"""
Especialista Técnico en modo asistido (caso subido + chatbot)
=============================================================
Conecta el `AgenteEspecialistaTecnico` (dictamen pericial, Nivel 2) con el
asistente ciudadano: cuando el usuario sube un caso y activa la opción
"Usar Especialista Técnico", este módulo:

  1. `analizar_caso()` — genera UNA sola vez el dictamen pericial del documento
     (viabilidad, estándares aplicables, infraestructura, matriz de riesgos).
  2. `responder_con_especialista()` — cada mensaje del chatbot se responde
     tomando como base ese dictamen y el texto del caso, en lenguaje claro y
     sin volver a peritar desde cero.

El dictamen viaja de ida y vuelta con el frontend (campo `dictamen`), así el
chat sigue siendo **sin estado** en el servidor, igual que el resto del
asistente ciudadano.
"""

import time
from typing import Any, Dict, Optional

try:
    from loguru import logger
except ImportError:  # pragma: no cover
    import logging
    logger = logging.getLogger("especialista_chat")

from sma_unified.agents.llm_client import chat_completion_resiliente

NOMBRE_FACETA = "Especialista Técnico"
LOGO_FACETA = "/robots/logos/asistente_profesional.jpg"

# Prefijo no numérico a propósito: `AgenteEspecialistaTecnico.ejecutar` solo
# persiste el dictamen en Neon cuando el id es numérico, y un caso ciudadano
# todavía no es un proyecto de ley registrado.
PREFIJO_CASO = "CASO-CIUDADANO"


def _instanciar_especialista():
    """
    Instancia el agente pericial. Si CrewAI o la configuración YAML no están
    disponibles en el entorno, se usa la instancia sin inicializar: `ejecutar()`
    solo necesita el cliente LLM resiliente, no el agente CrewAI.
    """
    from sma_unified.agents.especialista_tecnico import AgenteEspecialistaTecnico
    try:
        return AgenteEspecialistaTecnico()
    except Exception as e:
        logger.warning(f"[Especialista] Sin CrewAI disponible, modo directo LLM: {e}")
        return AgenteEspecialistaTecnico.__new__(AgenteEspecialistaTecnico)


def analizar_caso(
    texto_caso: str,
    titulo: Optional[str] = None,
    materia: Optional[str] = None,
    sesion_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Genera el dictamen técnico pericial de un caso subido por el ciudadano."""
    if not (texto_caso or "").strip():
        raise ValueError("El caso no tiene texto que analizar.")

    t0 = time.time()
    proyecto_info = {
        "id": f"{PREFIJO_CASO}-{int(t0)}",
        "titulo": titulo or "Caso ciudadano",
        "materia": materia or "General",
    }

    especialista = _instanciar_especialista()
    resultado = especialista.ejecutar(texto_caso, proyecto_info)
    dictamen = resultado.get("dictamen_tecnico", {}) if isinstance(resultado, dict) else {}

    _trazar_mongo(titulo, dictamen, sesion_id)

    return {
        "success": True,
        "dictamen": dictamen,
        "titulo_caso": proyecto_info["titulo"],
        "duracion_ms": int((time.time() - t0) * 1000),
    }


def responder_con_especialista(
    mensaje: str,
    texto_caso: str,
    dictamen: Optional[Dict[str, Any]] = None,
    titulo: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Responde una pregunta del chatbot actuando como Especialista Técnico sobre
    el caso cargado. Si todavía no hay dictamen, lo genera primero.
    """
    generado_ahora = False
    if not dictamen:
        dictamen = analizar_caso(texto_caso, titulo=titulo)["dictamen"]
        generado_ahora = True

    riesgos = "; ".join(
        f"{r.get('riesgo')} (impacto {r.get('impacto')})"
        for r in (dictamen.get("matriz_riesgos") or [])[:5]
    ) or "sin riesgos registrados"

    system_prompt = (
        "Eres el Especialista Técnico Pericial del Sistema Multi-Agente Legislativo de "
        "Bolivia, atendiendo por chat a quien subió el caso. Respondes SOLO sobre el "
        "caso y el dictamen que se te entregan, en lenguaje claro y sin jerga "
        "innecesaria. Cita el artículo, la cifra o el estándar concreto cuando lo "
        "menciones. Si la pregunta sale del alcance técnico (jurídico, presupuestario, "
        "de trámite), dilo y señala a qué instancia corresponde. Nunca inventes datos "
        "que no estén en el caso ni en el dictamen: si falta información, indica "
        "exactamente qué documento o dato haría falta."
    )

    user_prompt = (
        f"CASO: {titulo or 'Caso ciudadano'}\n"
        f"DICTAMEN PERICIAL YA EMITIDO:\n"
        f"- Viabilidad técnica: {dictamen.get('viabilidad_tecnica', 'N/D')} "
        f"(puntuación {dictamen.get('puntuacion_viabilidad', 'N/D')})\n"
        f"- Estándares aplicables: {', '.join(dictamen.get('estandares_aplicables') or []) or 'N/D'}\n"
        f"- Infraestructura requerida: {', '.join(dictamen.get('infraestructura_requerida') or []) or 'N/D'}\n"
        f"- Riesgos: {riesgos}\n"
        f"- Resumen: {dictamen.get('dictamen_tecnico_resumen', 'N/D')}\n\n"
        f"TEXTO DEL CASO (extracto):\n{(texto_caso or '')[:4000]}\n\n"
        f"PREGUNTA DE LA PERSONA:\n{mensaje}"
    )

    from sma_unified.agents.reglamentos_profesionales import (
        recuperar, contexto_fuentes, fuentes_publicas, INSTRUCCION_PROFESIONAL,
    )
    aviso_fuentes = None
    try:
        fuentes = recuperar(f"{mensaje}\n{titulo or ''}\n{texto_caso}")
    except Exception as exc:
        logger.warning(f"[Especialista] Corpus no disponible: {exc}")
        fuentes = []
        aviso_fuentes = 'No se pudo consultar el corpus profesional; los requisitos normativos quedan pendientes de revisión.'
    contenido, modelo = chat_completion_resiliente(
        messages=[
            {"role": "system", "content": system_prompt + '\n' + INSTRUCCION_PROFESIONAL},
            {"role": "user", "content": f"FUENTES:\n{contexto_fuentes(fuentes)}\n\n{user_prompt}"},
        ],
        temperature=0.2,
        max_tokens=1200,
        timeout=30,
    )

    return {
        "reply": contenido,
        "fuentes": fuentes_publicas(fuentes),
        "aviso_fuentes": aviso_fuentes,
        "dictamen": dictamen,
        "dictamen_generado_ahora": generado_ahora,
        "modelo_usado": modelo,
    }


def _trazar_mongo(titulo: Optional[str], dictamen: Dict[str, Any], sesion_id: Optional[str]) -> None:
    """Deja traza del peritaje en MongoDB Atlas, como el resto de agentes (best-effort)."""
    try:
        from sma_unified.db.mongo_atlas import publicar_mensaje, marcar_completado
        task_id = publicar_mensaje(
            agente_origen="Ciudadano",
            agente_destino="Especialista_Tecnico",
            tipo_tarea="Dictamen Técnico sobre Caso Ciudadano",
            payload={"titulo_caso": titulo or "Caso ciudadano"},
            sesion_id=sesion_id,
            metadata={"origen": "chatbot_ciudadano"},
        )
        marcar_completado(
            task_id,
            resultado={
                "viabilidad": dictamen.get("viabilidad_tecnica"),
                "puntuacion": dictamen.get("puntuacion_viabilidad"),
                "resumen": (dictamen.get("dictamen_tecnico_resumen") or "")[:400],
            },
            duracion_ms=int(dictamen.get("duracion_ms") or 0),
        )
    except Exception as e:
        logger.debug(f"[Especialista] Sin traza en Mongo: {e}")
