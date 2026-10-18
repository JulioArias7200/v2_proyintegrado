"""Asesoría ejecutiva sobre un expediente aprobado por un revisor humano."""
import json
from typing import Dict
from crewai import Task
from sma_unified.agents.base_agent import get_base_agent
from sma_unified.agents.llm_client import chat_completion_resiliente, extraer_json_de_llm
from sma_unified.db.neon_client import get_neon_client
from sma_unified.db.cosmos_client import registrar_traza_legislativa
from sma_unified.config import load_control_aprobacion


class AgenteVetoPromulgacion:
    def __init__(self, base_agent=None):
        self.base = base_agent or get_base_agent()
        self.neon = get_neon_client()

    @property
    def agent(self):
        """Conserva la interfaz CrewAI sin inicializar el modelo para validar datos."""
        return self.base.crear_agente("Veto_Promulgacion")

    def crear_tarea(self, expediente: Dict, proyecto_info: Dict) -> Task:
        return Task(description="Analizar el expediente sancionado conforme a CPE arts. 163 y 164. Emitir una recomendación fundada; esperar la decisión documentada de la autoridad competente.\n" + json.dumps({"proyecto_info": proyecto_info, "expediente": expediente}, ensure_ascii=False),
                    agent=self.agent,
                    expected_output="JSON evaluacion_veto con recomendación técnica y decisión pendiente")

    def ejecutar(self, expediente: Dict, proyecto_info: Dict, usuario_registrador=None) -> Dict:
        proyecto_id = proyecto_info.get("id") or proyecto_info.get("id_proyecto") or 1
        
        try:
            ciclo = self.neon.obtener_aprobacion_bicameral(int(proyecto_id))
        except Exception as e:
            raise ValueError(f"Se requiere una aprobacion bicameral vigente y guardada: {e}") from e
        decision = expediente.get("decision_operador")
        if decision is not None and decision not in ("PROMULGAR", "VETAR_TOTAL", "VETAR_PARCIAL"):
            raise ValueError("Decisión no válida: usar PROMULGAR, VETAR_TOTAL o VETAR_PARCIAL")
        if decision and (not usuario_registrador or not str(expediente.get("referencia_decision", "")).strip()):
            raise ValueError("Se requiere usuario autenticado y referencia del documento de decisión")
        recomendacion = {"dictamen_sugerido": "NO_DISPONIBLE",
                         "resumen_ejecutivo": "Asesoría no disponible. Se requiere revisión humana.",
                         "alertas_constitucionales": [], "alertas_fiscales": [], "fundamentacion": ""}
        pliego = []
        if not decision:
            try:
                raw, _ = chat_completion_resiliente(messages=[
                    {"role": "system", "content": "Eres asesor jurídico boliviano. CPE arts. 163 y 164. Examina solo evidencia recibida. No inventes respaldo fiscal, fechas ni cumplimiento. No promulgas ni vetas. Responde JSON evaluacion_veto con recomendacion_tecnica y pliego_observaciones."},
                    {"role": "user", "content": json.dumps(ciclo, ensure_ascii=False)}],
                    temperature=0.1, max_tokens=2500)
                datos = extraer_json_de_llm(raw)
                evaluacion = datos.get("evaluacion_veto", {}) if isinstance(datos, dict) else {}
                if isinstance(evaluacion.get("recomendacion_tecnica"), dict):
                    recomendacion = evaluacion["recomendacion_tecnica"]
                if isinstance(evaluacion.get("pliego_observaciones"), list):
                    pliego = evaluacion["pliego_observaciones"]
            except Exception:
                pass
        else:
            # Conserva la asesoría persistida, sin consultar de nuevo al modelo al registrar la decisión.
            previa = self.neon.ejecutar_query(
                "SELECT hallazgos FROM sistema.observaciones_unificadas WHERE id_proyecto = %s AND tipo_observacion = 'EVALUACION_VETO_PROMULGACION' ORDER BY id DESC LIMIT 1",
                (int(proyecto_id),))
            if previa:
                ev = previa[0]["hallazgos"].get("evaluacion_veto", {})
                if ev.get("id_revision") == ciclo["id_revision"]:
                    recomendacion = ev.get("recomendacion_tecnica", recomendacion)
                    pliego = ev.get("pliego_observaciones", [])
        evaluacion = {"proyecto_id": int(proyecto_id), "modo_control": "HUMAN_IN_THE_LOOP",
                      "roles_registro": load_control_aprobacion()["roles_permitidos"],
                      "decision": decision or "PENDIENTE_DECISION_HUMANA",
                      "recomendacion_tecnica": recomendacion, "pliego_observaciones": pliego,
                      "plazo_constitucional_dias": 10, "tipo_dias": "HABILES",
                      "referencia_decision": str(expediente.get("referencia_decision", "")).strip(),
                      "ruta_siguiente": "PUBLICACION_GACETA" if decision == "PROMULGAR" else "REMISION_OBSERVACIONES_ALP" if decision else "DECISION_HUMANA",
                      "estado_siguiente": "PROMULGADO_DOCUMENTADO" if decision == "PROMULGAR" else "VETADO_DOCUMENTADO" if decision else "PENDIENTE_DECISION_HUMANA",
                      "opciones_operador_humano": [{"accion": a, "etiqueta": e} for a, e in
                          (("PROMULGAR", "Registrar promulgación documentada"), ("VETAR_TOTAL", "Registrar veto total"), ("VETAR_PARCIAL", "Registrar veto parcial"))],
                      "justificacion": "La asesoría no sustituye la decisión de la autoridad competente."}
        resultado = {"evaluacion_veto": evaluacion}
        try:
            resultado["id_registro"] = self.neon.guardar_evaluacion_ejecutiva(int(proyecto_id), ciclo, resultado, usuario_registrador)
        except Exception as e_ev:
            if decision:
                raise RuntimeError(f"No se pudo guardar la decisión ejecutiva: {e_ev}") from e_ev
            print(f"Aviso guardando evaluacion ejecutiva: {e_ev}")
            resultado["id_registro"] = 1
        try:
            registrar_traza_legislativa(proyecto_id, "Veto y Promulgación", {"expediente": expediente}, resultado)
        except Exception:
            pass
        return resultado
