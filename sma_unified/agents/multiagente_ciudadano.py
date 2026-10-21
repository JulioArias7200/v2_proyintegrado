"""
Agente Multi-Faceta de Atención Ciudadana (router automático de prompts)
=======================================================================
Integra al SMA el backend "Multiagent API": un conjunto de sub-agentes
ciudadanos (Arquitectura y Urbanismo, Salud, Educación, …), cada uno con su
propio nombre, logo y `system_prompt`, donde **el usuario no elige el agente**:
cada mensaje entrante se analiza con el LLM y se enruta solo al sub-agente cuyo
`trigger_description` encaja mejor.

Diferencias respecto al proyecto original (standalone FastAPI + SQLAlchemy):

  - Persistencia: usa la conexión Neon ya existente del SMA
    (`sma_unified.db.neon_postgres.get_conn`, variable `NEON_DATABASE_URL`)
    en vez de un engine SQLAlchemy propio con `DATABASE_URL`. La tabla vive en
    el esquema `sistema` junto al resto del sistema.
  - LLM: usa `chat_completion_resiliente` (fallback automático entre modelos de
    NVIDIA NIM) en vez de un cliente OpenAI con el modelo fijo `z-ai/glm-5.3`,
    que queda "end of life" cada cierto tiempo.
  - Trazabilidad: cada conversación se publica en MongoDB Atlas como mensaje
    inter-agente, igual que el resto de agentes del SMA (best-effort).

Sigue siendo **sin estado**: no se guarda historial de chat, cada mensaje es
independiente.
"""

import json
import time
import uuid
from typing import Any, Dict, List, Optional

try:
    from loguru import logger
except ImportError:  # pragma: no cover
    import logging
    logger = logging.getLogger("multiagente_ciudadano")

from sma_unified.db.neon_postgres import get_conn
from sma_unified.agents.llm_client import chat_completion_resiliente, extraer_json_de_llm
from sma_unified.agents.reglamentos_profesionales import (
    LOGO, INSTRUCCION_PROFESIONAL, recuperar, contexto_fuentes, fuentes_publicas,
)

NOMBRE_AGENTE = "Agente_Multifaceta_Ciudadano"
TABLA = "sistema.agentes_ciudadanos"

_tabla_lista = False


# ════════════════════════════════════════════════════════════════════════════
# ESQUEMA Y SEMILLA
# ════════════════════════════════════════════════════════════════════════════

AGENTES_POR_DEFECTO: List[Dict[str, Any]] = [
    {
        "nombre": "Arquitectura y Urbanismo",
        "logo": LOGO,
        "trigger_description": (
            "Consultas sobre construcción, permisos de edificación, planos, "
            "catastro, uso de suelo, línea y nivel, o regularización de "
            "propiedades e inmuebles"
        ),
        "system_prompt": (
            "Eres un asistente municipal especializado en arquitectura y "
            "urbanismo. Ayudas a ciudadanos con trámites de permisos de "
            "construcción, aprobación de planos, catastro, uso de suelo y "
            "regularización de inmuebles. Explica en lenguaje simple y sin "
            "tecnicismos qué documentos se necesitan, los pasos a seguir y los "
            "tiempos aproximados. Si el trámite puede variar según el municipio "
            "o la magnitud de la obra, acláralo y sugiere confirmar con la "
            "oficina técnica municipal correspondiente. Sé empático y paciente, "
            "muchos ciudadanos no están familiarizados con jerga técnica o legal."
        ),
        "temperature": 0.4,
    },
    {
        "nombre": "Salud",
        "logo": LOGO,
        "trigger_description": (
            "Consultas sobre afiliación a seguros de salud, coberturas médicas, "
            "cómo acceder a hospitales o centros de salud, citas médicas o "
            "emergencias"
        ),
        "system_prompt": (
            "Eres un asistente de salud para ciudadanos. Ayudas con información "
            "sobre afiliación a seguros de salud, coberturas, requisitos para "
            "atenderse en centros de salud públicos o privados, y cómo proceder "
            "ante una emergencia médica. Explica todo en lenguaje claro, "
            "sencillo y empático. Nunca des diagnósticos médicos ni reemplaces a "
            "un profesional de salud — si la consulta suena a una urgencia "
            "médica real, indícale de inmediato que acuda a emergencias o llame "
            "a la línea de auxilio correspondiente."
        ),
        "temperature": 0.4,
    },
    {
        "nombre": "Educación",
        "logo": LOGO,
        "trigger_description": (
            "Consultas sobre inscripciones escolares o universitarias, becas, "
            "trámites académicos, convalidación de títulos o calendario escolar"
        ),
        "system_prompt": (
            "Eres un asistente educativo para ciudadanos. Ayudas con información "
            "sobre inscripciones escolares y universitarias, becas, trámites "
            "académicos, convalidación de títulos y calendario escolar. Responde "
            "en lenguaje simple y accesible, pensando en padres de familia y "
            "estudiantes que pueden no conocer los procesos administrativos."
        ),
        "temperature": 0.4,
    },
    {
        "nombre": "Trámites Legislativos",
        "logo": LOGO,
        "trigger_description": (
            "Consultas sobre proyectos de ley, el estado de un expediente "
            "legislativo, comisiones camerales, normativa boliviana o cómo "
            "presentar una petición ante la Asamblea Legislativa"
        ),
        "system_prompt": (
            "Eres un asistente del Sistema Multi-Agente de Registro Legislativo. "
            "Orientas a ciudadanos sobre cómo presentar peticiones, quejas o "
            "proyectos ante la Asamblea Legislativa Plurinacional, qué ocurre en "
            "cada etapa del trámite (Mesa de Partes, distribución, comisión, "
            "revisión constitucional, aprobación bicameral, promulgación y "
            "publicación en Gaceta) y qué plazos aplican. Explica en lenguaje "
            "claro, cita la norma cuando corresponda y aclara cuando algo debe "
            "confirmarse con la oficina competente. No inventes números de "
            "expediente ni estados de trámite: si no tienes ese dato, indica al "
            "ciudadano dónde consultarlo."
        ),
        "temperature": 0.3,
    },
]

AGENTES_POR_DEFECTO.extend([
    {"nombre": "Abogacía", "logo": LOGO,
     "trigger_description": "Ejercicio de la abogacía, registro de abogados, deberes y ética profesional",
     "system_prompt": "Orienta sobre el ejercicio profesional de la abogacía en Bolivia con las fuentes aportadas.",
     "temperature": 0.2},
    {"nombre": "Seguridad ciudadana", "logo": LOGO,
     "trigger_description": "Seguridad ciudadana, policía, prevención y coordinación institucional",
     "system_prompt": "Orienta sobre seguridad ciudadana en Bolivia con las fuentes aportadas.",
     "temperature": 0.2},
])


def _ensure_tabla() -> None:
    """Crea la tabla de sub-agentes ciudadanos y la siembra si está vacía."""
    global _tabla_lista
    if _tabla_lista:
        return

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("CREATE SCHEMA IF NOT EXISTS sistema")
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {TABLA} (
                id UUID PRIMARY KEY,
                nombre VARCHAR(120) NOT NULL,
                logo VARCHAR(500),
                system_prompt TEXT NOT NULL,
                trigger_description TEXT NOT NULL,
                modelo VARCHAR(200),
                temperature REAL NOT NULL DEFAULT 0.5,
                top_p REAL NOT NULL DEFAULT 1.0,
                max_tokens INT NOT NULL DEFAULT 1024,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute(f"CREATE INDEX IF NOT EXISTS idx_agentes_ciudadanos_activo ON {TABLA}(activo)")

    _tabla_lista = True
    _sembrar_por_defecto(conn)
    _migrar_facetas(conn)
    _registrar_en_catalogo(conn)


def _migrar_facetas(conn):
    """Actualiza instalaciones existentes sin sobrescribir prompts personalizados."""
    with conn.cursor() as cur:
        cur.execute(f"""UPDATE {TABLA} SET logo=%s
            WHERE logo IS NULL OR logo='' OR
            (logo NOT LIKE '/%%' AND logo NOT LIKE 'https://%%' AND logo NOT LIKE 'http://%%')""", (LOGO,))
        for datos in AGENTES_POR_DEFECTO:
            cur.execute(f"""INSERT INTO {TABLA}
                (id,nombre,logo,system_prompt,trigger_description,temperature)
                SELECT %s,%s,%s,%s,%s,%s
                WHERE NOT EXISTS (SELECT 1 FROM {TABLA} WHERE nombre=%s)""",
                (str(uuid.uuid4()), datos['nombre'], LOGO, datos['system_prompt'],
                 datos['trigger_description'], datos['temperature'], datos['nombre']))


def sincronizar_profesiones():
    """Registra nuevas facetas a partir del catálogo cargado, sin cambiar código."""
    from sma_unified.agents.reglamentos_profesionales import catalogo, detectar_profesiones
    _ensure_tabla()
    with get_conn().cursor() as cur:
        cur.execute(f"SELECT nombre FROM {TABLA}")
        nombres = [r[0] for r in cur.fetchall()]
        for documento in catalogo():
            if any(detectar_profesiones(nombre, [documento]) for nombre in nombres):
                continue
            profesion = documento['profesion']
            cur.execute(f"""INSERT INTO {TABLA}
                (id,nombre,logo,system_prompt,trigger_description,temperature)
                SELECT %s,%s,%s,%s,%s,0.2
                WHERE NOT EXISTS (SELECT 1 FROM {TABLA} WHERE nombre=%s)""",
                (str(uuid.uuid4()), profesion, LOGO,
                 f"Orienta profesionalmente sobre {profesion} en Bolivia usando las fuentes proporcionadas.",
                 ', '.join(documento['alias']), profesion))
            nombres.append(profesion)


def _sembrar_por_defecto(conn) -> None:
    """Crea los sub-agentes por defecto solo si la tabla está vacía (idempotente)."""
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT 1 FROM {TABLA} LIMIT 1")
            if cur.fetchone():
                return
        for datos in AGENTES_POR_DEFECTO:
            crear_agente(datos)
        logger.info(f"🌱 Sembrados {len(AGENTES_POR_DEFECTO)} sub-agentes ciudadanos por defecto")
    except Exception as e:
        logger.warning(f"No se pudieron sembrar los agentes ciudadanos por defecto: {e}")


def _registrar_en_catalogo(conn) -> None:
    """Publica el agente en `sistema.agentes_registrados` para que aparezca en /api/agentes."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO sistema.agentes_registrados
                    (nombre_agente, tipo_agente, descripcion, logo_url, estado_operativo, capabilities)
                VALUES (%s, %s, %s, %s, TRUE, %s::jsonb)
                ON CONFLICT (nombre_agente) DO UPDATE SET logo_url=EXCLUDED.logo_url
            """, (
                "Agente Multi-Faceta Ciudadano",
                "ATENCION_CIUDADANA",
                "Asistente ciudadano con múltiples facetas (arquitectura, salud, educación, "
                "trámites legislativos). Enruta automáticamente cada consulta al prompt adecuado.",
                LOGO,
                json.dumps({"routing_automatico": True, "multi_prompt": True, "sin_estado": True}),
            ))
    except Exception as e:
        logger.debug(f"No se registró el agente multi-faceta en el catálogo: {e}")


# ════════════════════════════════════════════════════════════════════════════
# CRUD DE SUB-AGENTES
# ════════════════════════════════════════════════════════════════════════════

_CAMPOS = (
    "id, nombre, logo, system_prompt, trigger_description, modelo, "
    "temperature, top_p, max_tokens, activo, creado_en"
)


def _fila_a_dict(row) -> Dict[str, Any]:
    return {
        "id": str(row[0]),
        "nombre": row[1],
        "logo": row[2],
        "system_prompt": row[3],
        "trigger_description": row[4],
        "modelo": row[5],
        "temperature": float(row[6]),
        "top_p": float(row[7]),
        "max_tokens": int(row[8]),
        "activo": bool(row[9]),
        "creado_en": row[10].isoformat() if row[10] else None,
    }


def listar_agentes(solo_activos: bool = False) -> List[Dict[str, Any]]:
    _ensure_tabla()
    filtro = "WHERE activo = TRUE" if solo_activos else ""
    with get_conn().cursor() as cur:
        cur.execute(f"SELECT {_CAMPOS} FROM {TABLA} {filtro} ORDER BY creado_en ASC")
        return [_fila_a_dict(r) for r in cur.fetchall()]


def obtener_agente(agente_id: str) -> Optional[Dict[str, Any]]:
    _ensure_tabla()
    with get_conn().cursor() as cur:
        cur.execute(f"SELECT {_CAMPOS} FROM {TABLA} WHERE id = %s", (agente_id,))
        row = cur.fetchone()
        return _fila_a_dict(row) if row else None


def crear_agente(datos: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_tabla()
    nuevo_id = str(uuid.uuid4())
    with get_conn().cursor() as cur:
        cur.execute(f"""
            INSERT INTO {TABLA}
                (id, nombre, logo, system_prompt, trigger_description, modelo,
                 temperature, top_p, max_tokens, activo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            nuevo_id,
            datos["nombre"],
            datos.get("logo"),
            datos["system_prompt"],
            datos["trigger_description"],
            datos.get("modelo"),          # None ⇒ usa la cascada de modelos del SMA
            datos.get("temperature", 0.5),
            datos.get("top_p", 1.0),
            datos.get("max_tokens", 1024),
            datos.get("activo", True),
        ))
    return obtener_agente(nuevo_id)


def actualizar_agente(agente_id: str, cambios: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    _ensure_tabla()
    permitidos = {
        "nombre", "logo", "system_prompt", "trigger_description",
        "modelo", "temperature", "top_p", "max_tokens", "activo",
    }
    sets, valores = [], []
    for campo, valor in cambios.items():
        if campo in permitidos and valor is not None:
            sets.append(f"{campo} = %s")
            valores.append(valor)
    if not sets:
        return obtener_agente(agente_id)

    valores.append(agente_id)
    with get_conn().cursor() as cur:
        cur.execute(f"UPDATE {TABLA} SET {', '.join(sets)} WHERE id = %s", tuple(valores))
    return obtener_agente(agente_id)


def eliminar_agente(agente_id: str) -> bool:
    _ensure_tabla()
    with get_conn().cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE id = %s", (agente_id,))
        return cur.rowcount > 0


# ════════════════════════════════════════════════════════════════════════════
# ROUTING AUTOMÁTICO + RESPUESTA
# ════════════════════════════════════════════════════════════════════════════

def elegir_agente(mensaje: str, agentes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Decide con el LLM cuál sub-agente responde el mensaje.
    Si el router falla o devuelve algo no parseable, cae al primer agente.
    """
    if not agentes:
        raise ValueError("No hay sub-agentes ciudadanos registrados")
    if len(agentes) == 1:
        return agentes[0]

    catalogo = "\n".join(
        f'- id="{a["id"]}" | {a["nombre"]}: {a["trigger_description"]}' for a in agentes
    )
    prompt_router = (
        "Eres un router. Tu única tarea es elegir, de la siguiente lista de agentes, "
        "cuál es el más adecuado para responder el mensaje del usuario.\n\n"
        f"Agentes disponibles:\n{catalogo}\n\n"
        'Responde EXCLUSIVAMENTE con un JSON de la forma {"agent_id": "<id>"}, '
        "sin texto adicional, sin markdown, sin explicaciones."
    )

    try:
        contenido, _modelo = chat_completion_resiliente(
            messages=[
                {"role": "system", "content": prompt_router},
                {"role": "user", "content": mensaje},
            ],
            temperature=0.0,
            max_tokens=120,
            timeout=15,
            max_model_attempts=2,
        )
        elegido = extraer_json_de_llm(contenido).get("agent_id")
        for a in agentes:
            if a["id"] == elegido:
                return a
        logger.warning(f"[Multifaceta] El router devolvió un id desconocido: {elegido}")
    except Exception as e:
        logger.warning(f"[Multifaceta] Falló el routing automático, usando fallback: {e}")

    # Un fallo del router no debe enviar una pregunta general al arquitecto.
    return next((a for a in agentes if a['nombre'] == 'Trámites Legislativos'), agentes[0])


def responder_ciudadano(
    mensaje: str,
    sesion_id: Optional[str] = None,
    agente_id: Optional[str] = None,
    caso_texto: Optional[str] = None,
    caso_nombre: Optional[str] = None,
    usar_especialista: bool = False,
    dictamen: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Punto de entrada del agente: recibe un mensaje, elige solo el sub-agente
    adecuado y responde con su `system_prompt`. Sin historial.

    `agente_id` es opcional y solo se usa para pruebas o para forzar una faceta;
    el flujo normal del SMA no lo envía.

    Si el ciudadano subió un caso y activó `usar_especialista`, el routing se
    omite y responde el Especialista Técnico Pericial sobre ese documento,
    reutilizando el `dictamen` ya emitido si se envía de vuelta.
    """
    t0 = time.time()

    if usar_especialista and (caso_texto or "").strip():
        return _responder_especialista(
            mensaje, caso_texto, caso_nombre, dictamen, sesion_id, t0
        )
    if (caso_texto or '').strip():
        from sma_unified.agents.facetas_semanticas import analizar_multifaceta
        analisis = analizar_multifaceta(caso_texto, titulo=caso_nombre, sesion_id=sesion_id, pregunta=mensaje)
        if analisis['estado'] != 'NO_APLICA':
            return {
                'success': True, 'reply': analisis.get('informe') or 'La revisión de las facetas está pendiente: ' + analisis.get('error', ''),
                'agente_id': 'multifaceta_profesional', 'agente_nombre': ' · '.join(analisis['profesiones']) or 'Asistente profesional',
                'agente_logo': LOGO, 'facetas': analisis['facetas'], 'fuentes': analisis['fuentes'],
                'informe_profesional': analisis, 'routing_automatico': True, 'con_caso_adjunto': True,
                'modelo_usado': analisis.get('modelo_selector'), 'duracion_ms': int((time.time()-t0)*1000),
                'aviso_fuentes': 'Hay facetas pendientes de revisión.' if analisis['estado']=='PENDIENTE_REVISION' else None,
            }
    agentes = listar_agentes(solo_activos=True)
    if not agentes:
        raise RuntimeError("No hay sub-agentes ciudadanos activos. Crea uno con POST /api/ciudadana/agentes")

    forzado = next((a for a in agentes if a["id"] == agente_id), None) if agente_id else None
    agente = forzado or elegir_agente(f"{mensaje}\n{(caso_texto or '')[:4000]}", agentes)

    task_id = _publicar_mongo(agente, mensaje, sesion_id)

    consulta = mensaje
    if (caso_texto or "").strip():
        consulta = (
            f"El ciudadano adjuntó el caso «{caso_nombre or 'documento'}». "
            f"Extracto del documento:\n{caso_texto[:3000]}\n\n"
            f"Consulta:\n{mensaje}"
        )

    fuentes = []
    aviso_fuentes = None
    try:
        # Si el selector confirmó NO_APLICA en el documento, no introducir
        # fuentes de otras profesiones por una coincidencia vectorial superficial.
        fuentes = [] if (caso_texto or '').strip() else recuperar(mensaje)
    except Exception as exc:
        logger.warning(f"[Multifaceta] Corpus no disponible: {exc}")
        aviso_fuentes = 'No se pudo consultar el corpus profesional; esta respuesta no acredita requisitos normativos.'
    base = contexto_fuentes(fuentes) or 'No hay fuentes profesionales recuperadas para esta consulta.'
    contenido, modelo_usado = chat_completion_resiliente(
        messages=[
            {"role": "system", "content": agente["system_prompt"] + '\n' + INSTRUCCION_PROFESIONAL},
            {"role": "user", "content": f"FUENTES DOCUMENTALES:\n{base}\n\n{consulta}"},
        ],
        temperature=agente["temperature"],
        max_tokens=agente["max_tokens"],
        top_p=agente["top_p"],
        timeout=30,
        max_model_attempts=2,
    )

    duracion_ms = int((time.time() - t0) * 1000)
    resultado = {
        "success": True,
        "reply": contenido,
        "agente_id": agente["id"],
        "agente_nombre": agente["nombre"],
        "agente_logo": agente.get("logo") if str(agente.get("logo") or '').startswith(('/', 'https://', 'http://')) else LOGO,
        "fuentes": fuentes_publicas(fuentes),
        "aviso_fuentes": aviso_fuentes,
        "routing_automatico": forzado is None,
        "modelo_usado": modelo_usado,
        "duracion_ms": duracion_ms,
        "task_id": task_id,
        "con_caso_adjunto": bool((caso_texto or "").strip()),
    }
    _cerrar_mongo(task_id, resultado, duracion_ms)
    return resultado


def _responder_especialista(
    mensaje: str,
    caso_texto: str,
    caso_nombre: Optional[str],
    dictamen: Optional[Dict[str, Any]],
    sesion_id: Optional[str],
    t0: float,
) -> Dict[str, Any]:
    """Delega la respuesta en el Especialista Técnico Pericial sobre el caso subido."""
    from sma_unified.agents.especialista_chat import (
        responder_con_especialista,
        NOMBRE_FACETA,
        LOGO_FACETA,
    )

    res = responder_con_especialista(
        mensaje=mensaje,
        texto_caso=caso_texto,
        dictamen=dictamen,
        titulo=caso_nombre,
    )
    duracion_ms = int((time.time() - t0) * 1000)
    return {
        "success": True,
        "reply": res["reply"],
        "fuentes": res.get("fuentes", []),
        "aviso_fuentes": res.get("aviso_fuentes"),
        "agente_id": "especialista_tecnico",
        "agente_nombre": NOMBRE_FACETA,
        "agente_logo": LOGO_FACETA,
        "routing_automatico": False,
        "especialista": True,
        "dictamen": res["dictamen"],
        "dictamen_generado_ahora": res["dictamen_generado_ahora"],
        "modelo_usado": res["modelo_usado"],
        "duracion_ms": duracion_ms,
        "con_caso_adjunto": True,
        "task_id": None,
    }


def _publicar_mongo(agente: Dict[str, Any], mensaje: str, sesion_id: Optional[str]) -> Optional[str]:
    """Traza la conversación en MongoDB Atlas como el resto de agentes (best-effort)."""
    try:
        from sma_unified.config import AGENTE_ATENCION_CIUDADANA
        from sma_unified.db.mongo_atlas import publicar_mensaje, marcar_en_proceso
        task_id = publicar_mensaje(
            agente_origen="Ciudadano",
            agente_destino=AGENTE_ATENCION_CIUDADANA,
            tipo_tarea="Consulta Ciudadana Multi-Faceta",
            payload={
                "mensaje_preview": mensaje[:400],
                "faceta_elegida": agente["nombre"],
                "agente_id": agente["id"],
            },
            sesion_id=sesion_id,
            metadata={"router": "automatico", "modelo_configurado": agente.get("modelo")},
        )
        marcar_en_proceso(task_id)
        return task_id
    except Exception as e:
        logger.debug(f"[Multifaceta] Sin traza en Mongo: {e}")
        return None


def _cerrar_mongo(task_id: Optional[str], resultado: Dict[str, Any], duracion_ms: int) -> None:
    if not task_id:
        return
    try:
        from sma_unified.db.mongo_atlas import marcar_completado
        marcar_completado(
            task_id,
            resultado={
                "faceta": resultado.get("agente_nombre", "Multifacético profesional"),
                "respuesta_preview": (resultado.get("reply") or resultado.get("informe") or "")[:400],
                "modelo_usado": resultado.get("modelo_usado"),
                "informe_profesional": resultado if "informe" in resultado else None,
                "fuentes": resultado.get("fuentes", []),
            },
            duracion_ms=duracion_ms,
        )
    except Exception as e:
        logger.debug(f"[Multifaceta] No se pudo cerrar la traza en Mongo: {e}")
