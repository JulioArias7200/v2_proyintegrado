"""
Extractor de Documentos (PDF, DOCX, TXT) para el SMA Congreso
================================================================
Extrae texto limpio y metadatos (número de páginas, palabras, caracteres)
usando pdfplumber, pypdf y python-docx con fallbacks automáticos.
"""
import io
import os
from typing import Dict, Any, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("doc_extractor")


def extraer_texto_pdf(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Extrae texto de un archivo PDF en bytes.
    Intenta primero con pdfplumber y usa pypdf/PyPDF2 como fallback.
    """
    texto_completo = []
    num_paginas = 0

    # Intento 1: pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            num_paginas = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text()
                if txt:
                    texto_completo.append(txt)
        if texto_completo:
            resultado = "\n\n".join(texto_completo)
            return resultado, {
                "num_paginas": num_paginas,
                "motor": "pdfplumber",
                "caracteres": len(resultado),
                "palabras": len(resultado.split()),
            }
    except Exception as e:
        logger.warning(f"Fallo extracción con pdfplumber: {e}. Intentando con pypdf...")

    # Intento 2: pypdf / PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        num_paginas = len(reader.pages)
        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                texto_completo.append(txt)
        resultado = "\n\n".join(texto_completo)
        return resultado, {
            "num_paginas": num_paginas,
            "motor": "pypdf",
            "caracteres": len(resultado),
            "palabras": len(resultado.split()),
        }
    except Exception as e:
        logger.error(f"Fallo extracción con pypdf: {e}")
        return "", {"num_paginas": 0, "motor": "error", "error": str(e)}


def extraer_texto_docx(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """Extrae texto de un archivo DOCX en bytes."""
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        parrafos = [p.text for p in doc.paragraphs if p.text.strip()]
        resultado = "\n\n".join(parrafos)
        return resultado, {
            "num_paginas": 1,
            "motor": "python-docx",
            "caracteres": len(resultado),
            "palabras": len(resultado.split()),
        }
    except Exception as e:
        logger.error(f"Fallo extracción DOCX: {e}")
        return "", {"num_paginas": 0, "motor": "error", "error": str(e)}


def extraer_texto_archivo(filename: str, file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Función general para extraer texto de cualquier formato soportado (.pdf, .docx, .txt, .md).
    """
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".pdf":
        return extraer_texto_pdf(file_bytes)
    elif ext in [".docx", ".doc"]:
        return extraer_texto_docx(file_bytes)
    else:
        # Texto plano / Markdown
        try:
            texto = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                texto = file_bytes.decode("latin-1")
            except Exception:
                texto = str(file_bytes)
        return texto, {
            "num_paginas": 1,
            "motor": "plain_text",
            "caracteres": len(texto),
            "palabras": len(texto.split()),
        }
