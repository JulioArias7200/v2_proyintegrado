from sma_unified.agents.pipeline import ejecutar_pipeline
from sma_unified.agents.distribuidor import clasificar_documento
from sma_unified.agents.comision import procesar_legislativo
from sma_unified.agents.ciudadana import procesar_atencion_ciudadana
from sma_unified.agents.correspondencia import procesar_correspondencia
from sma_unified.agents.consistencia_normativa import verificar_consistencia_normativa
from sma_unified.agents.emisor_resultados import emitir_informe_pdf
from sma_unified.agents.notificador_comision import notificar_miembros_comision

# Agentes CrewAI YAML — Flujo Legislativo Extendido
from sma_unified.agents.concentrador import AgenteConcentrador
from sma_unified.agents.secretario import AgenteSecretarioCamara
from sma_unified.agents.bicameral import AgenteBicameral
from sma_unified.agents.veto_promulgacion import AgenteVetoPromulgacion
from sma_unified.agents.publicacion import AgentePublicacionOficial
from sma_unified.agents.constitucion_fondo import AgenteConstitucionFondo
from sma_unified.agents.crew_orchestrator import ejecutar_pipeline_completo, ejecutar_etapa_individual

__all__ = [
    # Pipeline base
    "ejecutar_pipeline",
    "clasificar_documento",
    "procesar_legislativo",
    "procesar_atencion_ciudadana",
    "procesar_correspondencia",
    "verificar_consistencia_normativa",
    "emitir_informe_pdf",
    "notificar_miembros_comision",
    # Agentes CrewAI YAML
    "AgenteConcentrador",
    "AgenteSecretarioCamara",
    "AgenteBicameral",
    "AgenteVetoPromulgacion",
    "AgentePublicacionOficial",
    "AgenteConstitucionFondo",
    # Orquestador unificado
    "ejecutar_pipeline_completo",
    "ejecutar_etapa_individual",
]

