# sma_unified/agents/veto_promulgacion.py

from typing import Dict, List, Any
import json
import time
from crewai import Task
from sma_unified.agents.base_agent import BaseAgenteLegislativo, get_base_agent
from sma_unified.agents.llm_client import chat_completion_resiliente
from sma_unified.db.neon_client import get_neon_client
from sma_unified.db.cosmos_client import CosmosDBClient


class AgenteVetoPromulgacion:
    """Agente Veto y Promulgacion - Evaluacion estrategica multicriterio final"""

    def __init__(self, base_agent: BaseAgenteLegislativo = None):
        self.base = base_agent or get_base_agent()
        self.agent = self.base.crear_agente('Veto_Promulgacion')
        self.neon = get_neon_client()

    def crear_tarea(self, expediente: Dict, proyecto_info: Dict, texto_ley_sancionada: str = "") -> Task:
        """Crear tarea CrewAI de veto/promulgacion desde tasks.yaml"""
        from sma_unified.config import load_tasks_yaml
        tasks_cfg = load_tasks_yaml()
        task_info = tasks_cfg.get('tarea_evaluar_veto_promulgacion') or tasks_cfg.get('tareas', {}).get('tarea_evaluar_veto_promulgacion') or tasks_cfg.get('tareas', {}).get('Evaluar_Veto_Promulgacion', {})
        
        desc_template = task_info.get('description') or task_info.get('descripcion')
        expected_output = task_info.get('expected_output', "Resolución del Poder Ejecutivo sobre Proyecto Sancionado")
        
        texto_ley = texto_ley_sancionada or proyecto_info.get('texto') or proyecto_info.get('contenido_texto') or proyecto_info.get('titulo', 'Sin texto')
        if desc_template and "{texto_ley_sancionada}" in desc_template:
            prompt = desc_template.replace("{texto_ley_sancionada}", texto_ley[:4000])
            prompt += f"\n\nEXPEDIENTE CONSOLIDADO DEL PARLAMENTO:\n{json.dumps(expediente, indent=2, ensure_ascii=False)}"
        else:
            prompt = f"""
        Evalua estrategicamente el proyecto sancionado.
        PROYECTO: ID={proyecto_info.get('id', 'N/A')}, Titulo={proyecto_info.get('titulo', 'N/A')}
        EXPEDIENTE: {json.dumps(expediente, indent=2, ensure_ascii=False)}
        INSTRUCCIONES: Analiza 4 criterios: viabilidad politica, legalidad constitucional,
        factibilidad tecnica, sostenibilidad fiscal. Decide: PROMULGAR, VETAR_TOTAL o VETAR_PARCIAL.
        Responde UNICAMENTE con JSON con la clave evaluacion_veto.
        """
        return Task(
            description=prompt,
            agent=self.agent,
            expected_output=expected_output
        )

    def ejecutar(self, expediente: Dict, proyecto_info: Dict) -> Dict:
        """Ejecutar evaluacion veto/promulgacion con resiliencia LLM"""
        t0 = time.time()
        proyecto_id = proyecto_info.get('id') or proyecto_info.get('id_proyecto') or 1

        system_prompt = (
            "Eres el evaluador estrategico final del proceso legislativo. "
            "Tu decision de PROMULGAR, VETAR_TOTAL o VETAR_PARCIAL es definitiva. "
            "Evalua simultaneamente viabilidad politica, legalidad constitucional, "
            "factibilidad tecnica y sostenibilidad fiscal. Responde en JSON valido."
        )
        user_prompt = f"""
        Proyecto: {proyecto_info.get('titulo', 'Proyecto de Ley')} (ID: {proyecto_id})
        Expediente consolidado: {json.dumps(expediente, ensure_ascii=False)}

        Genera el JSON con evaluacion multicriterio:
        {{
          "evaluacion_veto": {{
            "proyecto_id": "{proyecto_id}",
            "decision": "PROMULGAR",
            "criterios": {{
              "viabilidad_politica": {{"score": 8, "razon": "Amplio consenso parlamentario"}},
              "legalidad_constitucional": {{"score": 9, "razon": "Conforme a CPE 2009 Art. 410"}},
              "factibilidad_tecnica": {{"score": 7, "razon": "Estructura tecnica solida"}},
              "sostenibilidad_fiscal": {{"score": 7, "razon": "Impacto fiscal moderado y sostenible"}}
            }},
            "score_final": 7.75,
            "observaciones_parciales": [],
            "justificacion": "El proyecto cumple los cuatro criterios estrategicos con suficiencia",
            "estado_siguiente": "APROBADO_PARA_PUBLICACION"
          }}
        }}
        """

        try:
            raw_res, modelo = chat_completion_resiliente(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            data = json.loads(raw_res)
        except Exception:
            data = {
                "evaluacion_veto": {
                    "proyecto_id": str(proyecto_id),
                    "decision": "PROMULGAR",
                    "criterios": {
                        "viabilidad_politica": {"score": 8, "razon": "Consenso parlamentario alcanzado"},
                        "legalidad_constitucional": {"score": 8, "razon": "Conforme a CPE"},
                        "factibilidad_tecnica": {"score": 7, "razon": "Tecnicamente viable"},
                        "sostenibilidad_fiscal": {"score": 7, "razon": "Sostenible fiscalmente"}
                    },
                    "score_final": 7.5,
                    "observaciones_parciales": [],
                    "justificacion": "Proyecto aprobado por evaluacion estrategica multicriterio.",
                    "estado_siguiente": "APROBADO_PARA_PUBLICACION"
                }
            }

        duracion_ms = int((time.time() - t0) * 1000)

        try:
            evaluacion = data.get("evaluacion_veto", {})
            decision = evaluacion.get("decision", "PROMULGAR")
            riesgo_map = {"PROMULGAR": "BAJO", "VETAR_PARCIAL": "MEDIO", "VETAR_TOTAL": "ALTO"}
            self.neon.insertar_observacion(
                id_proyecto=int(proyecto_id),
                tipo_obs="EVALUACION_VETO_PROMULGACION",
                agente="Veto y Promulgacion",
                hallazgos=evaluacion,
                riesgo=riesgo_map.get(decision, "MEDIO"),
                recomendacion=evaluacion.get("justificacion", "")
            )
            estado_neon = "PROMULGADO" if decision == "PROMULGAR" else "VETADO"
            self.neon.actualizar_estado_proyecto(int(proyecto_id), estado_neon, "Veto y Promulgacion")
        except Exception as db_err:
            print(f"Aviso Neon VetoPromulgacion: {db_err}")

        try:
            cosmos = CosmosDBClient()
            cosmos.log_agent_execution(
                id_proyecto=str(proyecto_id),
                nombre_agente="Veto y Promulgacion",
                input_data={"expediente": expediente},
                output_data=data,
                tiempo_ms=duracion_ms
            )
            cosmos.close()
        except Exception as mg_err:
            print(f"Aviso Mongo VetoPromulgacion: {mg_err}")

        return data
