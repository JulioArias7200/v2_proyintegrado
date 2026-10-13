# sma_unified/agents/secretario.py

from typing import Dict, List, Any
import json
import time
from crewai import Task
from sma_unified.agents.base_agent import BaseAgenteLegislativo, get_base_agent
from sma_unified.agents.llm_client import chat_completion_resiliente
from sma_unified.db.neon_client import get_neon_client
from sma_unified.db.cosmos_client import CosmosDBClient
from sma_unified.db.mongo_atlas import guardar_acta_detallada_mongo

class AgenteSecretarioCamara:
    """Agente Secretario de Cámara — Registro integral de debates, quórum, votaciones y actas formales"""
    
    def __init__(self, base_agent: BaseAgenteLegislativo = None):
        self.base = base_agent or get_base_agent()
        self.agent = self.base.crear_agente('Secretario_Camara')
        self.neon = get_neon_client()
    
    def crear_tarea(self, debate_data: Dict, proyecto_info: Dict) -> Task:
        """Crear tarea CrewAI de registro integral del debate parlamentario"""
        prompt = f"""
        Registra de manera fidedigna y exhaustiva la sesión plenaria conforme al Reglamento Camaral.
        
        PROYECTO DE LEY:
        - ID: {proyecto_info.get('id', proyecto_info.get('id_proyecto', 'N/A'))}
        - Título: {proyecto_info.get('titulo', proyecto_info.get('titulo_proyecto', 'N/A'))}
        
        DATOS DE LA SESIÓN Y DEBATE:
        {json.dumps(debate_data, indent=2, ensure_ascii=False)}
        
        INSTRUCCIONES OBLIGATORIAS:
        1. Registra metadatos de sesión (cámara, fecha, tipo de sesión) y verifica quórum legal (asistencias).
        2. Ordena cronológicamente el diario de debates registrando oradores por bancada política y posturas.
        3. Documenta mociones de sala (previas, de orden, incidentales o de aplazamiento).
        4. Realiza el cómputo de la DOBLE VOTACIÓN NOMINAL:
           a) Votación En Grande: Requiere Mayoría Absoluta (> 50% presentes). Si no alcanza, declarar RECHAZADO y archivar.
           b) Votación En Detalle: Registrar escrutinio nominal artículo por artículo (aprobados, modificados o suprimidos).
        5. Emite la certificación oficial del acta para su remisión al Agente de Comunicación Bicameral.
        
        Genera un JSON válido con la clave 'acta_debate'.
        """
        return Task(
            description=prompt,
            agent=self.agent,
            expected_output="JSON con acta formal estructurada, cómputo de votaciones y resolución constitucional"
        )
    
    def ejecutar(self, debate_data: Dict, proyecto_info: Dict) -> Dict:
        """Ejecutar registro del debate con resiliencia LLM, validación de mayorías y persistencia"""
        t0 = time.time()
        proyecto_id = proyecto_info.get('id') or proyecto_info.get('id_proyecto') or 1
        
        system_prompt = (
            "Eres el Secretario de Cámara y fedatario de la Asamblea Legislativa Plurinacional de Bolivia. "
            "Tu deber es redactar el Acta Oficial y el Diario de Debates con máxima fidelidad conforme al "
            "Reglamento Camaral y la CPE 2009. Computa quórum y mayorías absolutas con rigor matemático. "
            "Responde estrictamente en formato JSON válido."
        )
        user_prompt = f"""
        Proyecto: {proyecto_info.get('titulo', 'Proyecto de Ley')} (ID: {proyecto_id})
        Datos suministrados de la sesión plenaria:
        {json.dumps(debate_data, ensure_ascii=False, indent=2)}
        
        Genera el JSON con el Acta Oficial estructurada:
        {{
          "acta_debate": {{
            "fecha": "2026-09-19",
            "sesion_numero": 14,
            "camara": "Cámara de Diputados",
            "tipo_sesion": "ORDINARIA",
            "quorum_legal": {{
              "total_miembros": 130,
              "presentes": 115,
              "quorum_verificado": true
            }},
            "intervenciones": [
              {{
                "orden": 1,
                "legislador": "Dip. Roberto Quispe",
                "partido": "Bancada Mayoritaria",
                "postura": "A_FAVOR",
                "contenido": "Fundamentación técnica y necesidad social del proyecto",
                "timestamp": "10:30"
              }}
            ],
            "mociones": [
              {{
                "tipo": "PREVIA",
                "proponente": "Dip. Marcelo Vaca",
                "resultado": "RECHAZADA"
              }}
            ],
            "votacion_en_grande": {{
              "total_votantes": 115,
              "favor": 85,
              "contra": 25,
              "abstenciones": 5,
              "mayoria_absoluta_requerida": 58,
              "resultado": "APROBADO"
            }},
            "votacion_en_detalle": [
              {{
                "articulo": 1,
                "favor": 88,
                "contra": 22,
                "abstenciones": 5,
                "resultado": "APROBADO"
              }}
            ],
            "acuerdos": ["Aprobación íntegra en Grande y Detalle con modificaciones sugeridas"],
            "resultado_final": "APROBADO_EN_GRANDE_Y_DETALLE",
            "estado_siguiente": "EN_TRAMITE_BICAMERAL",
            "observaciones_secretaria": "Acta debidamente certificada y lista para remisión a Cámara Revisora."
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
                max_tokens=2500
            )
            data = json.loads(raw_res)
        except Exception:
            # Fallback estructurado y seguro
            presentes = debate_data.get("presentes", 110)
            favor_grande = debate_data.get("favor_grande", 75)
            contra_grande = debate_data.get("contra_grande", 30)
            abst_grande = debate_data.get("abstenciones_grande", 5)
            aprobado_grande = favor_grande > (presentes / 2)
            
            resultado_final = "APROBADO_EN_GRANDE_Y_DETALLE" if aprobado_grande else "RECHAZADO_EN_ORIGEN_ARCHIVADO"
            estado_siguiente = "EN_TRAMITE_BICAMERAL" if aprobado_grande else "ARCHIVADO_LEGISLATURA"
            
            data = {
                "acta_debate": {
                    "fecha": "2026-09-19",
                    "sesion_numero": 1,
                    "camara": "Cámara de Origen",
                    "tipo_sesion": "ORDINARIA",
                    "quorum_legal": {
                        "total_miembros": 130,
                        "presentes": presentes,
                        "quorum_verificado": True
                    },
                    "intervenciones": debate_data.get("intervenciones", []),
                    "mociones": debate_data.get("mociones", []),
                    "votacion_en_grande": {
                        "total_votantes": presentes,
                        "favor": favor_grande,
                        "contra": contra_grande,
                        "abstenciones": abst_grande,
                        "mayoria_absoluta_requerida": (presentes // 2) + 1,
                        "resultado": "APROBADO" if aprobado_grande else "RECHAZADO"
                    },
                    "votacion_en_detalle": debate_data.get("votaciones_detalle", [
                        {"articulo": 1, "favor": favor_grande, "contra": contra_grande, "abstenciones": abst_grande, "resultado": "APROBADO"}
                    ]),
                    "acuerdos": ["Acta oficial de debate parlamentario procesada."],
                    "resultado_final": resultado_final,
                    "estado_siguiente": estado_siguiente,
                    "observaciones_secretaria": "Acta procesada por el Secretario de Cámara."
                }
            }
        
        duracion_ms = int((time.time() - t0) * 1000)
        
        # Validación matemática formal con control_legislativo
        try:
            from sma_unified.agents.control_legislativo import validar_acta
            acta_cruda = data.get("acta_debate", {})
            if not acta_cruda.get("texto_aprobado"):
                acta_cruda["texto_aprobado"] = (proyecto_info.get("texto_completo") or
                                                proyecto_info.get("contenido_texto") or
                                                proyecto_info.get("texto") or
                                                proyecto_info.get("titulo") or "Texto Oficial Sometido a Votación")
            if not acta_cruda.get("camara"):
                acta_cruda["camara"] = "DIPUTADOS"
            if not acta_cruda.get("sesion_numero"):
                acta_cruda["sesion_numero"] = debate_data.get("sesion_numero", 1)
            if not acta_cruda.get("referencia_acta"):
                acta_cruda["referencia_acta"] = f"ACTA-SES-{acta_cruda.get('sesion_numero', 1)}-2026"
            acta = validar_acta(acta_cruda)
            data["acta_debate"] = acta
            data["estado_ejecucion"] = acta.get("resultado_final", "APROBADO_EN_GRANDE_Y_DETALLE")
            data["puede_continuar"] = acta.get("resultado_final") == "APROBADO_EN_GRANDE_Y_DETALLE"
        except Exception as e_val:
            print(f"Aviso validación acta Secretario: {e_val}")
            acta = data.get("acta_debate", {})

        resultado = acta.get("resultado_final", "APROBADO_EN_GRANDE_Y_DETALLE")
        es_rechazado = "RECHAZADO" in str(resultado)
        
        # Persistencia Neon (usando método transaccional si existe)
        try:
            if hasattr(self.neon, "guardar_insumo_legislativo"):
                self.neon.guardar_insumo_legislativo(
                    int(proyecto_id), "ACTA_DEBATE", data,
                    "Secretario de Cámara", acta.get("estado_siguiente", "EN_TRAMITE_BICAMERAL")
                )
            else:
                self.neon.insertar_observacion(
                    id_proyecto=int(proyecto_id),
                    tipo_obs="ACTA_DEBATE",
                    agente="Secretario de Cámara",
                    hallazgos=acta,
                    riesgo="ALTO" if es_rechazado else "BAJO",
                    recomendacion="Proyecto rechazado en Cámara de Origen y archivado en legislatura." if es_rechazado else "Acta formal de debate aprobada. Remitido a trámite bicameral."
                )
                nuevo_estado = "RECHAZADO_ORIGEN" if es_rechazado else "EN_TRAMITE_BICAMERAL"
                self.neon.actualizar_estado_proyecto(int(proyecto_id), nuevo_estado, "Secretario de Cámara")
        except Exception as err:
            print(f"Aviso Neon Secretario: {err}")
            
        # MongoDB logging en agent_executions
        try:
            cosmos = CosmosDBClient()
            cosmos.log_agent_execution(
                id_proyecto=str(proyecto_id),
                nombre_agente="Secretario de Cámara",
                input_data=debate_data,
                output_data=data,
                tiempo_ms=duracion_ms
            )
            cosmos.close()
        except Exception as err:
            print(f"Aviso Mongo Secretario: {err}")

        # Guardar Acta Detallada Oficial en MongoDB (actas_detalladas)
        try:
            acta_info = data.get("acta_debate", {})
            sesion_num = acta_info.get("sesion_numero", debate_data.get("sesion_numero", 1))
            guardar_acta_detallada_mongo({
                "id_proyecto": int(proyecto_id) if str(proyecto_id).isdigit() else proyecto_id,
                "sesion_id": debate_data.get("sesion_id") or proyecto_info.get("sesion_id"),
                "id_sesion": sesion_num,
                "numero_sesion": f"SES-{sesion_num}",
                "camara": acta_info.get("camara", debate_data.get("camara", "Cámara de Diputados")),
                "fecha_sesion": acta_info.get("fecha", time.strftime("%Y-%m-%d")),
                "acta_debate": acta_info,
                "intervenciones": acta_info.get("intervenciones", []),
                "votaciones": acta_info.get("votaciones", []),
                "acuerdos": acta_info.get("acuerdos", []),
                "estado_siguiente": acta_info.get("estado_siguiente", "EN_TRAMITE_BICAMERAL"),
                "proyecto_titulo": proyecto_info.get("titulo", proyecto_info.get("titulo_proyecto", "")),
                "duracion_ms": duracion_ms,
            })
        except Exception as e_acta:
            print(f"Aviso guardando acta detallada en Mongo: {e_acta}")
            
        return data
