# sma_unified/agents/publicacion.py

from typing import Dict, List, Any
import json
import time
from datetime import datetime, timedelta
from crewai import Task
from sma_unified.agents.base_agent import BaseAgenteLegislativo, get_base_agent
from sma_unified.agents.llm_client import chat_completion_resiliente
from sma_unified.db.neon_client import get_neon_client
from sma_unified.db.cosmos_client import CosmosDBClient


class AgentePublicacionOficial:
    """Agente Publicacion Oficial - Registro de ley en Boletin Oficial"""

    def __init__(self, base_agent: BaseAgenteLegislativo = None):
        self.base = base_agent or get_base_agent()
        self.agent = self.base.crear_agente('Publicacion_Oficial')
        self.neon = get_neon_client()

    def _obtener_numero_ley(self, proyecto_id: int) -> int:
        """Obtener el proximo numero de ley desde la base de datos o retornar secuencial"""
        try:
            query = """
                SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(numero_ley, '[^0-9]', '', 'g'), '') AS INTEGER)), 1400) as max_num
                FROM sistema.proyecto_ley
                WHERE numero_ley IS NOT NULL AND numero_ley != ''
            """
            rows = self.neon.ejecutar_query(query)
            if rows and rows[0].get("max_num"):
                return int(rows[0]["max_num"]) + 1
            return 1401
        except Exception:
            # Numero secuencial por defecto si no hay conexion
            return 1400 + int(proyecto_id)

    def crear_tarea(self, evaluacion_veto: Dict, proyecto_info: Dict) -> Task:
        """Crear tarea CrewAI de publicacion oficial"""
        prompt = f"""
        Publica oficialmente la ley promulgada en el Boletin Oficial.
        PROYECTO: ID={proyecto_info.get('id', 'N/A')}, Titulo={proyecto_info.get('titulo', 'N/A')}
        EVALUACION: {json.dumps(evaluacion_veto, indent=2, ensure_ascii=False)}
        INSTRUCCIONES: Asigna numero de ley secuencial, establece fecha de vigencia (dia siguiente),
        formatea para Boletin Oficial, registra en base normativa.
        Responde UNICAMENTE con JSON con la clave publicacion_oficial.
        """
        return Task(
            description=prompt,
            agent=self.agent,
            expected_output="JSON con datos de publicacion oficial en Boletin"
        )

    def ejecutar(self, evaluacion_veto: Dict, proyecto_info: Dict) -> Dict:
        """Ejecutar publicacion oficial con persistencia determinista"""
        t0 = time.time()
        proyecto_id = proyecto_info.get('id') or proyecto_info.get('id_proyecto') or 1

        # Verificar decision de promulgacion
        decision = evaluacion_veto.get("evaluacion_veto", {}).get("decision", "PROMULGAR")
        if decision != "PROMULGAR":
            return {
                "publicacion_oficial": {
                    "proyecto_id": str(proyecto_id),
                    "estado": "NO_PUBLICADA",
                    "razon": f"Proyecto vetado ({decision}). No procede publicacion."
                }
            }

        # Calcular numero de ley y fechas
        numero_ley_int = self._obtener_numero_ley(int(proyecto_id))
        fecha_promulgacion = datetime.now().strftime("%Y-%m-%d")
        fecha_vigencia = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        boletin_id = f"BOL-{datetime.now().strftime('%Y-%m-%d')}-{numero_ley_int:04d}"

        system_prompt = (
            "Eres el Registrador Oficial de Leyes del Estado Plurinacional. "
            "Tu proceso es determinista: asignas numero de ley, fecha de vigencia y "
            "codigos de boletin oficial. No hay interpretacion. Responde en JSON valido."
        )
        user_prompt = f"""
        Proyecto: {proyecto_info.get('titulo', 'Ley del Estado Plurinacional')} (ID: {proyecto_id})
        Numero de Ley asignado: {numero_ley_int}
        Fecha de promulgacion: {fecha_promulgacion}
        Fecha de vigencia: {fecha_vigencia}
        Codigo de Boletin: {boletin_id}

        Genera el JSON de publicacion oficial:
        {{
          "publicacion_oficial": {{
            "proyecto_id": "{proyecto_id}",
            "numero_ley": "Ley No. {numero_ley_int}",
            "titulo": "{proyecto_info.get('titulo', 'Ley Plurinacional')}",
            "fecha_promulgacion": "{fecha_promulgacion}",
            "fecha_vigencia": "{fecha_vigencia}",
            "boletin_oficial": "{boletin_id}",
            "texto_publicacion": "Se promulga la presente Ley en el marco de la CPE 2009...",
            "estado": "PUBLICADA",
            "estado_siguiente": "LEY_VIGENTE"
          }}
        }}
        """

        try:
            raw_res, modelo = chat_completion_resiliente(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0,
                max_tokens=800
            )
            data = json.loads(raw_res)
        except Exception:
            data = {
                "publicacion_oficial": {
                    "proyecto_id": str(proyecto_id),
                    "numero_ley": f"Ley No. {numero_ley_int}",
                    "titulo": proyecto_info.get('titulo', 'Ley Plurinacional'),
                    "fecha_promulgacion": fecha_promulgacion,
                    "fecha_vigencia": fecha_vigencia,
                    "boletin_oficial": boletin_id,
                    "texto_publicacion": f"Se promulga la Ley No. {numero_ley_int} conforme al proceso legislativo constitucional.",
                    "estado": "PUBLICADA",
                    "estado_siguiente": "LEY_VIGENTE"
                }
            }

        duracion_ms = int((time.time() - t0) * 1000)

        try:
            pub = data.get("publicacion_oficial", {})
            self.neon.insertar_observacion(
                id_proyecto=int(proyecto_id),
                tipo_obs="PUBLICACION_OFICIAL",
                agente="Publicacion Oficial",
                hallazgos=pub,
                riesgo="BAJO",
                recomendacion=f"Ley publicada en Boletin Oficial {boletin_id}"
            )
            self.neon.actualizar_estado_proyecto(int(proyecto_id), "LEY_PUBLICADA", "Publicacion Oficial")
        except Exception as db_err:
            print(f"Aviso Neon Publicacion: {db_err}")

        try:
            cosmos = CosmosDBClient()
            cosmos.log_agent_execution(
                id_proyecto=str(proyecto_id),
                nombre_agente="Publicacion Oficial",
                input_data={"evaluacion_veto": evaluacion_veto},
                output_data=data,
                tiempo_ms=duracion_ms
            )
            cosmos.close()
        except Exception as mg_err:
            print(f"Aviso Mongo Publicacion: {mg_err}")

        return data
