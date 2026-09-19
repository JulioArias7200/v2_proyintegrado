"""
Chat Orquestador — SMA Congreso Bolivia
=======================================
Orquestador conversacional con LLM (NVIDIA NIM) que reemplaza el matching
de frases de `voz_agent.py`. Interpreta mensajes de texto o audio transcrito,
decide a qué agente del SMA va dirigida la instrucción, valida la acción
contra el catálogo `COMANDOS_VOZ` y, para acciones irreversibles, exige
confirmación humana antes de ejecutar.

Estrategia:
  - Modo "llm": prompt de sistema con el catálogo de agentes/acciones y
    respuesta JSON estricta, con reintento y retroalimentación del error.
  - Modo "fallback": si el LLM falla, se usa el matching determinista de
    `procesar_comando_voz` + `obtener_texto_para_leer` de voz_agent.
  - Toda la persistencia en MongoDB Atlas (colección `chat_sesiones`) es
    opcional: si no hay conexión, el flujo continúa sin historial.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("chat_orquestador")

from sma_unified.agents.voz_agent import (
    COMANDOS_VOZ,
    AGENT_KEY_ALIASES,
    resolver_nombre_agente,
    procesar_comando_voz,
    obtener_texto_para_leer,
)

# ── Constantes del Orquestador ───────────────────────────────────────────────

# Acciones que modifican estado legal/institucional y requieren confirmación
# explícita del usuario antes de ejecutarse.
ACCIONES_IRREVERSIBLES: set = {
    "registrar_veto",
    "autorizar_promulgacion",
    "publicar_gaceta_oficial",
    "asignar_numero_ley",
    "enviar_notificacion_comision",
    "notificar_correcciones_autor",
    "confirmar_aprobacion_bicameral",
    "firmar_acta_debate",
    "disparar_flujo_correcciones",
    "disparar_flujo_correcciones_normativa",
    "enviar_dictamen_comision",
    "registrar_aprobacion_grande",
    "registrar_aprobacion_detalle",
}

ROLES_AGENTES: Dict[str, str] = {
    "Distribuidor": "Mesa de Partes: recepción y clasificación formal de proyectos de ley",
    "Comision": "Asignación de comisión legislativa competente al proyecto",
    "VerificadorConstitucional": "Control de constitucionalidad formal frente a la CPE",
    "ConsistenciaNormativa": "Detección de antinomias y conflictos con leyes vigentes",
    "EmisorResultados": "Emisión del dictamen técnico oficial en PDF",
    "NotificadorComision": "Envío de notificaciones formales a la comisión y al autor",
    "SecretarioCamara": "Registro de debates, votaciones y actas plenarias",
    "Bicameral": "Coordinación y reconciliación entre Cámara de Origen y Revisora",
    "VetoPromulgacion": "Evaluación de veto o promulgación por el Órgano Ejecutivo",
    "Publicacion": "Publicación en Gaceta Oficial y asignación de número de ley",
    "ConstitucionFondo": "Análisis hermenéutico constitucional de fondo",
    "ConcentradorCrew": "Consolidación y síntesis del expediente multi-agente",
    "EspecialistaTecnico": "Evaluación de viabilidad técnica y estándares",
    "PresidenciaComision": "Orden del día, convocatorias y cronograma de la comisión",
    "Presupuesto": "Evaluación de impacto presupuestario y fiscal (Ley 1178)",
    "DifusionCiudadana": "Guías en lenguaje claro y difusión a la ciudadanía",
    "Fiscalizacion": "Monitoreo de implementación y alertas de desvío",
    "AtencionCiudadana": "Recepción y seguimiento de peticiones ciudadanas",
}

_MAX_HISTORIAL_PROMPT = 12
_MAX_MENSAJES_PERSISTIDOS = 50
_MAX_REINTENTOS_LLM = 2
_COLECCION_CHAT = "chat_sesiones"


# ── Persistencia en MongoDB (opcional, nunca rompe el flujo) ─────────────────

def _cargar_sesion(sesion_id: str) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Carga el historial reciente y la acción pendiente de una sesión de chat
    desde la colección `chat_sesiones` de MongoDB Atlas.
    Si Mongo no está disponible, retorna listas vacías sin interrumpir el flujo.
    """
    try:
        from sma_unified.db.mongo_atlas import get_db
        db = get_db()
        doc = db[_COLECCION_CHAT].find_one({"sesion_id": sesion_id}) or {}
        mensajes = doc.get("mensajes", [])[-_MAX_HISTORIAL_PROMPT:]
        return mensajes, doc.get("accion_pendiente")
    except Exception as e:
        logger.warning(f"[Chat] Historial Mongo no disponible (modo sin historial): {e}")
        return [], None


def _guardar_sesion(
    sesion_id: str,
    mensajes_nuevos: List[Dict[str, Any]],
    accion_pendiente: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Persiste los mensajes nuevos y la acción pendiente de la sesión en MongoDB
    (upsert por sesion_id, historial acotado a los últimos 50 mensajes).
    """
    try:
        from sma_unified.db.mongo_atlas import get_db
        db = get_db()
        col = db[_COLECCION_CHAT]
        col.update_one(
            {"sesion_id": sesion_id},
            {
                "$push": {"mensajes": {"$each": mensajes_nuevos, "$slice": -_MAX_MENSAJES_PERSISTIDOS}},
                "$set": {
                    "sesion_id": sesion_id,
                    "accion_pendiente": accion_pendiente,
                    "actualizado": datetime.now(tz=timezone.utc),
                },
            },
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"[Chat] No se pudo persistir la sesión en Mongo (modo offline): {e}")


def obtener_historial_chat(sesion_id: str, limite: int = 50) -> List[Dict[str, Any]]:
    """Obtiene el historial de mensajes de una sesión de chat desde MongoDB Atlas."""
    try:
        from sma_unified.db.mongo_atlas import get_db
        db = get_db()
        doc = db[_COLECCION_CHAT].find_one({"sesion_id": sesion_id}, {"_id": 0, "mensajes": 1}) or {}
        mensajes = doc.get("mensajes", [])[-limite:]
        for m in mensajes:
            if isinstance(m.get("timestamp"), datetime):
                m["timestamp"] = m["timestamp"].isoformat()
        return mensajes
    except Exception as e:
        logger.warning(f"[Chat] No se pudo obtener historial de {sesion_id}: {e}")
        return []


# ── Construcción del prompt ──────────────────────────────────────────────────

def _catalogo_agentes_compacto() -> str:
    """Genera un catálogo compacto de agentes con sus roles y acciones disponibles."""
    lineas = []
    for agente, comandos in COMANDOS_VOZ.items():
        rol = ROLES_AGENTES.get(agente, "")
        acciones = ", ".join(f"{c['accion']} ({c['descripcion']})" for c in comandos)
        lineas.append(f"- {agente}: {rol}. Acciones: {acciones}")
    return "\n".join(lineas)


def _resumir_datos_contexto(datos: Optional[Dict[str, Any]], max_chars: int = 1500) -> str:
    """Convierte los datos de contexto (resultados del pipeline) en un resumen de texto."""
    if not datos:
        return "(sin datos de contexto del pipeline)"
    partes = []
    for k, v in datos.items():
        if isinstance(v, (dict, list)):
            v = str(v)[:300]
        partes.append(f"{k}: {v}")
    texto = "\n".join(partes)
    return texto[:max_chars]


def _armar_prompt_sistema(agente_contexto: Optional[str], datos_contexto: Optional[Dict[str, Any]]) -> str:
    """Arma el prompt de sistema del orquestador con el catálogo y el contexto actual."""
    canonico = resolver_nombre_agente(agente_contexto) if agente_contexto else None
    if not agente_contexto or agente_contexto.strip().lower() in ("", "orquestador"):
        linea_agente = (
            "No hay un agente de contexto fijo: elige tú el `agente_destino` más adecuado "
            "del catálogo según la intención del usuario."
        )
    else:
        linea_agente = (
            f"El usuario está interactuando actualmente con el agente '{canonico}'. "
            "Prefiere ese agente salvo que el mensaje claramente pertenezca a otro."
        )

    return f"""Eres el orquestador conversacional de la Mesa de Partes Legislativa de Bolivia.
Tu trabajo es interpretar el mensaje del usuario y decidir a qué agente del sistema
multi-agente va dirigido y qué acción ejecutar.

CATÁLOGO DE AGENTES Y ACCIONES DISPONIBLES:
{_catalogo_agentes_compacto()}

CONTEXTO ACTUAL:
{linea_agente}

DATOS DEL PIPELINE (resultados recientes del agente activo):
{_resumir_datos_contexto(datos_contexto)}

REGLAS:
1. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown:
   {{"agente_destino": "<nombre exacto del catálogo>", "accion": "<acción exacta del catálogo o null>", "parametros": {{}}, "requiere_confirmacion": false, "respuesta_chat": "<texto corto y natural en español>", "confianza": <0-100>}}
2. "accion" debe ser exactamente una de las acciones listadas para el agente elegido, o null si el mensaje es solo conversacional o no corresponde a ninguna acción.
3. "confianza" refleja qué tan seguro estás de la interpretación (0-100).
4. "respuesta_chat" debe ser breve (1-2 oraciones), natural y en español.
5. Si la acción modifica estado legal (registros, envíos oficiales, firmas, publicaciones), marca "requiere_confirmacion": true."""


# ── Fallback determinista ────────────────────────────────────────────────────

def _procesar_fallback(
    sesion_id: str,
    agente_contexto: Optional[str],
    texto: str,
    datos_contexto: Optional[Dict[str, Any]],
    confirmar: bool,
    historial: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Fallback determinista sin LLM: usa el matching de frases de voz_agent
    para resolver la acción y genera una respuesta con obtener_texto_para_leer.
    Aplica las mismas reglas de confirmación de acciones irreversibles.
    """
    agente = resolver_nombre_agente(agente_contexto) if agente_contexto else "Distribuidor"
    res_cmd = procesar_comando_voz(texto, agente)
    accion = res_cmd.get("accion")
    confianza = res_cmd.get("confianza", 30.0)
    respuesta = obtener_texto_para_leer(agente, accion, datos_contexto or {})

    requiere_confirmacion = False
    confirmada = False
    accion_pendiente = None
    if accion in ACCIONES_IRREVERSIBLES:
        if confirmar:
            confirmada = True
            respuesta = f"Confirmado. Ejecutando: {res_cmd.get('descripcion', accion)}."
        else:
            requiere_confirmacion = True
            respuesta = (
                f"La acción '{res_cmd.get('descripcion', accion)}' es irreversible. "
                "¿Confirmas que deseas ejecutarla?"
            )
            accion_pendiente = {"agente_destino": agente, "accion": accion, "confirmada": False}

    _persistir_turno(sesion_id, texto, respuesta, agente, accion, confianza, accion_pendiente)
    _publicar_en_bus(sesion_id, agente, texto, accion, respuesta)

    return {
        "success": True,
        "sesion_id": sesion_id,
        "agente_destino": agente,
        "accion": accion,
        "parametros": {},
        "requiere_confirmacion": requiere_confirmacion,
        "confirmada": confirmada,
        "respuesta_chat": respuesta,
        "confianza": confianza,
        "modo": "fallback",
    }


# ── Helpers de persistencia y bus ────────────────────────────────────────────

def _persistir_turno(
    sesion_id: str,
    texto_usuario: str,
    respuesta_chat: str,
    agente: str,
    accion: Optional[str],
    confianza: float,
    accion_pendiente: Optional[Dict[str, Any]],
) -> None:
    """Guarda el par de mensajes (usuario + agente) del turno en la sesión."""
    ahora = datetime.now(tz=timezone.utc)
    mensajes = [
        {"rol": "usuario", "texto": texto_usuario, "agente": None, "accion": None,
         "confianza": None, "timestamp": ahora},
        {"rol": "agente", "texto": respuesta_chat, "agente": agente, "accion": accion,
         "confianza": confianza, "timestamp": ahora},
    ]
    _guardar_sesion(sesion_id, mensajes, accion_pendiente)


def _publicar_en_bus(
    sesion_id: str,
    agente_destino: str,
    texto: str,
    accion: Optional[str],
    respuesta_chat: str,
) -> None:
    """Publica la instrucción del chat en el bus de mensajes de MongoDB Atlas."""
    try:
        from sma_unified.db.mongo_atlas import publicar_mensaje
        publicar_mensaje(
            "ChatOrquestador",
            agente_destino,
            "chat_instruccion",
            {"texto": texto, "accion": accion, "respuesta": respuesta_chat},
            sesion_id=sesion_id,
        )
    except Exception as e:
        logger.warning(f"[Chat] Publicación en bus omitida (modo offline): {e}")


# ── Núcleo del orquestador ───────────────────────────────────────────────────

def procesar_mensaje_chat(
    sesion_id: str,
    agente_contexto: Optional[str],
    texto: str,
    datos_contexto: Optional[dict] = None,
    confirmar: bool = False,
) -> Dict[str, Any]:
    """
    Procesa un mensaje de chat (texto o transcripción de audio) decidiendo el
    agente destino y la acción a ejecutar, con confirmación obligatoria para
    acciones irreversibles. Nunca lanza excepción: ante cualquier fallo del
    LLM usa el fallback determinista de voz_agent.

    Retorna:
        {"success", "sesion_id", "agente_destino", "accion", "parametros",
         "requiere_confirmacion", "confirmada", "respuesta_chat", "confianza", "modo"}
    """
    texto = (texto or "").strip()
    if not texto:
        return {
            "success": False,
            "sesion_id": sesion_id,
            "agente_destino": agente_contexto,
            "accion": None,
            "parametros": {},
            "requiere_confirmacion": False,
            "confirmada": False,
            "respuesta_chat": "No recibí ningún mensaje. ¿En qué puedo ayudarte?",
            "confianza": 0,
            "modo": "fallback",
        }

    historial, accion_pendiente_previa = _cargar_sesion(sesion_id)

    # 1) Confirmación de una acción irreversible pendiente
    if confirmar and accion_pendiente_previa:
        agente_p = accion_pendiente_previa.get("agente_destino", "Distribuidor")
        accion_p = accion_pendiente_previa.get("accion")
        respuesta = f"Confirmado. Ejecutando la acción '{accion_p}' con el agente {agente_p}."
        _persistir_turno(sesion_id, texto, respuesta, agente_p, accion_p, 100.0, None)
        _publicar_en_bus(sesion_id, agente_p, texto, accion_p, respuesta)
        return {
            "success": True,
            "sesion_id": sesion_id,
            "agente_destino": agente_p,
            "accion": accion_p,
            "parametros": accion_pendiente_previa.get("parametros", {}),
            "requiere_confirmacion": False,
            "confirmada": True,
            "respuesta_chat": respuesta,
            "confianza": 100.0,
            "modo": "llm",
        }

    # 2) Intento con LLM (con reintentos y retroalimentación del error)
    try:
        return _procesar_con_llm(
            sesion_id, agente_contexto, texto, datos_contexto, confirmar, historial
        )
    except Exception as e:
        logger.warning(f"[Chat] LLM no disponible, usando fallback determinista: {e}")
        return _procesar_fallback(
            sesion_id, agente_contexto, texto, datos_contexto, confirmar, historial
        )


def _procesar_con_llm(
    sesion_id: str,
    agente_contexto: Optional[str],
    texto: str,
    datos_contexto: Optional[Dict[str, Any]],
    confirmar: bool,
    historial: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Ruta principal: interpretación del mensaje con LLM y parseo JSON estricto."""
    from sma_unified.agents.llm_client import chat_completion_resiliente, extraer_json_de_llm

    mensajes: List[Dict[str, str]] = [
        {"role": "system", "content": _armar_prompt_sistema(agente_contexto, datos_contexto)}
    ]
    for m in historial:
        rol = "user" if m.get("rol") == "usuario" else "assistant"
        mensajes.append({"role": rol, "content": str(m.get("texto", ""))})
    mensajes.append({"role": "user", "content": texto})

    ultimo_error = "desconocido"
    for intento in range(_MAX_REINTENTOS_LLM + 1):
        raw, _modelo = chat_completion_resiliente(mensajes, temperature=0.2, max_tokens=600)
        try:
            data = extraer_json_de_llm(raw)
            if not isinstance(data, dict):
                raise ValueError("La respuesta no es un objeto JSON.")
            if "respuesta_chat" not in data:
                raise ValueError("Falta la clave obligatoria 'respuesta_chat'.")
            break  # parseo exitoso
        except Exception as parse_err:
            ultimo_error = str(parse_err)
            logger.warning(f"[Chat] Parseo JSON falló (intento {intento + 1}): {ultimo_error}")
            if intento < _MAX_REINTENTOS_LLM:
                mensajes.append({"role": "assistant", "content": str(raw)[:800]})
                mensajes.append({
                    "role": "user",
                    "content": (
                        f"Tu respuesta anterior no fue válida ({ultimo_error}). "
                        "Responde SOLO con el objeto JSON solicitado, sin texto adicional."
                    ),
                })
    else:
        raise RuntimeError(f"El LLM no produjo un JSON válido tras {_MAX_REINTENTOS_LLM + 1} intentos: {ultimo_error}")

    # ── Validaciones de precisión ────────────────────────────────────────────
    agente_destino = resolver_nombre_agente(str(data.get("agente_destino") or ""))
    if agente_destino not in COMANDOS_VOZ:
        agente_destino = resolver_nombre_agente(agente_contexto) if agente_contexto else "Distribuidor"
        if agente_destino not in COMANDOS_VOZ:
            agente_destino = "Distribuidor"

    acciones_validas = {c["accion"] for c in COMANDOS_VOZ.get(agente_destino, [])}
    accion = data.get("accion")
    if accion not in acciones_validas:
        accion = None

    try:
        confianza = float(data.get("confianza", 50))
    except (TypeError, ValueError):
        confianza = 50.0
    confianza = max(0.0, min(100.0, confianza))

    respuesta_chat = str(data.get("respuesta_chat") or "").strip() or "Entendido."
    parametros = data.get("parametros") if isinstance(data.get("parametros"), dict) else {}
    requiere_confirmacion = bool(data.get("requiere_confirmacion", False))
    confirmada = False
    accion_pendiente = None

    # Confianza baja: anular la acción y pedir aclaración
    if accion and confianza < 50:
        accion = None
        respuesta_chat = (
            "No estoy seguro de haber entendido tu solicitud. "
            "¿Podrías reformularla o indicar qué acción deseas ejecutar?"
        )

    # Acciones irreversibles: exigir confirmación humana
    if accion in ACCIONES_IRREVERSIBLES:
        if confirmar:
            confirmada = True
            respuesta_chat = f"Confirmado. Ejecutando: {respuesta_chat}"
        else:
            requiere_confirmacion = True
            accion_pendiente = {
                "agente_destino": agente_destino,
                "accion": accion,
                "parametros": parametros,
                "confirmada": False,
            }
            if "confirm" not in respuesta_chat.lower():
                respuesta_chat += " Esta acción es irreversible: ¿confirmas su ejecución?"

    _persistir_turno(sesion_id, texto, respuesta_chat, agente_destino, accion, confianza, accion_pendiente)
    _publicar_en_bus(sesion_id, agente_destino, texto, accion, respuesta_chat)

    return {
        "success": True,
        "sesion_id": sesion_id,
        "agente_destino": agente_destino,
        "accion": accion,
        "parametros": parametros,
        "requiere_confirmacion": requiere_confirmacion,
        "confirmada": confirmada,
        "respuesta_chat": respuesta_chat,
        "confianza": confianza,
        "modo": "llm",
    }
