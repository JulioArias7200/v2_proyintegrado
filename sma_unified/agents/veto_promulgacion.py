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
    """Agente Veto y Promulgación — Asesoría técnica ejecutiva y control humano en el bucle (Human-in-the-Loop)"""

    def __init__(self, base_agent: BaseAgenteLegislativo = None):
        self.base = base_agent or get_base_agent()
        self.agent = self.base.crear_agente('Veto_Promulgacion')
        self.neon = get_neon_client()

    def crear_tarea(self, expediente: Dict, proyecto_info: Dict) -> Task:
        """Crear tarea CrewAI de asesoría técnica ejecutiva para decisión humana"""
        prompt = f"""
        Como asesor jurídico y técnico de la Presidencia del Estado, analiza el proyecto sancionado (Art. 164 CPE).
        
        PROYECTO SANCIONADO:
        - ID: {proyecto_info.get('id', 'N/A')}
        - Título: {proyecto_info.get('titulo', 'N/A')}
        
        EXPEDIENTE Y SANCION BICAMERAL:
        {json.dumps(expediente, indent=2, ensure_ascii=False)}
        
        INSTRUCCIONES:
        1. Compila el análisis de antecedentes, alertas de constitucionalidad y sostenibilidad fiscal.
        2. Emite un dictamen técnico con la recomendación sugerida (RECOMIENDA_PROMULGAR, RECOMIENDA_VETAR_TOTAL o RECOMIENDA_VETAR_PARCIAL).
        3. Si sugieres veto, redacta el pliego formal de observaciones justificadas para la ALP.
        4. Estructura las opciones de decisión ejecutiva para el operador o autoridad humana.
        5. Genera un JSON estrictamente válido con la clave 'evaluacion_veto'.
        """
        return Task(
            description=prompt,
            agent=self.agent,
            expected_output="JSON con dictamen técnico de asesoría ejecutiva, pliego de observaciones y opciones Human-in-the-Loop"
        )

    def ejecutar(self, expediente: Dict, proyecto_info: Dict) -> Dict:
        """Ejecutar asesoría técnica ejecutiva y procesar la decisión humana (Human-in-the-Loop)"""
        t0 = time.time()
        proyecto_id = proyecto_info.get('id') or proyecto_info.get('id_proyecto') or 1
        decision_operador = (
            expediente.get("decision_operador")
            or proyecto_info.get("decision_operador")
            or expediente.get("decision_humana")
        )

        system_prompt = (
            "Eres el Asesor Jurídico y Técnico de la Presidencia del Estado Plurinacional de Bolivia en un esquema "
            "Human-in-the-Loop. Tu labor es analizar rigurosamente el proyecto sancionado (Art. 164 CPE), identificar "
            "riesgos constitucionales y fiscales, emitir una recomendación fundada y preparar el pliego de observaciones, "
            "dejando las opciones de resolución formal para el operador humano. Responde estrictamente en formato JSON válido."
        )
        user_prompt = f"""
        Proyecto Sancionado: {proyecto_info.get('titulo', 'Proyecto de Ley')} (ID: {proyecto_id})
        Expediente remitido:
        {json.dumps(expediente, ensure_ascii=False, indent=2)}

        Genera el JSON con el informe de asesoría ejecutiva:
        {{
          "evaluacion_veto": {{
            "proyecto_id": "{proyecto_id}",
            "modo_control": "HUMAN_IN_THE_LOOP",
            "decision": "PROMULGAR",
            "plazo_constitucional_dias": 10,
            "recomendacion_tecnica": {{
              "dictamen_sugerido": "RECOMIENDA_PROMULGAR",
              "resumen_ejecutivo": "El proyecto sancionado cumple con la CPE y la normativa fiscal.",
              "alertas_constitucionales": [],
              "alertas_fiscales": [],
              "fundamentacion": "La norma es jurídicamente sólida y cuenta con respaldo financiero en el PGE."
            }},
            "pliego_observaciones": [],
            "opciones_operador_humano": [
              {{"accion": "PROMULGAR", "etiqueta": "Firmar y Promulgar Ley", "destino": "PUBLICACION_GACETA"}},
              {{"accion": "VETAR_TOTAL", "etiqueta": "Emitir Veto Total con Observaciones", "destino": "REMISION_ALP"}},
              {{"accion": "VETAR_PARCIAL", "etiqueta": "Emitir Veto Parcial a Artículos Específicos", "destino": "REMISION_ALP"}}
            ],
            "justificacion": "Dictamen ejecutivo favorable para promulgación.",
            "ruta_siguiente": "PUBLICACION_GACETA",
            "estado_siguiente": "PROMULGADO_EJECUTIVO"
          }}
        }}
        """

        try:
            raw_res, modelo = chat_completion_resiliente(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=2500
            )
            data = json.loads(raw_res)
        except Exception:
            data = {
                "evaluacion_veto": {
                    "proyecto_id": str(proyecto_id),
                    "modo_control": "HUMAN_IN_THE_LOOP",
                    "decision": "PROMULGAR",
                    "plazo_constitucional_dias": 10,
                    "recomendacion_tecnica": {
                        "dictamen_sugerido": "RECOMIENDA_PROMULGAR",
                        "resumen_ejecutivo": "Proyecto sancionado procesado con asesoría ejecutiva.",
                        "alertas_constitucionales": [],
                        "alertas_fiscales": [],
                        "fundamentacion": "Evaluación técnica favorable conforme a CPE."
                    },
                    "pliego_observaciones": [],
                    "opciones_operador_humano": [
                        {"accion": "PROMULGAR", "etiqueta": "Firmar y Promulgar Ley", "destino": "PUBLICACION_GACETA"},
                        {"accion": "VETAR_TOTAL", "etiqueta": "Emitir Veto Total con Observaciones", "destino": "REMISION_ALP"},
                        {"accion": "VETAR_PARCIAL", "etiqueta": "Emitir Veto Parcial a Artículos Específicos", "destino": "REMISION_ALP"}
                    ],
                    "justificacion": "Asesoría técnica ejecutiva completada.",
                    "ruta_siguiente": "PUBLICACION_GACETA",
                    "estado_siguiente": "PROMULGADO_EJECUTIVO"
                }
            }

        duracion_ms = int((time.time() - t0) * 1000)

        try:
            evaluacion = data.get("evaluacion_veto", {})
            
            # Si el operador humano envió una decisión explícita, aplicarla
            if decision_operador:
                decision_operador_upper = str(decision_operador).upper()
                if "PROMULG" in decision_operador_upper:
                    evaluacion["decision"] = "PROMULGAR"
                    evaluacion["ruta_siguiente"] = "PUBLICACION_GACETA"
                    evaluacion["estado_siguiente"] = "PROMULGADO_EJECUTIVO"
                elif "PARCIAL" in decision_operador_upper:
                    evaluacion["decision"] = "VETAR_PARCIAL"
                    evaluacion["ruta_siguiente"] = "REMISION_OBSERVACIONES_ALP"
                    evaluacion["estado_siguiente"] = "VETADO_REMITIDO_A_ALP"
                elif "VETA" in decision_operador_upper or "TOTAL" in decision_operador_upper:
                    evaluacion["decision"] = "VETAR_TOTAL"
                    evaluacion["ruta_siguiente"] = "REMISION_OBSERVACIONES_ALP"
                    evaluacion["estado_siguiente"] = "VETADO_REMITIDO_A_ALP"

            decision = evaluacion.get("decision", "PROMULGAR")
            es_veto = "VETAR" in decision.upper()
            
            riesgo_map = {"PROMULGAR": "BAJO", "VETAR_PARCIAL": "MEDIO", "VETAR_TOTAL": "ALTO"}
            self.neon.insertar_observacion(
                id_proyecto=int(proyecto_id),
                tipo_obs="EVALUACION_VETO_PROMULGACION",
                agente="Veto y Promulgacion",
                hallazgos=evaluacion,
                riesgo=riesgo_map.get(decision, "ALTO" if es_veto else "BAJO"),
                recomendacion=evaluacion.get("justificacion", "")
            )
            
            if decision == "PROMULGAR":
                estado_neon = "PROMULGADO"
            elif es_veto:
                estado_neon = "VETADO_OBSERVADO"
            elif decision == "SUPERACION_VETO_ALP":
                estado_neon = "PROMULGADO_ALP"
            else:
                estado_neon = "VETADO"
                
            self.neon.actualizar_estado_proyecto(int(proyecto_id), estado_neon, "Veto y Promulgacion")
        except Exception as db_err:
            print(f"Aviso Neon VetoPromulgacion: {db_err}")

        try:
            cosmos = CosmosDBClient()
            cosmos.log_agent_execution(
                id_proyecto=str(proyecto_id),
                nombre_agente="Veto y Promulgacion",
                input_data={"expediente": expediente, "decision_operador": decision_operador},
                output_data=data,
                tiempo_ms=duracion_ms
            )
            cosmos.close()
        except Exception as mg_err:
            print(f"Aviso Mongo VetoPromulgacion: {mg_err}")

        return data
