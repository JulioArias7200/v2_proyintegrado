# sma_unified/agents/crew_orchestrator.py
"""
Orquestador CrewAI Unificado - Pipeline Legislativo Completo
=============================================================
Coordina todos los agentes en el flujo definido por workflows.yaml:
  Etapa 1: Distribuidor (clasificacion)
  Etapa 2: Auditoria Paralela (Constitucional + Consistencia + Comision)
  Etapa 3: Analisis Fondo Constitucional
  Etapa 4: Concentracion (Sintesis)
  Etapa 5: Debate (Secretario Camara)
  Etapa 6: Bicameral
  Etapa 7: Veto / Promulgacion
  Etapa 8: Publicacion Oficial
"""

import time
import json
from typing import Dict, Any, Optional, Callable

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("crew_orchestrator")

from sma_unified.agents.base_agent import get_base_agent
from sma_unified.agents.concentrador import AgenteConcentrador
from sma_unified.agents.secretario import AgenteSecretarioCamara
from sma_unified.agents.bicameral import AgenteBicameral
from sma_unified.agents.veto_promulgacion import AgenteVetoPromulgacion
from sma_unified.agents.publicacion import AgentePublicacionOficial
from sma_unified.agents.constitucion_fondo import AgenteConstitucionFondo
from sma_unified.agents.especialista_tecnico import AgenteEspecialistaTecnico
from sma_unified.agents.presidencia_comision import AgentePresidenciaComision
from sma_unified.agents.presupuesto import AgentePresupuesto
from sma_unified.agents.difusion_ciudadana import AgenteDifusionCiudadana
from sma_unified.agents.fiscalizacion import AgenteFiscalizacion
from sma_unified.db.neon_client import get_neon_client


def ejecutar_pipeline_completo(
    proyecto_info: Dict[str, Any],
    texto_documento: str,
    observaciones_previas: Optional[list] = None,
    on_progress: Optional[Callable[[str, str, str], None]] = None,
) -> Dict[str, Any]:
    """
    Ejecuta el pipeline legislativo completo desde la fase de analisis constitucional
    hasta la publicacion oficial.
    
    Args:
        proyecto_info: Diccionario con id, titulo, tipo del proyecto
        texto_documento: Texto completo del proyecto de ley
        observaciones_previas: Lista de observaciones de agentes de nivel 2 ya ejecutados
        on_progress: Callback(etapa, estado, mensaje) para actualizar UI en tiempo real
    
    Returns:
        Diccionario con resultados de todas las etapas
    """
    t0 = time.time()
    resultados = {}
    base = get_base_agent()
    neon = get_neon_client()
    obs = observaciones_previas or []

    def _progress(etapa: str, estado: str, msg: str):
        logger.info(f"[{etapa}] {estado}: {msg}")
        if on_progress:
            try:
                on_progress(etapa, estado, msg)
            except Exception:
                pass

    # ── ETAPA 3: Analisis Constitucional de Fondo ──────────────────────────
    _progress("Etapa_3_Analisis_Fondo", "EN_PROCESO", "Iniciando analisis hermeneutico constitucional...")
    try:
        agente_fondo = AgenteConstitucionFondo(base_agent=base)
        obs_formales = [o for o in obs if o.get("tipo") in ("CONSTITUCIONAL", "VERIFICACION_CONSTITUCIONAL")]
        resultado_fondo = agente_fondo.ejecutar(
            texto_proyecto=texto_documento,
            obs_formales=obs_formales,
            proyecto_info=proyecto_info
        )
        resultados["constitucion_fondo"] = resultado_fondo
        dictamen = resultado_fondo.get("dictamen_fondo", {})
        _progress("Etapa_3_Analisis_Fondo", "COMPLETADO", 
                  f"Viabilidad: {dictamen.get('viabilidad_fondo', 'N/A')} | Riesgo: {dictamen.get('riesgo_constitucional', 'N/A')}")
        
        # Agregar dictamen de fondo a observaciones
        obs.append({
            "tipo": "DICTAMEN_CONSTITUCIONAL_FONDO",
            "agente_origen": "Comision Constitucion Fondo",
            "contenido": dictamen.get("recomendaciones", ""),
            "riesgo": dictamen.get("riesgo_constitucional", "BAJO"),
            "viabilidad": dictamen.get("viabilidad_fondo", "VIABLE")
        })
    except Exception as e:
        _progress("Etapa_3_Analisis_Fondo", "ERROR", str(e))
        resultados["constitucion_fondo"] = {"error": str(e)}

    # ── DICTAMEN TÉCNICO PERICIAL (Especialista Técnico) ───────────────────
    _progress("Dictamen_Tecnico", "EN_PROCESO", "Evaluando viabilidad tecnica y estandares...")
    try:
        agente_tec = AgenteEspecialistaTecnico(base_agent=base)
        resultado_tec = agente_tec.ejecutar(
            texto_proyecto=texto_documento,
            proyecto_info=proyecto_info
        )
        resultados["especialista_tecnico"] = resultado_tec
        dic_tec = resultado_tec.get("dictamen_tecnico", {})
        _progress("Dictamen_Tecnico", "COMPLETADO", f"Viabilidad técnica: {dic_tec.get('viabilidad_tecnica', 'VIABLE')}")
        obs.append({
            "tipo": "DICTAMEN_TECNICO",
            "agente_origen": "Especialista Técnico",
            "contenido": dic_tec.get("dictamen_tecnico_resumen", ""),
            "riesgo": "BAJO" if dic_tec.get("viabilidad_tecnica") == "VIABLE" else "MEDIO",
            "viabilidad": dic_tec.get("viabilidad_tecnica", "VIABLE")
        })
    except Exception as e:
        _progress("Dictamen_Tecnico", "ERROR", str(e))
        resultados["especialista_tecnico"] = {"error": str(e)}

    # ── DICTAMEN FISCAL Y PRESUPUESTARIO (Planificación y Presupuesto) ────
    _progress("Dictamen_Presupuestario", "EN_PROCESO", "Evaluando impacto en TGN y Ley 1178...")
    try:
        agente_pto = AgentePresupuesto(base_agent=base)
        resultado_pto = agente_pto.ejecutar(
            texto_proyecto=texto_documento,
            proyecto_info=proyecto_info
        )
        resultados["presupuesto"] = resultado_pto
        dic_pto = resultado_pto.get("evaluacion_fiscal", {})
        _progress("Dictamen_Presupuestario", "COMPLETADO", f"Sostenibilidad: {dic_pto.get('viabilidad_fiscal', 'SOSTENIBLE')}")
        obs.append({
            "tipo": "DICTAMEN_PRESUPUESTARIO",
            "agente_origen": "Planificación y Presupuesto",
            "contenido": dic_pto.get("recomendacion_fiscal", ""),
            "riesgo": "BAJO" if dic_pto.get("alerta_presupuesto_tgn") == "VERDE" else "ALTO",
            "viabilidad": dic_pto.get("viabilidad_fiscal", "SOSTENIBLE")
        })
    except Exception as e:
        _progress("Dictamen_Presupuestario", "ERROR", str(e))
        resultados["presupuesto"] = {"error": str(e)}

    # ── ETAPA 4: Concentracion (Sintesis) ──────────────────────────────────
    _progress("Etapa_4_Sintesis", "EN_PROCESO", "Consolidando observaciones de todos los agentes...")
    try:
        agente_conc = AgenteConcentrador(base_agent=base)
        resultado_conc = agente_conc.ejecutar(
            observaciones=obs,
            proyecto_info={**proyecto_info, 'texto_proyecto': texto_documento}
        )
        resultados["concentrador"] = resultado_conc
        expediente = resultado_conc.get("expediente_consolidado", {})
        _progress("Etapa_4_Sintesis", "COMPLETADO",
                  f"Riesgo general: {expediente.get('nivel_riesgo_general', 'N/A')} | {len(obs)} observaciones integradas")
    except Exception as e:
        _progress("Etapa_4_Sintesis", "ERROR", str(e))
        resultados["concentrador"] = {"error": str(e)}
        expediente = {}

    # ── ETAPA 5: Debate Legislativo (Secretario) ───────────────────────────
    _progress("Etapa_5_Debate", "EN_PROCESO", "Registrando debate parlamentario...")
    try:
        agente_sec = AgenteSecretarioCamara(base_agent=base)
        debate_data = {
            "proyecto_titulo": proyecto_info.get("titulo", ""),
            "expediente_previo": expediente,
            "observaciones_count": len(obs),
        }
        resultado_sec = agente_sec.ejecutar(
            debate_data=debate_data,
            proyecto_info=proyecto_info
        )
        resultados["secretario"] = resultado_sec
        acta = resultado_sec.get("acta_debate", {})
        _progress("Etapa_5_Debate", "COMPLETADO",
                  f"Sesion #{acta.get('sesion_numero', 1)} | {len(acta.get('votaciones', []))} votaciones registradas")
    except Exception as e:
        _progress("Etapa_5_Debate", "ERROR", str(e))
        resultados["secretario"] = {"error": str(e)}
        resultado_sec = {}

    # ── ETAPA 6: Tramite Bicameral ─────────────────────────────────────────
    _progress("Etapa_6_Bicameral", "EN_PROCESO", "Iniciando tramite bicameral entre camaras...")
    try:
        agente_bic = AgenteBicameral(base_agent=base)
        acta_debate = resultado_sec.get("acta_debate", {})
        # Version original: texto real del proyecto tal como entro al pipeline.
        version_original = {
            "articulos": [texto_documento],
            "sesion_origen": acta_debate.get("sesion_numero", 1),
        }
        # Version retornada: aun no existe una etapa de edicion real por la
        # Camara Revisora en este sistema, asi que se usa el propio texto
        # mas los acuerdos/observaciones surgidos del debate (lo unico que
        # refleja cambios sugeridos hasta ahora). Cuando exista una etapa
        # real de "camara revisora" que produzca un texto editado, debe
        # reemplazar este bloque.
        version_retornada = {
            "articulos": [texto_documento],
            "acuerdos_debate": acta_debate.get("acuerdos", []),
            "sesion_revision": acta_debate.get("sesion_numero", 1) + 1,
        }
        resultado_bic = agente_bic.ejecutar(
            version_original=version_original,
            version_retornada=version_retornada,
            proyecto_info=proyecto_info
        )
        resultados["bicameral"] = resultado_bic
        ciclo = resultado_bic.get("ciclo_bicameral", {})
        _progress("Etapa_6_Bicameral", "COMPLETADO",
                  f"Cambios: {ciclo.get('clasificacion_cambios', 'N/A')} | Ruta: {ciclo.get('ruta_siguiente', 'N/A')}")
    except Exception as e:
        _progress("Etapa_6_Bicameral", "ERROR", str(e))
        resultados["bicameral"] = {"error": str(e)}
        ciclo = {}

    # ── Bifurcacion segun la decision del Agente Bicameral ─────────────────
    # Si el tramite requiere Conferencia Bicameral (cambios MAYORES), el
    # proyecto no debe pasar directo a Veto/Promulgacion: queda detenido en
    # esta etapa hasta que se resuelva la conferencia.
    ruta_bicameral = ciclo.get("ruta_siguiente", "SANCION_DIRECTA")
    if ruta_bicameral != "SANCION_DIRECTA":
        _progress("Etapa_7_Veto", "OMITIDA", f"Pendiente de Conferencia Bicameral (ruta: {ruta_bicameral})")
        resultados["veto_promulgacion"] = {
            "evaluacion_veto": {
                "decision": "PENDIENTE_CONFERENCIA_BICAMERAL",
                "razon": ciclo.get("justificacion", ""),
            }
        }
        resultados["publicacion"] = {
            "publicacion_oficial": {
                "estado": "NO_PUBLICADA",
                "razon": "Proyecto detenido en Conferencia Bicameral",
            }
        }
        duracion_total = int((time.time() - t0) * 1000)
        resultados["_meta"] = {
            "duracion_total_ms": duracion_total,
            "etapas_ejecutadas": list(resultados.keys()),
            "decision_final": "PENDIENTE_CONFERENCIA_BICAMERAL",
            "proyecto_id": proyecto_info.get("id") or proyecto_info.get("id_proyecto"),
        }
        logger.info(f"Pipeline detenido en Conferencia Bicameral: {duracion_total}ms")
        return resultados

    # ── ETAPA 7: Evaluacion Veto / Promulgacion ────────────────────────────
    _progress("Etapa_7_Veto", "EN_PROCESO", "Evaluacion estrategica multicriterio en curso...")
    try:
        agente_veto = AgenteVetoPromulgacion(base_agent=base)
        resultado_veto = agente_veto.ejecutar(
            expediente=expediente,
            proyecto_info=proyecto_info
        )
        resultados["veto_promulgacion"] = resultado_veto
        eval_veto = resultado_veto.get("evaluacion_veto", {})
        _progress("Etapa_7_Veto", "COMPLETADO",
                  f"Decision: {eval_veto.get('decision', 'N/A')} | Score: {eval_veto.get('score_final', 'N/A')}")
    except Exception as e:
        _progress("Etapa_7_Veto", "ERROR", str(e))
        resultados["veto_promulgacion"] = {"error": str(e)}
        resultado_veto = {"evaluacion_veto": {"decision": "PROMULGAR"}}

    # ── ETAPA 8: Publicacion Oficial ───────────────────────────────────────
    decision_final = resultado_veto.get("evaluacion_veto", {}).get("decision", "PROMULGAR")
    if decision_final == "PROMULGAR":
        _progress("Etapa_8_Publicacion", "EN_PROCESO", "Registrando ley en Boletin Oficial...")
        try:
            agente_pub = AgentePublicacionOficial(base_agent=base)
            resultado_pub = agente_pub.ejecutar(
                evaluacion_veto=resultado_veto,
                proyecto_info=proyecto_info
            )
            resultados["publicacion"] = resultado_pub
            pub = resultado_pub.get("publicacion_oficial", {})
            _progress("Etapa_8_Publicacion", "COMPLETADO",
                      f"{pub.get('numero_ley', 'N/A')} publicada | Vigencia: {pub.get('fecha_vigencia', 'N/A')}")

            # ── FASE 5: DIFUSIÓN CIUDADANA EN LENGUAJE CLARO ─────────────
            _progress("Difusion_Ciudadana", "EN_PROCESO", "Traduciendo a lenguaje claro y elaborando FAQ...")
            try:
                agente_dif = AgenteDifusionCiudadana(base_agent=base)
                resultado_dif = agente_dif.ejecutar(
                    texto_ley=texto_documento,
                    ley_info=pub
                )
                resultados["difusion_ciudadana"] = resultado_dif
                _progress("Difusion_Ciudadana", "COMPLETADO", "Guía ciudadana generada exitosamente")
            except Exception as ed:
                _progress("Difusion_Ciudadana", "ERROR", str(ed))
                resultados["difusion_ciudadana"] = {"error": str(ed)}

            # ── FASE 5: CONTROL POSTERIOR Y FISCALIZACIÓN ───────────────
            _progress("Fiscalizacion", "EN_PROCESO", "Estableciendo línea base de control posterior...")
            try:
                agente_fisc = AgenteFiscalizacion(base_agent=base)
                resultado_fisc = agente_fisc.ejecutar(
                    datos_ejecucion={
                        "dias_transcurridos": 0,
                        "decreto_reglamentario_emitido": False,
                        "presupuesto_ejecutado": 0.0
                    },
                    ley_info=pub
                )
                resultados["fiscalizacion"] = resultado_fisc
                _progress("Fiscalizacion", "COMPLETADO", "Línea base de fiscalización registrada")
            except Exception as ef:
                _progress("Fiscalizacion", "ERROR", str(ef))
                resultados["fiscalizacion"] = {"error": str(ef)}
        except Exception as e:
            _progress("Etapa_8_Publicacion", "ERROR", str(e))
            resultados["publicacion"] = {"error": str(e)}
    else:
        _progress("Etapa_8_Publicacion", "OMITIDA", f"Publicacion omitida por decision: {decision_final}")
        resultados["publicacion"] = {
            "publicacion_oficial": {
                "estado": "NO_PUBLICADA",
                "razon": f"Decision ejecutiva: {decision_final}"
            }
        }

    # ── Resumen final ──────────────────────────────────────────────────────
    duracion_total = int((time.time() - t0) * 1000)
    resultados["_meta"] = {
        "duracion_total_ms": duracion_total,
        "etapas_ejecutadas": list(resultados.keys()),
        "decision_final": decision_final,
        "proyecto_id": proyecto_info.get("id") or proyecto_info.get("id_proyecto"),
    }

    logger.info(f"Pipeline completo: {duracion_total}ms | Decision: {decision_final}")
    return resultados


def ejecutar_etapa_individual(
    etapa: str,
    proyecto_info: Dict[str, Any],
    input_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Ejecutar una sola etapa del pipeline de forma aislada.
    Util para retry o para interfaces que ejecutan paso a paso.
    
    Args:
        etapa: Nombre de la etapa (ej: 'bicameral', 'veto_promulgacion', 'especialista_tecnico')
        proyecto_info: Info del proyecto
        input_data: Datos especificos de entrada para la etapa
    """
    base = get_base_agent()
    etapa_lower = etapa.lower()

    if etapa_lower in ("constitucion_fondo", "fondo"):
        agente = AgenteConstitucionFondo(base_agent=base)
        return agente.ejecutar(
            texto_proyecto=input_data.get("texto_proyecto", ""),
            obs_formales=input_data.get("obs_formales", []),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("especialista_tecnico", "tecnico"):
        agente = AgenteEspecialistaTecnico(base_agent=base)
        return agente.ejecutar(
            texto_proyecto=input_data.get("texto_proyecto", ""),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("presidencia_comision", "presidencia"):
        agente = AgentePresidenciaComision(base_agent=base)
        return agente.ejecutar(
            texto_proyecto=input_data.get("texto_proyecto", ""),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("presupuesto", "planificacion_presupuesto"):
        agente = AgentePresupuesto(base_agent=base)
        return agente.ejecutar(
            texto_proyecto=input_data.get("texto_proyecto", ""),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("concentrador", "concentrar"):
        agente = AgenteConcentrador(base_agent=base)
        return agente.ejecutar(
            observaciones=input_data.get("observaciones", []),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("secretario", "debate"):
        agente = AgenteSecretarioCamara(base_agent=base)
        return agente.ejecutar(
            debate_data=input_data.get("debate_data", {}),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("bicameral",):
        agente = AgenteBicameral(base_agent=base)
        return agente.ejecutar(
            version_original=input_data.get("version_original", {}),
            version_retornada=input_data.get("version_retornada", {}),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("veto", "veto_promulgacion", "promulgacion"):
        agente = AgenteVetoPromulgacion(base_agent=base)
        return agente.ejecutar(
            expediente=input_data.get("expediente", {}),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("publicacion", "publicacion_oficial"):
        agente = AgentePublicacionOficial(base_agent=base)
        return agente.ejecutar(
            evaluacion_veto=input_data.get("evaluacion_veto", {}),
            proyecto_info=proyecto_info
        )
    elif etapa_lower in ("difusion_ciudadana", "difusion"):
        agente = AgenteDifusionCiudadana(base_agent=base)
        return agente.ejecutar(
            texto_ley=input_data.get("texto_ley", ""),
            ley_info=input_data.get("ley_info", {})
        )
    elif etapa_lower in ("fiscalizacion", "control_posterior"):
        agente = AgenteFiscalizacion(base_agent=base)
        return agente.ejecutar(
            datos_ejecucion=input_data.get("datos_ejecucion", {}),
            ley_info=input_data.get("ley_info", {})
        )
    else:
        return {"error": f"Etapa desconocida: {etapa}"}

