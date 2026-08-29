"""
Estado Global del SMA Congreso (Reflex)
========================================
Gestiona todo el estado de la aplicación Reflex:
  - Carga y extracción de archivos PDF / DOCX / TXT
  - Flujo por etapas con Punto de Control / Botón de Alto Humano
  - Clasificación Distribuidor (Nivel 1) -> Aprobación -> Especialistas + Verificación Constitucional (Nivel 2)
  - Modales para visualización de artículos constitucionales y expedientes
  - Bus de mensajes y KPIs de MongoDB Atlas + PostgreSQL Neon
"""
import asyncio
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel
import reflex as rx

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("sma_state")

from sma_unified.utils.doc_extractor import extraer_texto_archivo
from sma_unified.config import settings
from sma_unified.db.neon_postgres import (
    obtener_articulos_constitucion,
    buscar_articulos_normativa_similares,
    obtener_articulos_normativos,
    buscar_articulos_normativos_semantico,
)


class AgentMessage(BaseModel):
    """Mensaje de comunicación entre agentes (para Reflex)."""
    task_id: str = ""
    sesion_id: str = ""
    timestamp: str = ""
    agente_origen: str = ""
    agente_destino: str = ""
    tipo_tarea: str = ""
    estado: str = "pendiente"
    duracion_ms: int = 0
    payload_preview: str = ""
    resultado_preview: str = ""
    error_detalle: str = ""


class ContradiccionItem(BaseModel):
    """Contradicción constitucional detectada."""
    articulo_proyecto: str = ""
    articulo_constitucional: str = ""
    texto_constitucional_verificado: str = ""
    fragmento_proyecto: str = ""
    severidad: str = ""
    fundamento: str = ""


class HallazgoConsistenciaItem(BaseModel):
    """Hallazgo de consistencia normativa (contra el corpus de leyes vigentes)."""
    articulo_candidato_id: int = 0
    articulo_proyecto: str = ""
    numero_articulo: str = ""
    norma: str = ""
    similitud: float = 0.0
    tipo_relacion: str = ""
    justificacion: str = ""
    sugerencia: str = ""


class ChatMessageCiudadano(BaseModel):
    """Mensaje individual del chat con el Agente de Interacción Ciudadana."""
    role: str = "user"       # 'user' | 'agente'
    content: str = ""


class DocumentoNormativoItem(BaseModel):
    """Fila resumen de un cuerpo normativo ya cargado en articulos_constitucion."""
    documento: str = ""
    tipo_documento: str = ""
    numero_norma: str = ""
    num_articulos: int = 0
    ultima_actualizacion: str = ""


class DocumentoItem(BaseModel):
    """Documento procesado (para la tabla de expedientes)."""
    expediente_id: str = ""
    nombre_archivo: str = ""
    tipo_entrada: str = ""
    texto_preview: str = ""
    categoria: str = ""
    agente_destino: str = ""
    comision: str = ""
    resumen: str = ""
    valido_constitucional: str = ""
    confianza: str = ""
    severidad_maxima: str = ""
    num_contradicciones: int = 0
    duracion_ms: int = 0
    fecha_ingreso: str = ""
    estado: str = ""
    id_proyecto_pg: str = ""
    solicitud_id_pg: str = ""


SYSTEM_PROMPT_CIUDADANA = """Eres la licenciada María Helena Choque, operadora del Agente de Interacción
Ciudadana de la Oficialía Mayor de la Cámara de Senadores del Estado Plurinacional de Bolivia.

Conversas por chat con un(a) ciudadano(a) que quiere presentar una petición, solicitud o queja ante
el Senado, o que tiene dudas sobre normativa vigente. Tu tarea:
1. Salúdalo con calidez y naturalidad, en tono institucional boliviano, cercano y humano (nunca robótico).
2. Ayúdalo a explicar con claridad cuál es su petición o motivo, haciendo preguntas breves si falta
   información (¿de qué trata su solicitud?, ¿a qué municipio o sector corresponde?, etc.).
3. Explica en lenguaje sencillo, si te lo preguntan, cómo funciona el trámite: que su petición se
   registra, se clasifica automáticamente y pasa al área correspondiente (Atención Ciudadana,
   Comisión Legislativa o Correspondencia, según el caso).
4. Si en el mensaje del sistema recibes un bloque "CONTEXTO NORMATIVO" con artículos de leyes o de la
   Constitución Política del Estado, úsalo para responder consultas legales del ciudadano: explica en
   lenguaje simple lo que dice la norma y SIEMPRE cita el cuerpo normativo y el número de artículo
   exacto (ej. "según el Artículo 14 de la Constitución Política del Estado..."). Si ese contexto no
   trae información suficiente para la consulta legal, dilo explícitamente en vez de inventar.
5. Cuando notes que el motivo de la petición ya está razonablemente claro, invítalo a completar el
   formulario breve que aparece debajo del chat (nombre, motivo y vía de recepción) y pulsar
   "Registrar y continuar" para formalizar el trámite. Si el ciudadano quiere adjuntar un documento
   (PDF/Word) como sustento, dile que puede hacerlo en la zona de carga que se habilita después.
6. No inventes números de expediente, fechas ni compromisos que no puedas verificar. No dés asesoría
   legal definitiva ni sustituyas a un abogado; aclara que es información general.
7. Responde siempre en español, en mensajes breves (máximo un par de párrafos cortos), como en un chat real.
"""


MAPA_TIPO_DOCUMENTO_NORMATIVA = {
    "Constitución": "constitucion",
    "Código": "codigo",
    "Ley": "ley",
    "Decreto": "decreto",
    "Resolución": "resolucion",
    "Proyecto de Ley": "proyecto_ley",
}


def _construir_contexto_legal_ciudadano(mensaje: str) -> Tuple[str, str]:
    """
    RAG real para el chat del Agente de Interacción Ciudadana:
    embebe la pregunta (NVIDIA) y busca artículos relevantes en la base Neon:
      - normativa.articulos          (corpus del Agente de Consistencia Normativa)
      - public.articulos_normativos  (códigos/leyes/decretos cargados desde "Base Legal":
        búsqueda semántica por embedding + respaldo por palabras clave)
      - public.articulos_constitucion (CPE, por palabras clave, sin tocar su esquema)
    Devuelve (bloque_contexto, texto_fuentes); ambos vacíos si no hay nada
    relevante o si algo falla (el chat sigue funcionando igual).
    """
    bloques: List[str] = []
    fuentes: List[str] = []
    emb = None
    try:
        from sma_unified.agents.embeddings_nvidia import embeber_pregunta
        emb = embeber_pregunta(mensaje)

        for art in buscar_articulos_normativa_similares(
            emb, umbral=settings.UMBRAL_CONSISTENCIA, top_k=settings.TOP_K_CONSISTENCIA
        ):
            bloques.append(f"[{art['norma']}] Art. {art['numero_articulo']}\n{art['texto']}")
            fuentes.append(f"{art['norma']} — Art. {art['numero_articulo']}")
    except Exception as e:
        logger.warning(f"Búsqueda semántica normativa (chat ciudadano) no disponible: {e}")

    try:
        if emb is not None:
            for art in buscar_articulos_normativos_semantico(emb, top_k=6, umbral=settings.UMBRAL_CONSISTENCIA):
                bloques.append(f"[{art['documento']}] Art. {art['numero']}\n{art['texto']}")
                fuentes.append(f"{art['documento']} — Art. {art['numero']}")
    except Exception as e:
        logger.warning(f"Búsqueda semántica en articulos_normativos (chat ciudadano) no disponible: {e}")

    try:
        for art in obtener_articulos_normativos(mensaje, limit=4):
            if art.get("texto"):
                referencia = f"{art.get('documento', '')} — Art. {art['numero']}"
                if referencia not in fuentes:
                    bloques.append(f"[{art.get('documento', '')}] Art. {art['numero']} — {art.get('titulo', '')}\n{art['texto']}")
                    fuentes.append(referencia)
    except Exception as e:
        logger.warning(f"Búsqueda por palabras clave en articulos_normativos (chat ciudadano) no disponible: {e}")

    try:
        for art in obtener_articulos_constitucion(mensaje, limit=4):
            if art.get("texto"):
                referencia = f"Constitución Política del Estado — Art. {art['numero']}"
                if referencia not in fuentes:
                    bloques.append(f"[Constitución Política del Estado] Art. {art['numero']} — {art.get('titulo', '')}\n{art['texto']}")
                    fuentes.append(referencia)
    except Exception as e:
        logger.warning(f"Búsqueda constitucional (chat ciudadano) no disponible: {e}")

    if not bloques:
        return "", ""
    return "\n\n---\n\n".join(bloques), ", ".join(fuentes)


class State(rx.State):
    # ── Conexión MongoDB / BD ───────────────────────────────────────────────
    mongo_conectado: bool = False
    mongo_error: str = ""

    # ── Upload & Extracción State ─────────────────────────────────────────
    upload_mode: str = "file"        # 'file' | 'text'
    upload_text: str = ""
    upload_filename: str = ""
    upload_filesize: str = ""
    upload_filepath: str = ""        # ruta local del archivo guardado
    extracted_pages: int = 0
    extracted_words: int = 0
    extracted_chars: int = 0
    is_file_loaded: bool = False
    auto_classify_after_upload: bool = False

    # ── Agente Interacción Ciudadana State ─────────────────────────────────
    ciudadano_nombre: str = ""
    ciudadano_motivo: str = ""
    ciudadano_recepcion: str = "Digital"  # 'Digital' | 'Física' | 'Oficialía'
    ciudadana_agente_respuesta: str = ""
    ciudadana_is_saving: bool = False
    ciudadana_guardado_ok: bool = False
    is_text_modal_open: bool = False

    # ── Chat conversacional real del Agente de Interacción Ciudadana ───────
    ciudadano_chat_history: List[ChatMessageCiudadano] = []
    ciudadano_chat_input: str = ""
    ciudadano_chat_loading: bool = False

    # ── Ingesta de Normativa Legal (Código Penal, Código de Minería, etc.) ─
    normativa_documento_nombre: str = ""
    normativa_tipo_documento: str = "Ley"
    normativa_numero_norma: str = ""
    normativa_upload_filename: str = ""
    normativa_texto_extraido: str = ""
    normativa_is_file_loaded: bool = False
    normativa_is_processing: bool = False
    normativa_process_step: str = ""
    normativa_resultado_texto: str = ""
    normativa_resultado_ok: bool = False
    normativa_documentos: List[DocumentoNormativoItem] = []

    @rx.var
    def sesion_id_short(self) -> str:
        """Primeros 8 caracteres del ID de sesión para mostrar en la UI."""
        return self.last_sesion_id[:8].upper() if self.last_sesion_id else ""

    # ── Pipeline & Stepper State ───────────────────────────────────────────
    # Steps: 1: Carga, 2: Clasificando N1, 3: 🛑 ALTO / Confirmación Humana, 4: Ejecutando N2, 5: Completado
    workflow_step: int = 1
    is_processing: bool = False
    process_step_text: str = ""
    process_error: str = ""

    # Datos intermediarios de Fase 1
    fase1_data: Dict[str, Any] = {}
    categoria_sugerida: str = ""
    categoria_seleccionada: str = ""
    justificacion_fase1: str = ""

    # ── Resultado Final Consolidado ────────────────────────────────────────
    last_result: Dict[str, Any] = {}
    last_categoria: str = ""
    last_comision: str = ""
    last_resumen: str = ""
    last_palabras_clave: List[str] = []
    last_valido: str = ""
    last_confianza: str = ""
    last_severidad: str = ""
    last_num_contradicciones: int = 0
    last_contradicciones: List[ContradiccionItem] = []
    last_fundamentacion: str = ""
    last_consistencia: List[HallazgoConsistenciaItem] = []
    last_num_hallazgos_consistencia: int = 0
    last_sesion_id: str = ""
    last_duracion_ms: int = 0
    show_result: bool = False

    # ── Modal de Artículo Constitucional ───────────────────────────────────
    selected_articulo: Dict[str, Any] = {}
    is_articulo_modal_open: bool = False

    # ── Modal de Detalle de Expediente ─────────────────────────────────────
    selected_expediente: DocumentoItem = DocumentoItem()
    is_expediente_modal_open: bool = False

    # ── Filtros de Expedientes ─────────────────────────────────────────────
    filtro_categoria: str = "TODOS"
    filtro_constitucional: str = "TODOS"

    # ── Visualización de mensajes entre agentes ───────────────────────────
    agent_messages: List[Dict[str, Any]] = []
    messages_loading: bool = False
    selected_sesion_id: str = ""
    sesion_messages: List[Dict[str, Any]] = []

    # ── KPIs del bus de mensajes ───────────────────────────────────────────
    kpi_total_mensajes: int = 0
    kpi_completados: int = 0
    kpi_en_proceso: int = 0
    kpi_errores: int = 0
    kpi_avg_ms: int = 0

    # ── Expedientes / Documentos ───────────────────────────────────────────
    documentos: List[DocumentoItem] = []


    # ── Tabs de navegación ─────────────────────────────────────────────────
    active_tab: str = "upload"     # upload | flujo | expedientes | atlas

    # ════════════════════════════════════════════════════════════════════════
    # MÉTODOS DE CARGA Y EXTRACCIÓN DE ARCHIVOS (PDF, DOCX, TXT)
    # ════════════════════════════════════════════════════════════════════════

    async def handle_upload_and_classify(self, files: list[rx.UploadFile]):
        """Handler especial que activa la bandera de clasificar y luego procesa la carga del documento."""
        self.auto_classify_after_upload = True
        return await self.handle_upload(files)

    async def handle_upload(self, files: list[rx.UploadFile]):
        """
        Guarda el archivo localmente (rápido, solo I/O de disco) SIN extraer
        su texto todavía. La extracción real (pdfplumber/Docling + refinamiento
        LLM, que puede tardar o incluso colgarse con algunos PDFs) se delega
        a `ejecutar_fase_1_clasificar`, que corre como tarea de fondo real de
        Reflex (`@rx.event(background=True)`) y ya tiene esa lógica resuelta
        de forma segura (ver más abajo — el mismo motor que procesa PDFs
        pesados sin problema en el resto de la app).
        Este handler DEBE seguir siendo un evento normal (no background):
        Reflex lo exige para el widget de carga de archivos (`rx.upload`).
        """
        if not files:
            # Antes esto retornaba en silencio: si `handle_upload_and_classify`
            # había dejado `auto_classify_after_upload=True`, esa bandera
            # quedaba "colgada" y además el usuario no se enteraba de que no
            # se seleccionó ningún archivo (ver FASE1 disparándose con estado
            # vacío). Ahora se limpia la bandera y se muestra un error visible.
            self.auto_classify_after_upload = False
            self.process_error = (
                "No se detectó ningún archivo seleccionado. Arrastra o elige un "
                "PDF/DOCX/TXT en el recuadro antes de clasificar."
            )
            self.is_processing = False
            return

        self.process_error = ""
        self.is_processing = True
        self.process_step_text = "Cargando archivo..."

        file = files[0]  # max_files=1
        upload_data = await file.read()
        filename = file.filename or "documento.pdf"
        size_kb = len(upload_data) / 1024
        size_str = f"{size_kb:.1f} KB" if size_kb < 1024 else f"{size_kb/1024:.2f} MB"

        # Guardar localmente (I/O de disco simple, siempre rápido — no necesita executor)
        upload_dir = settings.uploads_dir
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        try:
            with open(file_path, "wb") as f:
                f.write(upload_data)
        except Exception as e:
            self.process_error = f"No se pudo guardar el archivo: {e}"
            self.is_processing = False
            return

        # NO se extrae texto aquí. Se deja `upload_text` vacío a propósito:
        # `ejecutar_fase_1_clasificar` detecta ese caso (is_loaded=True,
        # texto vacío, filepath presente) y hace la extracción pesada en
        # segundo plano, sin bloquear la app.
        self.upload_text = ""
        self.upload_filename = filename
        self.upload_filesize = size_str
        self.upload_filepath = file_path
        self.is_file_loaded = True
        self.workflow_step = 1
        self.is_processing = False
        self.process_step_text = ""

        # Si el usuario solicitó clasificar, ejecuta la fase 1 de inmediato
        # (esa fase de fondo se encarga de extraer el texto primero).
        if self.auto_classify_after_upload:
            self.auto_classify_after_upload = False
            return State.ejecutar_fase_1_clasificar

    async def handle_upload_normativa(self, files: list[rx.UploadFile]):
        """Carga y extrae el texto de un PDF/DOCX de un cuerpo normativo (Código Penal,
        Código de Minería, una ley, etc.) para la pantalla de Ingesta de Normativa Legal."""
        if not files:
            return
        self.normativa_resultado_texto = ""
        self.normativa_process_step = "Extrayendo texto del documento..."
        self.normativa_is_processing = True

        file = files[0]
        data = await file.read()
        filename = file.filename or "documento.pdf"

        try:
            from sma_unified.utils.doc_extractor import extraer_texto_archivo
            texto, _meta = extraer_texto_archivo(filename, data)
            if not texto or len(texto.strip()) < 20:
                raise ValueError("El archivo no contiene texto extraíble legible.")
            self.normativa_texto_extraido = texto
            self.normativa_upload_filename = filename
            self.normativa_is_file_loaded = True
            if not self.normativa_documento_nombre.strip():
                # Sugerencia razonable a partir del nombre del archivo (el usuario puede editarla)
                self.normativa_documento_nombre = os.path.splitext(filename)[0].replace("_", " ").strip()
        except Exception as e:
            self.normativa_resultado_texto = f"❌ No se pudo extraer el texto del documento: {e}"
            self.normativa_resultado_ok = False
        finally:
            self.normativa_is_processing = False
            self.normativa_process_step = ""

    def clear_normativa_upload(self):
        """Limpia el formulario de ingesta de normativa."""
        self.normativa_documento_nombre = ""
        self.normativa_tipo_documento = "Ley"
        self.normativa_numero_norma = ""
        self.normativa_upload_filename = ""
        self.normativa_texto_extraido = ""
        self.normativa_is_file_loaded = False
        self.normativa_resultado_texto = ""
        self.normativa_resultado_ok = False

    def set_normativa_documento_nombre(self, val: str):
        self.normativa_documento_nombre = val

    def set_normativa_tipo_documento(self, val: str):
        self.normativa_tipo_documento = val

    def set_normativa_numero_norma(self, val: str):
        self.normativa_numero_norma = val

    @rx.event(background=True)
    async def ingestar_documento_normativo(self):
        """Corre el pipeline completo de ingesta (perfil LLM + parseo + embeddings + upsert)
        sobre el texto cargado, y lo guarda en public.articulos_constitucion."""
        async with self:
            if self.normativa_is_processing:
                return
            if not self.normativa_texto_extraido or not self.normativa_documento_nombre.strip():
                self.normativa_resultado_texto = "⚠️ Cargue un archivo y escriba el nombre del documento antes de ingestar."
                self.normativa_resultado_ok = False
                return
            documento = self.normativa_documento_nombre.strip()
            tipo_documento = MAPA_TIPO_DOCUMENTO_NORMATIVA.get(self.normativa_tipo_documento, "ley")
            numero_norma = self.normativa_numero_norma.strip() or None
            texto = self.normativa_texto_extraido
            self.normativa_is_processing = True
            self.normativa_process_step = f"Procesando '{documento}' (puede tardar varios minutos según el tamaño)..."
            self.normativa_resultado_texto = ""

        resumen: Dict[str, Any] = {}
        error_texto = ""
        try:
            loop = asyncio.get_event_loop()

            def _correr_ingesta():
                from sma_unified.agents.ingest_normativa import ingestar_texto_normativo
                return ingestar_texto_normativo(
                    texto, documento, tipo_documento=tipo_documento,
                    numero_norma=numero_norma, progress_cb=logger.info,
                )

            resumen = await loop.run_in_executor(None, _correr_ingesta)
        except Exception as e:
            logger.warning(f"Error en la ingesta normativa de '{documento}': {e}")
            error_texto = str(e)

        async with self:
            self.normativa_is_processing = False
            self.normativa_process_step = ""
            if error_texto:
                self.normativa_resultado_texto = f"❌ Error durante la ingesta: {error_texto}"
                self.normativa_resultado_ok = False
            elif not resumen or resumen.get("total_detectados", 0) == 0:
                self.normativa_resultado_texto = "⚠️ " + resumen.get("mensaje", "No se detectaron artículos en el documento.")
                self.normativa_resultado_ok = False
            else:
                aviso_huecos = ""
                if not resumen.get("confiable", True):
                    aviso_huecos = f" ⚠️ Posibles huecos de numeración detectados: {resumen.get('huecos')}."
                self.normativa_resultado_texto = (
                    f"✅ '{documento}' procesado: {resumen['total_detectados']} artículos detectados "
                    f"({resumen['derogados']} derogados) — {resumen['nuevos']} nuevos, "
                    f"{resumen['actualizados']} actualizados, {resumen['sin_cambios']} sin cambios, "
                    f"{resumen['errores']} con error." + aviso_huecos
                )
                self.normativa_resultado_ok = True

        await self._fetch_documentos_normativos()

    async def _fetch_documentos_normativos(self):
        try:
            from sma_unified.db.neon_postgres import listar_documentos_normativos
            loop = asyncio.get_event_loop()
            filas = await loop.run_in_executor(None, listar_documentos_normativos)
            async with self:
                self.normativa_documentos = [
                    DocumentoNormativoItem(
                        documento=f.get("documento", ""),
                        tipo_documento=f.get("tipo_documento") or "",
                        numero_norma=f.get("numero_norma") or "",
                        num_articulos=f.get("num_articulos", 0),
                        ultima_actualizacion=f.get("ultima_actualizacion", ""),
                    )
                    for f in filas
                ]
        except Exception as e:
            logger.warning(f"No se pudo cargar el listado de documentos normativos: {e}")

    @rx.event(background=True)
    async def cargar_documentos_normativos(self):
        """Carga el listado de cuerpos normativos ya ingestados (para la pantalla de Base Legal)."""
        await self._fetch_documentos_normativos()

    def clear_upload(self):
        """Limpia el archivo o texto cargado."""
        self.upload_filename = ""
        self.upload_filesize = ""
        self.upload_text = ""
        self.upload_filepath = ""
        self.extracted_pages = 0
        self.extracted_words = 0
        self.extracted_chars = 0
        self.is_file_loaded = False
        self.workflow_step = 1
        self.show_result = False
        self.process_error = ""
        self.fase1_data = {}

    def set_upload_mode(self, val: str):
        self.upload_mode = val
        self.process_error = ""

    def set_upload_text(self, val: str):
        self.upload_text = val
        self.extracted_chars = len(val)
        self.extracted_words = len(val.split())
        self.process_error = ""

    def set_active_tab(self, tab: str):
        self.active_tab = tab

    def set_ciudadano_nombre(self, val: str):
        self.ciudadano_nombre = val

    def set_ciudadano_motivo(self, val: str):
        self.ciudadano_motivo = val

    def set_ciudadano_recepcion(self, val: str):
        self.ciudadano_recepcion = val

    @rx.event
    def open_text_modal(self):
        self.is_text_modal_open = True

    @rx.event
    def close_text_modal(self):
        self.is_text_modal_open = False

    def set_categoria_seleccionada(self, cat: str):
        """Permite al usuario cambiar manualmente la categoría en el punto de alto."""
        self.categoria_seleccionada = cat

    # ── Ejemplos Rápidos ───────────────────────────────────────────────────
    def cargar_ejemplo_legislativo(self):
        self.upload_text = (
            "PROYECTO DE LEY N° 142/2026-2027\n"
            "LA ASAMBLEA LEGISLATIVA PLURINACIONAL,\n\n"
            "DECRETA:\n"
            "LEY DE FOMENTO A LAS ENERGÍAS RENOVABLES Y SOBERANÍA ENERGÉTICA\n\n"
            "Artículo 1. (Objeto). La presente Ley establece el marco normativo para la promoción, "
            "fomento, desarrollo y aprovechamiento de fuentes de energía renovable en todo el "
            "territorio del Estado Plurinacional, garantizando el acceso universal a servicios de energía.\n\n"
            "Artículo 2. (Principios). Son principios rectores la sostenibilidad ambiental, "
            "la soberanía sobre los recursos naturales, la solidaridad y la complementariedad social.\n\n"
            "Artículo 3. (Incentivos). Se declaran de prioridad nacional los proyectos de generación "
            "solar y eólica. Ningún monopolio privado podrá controlar la distribución energética.\n\n"
            "Artículo 4. (Régimen Transitorio). Las empresas adecuarán sus instalaciones en "
            "un plazo de 180 días desde la promulgación de la presente ley."
        )
        self.upload_filename = "Proyecto_Ley_Energias_Renovables.pdf"
        self.upload_filesize = "45.2 KB"
        self.extracted_pages = 2
        self.extracted_words = len(self.upload_text.split())
        self.extracted_chars = len(self.upload_text)
        self.is_file_loaded = True
        self.workflow_step = 1

    def cargar_ejemplo_ciudadano(self):
        self.upload_text = (
            "Señores Asamblea Legislativa Plurinacional — Cámara de Senadores,\n\n"
            "Me dirijo a ustedes, ciudadano Carlos Mamani Quispe, CI 7654321 LP, "
            "para presentar una petición formal respecto a la falta de servicios "
            "básicos en el Municipio de Viacha. Solicito respetuosamente que se "
            "gestione y priorice el acceso a agua potable y saneamiento básico para "
            "las comunidades rurales de nuestro sector.\n\n"
            "Adjunto evidencia fotográfica y firmas de 500 comunarios afectados.\n\n"
            "Atentamente,\nCarlos Mamani Quispe"
        )
        self.upload_filename = "Peticion_Ciudadana_Agua_Viacha.pdf"
        self.upload_filesize = "28.5 KB"
        self.extracted_pages = 1
        self.extracted_words = len(self.upload_text.split())
        self.extracted_chars = len(self.upload_text)
        self.is_file_loaded = True
        self.workflow_step = 1

    def cargar_ejemplo_oficio(self):
        self.upload_text = (
            "OFICIO Nº 2026-MIN-0341\n"
            "La Paz, 20 de agosto de 2026\n\n"
            "Señor Presidente de la Cámara de Senadores\n"
            "Asamblea Legislativa Plurinacional\n"
            "Presente.-\n\n"
            "Me dirijo a usted en su calidad de presidente del Senado, "
            "para comunicarle que el Ministerio de Economía y Finanzas Públicas "
            "remite para su conocimiento e informe el estado de ejecución presupuestaria "
            "correspondiente al segundo trimestre de la gestión 2026.\n\n"
            "Adjunto: Informe Técnico Institucional (38 fojas)\n\n"
            "Lic. Roberto Fernández Vargas\nMinistro de Economía y Finanzas Públicas"
        )
        self.upload_filename = "Oficio_Ministerio_Economia_Q2.pdf"
        self.upload_filesize = "62.0 KB"
        self.extracted_pages = 3
        self.extracted_words = len(self.upload_text.split())
        self.extracted_chars = len(self.upload_text)
        self.is_file_loaded = True
        self.workflow_step = 1

    # ════════════════════════════════════════════════════════════════════════
    # PIPELINE EN FASES CON PUNTO DE ALTO / INTERVENCIÓN HUMANA
    # ════════════════════════════════════════════════════════════════════════

    @rx.event(background=True)
    async def ejecutar_fase_1_clasificar(self):
        """
        FASE 1: Ejecuta el Agente Distribuidor (Nivel 1) y se DETIENE en el
        Punto de Control (Paso 3) para validación humana.
        """
        async with self:
            is_loaded = self.is_file_loaded
            text_empty = not self.upload_text.strip()
            filepath = self.upload_filepath
            filename = self.upload_filename

        logger.info(
            f"🔎 FASE1 check: is_loaded={is_loaded} text_empty={text_empty} "
            f"filepath={filepath!r} filename={filename!r}"
        )

        # ── Extracción con Docling (thread executor → no bloquea Reflex) ──────
        if is_loaded and text_empty and filepath:
            async with self:
                self.is_processing = True
                self.process_step_text = "📄 Procesando documento con Docling..."
                self.process_error = ""

            sesion_id = str(uuid.uuid4())

            try:
                loop = asyncio.get_event_loop()

                def _procesar():
                    with open(filepath, "rb") as f:
                        fb = f.read()
                    from sma_unified.utils.docling_processor import procesar_y_guardar
                    return procesar_y_guardar(filepath, filename, fb, sesion_id)

                # Límite de seguridad: algunos PDFs hacen que pdfplumber se
                # cuelgue sin lanzar ninguna excepción. Con timeout evitamos
                # que esta tarea de fondo quede viva para siempre (el hilo en
                # sí puede seguir corriendo hasta terminar solo, pero ya no
                # deja a este evento ni al usuario esperando indefinidamente).
                try:
                    texto_extraido, meta = await asyncio.wait_for(
                        loop.run_in_executor(None, _procesar), timeout=120
                    )
                except asyncio.TimeoutError as e:
                    raise TimeoutError(
                        f"La extracción de '{filename}' tardó más de 2 minutos y se canceló. "
                        "El PDF puede tener un formato que hace que pdfplumber se cuelgue. "
                        "Prueba con otro archivo o re-guarda este PDF con otra herramienta."
                    ) from e

                async with self:
                    self.upload_text = texto_extraido
                    self.extracted_pages = meta.get("num_paginas", 1)
                    self.extracted_words = meta.get("palabras", len(texto_extraido.split()))
                    self.extracted_chars = meta.get("caracteres", len(texto_extraido))
                    self.last_sesion_id = sesion_id
            except Exception as e:
                async with self:
                    self.process_error = f"No se pudo procesar el archivo: {e}"
                    self.is_processing = False
                return
            finally:
                async with self:
                    self.is_processing = False

        async with self:
            texto = self.upload_text.strip()
            if len(texto) < 25:
                if self.upload_mode == "file" and not self.upload_filepath:
                    # No es que el documento tenga poco texto: nunca se
                    # cargó ningún archivo (filepath vacío). Mensaje más
                    # claro que "texto muy corto", que confundía al usuario
                    # con un PDF que sí tenía contenido de sobra.
                    self.process_error = (
                        "No se cargó ningún archivo antes de clasificar. Selecciona "
                        "el PDF en el recuadro de arriba y esperá a que aparezca "
                        "'Archivo seleccionado' antes de presionar el botón."
                    )
                else:
                    self.process_error = "El texto es muy corto para clasificar (mínimo 25 caracteres)."
                self.is_processing = False
                return

            self.is_processing = True
            self.process_error = ""
            self.show_result = False
            self.workflow_step = 2
            self.process_step_text = "🤖 Agente Distribuidor analizando materia institucional..."

        await asyncio.sleep(0.3)

        try:
            from sma_unified.agents.pipeline import ejecutar_fase_1_clasificacion
            loop = asyncio.get_event_loop()

            async with self:
                nombre = self.upload_filename or "documento_ingresado"
                tipo_ent = "Archivo PDF/Doc" if self.upload_mode == "file" else "Texto Directo"
                paginas = self.extracted_pages
                palabras = self.extracted_words

            fase1_res = await loop.run_in_executor(
                None,
                lambda: ejecutar_fase_1_clasificacion(
                    texto_documento=texto,
                    nombre_archivo=nombre,
                    tipo_entrada=tipo_ent,
                    metadata_extra={"paginas": paginas, "palabras": palabras},
                ),
            )

            cat = fase1_res.get("categoria", "AGENTE_REGISTRO_LEGISLATIVO")

            async with self:
                self.fase1_data = fase1_res
                self.categoria_sugerida = cat
                self.categoria_seleccionada = cat
                self.selected_sesion_id = fase1_res.get("sesion_id", "")
                self.workflow_step = 3  # 🛑 ALTO / CONTROL HUMANO
                self.is_processing = False
                self.process_step_text = "🛑 Clasificación Nivel 1 lista — Esperando confirmación humana"

            # Actualizar mensajes de fondo
            await self._fetch_mensajes_recientes()

        except Exception as e:
            logger.error(f"Error en Fase 1: {e}")
            async with self:
                self.process_error = f"Error en clasificación: {str(e)}"
                self.is_processing = False
                self.workflow_step = 1

    @rx.event(background=True)
    async def continuar_fase_2_agentes(self):
        """
        FASE 2: El usuario autorizó continuar. Se ejecutan los agentes de
        Nivel 2 (Comisión + Auditoría Constitucional / Ciudadana / Correspondencia).
        """
        async with self:
            if not self.fase1_data:
                self.process_error = "No hay datos de clasificación previos."
                return

            self.is_processing = True
            self.process_error = ""
            self.workflow_step = 4
            self.process_step_text = "⚙️ Ejecutando Agentes de Nivel 2 y Auditoría Constitucional..."

        await asyncio.sleep(0.3)

        try:
            from sma_unified.agents.pipeline import ejecutar_fase_2_agentes
            import concurrent.futures
            loop = asyncio.get_event_loop()

            f1 = self.fase1_data
            cat_final = self.categoria_seleccionada or f1.get("categoria", "AGENTE_REGISTRO_LEGISLATIVO")

            # Mapear agente destino si el usuario cambió la categoría
            agente_map = {
                "AGENTE_REGISTRO_LEGISLATIVO": "Agente_Comision_Legislativa",
                "AGENTE_ATENCION_CIUDADANA": "Agente_Atencion_Ciudadana",
                "AGENTE_GESTION_CORRESPONDENCIA": "Agente_Gestion_Correspondencia",
            }
            agente_destino = agente_map.get(cat_final, f1.get("agente_destino_nombre", "Agente_Comision_Legislativa"))

            resultado = await loop.run_in_executor(
                None,
                lambda: ejecutar_fase_2_agentes(
                    sesion_id=f1["sesion_id"],
                    task_id_inicial=f1["task_id_inicial"],
                    task_id_distribuidor=f1["task_id_distribuidor"],
                    categoria=cat_final,
                    agente_destino_nombre=agente_destino,
                    texto_documento=self.upload_text,
                    nombre_archivo=self.upload_filename or "documento_ingresado",
                    tipo_entrada="Archivo PDF/Doc" if self.upload_mode == "file" else "Texto Directo",
                    id_proyecto=f1.get("id_proyecto"),
                    solicitud_id=f1.get("solicitud_id"),
                    local_filepath=self.upload_filepath or None,
                ),
            )

            # Actualizar resultado final
            cat = resultado.get("categoria", "")
            palabras = resultado.get("palabras_clave", [])
            valido = resultado.get("valido_constitucional")
            confianza = resultado.get("confianza_constitucional")

            async with self:
                self.last_result = resultado
                self.last_categoria = cat
                self.last_comision = resultado.get("comision_display", "")
                self.last_resumen = resultado.get("resumen", "")
                self.last_palabras_clave = palabras if isinstance(palabras, list) else []
                self.last_valido = (
                    "CONFORME" if valido is True
                    else "CONTRADICCIONES DETECTADAS" if valido is False
                    else "N/A"
                )
                self.last_confianza = f"{confianza:.0f}%" if confianza is not None else "N/A"
                self.last_severidad = resultado.get("severidad_maxima") or "ninguna"
                self.last_num_contradicciones = resultado.get("num_contradicciones", 0)
                raw_contradicciones = resultado.get("contradicciones", [])
                contradicciones_items = []
                if isinstance(raw_contradicciones, list):
                    for c in raw_contradicciones:
                        if isinstance(c, dict):
                            contradicciones_items.append(
                                ContradiccionItem(
                                    articulo_proyecto=str(c.get("articulo_proyecto", "")),
                                    articulo_constitucional=str(c.get("articulo_constitucional", "")),
                                    texto_constitucional_verificado=str(c.get("texto_constitucional_verificado", "")),
                                    fragmento_proyecto=str(c.get("fragmento_proyecto", "")),
                                    severidad=str(c.get("severidad", "ninguna")),
                                    fundamento=str(c.get("fundamento", "")),
                                )
                            )

                self.last_contradicciones = contradicciones_items

                raw_hallazgos_consistencia = resultado.get("hallazgos_consistencia", [])
                consistencia_items = []
                if isinstance(raw_hallazgos_consistencia, list):
                    for h in raw_hallazgos_consistencia:
                        if isinstance(h, dict):
                            consistencia_items.append(
                                HallazgoConsistenciaItem(
                                    articulo_candidato_id=int(h.get("articulo_candidato_id", 0) or 0),
                                    articulo_proyecto=str(h.get("articulo_proyecto", "")),
                                    numero_articulo=str(h.get("numero_articulo", "")),
                                    norma=str(h.get("norma", "")),
                                    similitud=float(h.get("similitud", 0.0) or 0.0),
                                    tipo_relacion=str(h.get("tipo_relacion", "")),
                                    justificacion=str(h.get("justificacion", "")),
                                    sugerencia=str(h.get("sugerencia", "")),
                                )
                            )
                self.last_consistencia = consistencia_items
                self.last_num_hallazgos_consistencia = int(resultado.get("num_hallazgos_consistencia", 0))

                self.last_fundamentacion = str(resultado.get("fundamentacion", ""))
                self.last_sesion_id = str(resultado.get("sesion_id", ""))
                self.last_duracion_ms = int(resultado.get("duracion_total_ms", 0))
                self.workflow_step = 5  # Completado
                self.is_processing = False
                self.show_result = True
                self.process_step_text = "✅ Dictamen emitido y archivado exitosamente"

            await self._fetch_mensajes_sesion()
            await self._fetch_mensajes_recientes()
            await self._fetch_kpis()
            await self._fetch_expedientes()

        except Exception as e:
            logger.error(f"Error en Fase 2: {e}")
            async with self:
                self.process_error = f"Error en ejecución Nivel 2: {str(e)}"
                self.is_processing = False
                self.workflow_step = 3

    def detener_proceso(self):
        """Botón de ALTO: Cancela la ejecución y reinicia al paso 1."""
        self.workflow_step = 1
        self.is_processing = False
        self.process_step_text = "✋ Proceso detenido por el operador."
        self.fase1_data = {}

    # ════════════════════════════════════════════════════════════════════════
    # MODALES Y DETALLES (ARTÍCULOS Y EXPEDIENTES)
    # ════════════════════════════════════════════════════════════════════════

    def open_articulo_modal(self, art: Dict[str, Any]):
        """Abre modal con el texto íntegro del artículo constitucional."""
        self.selected_articulo = art
        self.is_articulo_modal_open = True

    def close_articulo_modal(self):
        self.is_articulo_modal_open = False
        self.selected_articulo = {}

    def ver_detalle_expediente(self, doc: DocumentoItem):
        """Abre modal de inspección detallada de un expediente."""
        self.selected_expediente = doc
        self.is_expediente_modal_open = True

    def cerrar_detalle_expediente(self):
        self.is_expediente_modal_open = False
        self.selected_expediente = DocumentoItem()

    def set_filtro_categoria(self, val: str):
        self.filtro_categoria = val

    def set_filtro_constitucional(self, val: str):
        self.filtro_constitucional = val

    # ════════════════════════════════════════════════════════════════════════
    # ASYNC HELPERS INTERNOS PARA CARGA DE DATOS
    # ════════════════════════════════════════════════════════════════════════

    async def _fetch_mensajes_recientes(self):
        async with self:
            self.messages_loading = True
        try:
            from sma_unified.db.mongo_atlas import obtener_mensajes_recientes
            import concurrent.futures
            loop = asyncio.get_event_loop()
            msgs = await loop.run_in_executor(
                None, lambda: obtener_mensajes_recientes(limit=30)
            )
            async with self:
                self.agent_messages = msgs
                self.messages_loading = False
        except Exception as e:
            logger.error(f"Error cargando mensajes: {e}")
            async with self:
                self.messages_loading = False

    async def _fetch_mensajes_sesion(self):
        if not self.selected_sesion_id:
            return
        try:
            from sma_unified.db.mongo_atlas import obtener_mensajes_sesion
            import concurrent.futures
            loop = asyncio.get_event_loop()
            sid = self.selected_sesion_id
            msgs = await loop.run_in_executor(
                None, lambda: obtener_mensajes_sesion(sid)
            )
            async with self:
                self.sesion_messages = msgs
        except Exception as e:
            logger.error(f"Error cargando sesión: {e}")

    async def _fetch_kpis(self):
        try:
            from sma_unified.db.mongo_atlas import obtener_kpis_mongo
            import concurrent.futures
            loop = asyncio.get_event_loop()
            kpis = await loop.run_in_executor(None, obtener_kpis_mongo)
            async with self:
                self.kpi_total_mensajes = kpis.get("total_mensajes", 0)
                self.kpi_completados = kpis.get("completados", 0)
                self.kpi_en_proceso = kpis.get("en_proceso", 0)
                self.kpi_errores = kpis.get("errores", 0)
                self.kpi_avg_ms = kpis.get("avg_duracion_ms", 0)
        except Exception as e:
            logger.error(f"Error cargando KPIs: {e}")

    async def _fetch_expedientes(self):
        try:
            from sma_unified.db.mongo_atlas import obtener_documentos_recientes
            import concurrent.futures
            loop = asyncio.get_event_loop()
            raw_docs = await loop.run_in_executor(
                None, lambda: obtener_documentos_recientes(50)
            )
            parsed_docs = []
            for d in raw_docs:
                parsed_docs.append(
                    DocumentoItem(
                        expediente_id=str(d.get("expediente_id", "")),
                        nombre_archivo=str(d.get("nombre_archivo", "")),
                        tipo_entrada=str(d.get("tipo_entrada", "")),
                        texto_preview=str(d.get("texto_preview", "")),
                        categoria=str(d.get("categoria", "")),
                        agente_destino=str(d.get("agente_destino", "")),
                        comision=str(d.get("comision", "")),
                        resumen=str(d.get("resumen", "")),
                        valido_constitucional=str(d.get("valido_constitucional", "")),
                        confianza=str(d.get("confianza", "")),
                        severidad_maxima=str(d.get("severidad_maxima", "")),
                        num_contradicciones=int(d.get("num_contradicciones", 0) or 0),
                        duracion_ms=int(d.get("duracion_total_ms", 0) or 0),
                        fecha_ingreso=str(d.get("fecha_ingreso", "")),
                        estado=str(d.get("estado", "")),
                        id_proyecto_pg=str(d.get("id_proyecto_pg", "") or ""),
                        solicitud_id_pg=str(d.get("solicitud_id_pg", "") or ""),
                    )
                )
            async with self:
                self.documentos = parsed_docs
        except Exception as e:
            logger.error(f"Error cargando expedientes: {e}")

    # ════════════════════════════════════════════════════════════════════════
    # PUBLIC EVENT HANDLERS
    # ════════════════════════════════════════════════════════════════════════



    def set_ciudadano_chat_input(self, val: str):
        self.ciudadano_chat_input = val

    def on_key_chat_ciudadano(self, key: str):
        """Permite enviar el mensaje presionando Enter en el campo de chat."""
        if key == "Enter":
            return State.enviar_mensaje_ciudadano

    @rx.event(background=True)
    async def enviar_mensaje_ciudadano(self):
        """Chat real (no simulado) con el Agente de Interacción Ciudadana: RAG
        (embeddings NVIDIA + búsqueda pgvector/Neon sobre normativa y CPE) + LLM."""
        async with self:
            mensaje = self.ciudadano_chat_input.strip()
            if not mensaje or self.ciudadano_chat_loading:
                return
            self.ciudadano_chat_history.append(ChatMessageCiudadano(role="user", content=mensaje))
            self.ciudadano_chat_input = ""
            self.ciudadano_chat_loading = True
            historial_para_llm = [
                {"role": "user" if m.role == "user" else "assistant", "content": m.content}
                for m in self.ciudadano_chat_history
            ]

        respuesta_texto = ""
        try:
            loop = asyncio.get_event_loop()

            # 1) Recuperación (RAG) — corre en threadpool porque hace llamadas de red/DB síncronas
            contexto_legal, fuentes = await loop.run_in_executor(
                None, _construir_contexto_legal_ciudadano, mensaje
            )

            # 2) Generación con el LLM, con el contexto legal (si lo hay) inyectado
            from sma_unified.agents.llm_client import chat_completion_resiliente

            def _llamar_llm():
                mensajes = [{"role": "system", "content": SYSTEM_PROMPT_CIUDADANA}]
                mensajes.extend(historial_para_llm[-12:])  # ventana de contexto reciente
                if contexto_legal:
                    mensajes.append({
                        "role": "system",
                        "content": f"CONTEXTO NORMATIVO (artículos recuperados de la base legal):\n\n{contexto_legal}",
                    })
                contenido, _modelo = chat_completion_resiliente(
                    messages=mensajes, temperature=0.4, max_tokens=800,
                )
                return contenido

            respuesta_texto = await loop.run_in_executor(None, _llamar_llm)
            if fuentes:
                respuesta_texto += f"\n\n_Fuentes consultadas: {fuentes}_"
        except Exception as e:
            logger.warning(f"Error en chat del Agente de Interacción Ciudadana: {e}")
            respuesta_texto = (
                "Disculpe, tuve un inconveniente técnico para responder en este momento. "
                "¿Podría reformular su consulta o intentar nuevamente?"
            )

        async with self:
            self.ciudadano_chat_history.append(ChatMessageCiudadano(role="agente", content=respuesta_texto))
            self.ciudadano_chat_loading = False

    def limpiar_chat_ciudadano(self):
        """Reinicia la conversación del Agente de Interacción Ciudadana."""
        self.ciudadano_chat_history = []
        self.ciudadano_chat_input = ""

    @rx.event(background=True)
    async def interactuar_ciudadano(self):
        """El Agente de Interacción Ciudadana recibe datos, los registra en BD y activa el flujo."""
        async with self:
            if not self.ciudadano_nombre.strip():
                self.process_error = "Por favor, ingresa el nombre del ciudadano."
                return
            if not self.ciudadano_motivo.strip():
                self.process_error = "Por favor, especifica el motivo o petición."
                return
            
            self.ciudadana_is_saving = True
            self.process_error = ""
            self.ciudadana_guardado_ok = False
            self.ciudadana_agente_respuesta = "🤖 Agente de Interacción Ciudadana conectando con bases de datos..."
        
        await asyncio.sleep(0.8)
        
        sesion_id = str(uuid.uuid4())
        sol_id = None
        task_id = None
        respuesta_texto = ""
        success = False
        error_msg = ""

        try:
            from sma_unified.db.neon_postgres import guardar_solicitud_documento
            from sma_unified.db.mongo_atlas import publicar_mensaje, marcar_completado
            loop = asyncio.get_event_loop()
            
            # 1. Guardar la petición inicial en Neon PG
            sol_id = await loop.run_in_executor(
                None,
                lambda: guardar_solicitud_documento(
                    sesion_id=sesion_id,
                    texto_documento=f"Nombre Ciudadano: {self.ciudadano_nombre}\nMotivo: {self.ciudadano_motivo}\nRecepción: {self.ciudadano_recepcion}",
                    tipo_entrada="Formulario de Interacción",
                    nombre_archivo="recepcion_interaccion_ciudadana.txt",
                    origen=f"Atención Ciudadana - {self.ciudadano_nombre}"
                )
            )
            
            # 2. Publicar en MongoDB Atlas como canal de comunicación del agente
            task_id = await loop.run_in_executor(
                None,
                lambda: publicar_mensaje(
                    agente_origen="Usuario",
                    agente_destino="Agente_Atencion_Ciudadana",
                    tipo_tarea="Intercambio / Recepción de Interacción Ciudadana",
                    payload={
                        "ciudadano": self.ciudadano_nombre,
                        "motivo": self.ciudadano_motivo,
                        "recepcion_modo": self.ciudadano_recepcion,
                        "solicitud_id_pg": sol_id,
                    },
                    sesion_id=sesion_id,
                )
            )
            
            # 3. Generar mensaje de confirmación interactiva de forma natural mediante LLM
            try:
                from openai import OpenAI
                client = OpenAI(
                    api_key=settings.NVIDIA_API_KEY,
                    base_url=settings.NVIDIA_BASE_URL,
                )
                
                prompt_agente = (
                    "Eres la licenciada María Helena Choque, operadora del Agente de Interacción Ciudadana de la Cámara de Senadores de Bolivia.\n"
                    "Tu trabajo es responder al ciudadano con amabilidad, calidez y naturalidad, como una persona real del Senado que conoce el flujo legislativo.\n"
                    "Confírmale de manera cordial que has registrado con éxito su trámite en el sistema y que sus datos de contacto ya están sincronizados en PostgreSQL Neon y MongoDB Atlas.\n"
                    "Indícales que el siguiente paso es adjuntar su proyecto de ley o sustento técnico en formato PDF en la sección que se habilitará abajo, para que podamos clasificarlo electrónicamente.\n\n"
                    "Datos del Trámite Ciudadano:\n"
                    f"- Nombre del remitente: {self.ciudadano_nombre}\n"
                    f"- Motivo / Petición: {self.ciudadano_motivo}\n"
                    f"- Canal de recepción: {self.ciudadano_recepcion}\n"
                    f"- Código Único de Seguimiento: {sesion_id[:8].upper()}\n\n"
                    "Escribe un mensaje fluido, en primera persona, con tono institucional boliviano, natural y acogedor. No uses formatos rígidos ni robóticos."
                )
                
                response = client.chat.completions.create(
                    model=settings.LLM_MODEL_CREW, # nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
                    messages=[
                        {"role": "system", "content": "Eres una servidora pública real del Senado boliviano, muy atenta y profesional."},
                        {"role": "user", "content": prompt_agente}
                    ],
                    temperature=0.6,
                    max_tokens=600,
                )
                respuesta_texto = response.choices[0].message.content
            except Exception as e_llm:
                logger.warning(f"Error llamando al LLM en interactuar_ciudadano: {e_llm}")
                respuesta_texto = (
                    f"🏛️ **Oficialía Mayor — Cámara de Senadores**\n\n"
                    f"Estimado(a) **{self.ciudadano_nombre}**, se ha completado el registro de su solicitud "
                    f"bajo el código de seguimiento **{sesion_id[:8].upper()}**.\n\n"
                    f"**Petición**: *{self.ciudadano_motivo}*\n"
                    f"**Vía**: {self.ciudadano_recepcion}\n\n"
                    "Los datos se sincronizaron en las bases de datos. Por favor, adjunte su documento PDF a continuación."
                )
            
            await loop.run_in_executor(
                None,
                lambda: marcar_completado(task_id, resultado={"respuesta": respuesta_texto})
            )
            success = True
        except Exception as e:
            error_msg = str(e)

        async with self:
            if success:
                self.ciudadana_agente_respuesta = respuesta_texto
                self.ciudadano_chat_history.append(ChatMessageCiudadano(role="agente", content=respuesta_texto))
                self.ciudadana_guardado_ok = True
                self.last_sesion_id = sesion_id
                # Resetear el modo de carga a 'file' para que aparezca el dropzone limpio
                self.upload_mode = "file"
                self.upload_text = ""
                self.is_file_loaded = False
                self.upload_filename = ""
                self.workflow_step = 1
            else:
                self.process_error = f"Error de base de datos / agente: {error_msg}"
                self.ciudadana_agente_respuesta = "❌ No se pudo registrar en la base de datos debido a un error."
                self.ciudadano_chat_history.append(
                    ChatMessageCiudadano(role="agente", content="❌ No se pudo registrar en la base de datos debido a un error.")
                )
            self.ciudadana_is_saving = False

        # Refrescar listas (fuera de los bloques async con self mutables)
        await self._fetch_mensajes_recientes()
        await self._fetch_expedientes()

    @rx.event(background=True)
    async def cargar_mensajes_recientes(self):
        """Carga los mensajes más recientes del bus de agentes."""
        await self._fetch_mensajes_recientes()

    @rx.event(background=True)
    async def cargar_mensajes_sesion(self):
        """Carga mensajes de la sesión seleccionada."""
        await self._fetch_mensajes_sesion()

    @rx.event(background=True)
    async def cargar_kpis(self):
        """Carga KPIs del bus de mensajes MongoDB Atlas."""
        await self._fetch_kpis()

    @rx.event(background=True)
    async def cargar_expedientes(self):
        """Carga expedientes procesados desde MongoDB Atlas."""
        await self._fetch_expedientes()

    @rx.event(background=True)
    async def verificar_conexion_mongo(self):
        """Verifica la conexión a MongoDB Atlas al iniciar."""
        try:
            from sma_unified.db.mongo_atlas import ping_mongo
            import concurrent.futures
            loop = asyncio.get_event_loop()
            ok = await loop.run_in_executor(None, ping_mongo)
            async with self:
                self.mongo_conectado = ok
                self.mongo_error = "" if ok else "No se pudo conectar a MongoDB Atlas"
        except Exception as e:
            async with self:
                self.mongo_conectado = False
                self.mongo_error = str(e)

    def on_load(self):
        """Inicializa datos al cargar la aplicación."""
        return [
            State.verificar_conexion_mongo,
            State.cargar_mensajes_recientes,
            State.cargar_kpis,
            State.cargar_expedientes,
            State.cargar_documentos_normativos,
        ]

