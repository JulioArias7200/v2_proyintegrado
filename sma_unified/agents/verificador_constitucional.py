"""
Agente Verificador de Constitucionalidad (CPE)  — v3
======================================================
Módulo INDEPENDIENTE que analiza un proyecto de ley contra la
Constitución Política del Estado de Bolivia (CPE).

Fuente de datos: sistema.articulos_constitucion (Neon PostgreSQL + pgvector)

Pipeline Prometheus v3 — ANÁLISIS PROFUNDO:
  1. Genera embedding del texto del proyecto (NVIDIA NIM).
  2. Recupera artículos CPE (TOP_K = 18, umbral 0.40) con doble consulta semántica.
  3. Fase A — Cribado rápido paralelo (tokens mínimos 220):
       descarta neutrales evidentes sin segunda llamada LLM.
  4. Fase B — Deep-check (candidatos no-NEUTRAL):
       árbol de decisión + citas literales obligatorias.
  5. Fase C — Análisis profundo POR HALLAZGO (EN_CONTRA y RAF):
       - impacto_juridico: descripción del impacto en el ordenamiento (≤100 palabras).
       - argumento_constitucional: argumento jurídico detallado (≤120 palabras).
       - argumento_defensa: contraargumento posible del proyecto (≤80 palabras).
       - articulos_cpe_relacionados: otros artículos CPE que refuerzan el hallazgo.
       - redaccion_corregida: texto alternativo concreto para resolver la contradicción.
       - precedentes_tcp: menciona si el TCP ha resuelto casos similares.
       - dictamen: veredicto jurídico formal (INCONSTITUCIONAL/CONDICIONALMENTE_CONSTITUCIONAL/
                   CONSTITUCIONAL/REQUIERE_CONSULTA_TCP).
  6. Genera resumen_ejecutivo enriquecido:
       nivel_riesgo (BLOQUEANTE/ALTO/MEDIO/BAJO/NINGUNO)
       score_confianza calibrado (30-98 %)
       score_cobertura_cpe_pct
       matriz_riesgo: tabla por artículo con dictamen y severidad
       recomendaciones_globales con emojis de prioridad
  7. Persiste dictamen en Neon PostgreSQL y MongoDB Atlas.
  8. Genera correcciones automáticas detalladas para Mesa Senadores y autor.

Mejoras v3 respecto a v2:
  - Nueva Fase C de análisis narrativo profundo por cada hallazgo crítico.
  - TOP_K ampliado a 18 artículos CPE, umbral bajado a 0.40.
  - Max tokens deep-check aumentados a 900 para citas extendidas.
  - Campo redaccion_corregida: sugerencia concreta de texto legislativo.
  - Campo argumento_constitucional + argumento_defensa para visión bilateral.
  - Campo precedentes_tcp para referencias jurisprudenciales.
  - Campo dictamen formal por artículo analizado.
  - Matriz de riesgo por artículo en resumen_ejecutivo.
  - Cada contradicción y RAF se enriquece con análisis_profundo completo.
"""
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("verificador_constitucional")

from sma_unified.config import settings
from sma_unified.agents.llm_client import chat_completion_auditoria, extraer_json_de_llm
from sma_unified.agents.embeddings_nvidia import embeber_pregunta
from sma_unified.db.mongo_atlas import publicar_mensaje, marcar_en_proceso, marcar_completado, marcar_error
from sma_unified.db.neon_postgres import (
    obtener_articulos_constitucion,
    guardar_observacion_constitucional,
    guardar_correccion_proyecto,
    obtener_email_autor_proyecto,
)

# ── Constantes ────────────────────────────────────────────────────────────────
TOP_K_CPE             = 18    # Artículos CPE a recuperar (ampliado a 18 para mayor cobertura)
UMBRAL_CPE            = 0.40  # Similitud mínima (más permisivo → mayor cobertura)
MAX_CHARS_BLOQUE      = 2500  # Chars máximos para embedding
MAX_TOKENS_CRIBA      = 220   # Fase A: cribado rápido (JSON compacto)
MAX_TOKENS_DEEPCHECK  = 900   # Fase B: deep-check con citas extendidas
MAX_TOKENS_ANALISIS   = 1400  # Fase C: análisis profundo por hallazgo
MAX_CHARS_CPE_TEXTO   = 800   # Texto CPE enviado al LLM (completo)
MAX_CHARS_PROYECTO    = 3500  # Texto proyecto enviado al LLM
MAX_CHARS_PROYECTO_C  = 2000  # Chars proyecto en Fase C (contexto focalizado)

# ── Prompts reutilizables ─────────────────────────────────────────────────────

_SISTEMA_CRIBA = (
    "Eres un filtro lógico determinista de constitucionalidad boliviana. "
    "Clasifica la relación entre el artículo CPE y el fragmento del proyecto de ley. "
    "NO interpretes, NO pongas, NO infieras intención. Solo texto literal.\n\n"
    "REGLA RÁPIDA (aplica la primera que coincida):\n"
    "1. ¿El proyecto PERMITE u ORDENA algo que el CPE PROHÍBE, o viceversa? → EN_CONTRA\n"
    "2. ¿El proyecto OMITE una obligación que el CPE IMPONE expresamente? → EN_CONTRA\n"
    "3. ¿El proyecto desarrolla o garantiza lo que el CPE manda? → A_FAVOR\n"
    "4. ¿La tensión requiere ponderar valores en conflicto? → RAF\n"
    "5. Sin colisión directa → NEUTRAL\n\n"
    "SALIDA: JSON mínimo de una línea, sin markdown:\n"
    '{"c":"A_FAVOR|EN_CONTRA|NEUTRAL|RAF","s":"bloqueante|grave|leve|ninguna","ok":true|false}'
)

_SISTEMA_DEEPCHECK = (
    "ROL: filtro lógico determinista de constitucionalidad boliviana (CPE 2009).\n"
    "FUENTE ÚNICA DE VERDAD: texto literal del artículo CPE y del proyecto. "
    "Lo que no esté copiado textualmente NO EXISTE.\n\n"
    "PROHIBICIONES ABSOLUTAS:\n"
    "- Prohibido inferir 'espíritu', 'finalidad' o 'intención' de la norma.\n"
    "- Prohibido citar artículos, incisos o frases que no estén en el input.\n"
    "- Prohibido usar conocimiento constitucional externo.\n"
    "- Prohibido emitir juicio de constitucionalidad de fondo.\n"
    "- Prohibido parafrasear citas: deben ser copia literal.\n\n"
    "ÁRBOL DE DECISIÓN (aplica en orden, la primera que coincida gana):\n"
    "1) ¿Proyecto PERMITE/ORDENA algo que CPE PROHÍBE, o viceversa? "
    "→ EN_CONTRA (bloqueante=derecho fundamental; grave=competencia/procedimiento; leve=formal)\n"
    "2) ¿Proyecto OMITE obligación que CPE IMPONE expresamente? → EN_CONTRA\n"
    "3) ¿Proyecto contradice jerarquía normativa o competencia citada en el artículo? → EN_CONTRA\n"
    "4) ¿Proyecto desarrolla, reglamenta o garantiza lo que CPE manda? → A_FAVOR\n"
    "5) ¿La tensión exige ponderar derechos o valores en conflicto? → REQUIERE_ANALISIS_DE_FONDO\n"
    "6) En cualquier otro caso → NEUTRAL\n\n"
    "REGLA DE ORO: si NO puedes copiar literalmente 'cita_proyecto' Y 'cita_constitucional' "
    "desde el input, la clasificación DEBE ser NEUTRAL y 'verificado'=false.\n\n"
    "SALIDA: SOLO JSON válido, sin markdown:\n"
    '{"clasificacion":"A_FAVOR|EN_CONTRA|NEUTRAL|REQUIERE_ANALISIS_DE_FONDO",'
    '"fundamento":"descripcion precisa <=80 palabras citando la regla aplicada (1-6)",'
    '"severidad":"bloqueante|grave|leve|ninguna",'
    '"cita_proyecto":"fragmento LITERAL del proyecto (vacío si NEUTRAL)",'
    '"cita_constitucional":"fragmento LITERAL del artículo CPE",'
    '"tipo_colision":"prohibicion_vs_permiso|omision_obligacion|jerarquia|desarrollo|ponderacion|ninguna",'
    '"recomendacion":"accion concreta <=60 palabras",'
    '"verificado":true|false}'
)

_SISTEMA_ANALISIS_PROFUNDO = (
    "Eres un jurista constitucionalista boliviano de primer nivel, experto en la CPE 2009 y "
    "en el Tribunal Constitucional Plurinacional (TCP). Tu tarea es elaborar un ANÁLISIS "
    "JURÍDICO COMPLETO Y DETALLADO de la relación entre el artículo CPE indicado y el "
    "fragmento del proyecto de ley.\n\n"
    "Contexto: se te provee la clasificación previa (EN_CONTRA o REQUIERE_ANALISIS_DE_FONDO) "
    "y las citas literales ya extraídas. Profundiza en los siguientes aspectos:\n\n"
    "ANÁLISIS REQUERIDO (responde TODOS los campos):\n"
    "1. impacto_juridico: ¿Qué consecuencia jurídica concreta tendría aprobar el proyecto "
    "   con esta disposición? ¿A qué sujetos afecta y cómo? (≤120 palabras)\n"
    "2. argumento_constitucional: Argumentación formal para sostener la contradicción/tensión. "
    "   Cita el tipo de norma constitucional afectada (derecho fundamental, garantía, "
    "   principio, competencia). (≤140 palabras)\n"
    "3. argumento_defensa: ¿Qué argumento podría usar el legislador para defender el "
    "   proyecto y por qué no resulta suficiente desde la perspectiva constitucional? "
    "   (≤100 palabras)\n"
    "4. articulos_cpe_relacionados: Lista de otros artículos CPE que refuerzan o modulan "
    "   el hallazgo (solo artículos que razonablemente existan en la CPE 2009, ej: "
    "   ['13', '14', '115']). Si no hay, lista vacía.\n"
    "5. redaccion_corregida: Texto alternativo CONCRETO que reemplazaría el fragmento "
    "   del proyecto para resolver la contradicción y cumplir la CPE. Debe ser redacción "
    "   legislativa formal boliviana. (≤120 palabras)\n"
    "6. precedentes_tcp: ¿El TCP ha resuelto casos similares? Menciona la sentencia "
    "   constitucional más probable (ej: SC 0064/2004) o indica 'Sin precedente conocido'. "
    "   (≤60 palabras)\n"
    "7. dictamen: Veredicto jurídico formal del artículo analizado.\n"
    "   Opciones: INCONSTITUCIONAL | CONDICIONALMENTE_CONSTITUCIONAL | "
    "   CONSTITUCIONAL | REQUIERE_CONSULTA_TCP\n"
    "8. nivel_urgencia_correccion: INMEDIATA | ANTES_DEBATE_COMISION | "
    "   ANTES_SEGUNDA_LECTURA | RECOMENDADA | NO_REQUERIDA\n\n"
    "IMPORTANTE: basa todo en los textos literales provistos. No inventes precedentes. "
    "Si no hay precedente conocido, di exactamente 'Sin precedente conocido'.\n\n"
    "SALIDA: JSON válido con exactamente estos campos, sin markdown:\n"
    '{"impacto_juridico":"...",'
    '"argumento_constitucional":"...",'
    '"argumento_defensa":"...",'
    '"articulos_cpe_relacionados":["..."],'
    '"redaccion_corregida":"...",'
    '"precedentes_tcp":"...",'
    '"dictamen":"INCONSTITUCIONAL|CONDICIONALMENTE_CONSTITUCIONAL|CONSTITUCIONAL|REQUIERE_CONSULTA_TCP",'
    '"nivel_urgencia_correccion":"INMEDIATA|ANTES_DEBATE_COMISION|ANTES_SEGUNDA_LECTURA|RECOMENDADA|NO_REQUERIDA"}'
)

_SISTEMA_ANALISIS_AFAVOR = (
    "Eres un jurista constitucionalista boliviano de primer nivel, redactor y asesor de la Asamblea "
    "Legislativa Plurinacional, experto en la CPE 2009 y la jurisprudencia del TCP. "
    "Tu tarea es elaborar una JUSTIFICACIÓN DETALLADA Y EXHAUSTIVA de por qué el proyecto de ley es "
    "CONFORME y se encuentra A FAVOR del artículo de la Constitución Política del Estado (CPE) evaluado.\n\n"
    "METODOLOGÍA DE EVALUACIÓN (debes evaluar PÁRRAFO POR PÁRRAFO Y ARTÍCULO POR ARTÍCULO):\n"
    "1. justificacion_por_que: Fundamentación jurídica detallada y rigurosa explicando el POR QUÉ "
    "   este artículo constitucional respalda al proyecto de ley y cómo el proyecto materializa, desarrolla "
    "   o garantiza el mandato constitucional. (120 a 180 palabras).\n"
    "2. evaluacion_detallada_articulos_parrafos: Lista estructurada de cada artículo y párrafo del proyecto de ley "
    "   que guardan consonancia con este artículo de la CPE. Para CADA fragmento identificado debes indicar:\n"
    "   - articulo_proyecto: Identificador del artículo o acápite del proyecto (ej: 'Artículo 2, Parágrafo I').\n"
    "   - texto_parrafo: Cita literal o extracto representativo del párrafo del proyecto analizado.\n"
    "   - explicacion_concordancia: Justificación minuciosa de cómo este párrafo específico ejecuta o desarrolla "
    "     el artículo de la CPE (≤60 palabras por párrafo).\n"
    "   (Incluye de 1 a 4 párrafos/artículos relevantes del proyecto).\n"
    "3. fortaleza_constitucional: 'ALTA' (cumplimiento directo y vinculante), 'MEDIA' (cumplimiento por principio o mandato general) o 'MODERADA'.\n"
    "4. principios_constitucionales_aplicados: Principios o valores de la CPE 2009 fortalecidos (ej: Vivir Bien - Suma Qamaña, "
    "   Descolonización, Soberanía, Legalidad, Debido Proceso, Igualdad y no Discriminación).\n"
    "5. articulos_cpe_conexos: Lista de otros artículos de la CPE 2009 conexos o que sirven de respaldo concurrente (ej: ['1', '9', '14']).\n"
    "6. recomendacion_blindaje: Recomendación de técnica legislativa para robustecer aún más la solidez constitucional "
    "   del articulado y evitar cualquier ambigüedad en su aplicación futura (≤70 palabras).\n\n"
    "SALIDA: JSON válido con exactamente estos campos, sin markdown ni texto adicional:\n"
    "{\n"
    '  "justificacion_por_que": "...",\n'
    '  "evaluacion_detallada_articulos_parrafos": [\n'
    '    {\n'
    '      "articulo_proyecto": "...",\n'
    '      "texto_parrafo": "...",\n'
    '      "explicacion_concordancia": "..."\n'
    '    }\n'
    '  ],\n'
    '  "fortaleza_constitucional": "ALTA|MEDIA|MODERADA",\n'
    '  "principios_constitucionales_aplicados": ["..."],\n'
    '  "articulos_cpe_conexos": ["..."],\n'
    '  "recomendacion_blindaje": "..."\n'
    "}"
)



class VerificadorConstitucional:
    """
    Coteja un proyecto de ley contra la CPE artículo por artículo.

    Pipeline de dos fases:
      Fase A — Cribado rápido paralelo (tokens mínimos).
      Fase B — Deep-check sólo en candidatos EN_CONTRA / A_FAVOR / RAF (máxima precisión).
    """

    # ── Embedding ──────────────────────────────────────────────────────────────

    def _embed(self, texto: str) -> List[float]:
        return embeber_pregunta(texto[:MAX_CHARS_BLOQUE])

    # ── Recuperación de artículos CPE ──────────────────────────────────────────

    def _recuperar_articulos_cpe(self, texto_proyecto: str) -> List[Dict[str, Any]]:
        """Búsqueda semántica con fallback por palabras clave generales."""
        try:
            articulos = obtener_articulos_constitucion(
                texto_query=texto_proyecto[:700],
                limit=TOP_K_CPE,
            )
            if not articulos:
                articulos = obtener_articulos_constitucion(
                    texto_query="derechos garantias principios estado bolivia",
                    limit=TOP_K_CPE,
                )
            # Deduplicación por número de artículo
            vistos: set = set()
            unicos: List[Dict] = []
            for a in (articulos or []):
                num = str(a.get("numero", "")).strip()
                if num and num not in vistos:
                    vistos.add(num)
                    unicos.append(a)
            return unicos
        except Exception as e:
            logger.warning(f"Error recuperando artículos CPE: {e}")
            return []

    # ── FASE A: Cribado rápido ─────────────────────────────────────────────────

    def _cribar_relacion_cpe(
        self, texto_proyecto: str, articulo_cpe: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Prompt compacto de cribado (220 tokens máx).
        Devuelve {'clasificacion', 'severidad', 'verificado', '_fase'}.
        Los artículos NEUTRAL con ok=True se descartan sin segunda pasada.
        """
        num      = articulo_cpe.get("numero", "")
        titulo   = articulo_cpe.get("titulo", "")
        texto_cpe = articulo_cpe.get("texto", "")[:MAX_CHARS_CPE_TEXTO]

        usuario = (
            f"<cpe art='{num}' titulo='{titulo}'>\n{texto_cpe}\n</cpe>\n\n"
            f"<proyecto>\n{texto_proyecto[:1800]}\n</proyecto>\n\n"
            "Aplica la REGLA RÁPIDA. Solo JSON."
        )

        try:
            contenido, _ = chat_completion_auditoria(
                messages=[
                    {"role": "system", "content": _SISTEMA_CRIBA},
                    {"role": "user",   "content": usuario},
                ],
                temperature=0.0,
                timeout=(5, 30),
                max_model_attempts=2,
                max_tokens=MAX_TOKENS_CRIBA,
            )
            data = extraer_json_de_llm(contenido)
            if not isinstance(data, dict):
                raise ValueError("Respuesta constitucional invalida")
            if data.get("c") not in {"A_FAVOR", "EN_CONTRA", "NEUTRAL", "RAF", "REQUIERE_ANALISIS_DE_FONDO"}:
                raise ValueError("Criba constitucional incompleta")
            return {
                "clasificacion": data.get("c", "NEUTRAL"),
                "severidad":     data.get("s", "ninguna"),
                "verificado":    bool(data.get("ok", False)),
                "_fase":         "criba",
            }
        except Exception as e:
            logger.debug(f"[Criba] Art. {num}: fallback NEUTRAL por error LLM: {e}")
            return {"clasificacion": "NEUTRAL", "severidad": "ninguna", "verificado": False, "_fase": "criba_fallback", "pendiente_revision": True, "motivo": str(e)}

    # ── FASE B: Deep-check de candidatos ──────────────────────────────────────

    def _verificar_profundo_cpe(
        self, texto_proyecto: str, articulo_cpe: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Segunda pasada con árbol de decisión completo, citas obligatorias y
        campo 'recomendacion'. Sólo se llama para artículos no-NEUTRAL de la criba.
        """
        num      = articulo_cpe.get("numero", "")
        titulo   = articulo_cpe.get("titulo", "")
        texto_cpe = articulo_cpe.get("texto", "")[:MAX_CHARS_CPE_TEXTO]

        usuario = (
            f"<articulo_cpe numero=\"{num}\" titulo=\"{titulo}\">\n"
            f"{texto_cpe}\n"
            f"</articulo_cpe>\n\n"
            f"<proyecto_ley>\n{texto_proyecto[:MAX_CHARS_PROYECTO]}\n</proyecto_ley>\n\n"
            "TAREA: aplica el ÁRBOL DE DECISIÓN en orden. Devuelve SOLO el JSON. "
            "Si dudas entre EN_CONTRA y NEUTRAL, elige NEUTRAL y 'verificado'=false."
        )

        try:
            contenido, _ = chat_completion_auditoria(
                messages=[
                    {"role": "system", "content": _SISTEMA_DEEPCHECK},
                    {"role": "user",   "content": usuario},
                ],
                temperature=0.0,
                timeout=(5, 30),
                max_model_attempts=2,
                max_tokens=MAX_TOKENS_DEEPCHECK,
            )
            data = extraer_json_de_llm(contenido)
            if not isinstance(data, dict):
                raise ValueError("Respuesta constitucional invalida")
            if data.get("clasificacion") not in {"A_FAVOR", "EN_CONTRA", "NEUTRAL", "REQUIERE_ANALISIS_DE_FONDO"}:
                raise ValueError("Cotejo constitucional incompleto")
        except Exception as e:
            logger.warning(f"[DeepCheck] Art. {num}: fallback heurístico por error LLM: {e}")
            return {"clasificacion": "PENDIENTE_REVISION", "verificado": False,
                    "pendiente_revision": True, "motivo": str(e)}

        # Validación de citas: EN_CONTRA sin cita_constitucional → NEUTRAL
        if not data.get("cita_constitucional") and data.get("clasificacion") == "EN_CONTRA":
            logger.warning(f"[VerificadorCPE] Art. {num}: EN_CONTRA sin cita → degradado a NEUTRAL")
            data["clasificacion"] = "NEUTRAL"
            data["_descartado_sin_cita"] = True

        # Normalización de clasificación
        CLASES_VALIDAS = {"A_FAVOR", "EN_CONTRA", "NEUTRAL", "REQUIERE_ANALISIS_DE_FONDO"}
        if data.get("clasificacion") not in CLASES_VALIDAS:
            data["clasificacion"] = "NEUTRAL"

        data["_fase"] = "deep_check"
        return data

    # ── FASE C: Análisis profundo por hallazgo crítico ────────────────────────

    def _analizar_impacto_profundo(
        self,
        texto_proyecto: str,
        articulo_cpe: Dict[str, Any],
        deep_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Fase C: análisis jurídico narrativo completo por cada hallazgo EN_CONTRA o RAF.
        Genera: impacto_juridico, argumento_constitucional, argumento_defensa,
        articulos_cpe_relacionados, redaccion_corregida, precedentes_tcp,
        dictamen y nivel_urgencia_correccion.
        Se ejecuta en paralelo sólo para hallazgos críticos (EN_CONTRA / RAF).
        """
        num           = articulo_cpe.get("numero", "")
        titulo        = articulo_cpe.get("titulo", "")
        texto_cpe     = articulo_cpe.get("texto", "")[:MAX_CHARS_CPE_TEXTO]
        clasificacion = deep_result.get("clasificacion", "")
        cita_proy     = deep_result.get("cita_proyecto", "") or texto_proyecto[:600]
        cita_cpe      = deep_result.get("cita_constitucional", "") or texto_cpe[:400]
        fundamento    = deep_result.get("fundamento", "")
        tipo_colision = deep_result.get("tipo_colision", "")

        usuario = (
            f"<contexto_previo>\n"
            f"  Clasificación Fase B: {clasificacion}\n"
            f"  Tipo de colisión: {tipo_colision}\n"
            f"  Fundamento previo: {fundamento}\n"
            f"</contexto_previo>\n\n"
            f"<articulo_cpe numero=\"{num}\" titulo=\"{titulo}\">\n"
            f"{texto_cpe}\n"
            f"</articulo_cpe>\n\n"
            f"<cita_constitucional_detectada>\n{cita_cpe}\n</cita_constitucional_detectada>\n\n"
            f"<fragmento_proyecto_afectado>\n{cita_proy}\n</fragmento_proyecto_afectado>\n\n"
            f"<proyecto_ley_completo>\n{texto_proyecto[:MAX_CHARS_PROYECTO_C]}\n</proyecto_ley_completo>\n\n"
            "TAREA: Elabora el análisis jurídico profundo y completo. "
            "Responde TODOS los campos. Solo JSON."
        )

        try:
            contenido, _ = chat_completion_auditoria(
                messages=[
                    {"role": "system", "content": _SISTEMA_ANALISIS_PROFUNDO},
                    {"role": "user",   "content": usuario},
                ],
                temperature=0.1,   # Leve creatividad para redacción corregida
                timeout=(5, 30),
                max_model_attempts=2,
                max_tokens=MAX_TOKENS_ANALISIS,
            )
            analisis = extraer_json_de_llm(contenido)
            # Garantizar que todos los campos clave existen
            analisis.setdefault("impacto_juridico",          "No disponible.")
            analisis.setdefault("argumento_constitucional",  "No disponible.")
            analisis.setdefault("argumento_defensa",         "No disponible.")
            analisis.setdefault("articulos_cpe_relacionados", [])
            analisis.setdefault("redaccion_corregida",       "No disponible.")
            analisis.setdefault("precedentes_tcp",           "Sin precedente conocido.")
            analisis.setdefault("dictamen",                  "REQUIERE_CONSULTA_TCP")
            analisis.setdefault("nivel_urgencia_correccion", "ANTES_DEBATE_COMISION")
            logger.info(f"[VerificadorCPE] Fase C completada para Art. {num}: dictamen={analisis.get('dictamen','?')}")
            return analisis
        except Exception as e:
            logger.warning(f"[AnálisisProfundo] Art. {num}: error LLM en Fase C: {e}")
            return {
                "pendiente_revision": True,
                "motivo": str(e),
                "impacto_juridico":          "No se pudo completar el análisis profundo.",
                "argumento_constitucional":  "No disponible (error en análisis).",
                "argumento_defensa":         "No disponible.",
                "articulos_cpe_relacionados": [],
                "redaccion_corregida":       "No disponible.",
                "precedentes_tcp":           "Sin precedente conocido.",
                "dictamen":                  "REQUIERE_CONSULTA_TCP",
                "nivel_urgencia_correccion": "ANTES_DEBATE_COMISION",
            }

    # ── FASE C (A FAVOR): Análisis y Justificación Detallada ──────────────────

    def _analizar_afavor_profundo(
        self,
        texto_proyecto: str,
        articulo_cpe: Dict[str, Any],
        deep_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Fase C para artículos A_FAVOR:
        Genera fundamentación jurídica profunda explicando el POR QUÉ respalda a la CPE,
        con evaluación detallada PÁRRAFO POR PÁRRAFO y ARTÍCULO POR ARTÍCULO del proyecto,
        identificando citas, principios fortalecidos y recomendaciones de blindaje.
        """
        num        = articulo_cpe.get("numero", "")
        titulo     = articulo_cpe.get("titulo", "")
        texto_cpe  = articulo_cpe.get("texto", "")[:MAX_CHARS_CPE_TEXTO]
        fundamento = deep_result.get("fundamento", "")
        cita_proy  = deep_result.get("cita_proyecto", "") or ""
        cita_cpe   = deep_result.get("cita_constitucional", "") or texto_cpe[:400]

        usuario = (
            f"<articulo_cpe numero=\"{num}\" titulo=\"{titulo}\">\n"
            f"{texto_cpe}\n"
            f"</articulo_cpe>\n\n"
            f"<fundamento_fase_previa>\n{fundamento}\n</fundamento_fase_previa>\n\n"
            f"<fragmento_proyecto_detectado>\n{cita_proy}\n</fragmento_proyecto_detectado>\n\n"
            f"<proyecto_ley_completo>\n{texto_proyecto[:MAX_CHARS_PROYECTO_C]}\n</proyecto_ley_completo>\n\n"
            "TAREA: Evalúa minuciosamente el proyecto de ley frente a este artículo CPE. "
            "Justifica con detalle el POR QUÉ y desglosa la concordancia PÁRRAFO POR PÁRRAFO y ARTÍCULO POR ARTÍCULO. "
            "Responde TODOS los campos del JSON requerido, sin markdown."
        )

        try:
            contenido, _ = chat_completion_auditoria(
                messages=[
                    {"role": "system", "content": _SISTEMA_ANALISIS_AFAVOR},
                    {"role": "user",   "content": usuario},
                ],
                temperature=0.1,
                timeout=(5, 30),
                max_model_attempts=2,
                max_tokens=MAX_TOKENS_ANALISIS,
            )
            analisis = extraer_json_de_llm(contenido)
            analisis.setdefault(
                "justificacion_por_que",
                fundamento or "El articulado del proyecto materializa y garantiza de forma directa los preceptos constitucionales evaluados."
            )
            analisis.setdefault("evaluacion_detallada_articulos_parrafos", [])
            analisis.setdefault("fortaleza_constitucional", "ALTA")
            analisis.setdefault("principios_constitucionales_aplicados", ["Seguridad Jurídica", "Supremacía Constitucional"])
            analisis.setdefault("articulos_cpe_conexos", [])
            analisis.setdefault(
                "recomendacion_blindaje",
                "Mantener concordancia explícita con las reservas de ley y competencias constitucionales."
            )
            logger.info(
                f"[VerificadorCPE] Análisis A_FAVOR completado para Art. {num}: "
                f"{len(analisis.get('evaluacion_detallada_articulos_parrafos', []))} párrafos/artículos evaluados."
            )
            return analisis
        except Exception as e:
            logger.warning(f"[AnalisisAFavor] Art. {num}: error LLM: {e}")
            return {"pendiente_revision": True, "motivo": str(e)}


    # ── Fallback heurístico (sin LLM) ─────────────────────────────────────────

    @staticmethod
    def _fallback_heuristico(
        texto_proyecto: str, articulo_cpe: Dict[str, Any]
    ) -> Dict[str, Any]:
        num       = articulo_cpe.get("numero", "")
        texto_cpe = (articulo_cpe.get("texto") or "").lower()
        proy_txt  = texto_proyecto.lower()

        prohibe   = any(p in texto_cpe for p in ["prohíbe", "prohibe", "impedirá", "vedado", "no se permite"])
        obliga    = any(o in proy_txt  for o in ["deberá", "debera", "se obliga", "establece"])
        garantiza = any(g in texto_cpe for g in ["derecho", "garantiza", "reconoce", "salud", "educación", "trabajo"])

        if prohibe and obliga:
            return {
                "clasificacion":      "EN_CONTRA",
                "fundamento":         f"Tensión detectada: CPE Art. {num} restringe lo que el proyecto ordena (heurístico).",
                "severidad":          "grave",
                "cita_proyecto":      texto_proyecto[:200],
                "cita_constitucional": articulo_cpe.get("texto", "")[:200],
                "recomendacion":      "Revisar manualmente la colisión detectada entre el proyecto y la CPE.",
                "verificado":         False,
            }
        if garantiza:
            return {
                "clasificacion":      "A_FAVOR",
                "fundamento":         f"El proyecto se alinea con las garantías del Art. {num} CPE (heurístico).",
                "severidad":          "ninguna",
                "cita_proyecto":      "",
                "cita_constitucional": articulo_cpe.get("texto", "")[:200],
                "recomendacion":      "Sin acción requerida. Garantía constitucional respaldada.",
                "verificado":         False,
            }
        return {
            "clasificacion":      "NEUTRAL",
            "fundamento":         "Sin colisión directa detectada por reglas de deducción (heurístico).",
            "severidad":          "ninguna",
            "cita_proyecto":      "",
            "cita_constitucional": "",
            "recomendacion":      "",
            "verificado":         False,
        }

    # ── Resumen ejecutivo ─────────────────────────────────────────────────────

    @staticmethod
    def _generar_resumen_ejecutivo(
        contradicciones: List[Dict],
        a_favor:         List[Dict],
        requieren_fondo: List[Dict],
        articulos_consultados: List[Dict],
    ) -> Dict[str, Any]:
        """
        Calcula nivel_riesgo, score_confianza calibrado, score_cobertura,
        matriz_riesgo por artículo y recomendaciones_globales con emojis.
        """
        sevs = [c.get("severidad", "ninguna") for c in contradicciones]

        nivel_riesgo = (
            "BLOQUEANTE" if "bloqueante" in sevs
            else "ALTO"   if "grave" in sevs
            else "MEDIO"  if "leve" in sevs and len(contradicciones) > 0
            else "BAJO"   if len(requieren_fondo) > 0
            else "NINGUNO"
        )

        # Score de confianza calibrado: base 90, penaliza por gravedad, premia a_favor
        score = 90
        score -= sum({"bloqueante": 20, "grave": 12, "leve": 6}.get(s, 0) for s in sevs)
        score += min(len(a_favor) * 2, 10)
        score  = max(30, min(score, 98))

        # Cobertura CPE: % de artículos consultados con resultado conclusivo
        total_consultados = len(articulos_consultados)
        conclusivos       = len(contradicciones) + len(a_favor)
        cobertura         = round(conclusivos / total_consultados * 100, 1) if total_consultados else 0.0

        bloqueantes = [c for c in contradicciones if c.get("severidad") == "bloqueante"]
        graves      = [c for c in contradicciones if c.get("severidad") == "grave"]
        leves       = [c for c in contradicciones if c.get("severidad") == "leve"]

        recomendaciones_globales: List[str] = []
        if bloqueantes:
            recomendaciones_globales.append(
                f"⛔ DETENER TRAMITACIÓN: {len(bloqueantes)} contradicción(es) bloqueante(s) "
                "con derecho(s) fundamental(es). Corrección obligatoria antes de continuar."
            )
        if graves:
            recomendaciones_globales.append(
                f"⚠️ CORRECCIÓN PRIORITARIA: {len(graves)} contradicción(es) grave(s) de "
                "competencia/procedimiento. Subsanar antes del debate en comisión."
            )
        if leves:
            recomendaciones_globales.append(
                f"📋 AJUSTE FORMAL: {len(leves)} observación(es) leve(s). "
                "Corregir en la revisión de estilo legislativo."
            )
        if requieren_fondo:
            recomendaciones_globales.append(
                f"🔍 ANÁLISIS DE FONDO: {len(requieren_fondo)} artículo(s) CPE requieren "
                "ponderación jurídica especializada. Derivar al Tribunal Constitucional Plurinacional (TCP)."
            )
        if not contradicciones and not requieren_fondo:
            recomendaciones_globales.append(
                "✅ PROYECTO CONSTITUCIONALMENTE COHERENTE: no se detectaron contradicciones "
                "con la CPE en los artículos analizados."
            )

        # Matriz de riesgo por artículo (para visualización en frontend)
        matriz_riesgo: List[Dict[str, Any]] = []
        for c in contradicciones:
            dictamen_fc = (c.get("analisis_profundo") or {}).get("dictamen", "REQUIERE_CONSULTA_TCP")
            urgencia_fc = (c.get("analisis_profundo") or {}).get("nivel_urgencia_correccion", "ANTES_DEBATE_COMISION")
            matriz_riesgo.append({
                "articulo_cpe":    c.get("articulo_constitucional", ""),
                "tipo":            "EN_CONTRA",
                "severidad":       c.get("severidad", "leve"),
                "dictamen":        dictamen_fc,
                "urgencia":        urgencia_fc,
                "tipo_colision":   c.get("tipo_colision", ""),
            })
        for r in requieren_fondo:
            dictamen_fc = (r.get("analisis_profundo") or {}).get("dictamen", "REQUIERE_CONSULTA_TCP")
            urgencia_fc = (r.get("analisis_profundo") or {}).get("nivel_urgencia_correccion", "ANTES_DEBATE_COMISION")
            matriz_riesgo.append({
                "articulo_cpe":  r.get("articulo_constitucional", ""),
                "tipo":          "REQUIERE_ANALISIS_DE_FONDO",
                "severidad":     "medio",
                "dictamen":      dictamen_fc,
                "urgencia":      urgencia_fc,
                "tipo_colision": r.get("tipo_colision", ""),
            })
        for f in a_favor:
            analisis_af = f.get("analisis_profundo") or {}
            fortaleza = analisis_af.get("fortaleza_constitucional", "ALTA")
            matriz_riesgo.append({
                "articulo_cpe":  f"Art. {f.get('numero','')} - {f.get('titulo','')}",
                "tipo":          "A_FAVOR",
                "severidad":     "ninguna",
                "dictamen":      f"CONSTITUCIONAL ({fortaleza})",
                "urgencia":      "NO_REQUERIDA",
                "tipo_colision": f.get("tipo_colision", "desarrollo"),
            })

        return {
            "nivel_riesgo":            nivel_riesgo,
            "score_confianza":         score,
            "score_cobertura_cpe_pct": cobertura,
            "total_consultados":       total_consultados,
            "total_a_favor":           len(a_favor),
            "total_contradicciones":   len(contradicciones),
            "total_requieren_fondo":   len(requieren_fondo),
            "distribucion_severidad": {
                "bloqueante": len(bloqueantes),
                "grave":      len(graves),
                "leve":       len(leves),
            },
            "recomendaciones_globales": recomendaciones_globales,
            "matriz_riesgo":            matriz_riesgo,
        }

    # ── Análisis completo del documento ───────────────────────────────────────

    def analizar(
        self,
        texto_proyecto: str,
        sesion_id: str,
        id_proyecto: Optional[int] = None,
        task_id_mongo: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Pipeline de tres fases:
          Fase A — Cribado rápido paralelo (tokens mínimos, descarta neutrales).
          Fase B — Deep-check paralelo (citas + tipo de colisión).
          Fase C — Análisis profundo por hallazgo EN_CONTRA y RAF
                   (impacto, argumento, redacción corregida, dictamen formal).
        """
        articulos_cpe = self._recuperar_articulos_cpe(texto_proyecto)
        if not articulos_cpe:
            logger.warning("[VerificadorCPE] Sin artículos CPE recuperados.")

        from concurrent.futures import ThreadPoolExecutor

        # ── Fase A: Cribado paralelo ──────────────────────────────────────────
        def _cribar(art: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            return art, self._cribar_relacion_cpe(texto_proyecto, art)

        with ThreadPoolExecutor(max_workers=2) as exe:
            cribados = list(exe.map(_cribar, articulos_cpe))

        pendientes_revision = [
            {"articulo_constitucional": art.get("numero"), "fase": "criba", "motivo": criba.get("motivo")}
            for art, criba in cribados if criba.get("pendiente_revision")
        ]
        if not articulos_cpe:
            pendientes_revision.append({"fase": "recuperacion", "motivo": "Sin articulos CPE disponibles"})

        candidatos_deep:    List[Tuple[Dict, Dict]] = []
        neutrales_directos: List[Tuple[Dict, Dict]] = []

        for art, criba in cribados:
            if criba.get("pendiente_revision"):
                continue
            c = criba.get("clasificacion", "NEUTRAL")
            if c == "RAF":
                c = "REQUIERE_ANALISIS_DE_FONDO"
            if c in ("EN_CONTRA", "REQUIERE_ANALISIS_DE_FONDO", "A_FAVOR"):
                candidatos_deep.append((art, criba))
            else:
                neutrales_directos.append((art, criba))

        logger.info(
            f"[VerificadorCPE] Criba: {len(candidatos_deep)} para deep-check, "
            f"{len(neutrales_directos)} neutrales directos."
        )

        # ── Fase B: Deep-check paralelo ────────────────────────────────────────
        def _deepcheck(art_criba: Tuple[Dict, Dict]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            art, _ = art_criba
            return art, self._verificar_profundo_cpe(texto_proyecto, art)

        with ThreadPoolExecutor(max_workers=2) as exe:
            deep_resultados = list(exe.map(_deepcheck, candidatos_deep))

        # ── Consolidación Fase B ───────────────────────────────────────────────
        contradicciones:  List[Dict[str, Any]] = []
        a_favor:          List[Dict[str, Any]] = []
        requieren_fondo:  List[Dict[str, Any]] = []
        articulos_consultados: List[Dict[str, Any]] = []
        vistos_consultados: set = set()

        # Guardar referencias art↔deep para Fase C
        criticos_para_fase_c: List[Tuple[Dict, Dict, Dict]] = []  # (art, deep_result, entrada)
        afavor_para_fase_c:   List[Tuple[Dict, Dict, Dict]] = []  # (art, deep_result, entrada)

        for art, clasificacion in deep_resultados:
            if clasificacion.get("pendiente_revision"):
                pendientes_revision.append({"articulo_constitucional": art.get("numero"),
                    "fase": "deep_check", "motivo": clasificacion.get("motivo")})
                continue
            num       = art.get("numero", "")
            titulo    = art.get("titulo", "")
            texto_cpe = art.get("texto", "")

            if num in vistos_consultados:
                continue
            vistos_consultados.add(num)

            extracto = texto_cpe[:250] if texto_cpe else ""
            articulos_consultados.append({
                "numero":   num,
                "titulo":   titulo,
                "extracto": extracto,
            })

            tipo = clasificacion.get("clasificacion", "NEUTRAL")

            if tipo == "EN_CONTRA":
                if clasificacion.get("verificado", True):
                    entrada = {
                        "articulo_proyecto":               clasificacion.get("cita_proyecto", "Documento evaluado"),
                        "articulo_constitucional":         f"Art. {num} - {titulo}",
                        "cita_proyecto":                   clasificacion.get("cita_proyecto", ""),
                        "cita_constitucional":             clasificacion.get("cita_constitucional", texto_cpe[:400]),
                        "texto_constitucional_verificado": texto_cpe[:400],
                        "fundamento":                      clasificacion.get("fundamento", ""),
                        "tipo_colision":                   clasificacion.get("tipo_colision", ""),
                        "severidad":                       clasificacion.get("severidad", "leve"),
                        "recomendacion":                   clasificacion.get("recomendacion", ""),
                        "verificado":                      clasificacion.get("verificado", True),
                        "analisis_profundo":               {},  # se rellena en Fase C
                    }
                    contradicciones.append(entrada)
                    criticos_para_fase_c.append((art, clasificacion, entrada))
                else:
                    logger.info(f"[VerificadorCPE] Art. {num}: EN_CONTRA no verificado — excluido.")

            elif tipo == "A_FAVOR":
                entrada_af = {
                    "numero":              num,
                    "titulo":              titulo,
                    "extracto":            extracto,
                    "fundamento":          clasificacion.get("fundamento", ""),
                    "cita_proyecto":       clasificacion.get("cita_proyecto", ""),
                    "cita_constitucional": clasificacion.get("cita_constitucional", ""),
                    "tipo_colision":       clasificacion.get("tipo_colision", "desarrollo"),
                    "recomendacion":       clasificacion.get("recomendacion", ""),
                    "analisis_profundo":   {},  # se rellena en Fase C
                }
                a_favor.append(entrada_af)
                afavor_para_fase_c.append((art, clasificacion, entrada_af))

            elif tipo == "REQUIERE_ANALISIS_DE_FONDO":
                entrada_raf = {
                    "articulo_constitucional": f"Art. {num} - {titulo}",
                    "razon":                   clasificacion.get("fundamento", "Requiere ponderación de derechos"),
                    "cita_constitucional":     clasificacion.get("cita_constitucional", texto_cpe[:400]),
                    "tipo_colision":           clasificacion.get("tipo_colision", ""),
                    "recomendacion":           clasificacion.get("recomendacion", ""),
                    "analisis_profundo":       {},  # se rellena en Fase C
                }
                requieren_fondo.append(entrada_raf)
                criticos_para_fase_c.append((art, clasificacion, entrada_raf))

        # Añadir neutrales directos al listado de consultados
        for art, _ in neutrales_directos:
            num = art.get("numero", "")
            if num and num not in vistos_consultados:
                vistos_consultados.add(num)
                articulos_consultados.append({
                    "numero":   num,
                    "titulo":   art.get("titulo", ""),
                    "extracto": art.get("texto", "")[:250],
                })

        # ── Fase C: Análisis profundo paralelo (Críticos y A FAVOR) ───────────
        logger.info(
            f"[VerificadorCPE] Fase C: análisis profundo de {len(criticos_para_fase_c)} hallazgo(s) crítico(s) "
            f"y {len(afavor_para_fase_c)} artículo(s) A FAVOR."
        )

        def _analizar_profundo_critico(triple: Tuple) -> Dict[str, Any]:
            art, deep_result, _ = triple
            return self._analizar_impacto_profundo(texto_proyecto, art, deep_result)

        def _analizar_profundo_afavor(triple: Tuple) -> Dict[str, Any]:
            art, deep_result, _ = triple
            return self._analizar_afavor_profundo(texto_proyecto, art, deep_result)

        # Ejecución concurrente Fase C
        with ThreadPoolExecutor(max_workers=2) as exe:
            futuros_criticos = (
                list(exe.map(_analizar_profundo_critico, criticos_para_fase_c))
                if criticos_para_fase_c else []
            )
            futuros_afavor = (
                list(exe.map(_analizar_profundo_afavor, afavor_para_fase_c))
                if afavor_para_fase_c else []
            )

        for (art, _, _), analisis in zip(
            criticos_para_fase_c + afavor_para_fase_c, futuros_criticos + futuros_afavor
        ):
            if analisis.get("pendiente_revision"):
                pendientes_revision.append({"articulo_constitucional": art.get("numero"),
                    "fase": "analisis_profundo", "motivo": analisis.get("motivo")})

        # Inyectar análisis profundo en hallazgos críticos
        for i, (_, _, entrada_ref) in enumerate(criticos_para_fase_c):
            entrada_ref["analisis_profundo"] = futuros_criticos[i]

        # Inyectar análisis profundo y justificación detallada en A_FAVOR
        for i, (_, _, entrada_ref) in enumerate(afavor_para_fase_c):
            af_res = futuros_afavor[i]
            entrada_ref["analisis_profundo"] = af_res
            if af_res.get("justificacion_por_que"):
                entrada_ref["justificacion_detallada"] = af_res["justificacion_por_que"]
                if len(entrada_ref.get("fundamento", "")) < 40:
                    entrada_ref["fundamento"] = af_res["justificacion_por_que"]
            if af_res.get("evaluacion_detallada_articulos_parrafos"):
                entrada_ref["parrafos_evaluados"] = af_res["evaluacion_detallada_articulos_parrafos"]
            if af_res.get("fortaleza_constitucional"):
                entrada_ref["fortaleza_constitucional"] = af_res["fortaleza_constitucional"]
            if af_res.get("principios_constitucionales_aplicados"):
                entrada_ref["principios"] = af_res["principios_constitucionales_aplicados"]
            if af_res.get("recomendacion_blindaje"):
                entrada_ref["recomendacion_blindaje"] = af_res["recomendacion_blindaje"]

        # ── Resumen ejecutivo ─────────────────────────────────────────────────
        resumen = self._generar_resumen_ejecutivo(
            contradicciones, a_favor, requieren_fondo, articulos_consultados
        )

        valido          = not pendientes_revision and len(contradicciones) == 0
        resultado_final = "ARTICULADO_VALIDO" if valido else "CONTRADICCIONES_DETECTADAS"
        if pendientes_revision:
            resultado_final = "PENDIENTE_REVISION"
            resumen["nivel_riesgo"] = "DESCONOCIDO"
            resumen["score_confianza"] = 0
        dist_sev        = resumen["distribucion_severidad"]
        severidad_maxima = (
            "bloqueante" if dist_sev["bloqueante"] > 0
            else "grave" if dist_sev["grave"] > 0
            else "leve"  if dist_sev["leve"] > 0
            else "ninguna"
        )

        return {
            "estado": "PENDIENTE_REVISION" if pendientes_revision else "COMPLETADO",
            "pendientes_revision": pendientes_revision,
            "total_pendientes": len(pendientes_revision),
            "resultado_final":          resultado_final,
            "valido":                   valido,
            "confianza":                resumen["score_confianza"],
            "severidad_maxima":         severidad_maxima,
            "num_contradicciones":      len(contradicciones),
            "contradicciones":          contradicciones,
            "requieren_analisis_fondo": requieren_fondo,
            "articulos_a_favor":        a_favor,
            "articulos_consultados":    articulos_consultados,
            "resumen_ejecutivo":        resumen,
        }


# ── Punto de entrada del pipeline ────────────────────────────────────────────

def verificar_constitucionalidad(
    texto_documento: str,
    sesion_id: str,
    id_proyecto: Optional[int] = None,
    task_id_distribuidor: Optional[str] = None,
    persistir: bool = True,
) -> Dict[str, Any]:
    """
    Función de entrada usada por server.py (run_agent_constitucional).
    Publica en MongoDB, ejecuta el análisis de dos fases y persiste el dictamen.
    """
    task_id = publicar_mensaje(
        agente_origen="AGENTE_SISTEMA",
        agente_destino="AGENTE_CONSTITUCIONAL",
        tipo_tarea="Verificacion de Constitucionalidad CPE",
        payload={"preview": texto_documento[:300], "task_id_dist": task_id_distribuidor},
        sesion_id=sesion_id,
        metadata={"etapa": "verificacion_constitucional"},
    )
    marcar_en_proceso(task_id)
    t0 = time.time()

    try:
        agente = VerificadorConstitucional()
        resultado = agente.analizar(
            texto_documento,
            sesion_id=sesion_id,
            id_proyecto=id_proyecto,
            task_id_mongo=task_id,
        )

        if persistir and id_proyecto and not resultado.get("total_pendientes"):
            guardar_observacion_constitucional(
                sesion_id=sesion_id,
                dictamen=resultado,
                id_proyecto=id_proyecto,
                task_id_mongo=task_id,
                modelo_llm=settings.LLM_MODEL_CREW,
                duracion_ms=int((time.time() - t0) * 1000),
                articulos_consultados=resultado.get("articulos_consultados"),
            )

            # ── Correcciones automáticas por cada contradicción CPE ──────────
            contradicciones_detectadas = resultado.get("contradicciones", [])
            if contradicciones_detectadas and not resultado.get("total_pendientes"):
                email_autor = obtener_email_autor_proyecto(id_proyecto)
                for contra in contradicciones_detectadas:
                    art_cpe = contra.get("articulo_constitucional", "")
                    guardar_correccion_proyecto(
                        id_proyecto=id_proyecto,
                        tipo_corrector="SENADO_NORMATIVA",
                        agente_origen="AGENTE_VERIFICADOR_CONSTITUCIONAL",
                        articulo_afectado=contra.get("articulo_proyecto", ""),
                        texto_original=contra.get("cita_proyecto", ""),
                        motivo=contra.get("fundamento", ""),
                        referencia_cpe=art_cpe,
                        sesion_id=sesion_id,
                    )
                    if email_autor:
                        guardar_correccion_proyecto(
                            id_proyecto=id_proyecto,
                            tipo_corrector="AUTOR_PROYECTO",
                            agente_origen="AGENTE_VERIFICADOR_CONSTITUCIONAL",
                            corrector_email=email_autor,
                            articulo_afectado=contra.get("articulo_proyecto", ""),
                            texto_original=contra.get("cita_proyecto", ""),
                            motivo=contra.get("fundamento", ""),
                            referencia_cpe=art_cpe,
                            sesion_id=sesion_id,
                        )
                logger.info(
                    f"[VerificadorCPE] {len(contradicciones_detectadas)} corrección(es) "
                    f"guardadas en sistema.correcciones_proyecto para proyecto {id_proyecto}"
                )

        duracion_ms = int((time.time() - t0) * 1000)
        if resultado.get("total_pendientes"):
            marcar_error(task_id, "Auditoría pendiente de revisión por fallos del proveedor LLM")
        else:
            marcar_completado(task_id, resultado={"valido": resultado["valido"]}, duracion_ms=duracion_ms)
        resumen_ej = resultado.get("resumen_ejecutivo", {})
        logger.info(
            f"[VerificadorCPE] Completado: valido={resultado['valido']}, "
            f"riesgo={resumen_ej.get('nivel_riesgo','?')}, "
            f"confianza={resumen_ej.get('score_confianza','?')}% [{duracion_ms}ms]"
        )
        resultado["task_id_constitucional"] = task_id
        resultado["duracion_ms"]            = duracion_ms
        return resultado

    except Exception as e:
        duracion_ms = int((time.time() - t0) * 1000)
        marcar_error(task_id, str(e))
        logger.error(f"Error en VerificadorConstitucional: {e}")
        return {
            "resultado_final":          "ERROR",
            "valido":                   False,
            "confianza":                0,
            "severidad_maxima":         "ninguna",
            "num_contradicciones":      0,
            "contradicciones":          [],
            "articulos_a_favor":        [],
            "articulos_consultados":    [],
            "requieren_analisis_fondo": [],
            "resumen_ejecutivo": {
                "nivel_riesgo":             "DESCONOCIDO",
                "score_confianza":          0,
                "score_cobertura_cpe_pct":  0.0,
                "recomendaciones_globales": ["⚠️ Error durante el análisis. Verificar manualmente."],
            },
            "task_id_constitucional": task_id,
            "duracion_ms":            duracion_ms,
            "error":                  str(e),
        }
