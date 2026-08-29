"""
Agente Distribuidor (Nivel 1)
=============================
Primer agente del pipeline. Recibe el documento, lo clasifica en una de las
tres categorías y registra TODO en MongoDB Atlas via el bus de comunicación.

Flujo:
  Usuario → [MongoDB Atlas] → Agente_Distribuidor → clasifica
  Agente_Distribuidor → [MongoDB Atlas] → Agente_Comision_Legislativa
                                        → Agente_Atencion_Ciudadana
                                        → Agente_Gestion_Correspondencia
"""
import os
import time
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("agente_distribuidor")

from sma_unified.config import (
    settings,
    AGENTE_USUARIO,
    AGENTE_DISTRIBUIDOR,
    AGENTE_COMISION,
    AGENTE_ATENCION_CIUDADANA,
    AGENTE_CORRESPONDENCIA,
    CATEGORIAS_VALIDAS,
    load_agents_yaml,
    load_tasks_yaml,
)
from sma_unified.utils.text_sampler import muestrear_texto
from sma_unified.db.mongo_atlas import (
    publicar_mensaje,
    marcar_en_proceso,
    marcar_completado,
    marcar_error,
)


def _get_llm():
    """Instancia el LLM NVIDIA para CrewAI."""
    from crewai import LLM
    return LLM(
        model=f"openai/{settings.LLM_MODEL_CREW}",
        api_key=settings.NVIDIA_API_KEY,
        base_url=settings.NVIDIA_BASE_URL,
    )


def _get_distribuidor_agent():
    """Crea el agente CrewAI para clasificación / distribución desde YAML."""
    from crewai import Agent
    llm = _get_llm()
    agents_cfg = load_agents_yaml().get("agente_enrutador", {})
    return Agent(
        role=agents_cfg.get("role", "Clasificador Estricto de Documentación Oficial de Bolivia"),
        goal=agents_cfg.get("goal", "Clasificar en EXACTAMENTE UNA de las 3 categorías institucionales."),
        backstory=agents_cfg.get("backstory", "Sistema automatizado de recepción y enrutamiento documental."),
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=2,
        memory=False,
    )


def clasificar_documento(
    texto_documento: str,
    sesion_id: str,
    metadata_entrada: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ejecuta la clasificación de Nivel 1 con el Agente Distribuidor.
    Registra entrada y salida en MongoDB Atlas.
    """
    from crewai import Task, Crew

    # 1. Registrar mensaje de entrada (Usuario → Distribuidor)
    task_id_entrada = publicar_mensaje(
        agente_origen=AGENTE_USUARIO,
        agente_destino=AGENTE_DISTRIBUIDOR,
        tipo_tarea="Recepción y Clasificación de Documento",
        payload={
            "texto_preview": texto_documento[:500] + "..." if len(texto_documento) > 500 else texto_documento,
            "longitud_chars": len(texto_documento),
            **(metadata_entrada or {}),
        },
        sesion_id=sesion_id,
        metadata={"modelo_llm": settings.LLM_MODEL_CREW},
    )

    marcar_en_proceso(task_id_entrada)
    t_inicio = time.time()

    try:
        agente = _get_distribuidor_agent()
        tasks_cfg = load_tasks_yaml().get("tarea_clasificacion_enrutador", {})

        desc_template = tasks_cfg.get("description", "Clasifica el documento:\n{texto_documento}")
        # Antes: texto_documento[:4000] — sólo veía las primeras ~1-2 páginas.
        # Para leyes largas (30-40 páginas) eso normalmente alcanza para
        # clasificar bien (el objeto de la ley suele estar al inicio), pero
        # se usa el muestreo representativo por consistencia con el resto
        # del pipeline y para no perder señales si el documento arranca con
        # texto de trámite/carátula poco informativo.
        desc = desc_template.replace("{texto_documento}", muestrear_texto(texto_documento, 4000))

        tarea = Task(
            description=desc,
            expected_output=tasks_cfg.get(
                "expected_output",
                "AGENTE_REGISTRO_LEGISLATIVO | AGENTE_ATENCION_CIUDADANA | AGENTE_GESTION_CORRESPONDENCIA"
            ),
            agent=agente,
        )

        crew = Crew(agents=[agente], tasks=[tarea], verbose=False)
        resultado_raw = str(crew.kickoff()).strip().upper()

        # Buscar la categoría válida en la respuesta
        categoria = None
        for cat in CATEGORIAS_VALIDAS:
            if cat in resultado_raw:
                categoria = cat
                break

        if not categoria:
            logger.warning(
                f"LLM no retornó categoría válida: {resultado_raw!r}. "
                "Fallback a AGENTE_REGISTRO_LEGISLATIVO."
            )
            categoria = "AGENTE_REGISTRO_LEGISLATIVO"

        duracion_ms = int((time.time() - t_inicio) * 1000)

        # Determinar agente destino
        agente_destino_map = {
            "AGENTE_REGISTRO_LEGISLATIVO": AGENTE_COMISION,
            "AGENTE_ATENCION_CIUDADANA": AGENTE_ATENCION_CIUDADANA,
            "AGENTE_GESTION_CORRESPONDENCIA": AGENTE_CORRESPONDENCIA,
        }
        agente_destino_nombre = agente_destino_map[categoria]

        # 2. Completar mensaje de entrada con resultado
        marcar_completado(
            task_id_entrada,
            resultado={
                "categoria_clasificada": categoria,
                "agente_destino": agente_destino_nombre,
                "respuesta_raw_llm": resultado_raw[:200],
            },
            duracion_ms=duracion_ms,
        )
        logger.info(
            f"✅ Distribuidor clasificó → {categoria} "
            f"[{duracion_ms}ms]"
        )

        return {
            "categoria": categoria,
            "task_id_entrada": task_id_entrada,
            "agente_destino_nombre": agente_destino_nombre,
            "duracion_ms": duracion_ms,
        }

    except Exception as e:
        marcar_error(task_id_entrada, str(e))
        logger.error(f"Error en Agente Distribuidor: {e}")
        raise
