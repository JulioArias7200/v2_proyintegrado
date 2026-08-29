"""
Agente de Consistencia Normativa (Ordenamiento Legal Vigente)
=============================================================
Módulo INDEPENDIENTE que analiza un proyecto de ley contra el
CORPUS NORMATIVO VIGENTE boliviano cargado en la base de datos:
  - Código Penal, Código Civil, Código de Minería
  - Leyes Sectoriales, Decretos Supremos, Resoluciones
  - Cualquier PDF/norma ingresado en "Base Legal" del sistema

Fuente de datos: public.articulos_normativos (Neon PostgreSQL + pgvector)

Lógica DIFERENTE a la constitucional:
  * NO consulta la CPE — esa es competencia del VerificadorConstitucional.
  * Coteja ARTÍCULO por ARTÍCULO del proyecto contra el corpus de leyes vigentes.
  * Clasifica la relación en 5 categorías:
      contradiccion   - Consecuencias jurídicas incompatibles entre ambos textos.
      repeticion      - Dice lo mismo con distinta redacción (posible derogación tácita).
      vacio_llenado   - El proyecto cubre un vacío que la ley vigente dejaba abierto.
      complementario  - Misma materia, sin conflicto (se complementan).
      sin_relacion    - Similitud superficial, no hay relación jurídica real.
  * Para cada hallazgo sugiere una acción: derogar | modificar | mantener | ninguna.
  * Persiste en normativa.analisis_consistencia y publica en MongoDB Atlas.

Profundidad ampliada:
  - TOP_K configurable hasta 15 (vs 10 anterior).
  - Se analiza por bloques de artículos, no solo el documento completo.
  - Se añade análisis de derogación tácita y conflictos de especialidad.
  - Se incluye un resumen ejecutivo categorizando el riesgo normativo global.
"""
import json
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("consistencia_normativa")

from sma_unified.config import (
    settings,
    AGENTE_COMISION,
    AGENTE_CONSISTENCIA,
    TIPOS_RELACION_CONSISTENCIA,
)
from sma_unified.agents.llm_client import chat_completion_resiliente
from sma_unified.agents.embeddings_nvidia import embeber_pregunta
from sma_unified.utils.parser_normativa import parsear_articulos
from sma_unified.db.mongo_atlas import publicar_mensaje, marcar_en_proceso, marcar_completado, marcar_error
from sma_unified.db.neon_postgres import (
    buscar_articulos_normativos_semantico,
    guardar_analisis_consistencia,
)

# ── Constantes de profundidad ────────────────────────────────────────────────
TOP_K_NORMAS = 15           # Artículos vigentes a recuperar por bloque
UMBRAL_SIMILITUD = 0.42     # Similitud mínima coseno (más bajo = más cobertura)
LONGITUD_MIN_BLOQUE = 30    # Mínimo de caracteres para considerar un bloque analizable
MAX_CHARS_EMBEDDING = 1500  # Máximo de caracteres enviados al modelo de embedding


class AgenteConsistenciaNormativa:
    """
    Compara el proyecto de ley (artículo por artículo) contra el corpus
    de leyes vigentes cargado en public.articulos_normativos.

    Usa embedding semántico (NVIDIA NIM) + LLM para:
      1. Recuperar normas vigentes similares.
      2. Clasificar la relación jurídica.
      3. Detectar derogación tácita y conflictos de especialidad.
    """

    def __init__(self):
        self.llm_model = settings.LLM_MODEL_CONSISTENCIA
        self.umbral = UMBRAL_SIMILITUD
        self.top_k = TOP_K_NORMAS

    # ── Embedding ──────────────────────────────────────────────────────────────

    def _embed(self, texto: str) -> List[float]:
        return embeber_pregunta(texto[:MAX_CHARS_EMBEDDING])

    # ── Parser de artículos ───────────────────────────────────────────────────

    def _reconocer_articulos(self, texto_documento: str) -> List[Dict[str, str]]:
        """
        Divide el documento en artículos usando el parser jurídico boliviano.
        Si no se reconocen artículos (oficio, fragmento atípico), lo trata como
        un único bloque para no dejar ningún texto sin cotejar.
        """
        try:
            articulos = parsear_articulos(texto_documento)
        except Exception as e:
            logger.warning(f"Parser no pudo dividir el documento: {e}")
            articulos = []

        unidades = [
            {"numero": a["numero_articulo"], "texto": a["texto"]}
            for a in articulos
            if a.get("texto") and len(a["texto"].strip()) >= LONGITUD_MIN_BLOQUE
        ]

        if unidades:
            return unidades

        # Fallback: documento completo como bloque único
        if texto_documento and len(texto_documento.strip()) >= LONGITUD_MIN_BLOQUE:
            return [{"numero": "(documento completo)", "texto": texto_documento}]
        return []

    # ── Clasificación con LLM (profundidad extendida) ─────────────────────────

    def _clasificar_relacion(
        self, texto_nuevo: str, candidato: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compara un artículo del proyecto contra uno vigente. Detecta además:
          - Derogación tácita: el nuevo regula lo mismo sin mencionar al anterior.
          - Conflicto de especialidad: la norma especial prevalece sobre la general.
          - Conflicto temporal: la norma posterior prevalece sobre la anterior.
        """
        prompt_sistema = (
            "Eres un jurista boliviano experto en análisis de consistencia normativa y técnica legislativa.\n"
            "Compara el artículo NUEVO (proyecto de ley) con el artículo VIGENTE de la legislación boliviana y clasifica su relación jurídica con máxima rigurosidad y precisión (SIN ALUCINACIONES).\n\n"
            "Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin bloques markdown extra):\n"
            '{"tipo_relacion": "contradiccion|repeticion|vacio_llenado|complementario|sin_relacion", '
            '"justificacion": "explicacion estricta citando ambos textos (max 120 palabras)", '
            '"sugerencia": "derogar|modificar|mantener|ninguna, con una frase de razon", '
            '"derogacion_tacita": true|false, '
            '"conflicto_especialidad": true|false, '
            '"riesgo": "alto|medio|bajo|ninguno"}\n\n'
            "Definiciones:\n"
            "- contradiccion: consecuencias jurídicas incompatibles. Riesgo alto/medio.\n"
            "- repeticion: mismo contenido, distinta redacción. Puede implicar derogación tácita.\n"
            "- vacio_llenado: el nuevo cubre un vacío que el vigente dejaba abierto.\n"
            "- complementario: misma materia, sin conflicto.\n"
            "- sin_relacion: similitud superficial, sin relación jurídica real.\n"
            "- derogacion_tacita: el artículo nuevo regula la misma materia sin indicar que deroga al anterior.\n"
            "- conflicto_especialidad: la norma especial debería prevalecer sobre la general."
        )
        prompt_usuario = (
            f"ARTÍCULO NUEVO (proyecto):\n{texto_nuevo[:800]}\n\n"
            f"ARTÍCULO VIGENTE — {candidato['documento']}, Art. {candidato['numero']}:\n"
            f"{candidato['texto'][:800]}"
        )

        try:
            contenido, _modelo = chat_completion_resiliente(
                messages=[
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": prompt_usuario},
                ],
                temperature=0.0,
                max_tokens=1500,
            )
            from sma_unified.agents.llm_client import extraer_json_de_llm
            data = extraer_json_de_llm(contenido)
        except Exception as e:
            logger.warning(f"Fallback heurístico en _clasificar_relacion (consistencia) por error LLM: {e}")
            similitud = float(candidato.get("similitud", 0.5))
            txt_n = texto_nuevo.lower()
            txt_v = (candidato.get("texto") or "").lower()

            if similitud > 0.75:
                tipo = "repeticion"
                just = f"Alta similitud semántica ({int(similitud*100)}%) con {candidato['documento']} (Art. {candidato['numero']}). Posible duplicación o derogación tácita."
                sug = "Evaluar si el proyecto abroga o sustituye expresamente este artículo vigente."
                derog = True
                conflicto_esp = False
                riesgo = "medio"
            elif similitud > 0.55:
                tipo = "complementario"
                just = f"Relación normativa cercana ({int(similitud*100)}% similitud) con {candidato['documento']} (Art. {candidato['numero']}). Regulan la misma materia."
                sug = "Verificar armonización terminológica entre ambos cuerpos normativos."
                derog = False
                conflicto_esp = True
                riesgo = "bajo"
            else:
                tipo = "vacio_llenado"
                just = f"Coincidencia temática inicial con {candidato['documento']}. El proyecto parece complementar o desarrollar aspectos no cubiertos por la norma vigente."
                sug = "Mantener redacción verificando no alterar procedimientos vigentes."
                derog = False
                conflicto_esp = False
                riesgo = "ninguno"

            data = {
                "tipo_relacion": tipo,
                "justificacion": just,
                "sugerencia": sug,
                "derogacion_tacita": derog,
                "conflicto_especialidad": conflicto_esp,
                "riesgo": riesgo,
            }

        if data.get("tipo_relacion") not in TIPOS_RELACION_CONSISTENCIA:
            data["tipo_relacion"] = "sin_relacion"

        return data

    # ── Análisis de un artículo del proyecto ──────────────────────────────────

    # ── Análisis de un artículo del proyecto ──────────────────────────────────

    def analizar_articulo(
        self,
        texto_nuevo: str,
        articulo_proyecto_numero: str = "",
        nombre_archivo: Optional[str] = None,
        sesion_id: Optional[str] = None,
        task_id_mongo: Optional[str] = None,
        id_proyecto: Optional[int] = None,
        persistir: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Coteja UN artículo contra los cuerpos normativos vigentes en paralelo,
        filtrando y deduplicando los candidatos más relevantes.
        """
        embedding = self._embed(texto_nuevo)
        candidatos = buscar_articulos_normativos_semantico(
            embedding, documento=None, top_k=self.top_k, umbral=self.umbral
        )
        if not candidatos:
            candidatos = buscar_articulos_normativos_semantico(
                embedding, documento=None, top_k=self.top_k, umbral=0.35
            )

        # Deduplicación de candidatos por (documento, numero) y límite a top 6
        vistos_cand = set()
        candidatos_unicos = []
        for c in (candidatos or []):
            clave = (str(c.get("documento", "")).strip(), str(c.get("numero", "")).strip())
            if clave not in vistos_cand:
                vistos_cand.add(clave)
                candidatos_unicos.append(c)
        candidatos_unicos = candidatos_unicos[:6]

        if not candidatos_unicos:
            return []

        from concurrent.futures import ThreadPoolExecutor

        def _evaluar_candidato_normativo(cand: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            clasificacion = self._clasificar_relacion(texto_nuevo, cand)
            return cand, clasificacion

        with ThreadPoolExecutor(max_workers=5) as executor:
            evaluaciones_paralelas = list(executor.map(_evaluar_candidato_normativo, candidatos_unicos))

        resultados: List[Dict[str, Any]] = []
        for candidato, clasificacion in evaluaciones_paralelas:
            tipo_relacion = clasificacion["tipo_relacion"]

            if tipo_relacion == "sin_relacion":
                continue

            resultado = {
                "articulo_proyecto": articulo_proyecto_numero,
                "numero_articulo": candidato["numero"],
                "norma": candidato["documento"],
                "similitud": round(float(candidato["similitud"]), 4),
                "tipo_relacion": tipo_relacion,
                "justificacion": clasificacion.get("justificacion", ""),
                "sugerencia": clasificacion.get("sugerencia", ""),
                "derogacion_tacita": clasificacion.get("derogacion_tacita", False),
                "conflicto_especialidad": clasificacion.get("conflicto_especialidad", False),
                "riesgo": clasificacion.get("riesgo", "ninguno"),
            }
            resultados.append(resultado)

            if persistir:
                guardar_analisis_consistencia(
                    articulo_nuevo_texto=texto_nuevo,
                    articulo_candidato_id=None,
                    similitud=resultado["similitud"],
                    tipo_relacion=tipo_relacion,
                    justificacion=resultado["justificacion"],
                    sugerencia=resultado["sugerencia"],
                    sesion_id=sesion_id,
                    task_id_mongo=task_id_mongo,
                    id_proyecto=id_proyecto,
                    modelo_llm=self.llm_model,
                    nombre_archivo=nombre_archivo,
                    articulo_proyecto_numero=articulo_proyecto_numero,
                    articulo_candidato_documento=candidato["documento"],
                    articulo_candidato_numero=candidato["numero"],
                )

        return resultados

    # ── Análisis de todo el documento ─────────────────────────────────────────

    def analizar_documento(
        self,
        texto_documento: str,
        nombre_archivo: Optional[str] = None,
        sesion_id: Optional[str] = None,
        task_id_mongo: Optional[str] = None,
        id_proyecto: Optional[int] = None,
        persistir: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Reconoce artículos del documento y coteja CADA UNO contra el corpus vigente.
        """
        unidades = self._reconocer_articulos(texto_documento)
        if not unidades:
            logger.info("Consistencia normativa: documento vacío o sin contenido analizable.")
            return []

        resultados: List[Dict[str, Any]] = []
        vistos_hallazgos = set()

        for unidad in unidades:
            hallazgos = self.analizar_articulo(
                unidad["texto"],
                articulo_proyecto_numero=unidad["numero"],
                nombre_archivo=nombre_archivo,
                sesion_id=sesion_id,
                task_id_mongo=task_id_mongo,
                id_proyecto=id_proyecto,
                persistir=persistir,
            )
            for h in hallazgos:
                clave = (h.get("articulo_proyecto"), h.get("norma"), h.get("numero_articulo"), h.get("tipo_relacion"))
                if clave not in vistos_hallazgos:
                    vistos_hallazgos.add(clave)
                    resultados.append(h)

        return resultados

    # ── Resumen ejecutivo de riesgo normativo ─────────────────────────────────

    @staticmethod
    def generar_resumen(hallazgos: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calcula el riesgo normativo global y categoriza los hallazgos.
        """
        resumen: Dict[str, int] = {}
        for h in hallazgos:
            resumen[h["tipo_relacion"]] = resumen.get(h["tipo_relacion"], 0) + 1

        alto = sum(1 for h in hallazgos if h.get("riesgo") == "alto")
        medio = sum(1 for h in hallazgos if h.get("riesgo") == "medio")
        derogaciones = sum(1 for h in hallazgos if h.get("derogacion_tacita"))
        especialidad = sum(1 for h in hallazgos if h.get("conflicto_especialidad"))

        if alto > 0:
            nivel_riesgo = "ALTO"
        elif medio > 1:
            nivel_riesgo = "MEDIO"
        elif len(hallazgos) > 0:
            nivel_riesgo = "BAJO"
        else:
            nivel_riesgo = "NINGUNO"

        return {
            "resumen_por_tipo": resumen,
            "nivel_riesgo_global": nivel_riesgo,
            "alertas_riesgo_alto": alto,
            "alertas_riesgo_medio": medio,
            "posibles_derogaciones_tacitas": derogaciones,
            "conflictos_especialidad": especialidad,
        }


# ── Punto de entrada del pipeline ────────────────────────────────────────────

def verificar_consistencia_normativa(
    texto_documento: str,
    sesion_id: str,
    task_id_distribuidor: Optional[str] = None,
    metadata_extra: Optional[Dict[str, Any]] = None,
    id_proyecto: Optional[int] = None,
    persistir: bool = True,
    nombre_archivo: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Función de entrada usada por server.py (run_agent_consistencia).
    Publica en MongoDB, ejecuta análisis artículo por artículo y
    devuelve un dict con hallazgos + resumen ejecutivo de riesgo.
    """
    nombre_archivo = nombre_archivo or (metadata_extra or {}).get("nombre_archivo")

    task_id = publicar_mensaje(
        agente_origen=AGENTE_COMISION,
        agente_destino=AGENTE_CONSISTENCIA,
        tipo_tarea="Verificacion de Consistencia Normativa (Leyes Vigentes)",
        payload={
            "texto_preview": texto_documento[:400],
            "longitud_chars": len(texto_documento),
            "task_id_comision": task_id_distribuidor,
            **(metadata_extra or {}),
        },
        sesion_id=sesion_id,
        metadata={"etapa": "consistencia_normativa"},
    )
    marcar_en_proceso(task_id)
    t0 = time.time()

    try:
        agente = AgenteConsistenciaNormativa()
        hallazgos = agente.analizar_documento(
            texto_documento,
            nombre_archivo=nombre_archivo,
            sesion_id=sesion_id,
            task_id_mongo=task_id,
            id_proyecto=id_proyecto,
            persistir=persistir,
        )
        resumen = agente.generar_resumen(hallazgos)

    except Exception as e:
        duracion_ms = int((time.time() - t0) * 1000)
        logger.warning(f"Agente Consistencia Normativa: error en análisis: {e}")
        marcar_error(task_id, str(e))
        return {
            "hallazgos": [],
            "analisis": [],
            "resumen_por_tipo": {},
            "nivel_riesgo_global": "DESCONOCIDO",
            "total_hallazgos": 0,
            "task_id_consistencia": task_id,
            "duracion_ms": duracion_ms,
            "error": str(e),
        }

    duracion_ms = int((time.time() - t0) * 1000)
    marcar_completado(
        task_id,
        resultado={"total_hallazgos": len(hallazgos), **resumen},
        duracion_ms=duracion_ms,
    )
    logger.info(
        f"Consistencia normativa: {len(hallazgos)} hallazgos | "
        f"Riesgo: {resumen['nivel_riesgo_global']} [{duracion_ms}ms]"
    )

    return {
        "hallazgos": hallazgos,
        "analisis": hallazgos,        # alias para el frontend
        "total_hallazgos": len(hallazgos),
        "task_id_consistencia": task_id,
        "duracion_ms": duracion_ms,
        **resumen,
    }
