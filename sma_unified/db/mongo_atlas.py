"""
MongoDB Atlas — Bus de Comunicación entre Agentes
==================================================
Cada mensaje entre agentes queda registrado en la colección `agent_messages`
con todos los detalles: tarea, agente origen, destino, payload, estado y resultado.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("sma_mongo")

# ── Lazy singleton para la conexión ─────────────────────────────────────────
_client = None
_db = None


def get_db():
    """Retorna la instancia de base de datos MongoDB Atlas (singleton síncrono)."""
    global _client, _db
    if _db is not None:
        return _db
    try:
        from pymongo import MongoClient
        from pymongo.server_api import ServerApi

        uri = os.getenv("MONGO_URI", "")
        db_name = os.getenv("MONGO_DB", "sma_congreso")

        if not uri or "usuario:password" in uri:
            raise ValueError(
                "MONGO_URI no configurada. Edita .env con tu cadena de conexión de MongoDB Atlas."
            )

        _client = MongoClient(uri, server_api=ServerApi("1"), serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")  # Verifica conectividad
        _db = _client[db_name]
        logger.info(f"✅ MongoDB Atlas conectado → base de datos: {db_name}")
        _ensure_indexes(_db)
        return _db
    except Exception as e:
        logger.error(f"❌ No se pudo conectar a MongoDB Atlas: {e}")
        raise


def _ensure_indexes(db):
    """Crea índices necesarios para rendimiento en las colecciones principales."""
    try:
        msgs = db["agent_messages"]
        msgs.create_index([("task_id", 1)], unique=True, sparse=True)
        msgs.create_index([("agente_destino", 1), ("estado", 1)])
        msgs.create_index([("timestamp", -1)])
        msgs.create_index([("sesion_id", 1)])

        docs = db["documentos"]
        docs.create_index([("expediente_id", 1)], unique=True, sparse=True)
        docs.create_index([("estado", 1)])
        docs.create_index([("fecha_ingreso", -1)])

        # ── Colección nueva: observaciones constitucionales ─────────────────
        obs = db["observaciones_constitucionales"]
        obs.create_index([("obs_id", 1)], unique=True, sparse=True)
        obs.create_index([("sesion_id", 1)])
        obs.create_index([("id_proyecto_pg", 1)])
        obs.create_index([("valido", 1), ("severidad_maxima", 1)])
        obs.create_index([("timestamp", -1)])

        # ── Colecciones de Dictaminación Legislativa Solicitadas ────────────
        rep_const = db["reportes_constitucionalidad"]
        rep_const.create_index([("expediente_id", 1)])
        rep_const.create_index([("sesion_id", 1)])

        rep_cons = db["reportes_consistencia"]
        rep_cons.create_index([("expediente_id", 1)])
        rep_cons.create_index([("sesion_id", 1)])

        notif_pend = db["notificaciones_pendientes"]
        notif_pend.create_index([("id_comision", 1)])
        notif_pend.create_index([("estado", 1)])

        msg_ofic = db["mensajes_oficiales"]
        msg_ofic.create_index([("sesion_id", 1)])
        msg_ofic.create_index([("fecha_envio", -1)])

        logger.info("Índices MongoDB verificados/creados.")
    except Exception as e:
        logger.warning(f"No se pudieron crear índices: {e}")


def guardar_reporte_constitucionalidad_mongo(data: Dict[str, Any]) -> str:
    """Guarda reporte en la colección reportes_constitucionalidad."""
    db = get_db()
    data["timestamp"] = datetime.now(timezone.utc)
    res = db["reportes_constitucionalidad"].insert_one(data)
    return str(res.inserted_id)


def guardar_notificacion_oficial_mongo(data: Dict[str, Any]) -> str:
    """Guarda una notificación en notificaciones_pendientes y mensajes_oficiales."""
    db = get_db()
    data["timestamp"] = datetime.now(timezone.utc)
    db["notificaciones_pendientes"].insert_one(data)
    res = db["mensajes_oficiales"].insert_one(data)
    return str(res.inserted_id)


# ════════════════════════════════════════════════════════════════════════════
# FUNCIONES DE MENSAJERÍA ENTRE AGENTES
# ════════════════════════════════════════════════════════════════════════════

def publicar_mensaje(
    agente_origen: str,
    agente_destino: str,
    tipo_tarea: str,
    payload: Dict[str, Any],
    sesion_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Publica un mensaje de comunicación entre agentes en MongoDB Atlas.

    Retorna el task_id generado.

    Esquema del documento:
    {
        task_id:        UUID único del mensaje/tarea
        sesion_id:      ID de sesión del flujo completo
        timestamp:      Fecha/hora UTC de creación
        agente_origen:  Nombre del agente que envía
        agente_destino: Nombre del agente que recibe
        tipo_tarea:     Nombre legible de la tarea a ejecutar
        estado:         "pendiente" | "en_proceso" | "completado" | "error"
        payload:        Datos enviados al agente destino
        resultado:      null (se llena al completar)
        metadata:       Información adicional (tiempos, modelo LLM, etc.)
        duracion_ms:    null (se llena al completar)
    }
    """
    task_id = str(uuid.uuid4())
    db = get_db()

    doc = {
        "task_id": task_id,
        "sesion_id": sesion_id or str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc),
        "agente_origen": agente_origen,
        "agente_destino": agente_destino,
        "tipo_tarea": tipo_tarea,
        "estado": "pendiente",
        "payload": payload,
        "resultado": None,
        "metadata": metadata or {},
        "duracion_ms": None,
        "error_detalle": None,
    }
    db["agent_messages"].insert_one(doc)
    logger.info(
        f"📨 [{agente_origen}] → [{agente_destino}] | Tarea: {tipo_tarea} | ID: {task_id[:8]}..."
    )
    return task_id


def actualizar_estado(
    task_id: str,
    estado: str,
    resultado: Optional[Dict[str, Any]] = None,
    duracion_ms: Optional[int] = None,
    error_detalle: Optional[str] = None,
) -> None:
    """
    Actualiza el estado de un mensaje/tarea en MongoDB Atlas.

    estados posibles: 'pendiente', 'en_proceso', 'completado', 'error'
    """
    db = get_db()
    update = {"$set": {"estado": estado, "fecha_actualizacion": datetime.now(timezone.utc)}}
    if resultado is not None:
        update["$set"]["resultado"] = resultado
    if duracion_ms is not None:
        update["$set"]["duracion_ms"] = duracion_ms
    if error_detalle is not None:
        update["$set"]["error_detalle"] = error_detalle

    db["agent_messages"].update_one({"task_id": task_id}, update)
    logger.info(f"🔄 Tarea {task_id[:8]}... → estado: {estado}")


def marcar_en_proceso(task_id: str) -> None:
    """Marca una tarea como 'en_proceso' al iniciar ejecución."""
    actualizar_estado(task_id, "en_proceso")


def marcar_completado(
    task_id: str,
    resultado: Dict[str, Any],
    duracion_ms: int = 0,
) -> None:
    """Marca una tarea como completada con su resultado."""
    actualizar_estado(task_id, "completado", resultado=resultado, duracion_ms=duracion_ms)


def marcar_error(task_id: str, error: str) -> None:
    """Marca una tarea como fallida con detalle del error."""
    actualizar_estado(task_id, "error", error_detalle=error)


# ════════════════════════════════════════════════════════════════════════════
# CONSULTAS DE VISUALIZACIÓN
# ════════════════════════════════════════════════════════════════════════════

def obtener_mensajes_recientes(limit: int = 50) -> List[Dict[str, Any]]:
    """Obtiene los mensajes más recientes para la visualización en la UI."""
    db = get_db()
    cursor = (
        db["agent_messages"]
        .find({}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    docs = list(cursor)
    # Convertir datetimes a strings para Reflex
    for d in docs:
        if isinstance(d.get("timestamp"), datetime):
            d["timestamp"] = d["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(d.get("fecha_actualizacion"), datetime):
            d["fecha_actualizacion"] = d["fecha_actualizacion"].strftime("%Y-%m-%d %H:%M:%S")
    return docs


def obtener_mensajes_sesion(sesion_id: str) -> List[Dict[str, Any]]:
    """Obtiene todos los mensajes de una sesión de procesamiento."""
    db = get_db()
    cursor = (
        db["agent_messages"]
        .find({"sesion_id": sesion_id}, {"_id": 0})
        .sort("timestamp", 1)
    )
    docs = list(cursor)
    for d in docs:
        if isinstance(d.get("timestamp"), datetime):
            d["timestamp"] = d["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
    return docs


def obtener_kpis_mongo() -> Dict[str, Any]:
    """KPIs de mensajería entre agentes para el dashboard."""
    db = get_db()
    col = db["agent_messages"]
    total = col.count_documents({})
    completados = col.count_documents({"estado": "completado"})
    en_proceso = col.count_documents({"estado": "en_proceso"})
    errores = col.count_documents({"estado": "error"})

    # Tiempo promedio de respuesta (agentes completados)
    pipeline = [
        {"$match": {"estado": "completado", "duracion_ms": {"$ne": None}}},
        {"$group": {"_id": None, "avg_ms": {"$avg": "$duracion_ms"}}},
    ]
    avg_result = list(col.aggregate(pipeline))
    avg_ms = int(avg_result[0]["avg_ms"]) if avg_result else 0

    # Mensajes por agente destino
    pipeline_agentes = [
        {"$group": {"_id": "$agente_destino", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    agentes_stats = {r["_id"]: r["count"] for r in col.aggregate(pipeline_agentes)}

    return {
        "total_mensajes": total,
        "completados": completados,
        "en_proceso": en_proceso,
        "errores": errores,
        "avg_duracion_ms": avg_ms,
        "agentes_stats": agentes_stats,
    }


def guardar_documento(doc_data: Dict[str, Any]) -> str:
    """Guarda un documento procesado en la colección 'documentos'."""
    db = get_db()
    exp_id = doc_data.get("expediente_id") or str(uuid.uuid4())
    doc_data["expediente_id"] = exp_id
    doc_data["fecha_ingreso"] = datetime.now(timezone.utc)
    db["documentos"].replace_one(
        {"expediente_id": exp_id}, doc_data, upsert=True
    )
    return exp_id


def obtener_documentos_recientes(limit: int = 20) -> List[Dict[str, Any]]:
    """Obtiene los documentos más recientes."""
    db = get_db()
    cursor = (
        db["documentos"]
        .find({}, {"_id": 0})
        .sort("fecha_ingreso", -1)
        .limit(limit)
    )
    docs = list(cursor)
    for d in docs:
        if isinstance(d.get("fecha_ingreso"), datetime):
            d["fecha_ingreso"] = d["fecha_ingreso"].strftime("%Y-%m-%d %H:%M:%S")
    return docs


def ping_mongo() -> bool:
    """Retorna True si MongoDB Atlas responde correctamente."""
    try:
        get_db()
        return True
    except Exception:
        return False


# ════════════════════════════════════════════════════════════════════════════
# OBSERVACIONES CONSTITUCIONALES (colección nueva)
# ════════════════════════════════════════════════════════════════════════════

def guardar_observacion_constitucional_mongo(
    sesion_id: str,
    dictamen: Dict[str, Any],
    task_id_verificacion: Optional[str] = None,
    id_proyecto_pg: Optional[int] = None,
    articulos_consultados: Optional[List[Dict[str, Any]]] = None,
    modelo_llm: Optional[str] = None,
    duracion_ms: Optional[int] = None,
) -> str:
    """
    Guarda el dictamen constitucional en la colección MongoDB 'observaciones_constitucionales'.
    Sirve como cache rápido para el dashboard en tiempo real.

    Documento almacenado:
    {
        obs_id:               UUID único de la observación
        sesion_id:            ID de sesión del pipeline
        task_id_verificacion: UUID del mensaje en agent_messages
        id_proyecto_pg:       FK al id_proyecto en PostgreSQL (puede ser None)
        valido:               bool — True si el proyecto es conforme
        confianza:            float 0-100
        severidad_maxima:     'ninguna' | 'leve' | 'grave' | 'bloqueante'
        num_contradicciones:  int
        contradicciones:      lista de objetos con detalles de cada contradicción
        analisis_articulos:   lista de análisis por artículo del proyecto
        articulos_consultados:lista de artículos constitucionales consultados
        fundamentacion_general: str — razonamiento general del agente
        modelo_llm:           modelo usado
        duracion_ms:          tiempo de ejecución
        timestamp:            datetime UTC
    }

    Returns:
        obs_id (UUID string) del documento insertado.
    """
    import uuid as _uuid
    obs_id = str(_uuid.uuid4())
    db = get_db()

    doc = {
        "obs_id": obs_id,
        "sesion_id": sesion_id,
        "task_id_verificacion": task_id_verificacion,
        "id_proyecto_pg": id_proyecto_pg,
        "valido": bool(dictamen.get("valido", True)),
        "confianza": float(dictamen.get("confianza", 0)) if dictamen.get("confianza") is not None else None,
        "severidad_maxima": dictamen.get("severidad_maxima", "ninguna"),
        "num_contradicciones": len(dictamen.get("contradicciones", [])),
        "contradicciones": dictamen.get("contradicciones", []),
        "analisis_articulos": dictamen.get("analisis_por_articulo", []),
        "articulos_consultados": articulos_consultados or [],
        "fundamentacion_general": str(dictamen.get("fundamentacion_general", ""))[:3000],
        "modelo_llm": modelo_llm,
        "duracion_ms": duracion_ms,
        "timestamp": datetime.now(timezone.utc),
    }
    db["observaciones_constitucionales"].insert_one(doc)
    logger.info(
        f"⚖️  Observación constitucional MongoDB | sesión {sesion_id[:8]}... "
        f"| valido={doc['valido']} | severidad={doc['severidad_maxima']}"
    )
    return obs_id


def obtener_observaciones_mongo(
    limit: int = 20,
    solo_invalidos: bool = False,
) -> List[Dict[str, Any]]:
    """Obtiene observaciones constitucionales recientes desde MongoDB."""
    db = get_db()
    filtro: Dict[str, Any] = {}
    if solo_invalidos:
        filtro["valido"] = False
    cursor = (
        db["observaciones_constitucionales"]
        .find(filtro, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    docs = list(cursor)
    for d in docs:
        if isinstance(d.get("timestamp"), datetime):
            d["timestamp"] = d["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
    return docs


def obtener_kpis_constitucionales_mongo() -> Dict[str, Any]:
    """KPIs de observaciones constitucionales desde MongoDB para el dashboard."""
    db = get_db()
    col = db["observaciones_constitucionales"]
    total = col.count_documents({})
    conformes = col.count_documents({"valido": True})
    con_contradicciones = col.count_documents({"valido": False})
    bloqueantes = col.count_documents({"severidad_maxima": "bloqueante"})
    graves = col.count_documents({"severidad_maxima": "grave"})

    pipeline_avg = [
        {"$match": {"confianza": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$confianza"}}},
    ]
    avg_result = list(col.aggregate(pipeline_avg))
    avg_confianza = round(avg_result[0]["avg"], 1) if avg_result else 0.0

    pipeline_sev = [
        {"$group": {"_id": "$severidad_maxima", "count": {"$sum": 1}}},
    ]
    sev_stats = {r["_id"]: r["count"] for r in col.aggregate(pipeline_sev)}

    return {
        "total": total,
        "conformes": conformes,
        "con_contradicciones": con_contradicciones,
        "bloqueantes": bloqueantes,
        "graves": graves,
        "avg_confianza": avg_confianza,
        "por_severidad": sev_stats,
    }
