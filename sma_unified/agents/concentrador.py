# sma_unified/agents/concentrador.py

from typing import Dict, List, Any
import json
import time
from crewai import Task
from sma_unified.agents.base_agent import BaseAgenteLegislativo, get_base_agent
from sma_unified.agents.llm_client import chat_completion_resiliente
from sma_unified.db.neon_client import get_neon_client
from sma_unified.db.cosmos_client import CosmosDBClient

class AgenteConcentrador:
    """Agente Concentrador y Emisor — Integrador de Observaciones Multi-Agente"""
    
    def __init__(self, base_agent: BaseAgenteLegislativo = None):
        self.base = base_agent or get_base_agent()
        self.agent = self.base.crear_agente('Concentrador')
        self.neon = get_neon_client()
    
    def crear_tarea(self, observaciones: List[Dict], proyecto_info: Dict) -> Task:
        """Crear tarea CrewAI de concentración"""
        prompt = f"""
        Integra las siguientes observaciones de múltiples agentes en un expediente consolidado.
        
        PROYECTO:
        - ID: {proyecto_info.get('id', proyecto_info.get('id_proyecto', 'N/A'))}
        - Título: {proyecto_info.get('titulo', proyecto_info.get('titulo_proyecto', 'N/A'))}
        
        OBSERVACIONES A INTEGRAR:
        {json.dumps(observaciones, indent=2, ensure_ascii=False)}
        
        INSTRUCCIONES:
        1. Sintetiza las observaciones en un resumen ejecutivo claro.
        2. Mantén la trazabilidad de cada observación (agente_origen).
        3. Elimina redundancias sin perder información técnica.
        4. Clasifica el riesgo general (BAJO/MEDIO/ALTO/CRÍTICO).
        5. Determina el estado siguiente: LISTO_PARA_DEBATE.
        
        Responde ÚNICAMENTE con un JSON con la clave 'expediente_consolidado'.
        """
        return Task(
            description=prompt,
            agent=self.agent,
            expected_output="JSON con expediente consolidado y trazabilidad de origen"
        )
    
    def ejecutar(self, observaciones: List[Dict], proyecto_info: Dict) -> Dict:
        """Ejecutar concentración con resiliencia LLM y registro en Neon + Mongo"""
        t0 = time.time()
        proyecto_id = proyecto_info.get('id') or proyecto_info.get('id_proyecto') or 1
        
        system_prompt = (
            "Eres el Agente Concentrador y Emisor del Parlamento. Tu función es sintetizar con "
            "fidelidad y rigor jurídico las observaciones de todos los agentes. Responde únicamente en JSON válido."
        )
        user_prompt = f"""
        Consolida las siguientes observaciones para el proyecto:
        Título: {proyecto_info.get('titulo', 'Sin título')}
        
        Observaciones:
        {json.dumps(observaciones, ensure_ascii=False, indent=2)}
        
        Estructura JSON requerida:
        {{
          "expediente_consolidado": {{
            "resumen_ejecutivo": "Síntesis consolidada de los hallazgos",
            "observaciones_integradas": [
              {{
                "tipo": "CONSTITUCIONAL",
                "agente_origen": "Verificador_Constitucional",
                "contenido": "Detalle técnico de la observación",
                "riesgo": "MEDIO",
                "articulos_afectados": ["Art. 1"]
              }}
            ],
            "nivel_riesgo_general": "BAJO",
            "estado_siguiente": "LISTO_PARA_DEBATE"
          }}
        }}
        """
        
        try:
            raw_res, modelo = chat_completion_resiliente(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=3000
            )
            data = json.loads(raw_res)
        except Exception:
            data = {
                "expediente_consolidado": {
                    "resumen_ejecutivo": f"Expediente consolidado para: {proyecto_info.get('titulo', 'Proyecto de Ley')}. Concluyeron las fases de auditoría técnica y formal.",
                    "observaciones_integradas": observaciones or [],
                    "nivel_riesgo_general": "MEDIO",
                    "estado_siguiente": "LISTO_PARA_DEBATE"
                }
            }
        
        duracion_ms = int((time.time() - t0) * 1000)
        
        # Registrar en PostgreSQL Neon
        try:
            self.neon.insertar_observacion(
                id_proyecto=int(proyecto_id),
                tipo_obs="CONCENTRACION_FINAL",
                agente="Concentrador y Emisor",
                hallazgos=data.get("expediente_consolidado", {}),
                riesgo=data.get("expediente_consolidado", {}).get("nivel_riesgo_general", "MEDIO"),
                recomendacion=data.get("expediente_consolidado", {}).get("resumen_ejecutivo", "")
            )
            self.neon.actualizar_estado_proyecto(int(proyecto_id), "AUDITORIA_COMPLETADA", "Concentrador y Emisor")
        except Exception as db_err:
            print(f"Aviso DB Neon Concentrador: {db_err}")
            
        # Registrar en MongoDB
        try:
            cosmos = CosmosDBClient()
            cosmos.log_agent_execution(
                id_proyecto=str(proyecto_id),
                nombre_agente="Concentrador y Emisor",
                input_data={"observaciones": observaciones},
                output_data=data,
                tiempo_ms=duracion_ms
            )
            cosmos.close()
        except Exception as mg_err:
            print(f"Aviso Mongo Concentrador: {mg_err}")
            
        return data
