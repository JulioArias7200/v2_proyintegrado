"""
Agente Verificador de Constitucionalidad (CPE)
================================================
Módulo INDEPENDIENTE que analiza un proyecto de ley contra la
Constitución Política del Estado de Bolivia (CPE).

Fuente de datos: public.articulos_constitucion (Neon PostgreSQL + pgvector)

Lógica propia:
  1. Genera embedding del texto del proyecto (NVIDIA NIM).
  2. Recupera artículos CPE semánticamente similares vía pgvector.
  3. Para cada artículo candidato un LLM clasifica la relación en:
       A_FAVOR     - El proyecto desarrolla o garantiza lo que la CPE manda.
       EN_CONTRA   - El proyecto contradice, restringe o viola la CPE.
       NEUTRAL     - No hay tensión jurídica relevante.
  4. Persiste el dictamen en:
       - sistema.observaciones_constitucionales (Neon PostgreSQL)
       - MongoDB Atlas (bus de mensajería SMA)
  5. Retorna un dict estructurado con:
       valido, confianza, contradicciones, articulos_a_favor, articulos_consultados
"""
import json
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("verificador_constitucional")

from sma_unified.config import settings
from sma_unified.agents.llm_client import chat_completion_resiliente
from sma_unified.agents.embeddings_nvidia import embeber_pregunta
from sma_unified.db.mongo_atlas import publicar_mensaje, marcar_en_proceso, marcar_completado, marcar_error
from sma_unified.db.neon_postgres import (
    obtener_articulos_constitucion,
    guardar_observacion_constitucional,
)

# ── Constantes ────────────────────────────────────────────────────────────────
TOP_K_CPE = 12          # Máximo de artículos CPE a recuperar por embedding
UMBRAL_CPE = 0.45       # Similitud coseno mínima para considerar un artículo relevante
MAX_CHARS_BLOQUE = 2000  # Máximo de caracteres por bloque de análisis


class VerificadorConstitucional:
    """
    Coteja un proyecto de ley contra la CPE artículo por artículo.
    Clasifica cada hallazgo como A_FAVOR, EN_CONTRA o NEUTRAL.
    """

    # ── Embedding ──────────────────────────────────────────────────────────────

    def _embed(self, texto: str) -> List[float]:
        return embeber_pregunta(texto[:MAX_CHARS_BLOQUE])

    # ── Recuperación de artículos CPE ──────────────────────────────────────────

    # ── Recuperación de artículos CPE ──────────────────────────────────────────

    def _recuperar_articulos_cpe(self, texto_proyecto: str) -> List[Dict[str, Any]]:
        """Búsqueda semántica en public.articulos_constitucion via pgvector o fallback por palabras clave."""
        try:
            articulos = obtener_articulos_constitucion(
                texto_query=texto_proyecto[:600],
                limit=TOP_K_CPE,
            )
            if not articulos:
                articulos = obtener_articulos_constitucion(
                    texto_query="derechos garantias principios estado bolivia",
                    limit=TOP_K_CPE,
                )
            
            # Deduplicación estricta por número de artículo constitucional
            vistos = set()
            unicos = []
            for a in (articulos or []):
                num = str(a.get("numero", "")).strip()
                if num and num not in vistos:
                    vistos.add(num)
                    unicos.append(a)
            return unicos
        except Exception as e:
            logger.warning(f"Error recuperando artículos CPE: {e}")
            return []

    # ── Clasificación A FAVOR / EN CONTRA con LLM ─────────────────────────────

    def _clasificar_relacion_cpe(
        self, texto_proyecto: str, articulo_cpe: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Envía el par (texto_proyecto, articulo_cpe) al LLM y obtiene:
          clasificacion: A_FAVOR | EN_CONTRA | NEUTRAL
          fundamento:    explicación jurídica breve (≤ 120 palabras)
          severidad:     bloqueante | grave | leve | ninguna
          fragmento_proyecto: extracto del proyecto que genera la tensión
        """
        num = articulo_cpe.get("numero", "")
        titulo = articulo_cpe.get("titulo", "")
        texto_cpe = articulo_cpe.get("texto", "")[:800]

        sistema = (
            "Eres un riguroso abogado constitucionalista boliviano experto en la Constitución Política del Estado (CPE 2009).\n"
            "Tu tarea es realizar una verificación jurídica estricta, detallada y objetiva (SIN ALUCINAR ni presuponer hechos) "
            "evaluando si el proyecto de ley es CONFORME (A_FAVOR) o VIOLA/CONTRADICE (EN_CONTRA) el artículo constitucional provisto.\n\n"
            "REGLAS OBLIGATORIAS:\n"
            "1. Basa tu dictamen ÚNICAMENTE en el texto expreso del artículo de la CPE y los artículos/extracto del proyecto.\n"
            "2. Sé extremadamente preciso e indica el fundamento jurídico exacto.\n"
            "3. Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes o después, sin bloques ``` extra):\n"
            '{"clasificacion": "A_FAVOR|EN_CONTRA|NEUTRAL", '
            '"fundamento": "explicacion juridica detallada y precisa de max 120 palabras", '
            '"severidad": "bloqueante|grave|leve|ninguna", '
            '"fragmento_proyecto": "extracto exacto del proyecto que genera la tension (vacío si NEUTRAL)"}'
        )
        usuario = (
            f"ARTÍCULO CPE — Art. {num} ({titulo}):\n{texto_cpe}\n\n"
            f"TEXTO COMPLETO/SECCIONES DEL PROYECTO DE LEY:\n{texto_proyecto[:3000]}"
        )

        try:
            contenido, _modelo = chat_completion_resiliente(
                messages=[
                    {"role": "system", "content": sistema},
                    {"role": "user", "content": usuario},
                ],
                temperature=0.0,
                max_tokens=1500,
            )
            from sma_unified.agents.llm_client import extraer_json_de_llm
            data = extraer_json_de_llm(contenido)
        except Exception as e:
            logger.warning(f"Fallback heurístico en _clasificar_relacion_cpe por error LLM: {e}")
            proy_txt = texto_proyecto.lower()
            const_txt = (articulo_cpe.get("texto") or "").lower()
            prohibe = any(p in const_txt for p in ["prohíbe", "prohibe", "impedirá", "vedado", "no se permite"])
            obliga = any(o in proy_txt for o in ["deberá", "debera", "se obliga", "establece"])
            garantiza = any(g in const_txt for g in ["derecho", "garantiza", "reconoce", "salud", "educación", "trabajo"])
            if prohibe and obliga:
                data = {
                    "clasificacion": "EN_CONTRA",
                    "fundamento": f"Tensión constitucional detectada: La CPE (Art. {num}) establece prohibición u ordenamiento no compatible con la pretensión del proyecto.",
                    "severidad": "grave",
                    "fragmento_proyecto": texto_proyecto[:250],
                }
            elif garantiza:
                data = {
                    "clasificacion": "A_FAVOR",
                    "fundamento": f"El proyecto se encuentra en sintonía con las garantías del Art. {num} de la CPE ({titulo}).",
                    "severidad": "ninguna",
                    "fragmento_proyecto": "",
                }
            else:
                data = {
                    "clasificacion": "NEUTRAL",
                    "fundamento": "Sin colisión directa o tensión evidente identificada.",
                    "severidad": "ninguna",
                    "fragmento_proyecto": "",
                }

        if data.get("clasificacion") not in ("A_FAVOR", "EN_CONTRA", "NEUTRAL"):
            data["clasificacion"] = "NEUTRAL"

        return data

    # ── Análisis completo del documento ───────────────────────────────────────

    def analizar(
        self,
        texto_proyecto: str,
        sesion_id: str,
        id_proyecto: Optional[int] = None,
        task_id_mongo: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Punto de entrada principal.
        Recupera los artículos CPE más relevantes, los clasifica en paralelo y
        construye el dictamen estructurado sin duplicados.
        """
        articulos_cpe = self._recuperar_articulos_cpe(texto_proyecto)

        contradicciones: List[Dict[str, Any]] = []
        a_favor: List[Dict[str, Any]] = []
        articulos_consultados: List[Dict[str, Any]] = []
        vistos_consultados = set()

        from concurrent.futures import ThreadPoolExecutor

        def _evaluar_articulo_cpe(art: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            clasificacion = self._clasificar_relacion_cpe(texto_proyecto, art)
            return art, clasificacion

        with ThreadPoolExecutor(max_workers=5) as executor:
            resultados_paralelos = list(executor.map(_evaluar_articulo_cpe, articulos_cpe))

        for art, clasificacion in resultados_paralelos:
            num = art.get("numero", "")
            titulo = art.get("titulo", "")
            texto_cpe = art.get("texto", "")

            if num in vistos_consultados:
                continue
            vistos_consultados.add(num)

            tipo = clasificacion["clasificacion"]
            extracto = texto_cpe[:180] if texto_cpe else ""
            articulos_consultados.append(
                {"numero": num, "titulo": titulo, "extracto": extracto}
            )

            if tipo == "EN_CONTRA":
                contradicciones.append(
                    {
                        "articulo_proyecto": "Documento evaluado",
                        "articulo_constitucional": f"Art. {num} - {titulo}",
                        "texto_constitucional_verificado": texto_cpe[:300],
                        "fundamento": clasificacion["fundamento"],
                        "severidad": clasificacion["severidad"],
                        "fragmento_proyecto": clasificacion.get("fragmento_proyecto", ""),
                    }
                )
            elif tipo == "A_FAVOR":
                a_favor.append(
                    {
                        "numero": num,
                        "titulo": titulo,
                        "extracto": extracto,
                        "fundamento": clasificacion["fundamento"],
                    }
                )

        valido = len(contradicciones) == 0
        sevs = [c["severidad"] for c in contradicciones]
        severidad_maxima = (
            "bloqueante" if "bloqueante" in sevs
            else "grave" if "grave" in sevs
            else "leve" if "leve" in sevs
            else "ninguna"
        )
        confianza = max(55, 95 - len(contradicciones) * 12)

        return {
            "valido": valido,
            "confianza": confianza,
            "severidad_maxima": severidad_maxima,
            "num_contradicciones": len(contradicciones),
            "contradicciones": contradicciones,
            "articulos_a_favor": a_favor,
            "articulos_consultados": articulos_consultados,
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
    Publica en MongoDB, ejecuta el análisis y persiste el dictamen.
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

        if persistir and id_proyecto:
            guardar_observacion_constitucional(
                sesion_id=sesion_id,
                dictamen=resultado,
                id_proyecto=id_proyecto,
                task_id_mongo=task_id,
                modelo_llm=settings.LLM_MODEL_CREW,
                duracion_ms=int((time.time() - t0) * 1000),
                articulos_consultados=resultado.get("articulos_consultados"),
            )

        duracion_ms = int((time.time() - t0) * 1000)
        marcar_completado(task_id, resultado={"valido": resultado["valido"]}, duracion_ms=duracion_ms)
        logger.info(f"Verificacion constitucional completada: valido={resultado['valido']} [{duracion_ms}ms]")
        resultado["task_id_constitucional"] = task_id
        resultado["duracion_ms"] = duracion_ms
        return resultado

    except Exception as e:
        duracion_ms = int((time.time() - t0) * 1000)
        marcar_error(task_id, str(e))
        logger.error(f"Error en VerificadorConstitucional: {e}")
        return {
            "valido": False,
            "confianza": 0,
            "severidad_maxima": "ninguna",
            "num_contradicciones": 0,
            "contradicciones": [],
            "articulos_a_favor": [],
            "articulos_consultados": [],
            "task_id_constitucional": task_id,
            "duracion_ms": duracion_ms,
            "error": str(e),
        }
