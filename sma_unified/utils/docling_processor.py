"""
Procesador de Documentos con Docling
=====================================
Usa Docling (IBM Research) para convertir PDF/DOCX a texto Markdown estructurado.
- Pipeline rapido: EasyOCR desactivado (do_ocr=False) — listo en segundos
- Guarda el documento en MongoDB Atlas coleccion 'documentos_raw'
- Fallback automatico a pdfplumber si Docling no esta instalado
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("docling_processor")


# Coleccion Mongo donde se guardan los docs extraidos
COLECCION = "documentos_raw"


def _extraer_con_docling(file_path: str) -> Tuple[str, Dict[str, Any]]:
    """
    Extrae texto de un archivo local usando Docling.
    Pipeline rapido: sin OCR pesado, solo extraccion textual nativa del PDF.
    Retorna (texto_markdown, metadata_dict).
    """
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    pipeline_opts = PdfPipelineOptions()
    pipeline_opts.do_ocr = False               # desactiva EasyOCR (lento)
    pipeline_opts.do_table_structure = False   # sin analisis de tablas

    converter = DocumentConverter(
        format_options={
            "pdf": PdfFormatOption(pipeline_options=pipeline_opts)
        }
    )

    result = converter.convert(file_path)
    doc = result.document

    texto_md = doc.export_to_markdown()
    num_paginas = len(doc.pages) if hasattr(doc, "pages") else 1
    palabras = len(texto_md.split())

    return texto_md, {
        "motor": "docling",
        "num_paginas": num_paginas,
        "palabras": palabras,
        "caracteres": len(texto_md),
    }


def _extraer_fallback(filename: str, file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """Fallback con pdfplumber/PyPDF2 si Docling no esta disponible."""
    from sma_unified.utils.doc_extractor import extraer_texto_archivo
    return extraer_texto_archivo(filename, file_bytes)


def _refinar_con_llm(texto_crudo: str, filename: str) -> str:
    """Usa la API de LLM (NVIDIA NIM) para estructurar y limpiar el texto crudo en Markdown."""
    from sma_unified.config import settings
    if not settings.NVIDIA_API_KEY:
        logger.warning("NVIDIA_API_KEY no configurada. Saltando refinamiento LLM.")
        return texto_crudo

    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=settings.NVIDIA_API_KEY,
            base_url=settings.NVIDIA_BASE_URL,
            timeout=45.0,  # evita que una API lenta/caída cuelgue el procesamiento por minutos
        )
        
        # Limitar a los primeros 15000 caracteres para llamadas rápidas y eficientes
        muestra_texto = texto_crudo[:15000]
        
        prompt = (
            "Eres el Agente de Interacción y Digitalización de la Cámara de Senadores de Bolivia.\n"
            "Tu tarea es limpiar y estructurar en formato Markdown limpio el siguiente texto extraído de un PDF.\n"
            "Corrige cortes de palabras extraños, arregla la estructura de títulos (H1, H2, H3), "
            "párrafos y listas. Asegúrate de no alterar el significado de las leyes ni del texto legal.\n"
            "Retorna exclusivamente el documento limpio en Markdown, sin preámbulos, explicaciones ni bloques de código adicionales.\n\n"
            f"--- ARCHIVO: {filename} ---\n\n"
            f"{muestra_texto}"
        )
        
        logger.info(f"Refinando texto del documento '{filename}' con modelo LLM en la nube...")
        response = client.chat.completions.create(
            model=settings.LLM_MODEL_CREW, # nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
            messages=[
                {"role": "system", "content": "Eres un transcriptor legislativo experto que genera exclusivamente código Markdown estructurado y limpio."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=4000,
        )
        
        texto_refinado = response.choices[0].message.content
        if texto_refinado and len(texto_refinado.strip()) > 50:
            # Si el documento original era más largo de lo que enviamos de muestra, agregamos el resto sin refinar
            if len(texto_crudo) > 15000:
                texto_refinado += "\n\n---\n*Nota: El texto restante se adjunta en bruto debido a límites de contexto.*\n\n" + texto_crudo[15000:]
            return texto_refinado
    except Exception as e:
        logger.warning(f"Error al refinar texto con LLM: {e}. Retornando texto crudo.")
    
    return texto_crudo


def procesar_y_guardar(
    file_path: str,
    filename: str,
    file_bytes: bytes,
    sesion_id: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Procesa el archivo con pdfplumber y lo refina usando modelos LLM en la nube,
    guardando el resultado estructurado en MongoDB.

    Args:
        file_path:   Ruta local donde ya esta guardado el archivo.
        filename:    Nombre original del archivo.
        file_bytes:  Bytes del archivo.
        sesion_id:   ID de sesion del pipeline (opcional).

    Returns:
        (texto_extraido, metadata) — texto listo para los agentes LLM.
    """
    # 1. Extraccion rapida e instantanea con pdfplumber / PyPDF2
    texto, meta = "", {}
    try:
        logger.info(f"Intentando extraccion rapida con pdfplumber para '{filename}'...")
        texto, meta = _extraer_fallback(filename, file_bytes)
        if texto and len(texto.strip()) >= 25:
            logger.info(
                f"Extraccion rapida exitosa '{filename}' -> "
                f"{meta.get('num_paginas', 1)} pags, {meta.get('palabras', 0)} palabras"
            )
            # 2. Refinamiento en la nube con LLMs
            texto = _refinar_con_llm(texto, filename)
            meta["motor"] = "llm-refiner-pdf"
            meta["palabras"] = len(texto.split())
            meta["caracteres"] = len(texto)
        else:
            raise ValueError("Texto extraido es demasiado corto o vacio.")
    except Exception as e:
        logger.warning(f"Extraccion rapida fallo o vacia ({e}) — usando fallback basico")
        texto, meta = _extraer_fallback(filename, file_bytes)
        meta["motor"] = "pdfplumber-raw"

    # 2. Guardar en MongoDB (no bloquea si falla)
    doc_id = str(uuid.uuid4())
    try:
        from sma_unified.db.mongo_atlas import get_db
        db = get_db()
        sid = sesion_id or str(uuid.uuid4())
        doc_mongo = {
            "doc_id":      doc_id,
            "sesion_id":   sid,
            "filename":    filename,
            "file_path":   file_path,
            # Antes se truncaba a 50,000 caracteres — una ley de 30-40 páginas
            # como una Ley de Inversiones puede rondar 120,000 caracteres, así
            # que quedaba guardada cortada a la mitad. MongoDB admite
            # documentos de hasta 16 MB, así que 500,000 caracteres (~0.5 MB)
            # da margen de sobra para leyes largas sin arriesgar el límite.
            "texto":       texto[:500_000],
            "motor":       meta.get("motor", "desconocido"),
            "num_paginas": meta.get("num_paginas", 0),
            "palabras":    meta.get("palabras", 0),
            "caracteres":  meta.get("caracteres", 0),
            "estado":      "extraido",
            "timestamp":   datetime.now(timezone.utc),
        }
        db[COLECCION].replace_one(
            {"filename": filename, "sesion_id": sid},
            doc_mongo,
            upsert=True,
        )
        meta["doc_id"] = doc_id
        logger.info(
            f"Documento guardado en MongoDB '{COLECCION}' | "
            f"doc_id={doc_id[:8]}..."
        )
    except Exception as e:
        logger.warning(f"No se pudo guardar en MongoDB: {e} (continuando sin BD)")

    return texto, meta


def actualizar_estado_documento(
    doc_id: str,
    estado: str,
    resultado: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Actualiza el estado del documento en MongoDB tras el procesamiento por agentes.
    estados: 'extraido' | 'clasificado' | 'procesado' | 'error'
    """
    try:
        from sma_unified.db.mongo_atlas import get_db
        db = get_db()
        update: Dict[str, Any] = {
            "$set": {
                "estado": estado,
                "fecha_actualizacion": datetime.now(timezone.utc),
            }
        }
        if resultado:
            update["$set"]["resultado_agentes"] = resultado
        db[COLECCION].update_one({"doc_id": doc_id}, update)
    except Exception as e:
        logger.warning(f"No se pudo actualizar estado en MongoDB: {e}")
