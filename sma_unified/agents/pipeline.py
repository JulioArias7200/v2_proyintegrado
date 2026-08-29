"""
Pipeline Principal del SMA (Sistema Multi-Agente)
==================================================
Orquesta el flujo de procesamiento de documentos en 2 fases con punto de control humano:
  Fase 1: Recepción + Clasificación Nivel 1 (Agente Distribuidor)
  [PUNTO DE CONTROL / ALTO HUMANO]: Validación o ajuste de categoría
  Fase 2: Ejecución Nivel 2 (Agente Especializado + Verificación Constitucional)
  Persistencia dual: MongoDB Atlas + PostgreSQL Neon
"""

import uuid
import time
from typing import Dict, Any, Optional

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("pipeline")

from sma_unified.db.mongo_atlas import guardar_documento, publicar_mensaje, marcar_completado
from sma_unified.db.neon_postgres import (
    guardar_proyecto_ley,
    guardar_solicitud_documento,
    guardar_clasificacion_agente,
    actualizar_proyecto_con_observacion,
    registrar_bitacora,
    registrar_enrutamiento,
)
from sma_unified.agents.distribuidor import clasificar_documento
from sma_unified.agents.comision import procesar_legislativo
from sma_unified.agents.ciudadana import procesar_atencion_ciudadana
from sma_unified.agents.correspondencia import procesar_correspondencia
from sma_unified.agents.consistencia_normativa import verificar_consistencia_normativa
from sma_unified.config import AGENTE_DISTRIBUIDOR, AGENTE_USUARIO, AGENTE_CONSISTENCIA


def ejecutar_fase_1_clasificacion(
    texto_documento: str,
    nombre_archivo: Optional[str] = None,
    tipo_entrada: str = "Texto",
    metadata_extra: Optional[Dict[str, Any]] = None,
    sesion_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    FASE 1: Recepción inicial y clasificación con Agente Distribuidor (Nivel 1).
    Se detiene aquí para permitir validación humana o botón de alto.
    """
    sesion_id = sesion_id or str(uuid.uuid4())
    logger.info(f"🚀 [Fase 1] Iniciando clasificación SMA | sesión: {sesion_id[:8]}...")

    # 1. Publicar recepción inicial en MongoDB
    task_id_inicial = publicar_mensaje(
        agente_origen=AGENTE_USUARIO,
        agente_destino=AGENTE_DISTRIBUIDOR,
        tipo_tarea="Inicio de Pipeline — Recepción de Documento",
        payload={
            "nombre_archivo": nombre_archivo or "texto_directo",
            "tipo_entrada": tipo_entrada,
            "longitud_chars": len(texto_documento),
            **(metadata_extra or {}),
        },
        sesion_id=sesion_id,
        metadata={"inicio_pipeline": True},
    )

    # 2. Agente Distribuidor (Nivel 1)
    clasificacion = clasificar_documento(
        texto_documento=texto_documento,
        sesion_id=sesion_id,
        metadata_entrada={
            "nombre_archivo": nombre_archivo,
            "tipo_entrada": tipo_entrada,
        },
    )

    categoria = clasificacion["categoria"]
    task_id_distribuidor = clasificacion["task_id_entrada"]
    agente_destino_nombre = clasificacion["agente_destino_nombre"]
    duracion_distribuidor_ms = clasificacion.get("duracion_ms", 0)

    # 3. Pre-guardar en PostgreSQL según categoría
    id_proyecto: Optional[int] = None
    solicitud_id: Optional[int] = None

    if categoria == "AGENTE_REGISTRO_LEGISLATIVO":
        id_proyecto = guardar_proyecto_ley(
            sesion_id=sesion_id,
            texto_documento=texto_documento,
            nombre_archivo=nombre_archivo,
            tipo_entrada=tipo_entrada,
        )
        registrar_bitacora(
            id_proyecto=id_proyecto,
            agente_accion=AGENTE_DISTRIBUIDOR,
            accion_realizada="Clasificación Nivel 1 — Legislativo",
            descripcion=f"Documento clasificado como LEGISLATIVO. Agente destino: {agente_destino_nombre}",
            tiempo_segundos=duracion_distribuidor_ms // 1000,
        )
    else:
        origen = "Atención Ciudadana" if "CIUDADANA" in categoria else "Correspondencia"
        solicitud_id = guardar_solicitud_documento(
            sesion_id=sesion_id,
            texto_documento=texto_documento,
            tipo_entrada=tipo_entrada,
            nombre_archivo=nombre_archivo,
            origen=origen,
        )

    guardar_clasificacion_agente(
        solicitud_id=solicitud_id,
        agente_destino=agente_destino_nombre,
    )

    registrar_enrutamiento(
        id_proyecto=id_proyecto,
        agente_origen=AGENTE_DISTRIBUIDOR,
        agente_destino=agente_destino_nombre,
        estado_envio="enviado",
        tiempo_respuesta_ms=duracion_distribuidor_ms,
        decision=f"Clasificado como: {categoria}",
        categoria=categoria,
    )

    return {
        "sesion_id": sesion_id,
        "task_id_inicial": task_id_inicial,
        "task_id_distribuidor": task_id_distribuidor,
        "categoria": categoria,
        "agente_destino_nombre": agente_destino_nombre,
        "duracion_ms": duracion_distribuidor_ms,
        "id_proyecto": id_proyecto,
        "solicitud_id": solicitud_id,
        "nombre_archivo": nombre_archivo or "texto_directo",
        "tipo_entrada": tipo_entrada,
    }


def ejecutar_fase_2_agentes(
    sesion_id: str,
    task_id_inicial: str,
    task_id_distribuidor: str,
    categoria: str,
    agente_destino_nombre: str,
    texto_documento: str,
    nombre_archivo: Optional[str] = None,
    tipo_entrada: str = "Texto",
    id_proyecto: Optional[int] = None,
    solicitud_id: Optional[int] = None,
    t_inicio_fase1: Optional[float] = None,
    local_filepath: Optional[str] = None,
) -> Dict[str, Any]:
    """
    FASE 2: Ejecución de Agentes de Nivel 2 y Auditoría Constitucional.
    Persiste en MongoDB Atlas y PostgreSQL Neon (archivo_pdf = ruta local).
    """
    t_fase2 = time.time()
    t_total_ref = t_inicio_fase1 or t_fase2

    logger.info(f"⚙️  [Fase 2] Ejecutando agentes especializados para {categoria}...")
    resultado_nivel2: Dict[str, Any] = {}

    if categoria == "AGENTE_REGISTRO_LEGISLATIVO":
        resultado_nivel2 = procesar_legislativo(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
            solicitud_id=solicitud_id,
            id_proyecto=id_proyecto,
        )
        comision_data = resultado_nivel2.get("comision_data", {})
        dictamen = resultado_nivel2.get("dictamen", {})
        comision_nombre = comision_data.get("comision_principal", "")

        # ── Agente de Consistencia Normativa: coteja contra el resto del
        #    ordenamiento vigente (leyes/decretos), en paralelo a la
        #    verificación constitucional que ya hizo procesar_legislativo() ──
        resultado_consistencia = verificar_consistencia_normativa(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=resultado_nivel2.get("task_id_verificacion") or task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
            id_proyecto=id_proyecto,
            nombre_archivo=nombre_archivo,
        )
        resultado_nivel2["consistencia_normativa"] = resultado_consistencia

        if id_proyecto:
            guardar_proyecto_ley(
                sesion_id=sesion_id,
                texto_documento=texto_documento,
                nombre_archivo=nombre_archivo,
                comision_data=comision_data,
                dictamen=dictamen,
                tipo_entrada=tipo_entrada,
            )
            if comision_nombre:
                from sma_unified.db.neon_postgres import asignar_comision_a_proyecto
                asignar_comision_a_proyecto(
                    id_proyecto=id_proyecto,
                    nombre_comision=comision_nombre,
                    observaciones=dictamen.get("fundamentacion_general"),
                    valido_constitucional=bool(dictamen.get("valido", True)),
                )
            id_obs_neon = resultado_nivel2.get("id_observacion_neon")
            if id_obs_neon:
                actualizar_proyecto_con_observacion(
                    id_proyecto=id_proyecto,
                    id_observacion=id_obs_neon,
                    valido=bool(dictamen.get("valido", True)),
                )

            registrar_bitacora(
                id_proyecto=id_proyecto,
                agente_accion=AGENTE_CONSISTENCIA,
                accion_realizada="Análisis de Consistencia Normativa",
                descripcion=(
                    f"Hallazgos: {resultado_consistencia.get('total_hallazgos', 0)} | "
                    f"Por tipo: {resultado_consistencia.get('resumen_por_tipo', {})}"
                ),
                tiempo_segundos=resultado_consistencia.get("duracion_ms", 0) // 1000,
            )

            # ── Guardar ruta local del archivo en Neon (archivo_pdf) ────────
            if local_filepath and id_proyecto:
                try:
                    from sma_unified.db.neon_postgres import get_conn
                    _conn = get_conn()
                    _cur = _conn.cursor()
                    _cur.execute(
                        "UPDATE sistema.proyecto_ley SET archivo_pdf = %s WHERE id_proyecto = %s",
                        (local_filepath, id_proyecto),
                    )
                    _conn.commit()
                    _cur.close()
                    logger.info(f"📂 archivo_pdf guardado localmente: {local_filepath}")
                except Exception as _le:
                    logger.warning(f"No se pudo guardar ruta local en Neon: {_le}")

            registrar_bitacora(
                id_proyecto=id_proyecto,
                agente_accion=agente_destino_nombre,
                accion_realizada="Asignación de Comisión + Verificación Constitucional",
                descripcion=(
                    f"Comisión: {comision_data.get('comision_principal')} | "
                    f"Válido: {dictamen.get('valido')} | "
                    f"Severidad: {dictamen.get('severidad_maxima', 'ninguna')}"
                ),
                nivel_confianza=float(dictamen.get("confianza", 0)) if dictamen.get("confianza") else None,
            )

    elif categoria == "AGENTE_ATENCION_CIUDADANA":
        resultado_nivel2 = procesar_atencion_ciudadana(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
        )
        res_n2 = resultado_nivel2.get("resultado", {})
        registrar_bitacora(
            id_proyecto=None,
            agente_accion=agente_destino_nombre,
            accion_realizada="Procesamiento de Solicitud Ciudadana",
            descripcion=f"Categoría: {res_n2.get('categoria')} | Prioridad: {res_n2.get('prioridad')}",
        )

    else:  # AGENTE_GESTION_CORRESPONDENCIA
        resultado_nivel2 = procesar_correspondencia(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
        )
        res_n2 = resultado_nivel2.get("resultado", {})
        registrar_bitacora(
            id_proyecto=None,
            agente_accion=agente_destino_nombre,
            accion_realizada="Gestión de Correspondencia Oficial",
            descripcion=f"Tipo: {res_n2.get('tipo_tramite')} | Urgencia: {res_n2.get('nivel_urgencia')}",
        )

    duracion_total_ms = int((time.time() - t_total_ref) * 1000)

    # Extraer campos de presentación
    if categoria == "AGENTE_REGISTRO_LEGISLATIVO":
        comision_data = resultado_nivel2.get("comision_data", {})
        dictamen = resultado_nivel2.get("dictamen", {})
        comision_display = comision_data.get("comision_principal", "COMISION_DE_CONSTITUCION")
        resumen = comision_data.get("resumen", "Proyecto legislativo procesado.")
        palabras_clave = comision_data.get("palabras_clave", [])
        valido_const = dictamen.get("valido", True)
        confianza = dictamen.get("confianza", 85.0)
        severidad = dictamen.get("severidad_maxima", "ninguna")
        num_contradicciones = len(dictamen.get("contradicciones", []))
        contradicciones = dictamen.get("contradicciones", [])
        fundamentacion = dictamen.get("fundamentacion_general", "")
        consistencia_normativa = resultado_nivel2.get("consistencia_normativa", {})
        hallazgos_consistencia = consistencia_normativa.get("hallazgos", [])
    else:
        res_n2 = resultado_nivel2.get("resultado", {})
        comision_display = (
            res_n2.get("area_responsable")
            or res_n2.get("unidad_receptora")
            or agente_destino_nombre
        )
        resumen = (
            res_n2.get("resumen")
            or res_n2.get("asunto_principal")
            or "Documento procesado correctamente."
        )
        palabras_clave = []
        valido_const = None
        confianza = None
        severidad = None
        num_contradicciones = 0
        contradicciones = []
        fundamentacion = ""
        consistencia_normativa = {}
        hallazgos_consistencia = []

    resultado_final = {
        "sesion_id": sesion_id,
        "task_id_inicial": task_id_inicial,
        "categoria": categoria,
        "agente_destino": agente_destino_nombre,
        "comision_display": comision_display,
        "resumen": resumen,
        "palabras_clave": palabras_clave if isinstance(palabras_clave, list) else [],
        "valido_constitucional": valido_const,
        "confianza_constitucional": confianza,
        "severidad_maxima": severidad,
        "num_contradicciones": num_contradicciones,
        "contradicciones": contradicciones,
        "fundamentacion": fundamentacion,
        "consistencia_normativa": consistencia_normativa,
        "hallazgos_consistencia": hallazgos_consistencia,
        "num_hallazgos_consistencia": len(hallazgos_consistencia),
        "duracion_total_ms": duracion_total_ms,
        "tipo_entrada": tipo_entrada,
        "nombre_archivo": nombre_archivo or "texto_directo",
        "nivel2": resultado_nivel2,
        "id_proyecto_pg": id_proyecto,
        "solicitud_id_pg": solicitud_id,
        "id_observacion_neon": resultado_nivel2.get("id_observacion_neon"),
        "obs_id_mongo": resultado_nivel2.get("obs_id_mongo"),
    }

    # Guardar snapshot consolidado en MongoDB
    expediente_id = guardar_documento({
        "sesion_id": sesion_id,
        "nombre_archivo": nombre_archivo or "texto_directo",
        "tipo_entrada": tipo_entrada,
        "texto_preview": texto_documento[:300],
        "categoria": categoria,
        "agente_destino": agente_destino_nombre,
        "comision": comision_display,
        "resumen": resumen,
        "palabras_clave": palabras_clave,
        "valido_constitucional": valido_const,
        "confianza": confianza,
        "severidad_maxima": severidad,
        "num_contradicciones": num_contradicciones,
        "num_hallazgos_consistencia": len(hallazgos_consistencia),
        "duracion_total_ms": duracion_total_ms,
        "estado": "completado",
        "id_proyecto_pg": id_proyecto,
        "solicitud_id_pg": solicitud_id,
    })

    resultado_final["expediente_id"] = expediente_id

    marcar_completado(
        task_id_inicial,
        resultado={
            "expediente_id": expediente_id,
            "categoria": categoria,
            "duracion_ms": duracion_total_ms,
            "id_proyecto_pg": id_proyecto,
        },
        duracion_ms=duracion_total_ms,
    )

    registrar_bitacora(
        id_proyecto=id_proyecto,
        agente_accion="Pipeline",
        accion_realizada="Pipeline Completado",
        descripcion=f"Sesión {sesion_id[:8]} finalizada | {duracion_total_ms}ms | expediente: {expediente_id}",
        tiempo_segundos=duracion_total_ms // 1000,
        metadata={
            "expediente_id": expediente_id,
            "categoria": categoria,
            "num_contradicciones": num_contradicciones,
        },
    )

    logger.info(
        f"🏁 Pipeline completado | sesión {sesion_id[:8]}... | "
        f"categoría: {categoria} | total: {duracion_total_ms}ms"
    )

    return resultado_final


def ejecutar_pipeline(
    texto_documento: str,
    nombre_archivo: Optional[str] = None,
    tipo_entrada: str = "Texto",
    metadata_extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Ejecuta el pipeline completo de corrido (Fase 1 + Fase 2)."""
    t0 = time.time()
    f1 = ejecutar_fase_1_clasificacion(
        texto_documento=texto_documento,
        nombre_archivo=nombre_archivo,
        tipo_entrada=tipo_entrada,
        metadata_extra=metadata_extra,
    )
    return ejecutar_fase_2_agentes(
        sesion_id=f1["sesion_id"],
        task_id_inicial=f1["task_id_inicial"],
        task_id_distribuidor=f1["task_id_distribuidor"],
        categoria=f1["categoria"],
        agente_destino_nombre=f1["agente_destino_nombre"],
        texto_documento=texto_documento,
        nombre_archivo=nombre_archivo,
        tipo_entrada=tipo_entrada,
        id_proyecto=f1["id_proyecto"],
        solicitud_id=f1["solicitud_id"],
        t_inicio_fase1=t0,
    )


import uuid
import time
from typing import Dict, Any, Optional

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("pipeline")

from sma_unified.db.mongo_atlas import guardar_documento, publicar_mensaje, marcar_completado
from sma_unified.db.neon_postgres import (
    guardar_proyecto_ley,
    guardar_solicitud_documento,
    guardar_clasificacion_agente,
    actualizar_proyecto_con_observacion,
    registrar_bitacora,
    registrar_enrutamiento,
)
from sma_unified.agents.distribuidor import clasificar_documento
from sma_unified.agents.comision import procesar_legislativo
from sma_unified.agents.ciudadana import procesar_atencion_ciudadana
from sma_unified.agents.correspondencia import procesar_correspondencia
from sma_unified.config import AGENTE_DISTRIBUIDOR, AGENTE_USUARIO


def ejecutar_pipeline(
    texto_documento: str,
    nombre_archivo: Optional[str] = None,
    tipo_entrada: str = "Texto",
    metadata_extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ejecuta el pipeline completo de procesamiento de documentos.

    Persiste en:
      MongoDB Atlas  → agent_messages, documentos, observaciones_constitucionales
      PostgreSQL Neon → proyecto_ley / Solicitudes_Documentos, bitacora_proceso,
                        enrutamiento_documento, Clasificacion_Agente,
                        observaciones_constitucionales (via comision.py)

    Returns:
        dict con resultado completo del procesamiento, incluyendo IDs de ambas BDs.
    """
    sesion_id = str(uuid.uuid4())
    t_total = time.time()

    logger.info(f"🚀 Iniciando pipeline SMA | sesión: {sesion_id[:8]}...")

    # ── Paso 0: Publicar recepción inicial en MongoDB ────────────────────────
    task_id_inicial = publicar_mensaje(
        agente_origen=AGENTE_USUARIO,
        agente_destino=AGENTE_DISTRIBUIDOR,
        tipo_tarea="Inicio de Pipeline — Recepción de Documento",
        payload={
            "nombre_archivo": nombre_archivo or "texto_directo",
            "tipo_entrada": tipo_entrada,
            "longitud_chars": len(texto_documento),
            **(metadata_extra or {}),
        },
        sesion_id=sesion_id,
        metadata={"inicio_pipeline": True},
    )

    # ── Paso 1: Agente Distribuidor (Nivel 1) ────────────────────────────────
    clasificacion = clasificar_documento(
        texto_documento=texto_documento,
        sesion_id=sesion_id,
        metadata_entrada={
            "nombre_archivo": nombre_archivo,
            "tipo_entrada": tipo_entrada,
        },
    )

    categoria = clasificacion["categoria"]
    task_id_distribuidor = clasificacion["task_id_entrada"]
    agente_destino_nombre = clasificacion["agente_destino_nombre"]
    duracion_distribuidor_ms = clasificacion.get("duracion_ms", 0)

    # ── Paso 2: Pre-guardar en PostgreSQL según categoría ────────────────────
    id_proyecto: Optional[int] = None
    solicitud_id: Optional[int] = None

    if categoria == "AGENTE_REGISTRO_LEGISLATIVO":
        # Guardado inicial en sistema.proyecto_ley (se actualizará con datos de comisión)
        id_proyecto = guardar_proyecto_ley(
            sesion_id=sesion_id,
            texto_documento=texto_documento,
            nombre_archivo=nombre_archivo,
            tipo_entrada=tipo_entrada,
        )
        registrar_bitacora(
            id_proyecto=id_proyecto,
            agente_accion=AGENTE_DISTRIBUIDOR,
            accion_realizada="Clasificación Nivel 1 — Legislativo",
            descripcion=f"Documento clasificado como LEGISLATIVO. Agente destino: {agente_destino_nombre}",
            tiempo_segundos=duracion_distribuidor_ms // 1000,
        )
    else:
        # Solicitudes ciudadanas y correspondencia → public.Solicitudes_Documentos
        origen = "Atención Ciudadana" if "CIUDADANA" in categoria else "Correspondencia"
        solicitud_id = guardar_solicitud_documento(
            sesion_id=sesion_id,
            texto_documento=texto_documento,
            tipo_entrada=tipo_entrada,
            nombre_archivo=nombre_archivo,
            origen=origen,
        )

    # Registrar clasificación del agente distribuidor en public.Clasificacion_Agente
    guardar_clasificacion_agente(
        solicitud_id=solicitud_id,
        agente_destino=agente_destino_nombre,
    )

    # Registrar enrutamiento Distribuidor → Agente destino
    registrar_enrutamiento(
        id_proyecto=id_proyecto,
        agente_origen=AGENTE_DISTRIBUIDOR,
        agente_destino=agente_destino_nombre,
        estado_envio="enviado",
        tiempo_respuesta_ms=duracion_distribuidor_ms,
        decision=f"Clasificado como: {categoria}",
        categoria=categoria,
    )

    # ── Paso 3: Enrutar al agente correspondiente (Nivel 2) ──────────────────
    resultado_nivel2: Dict[str, Any] = {}

    if categoria == "AGENTE_REGISTRO_LEGISLATIVO":
        resultado_nivel2 = procesar_legislativo(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
            solicitud_id=solicitud_id,
            id_proyecto=id_proyecto,
        )
        # Actualizar proyecto_ley con datos de comisión y resultado constitucional
        comision_data = resultado_nivel2.get("comision_data", {})
        dictamen = resultado_nivel2.get("dictamen", {})

        # ── Agente de Consistencia Normativa: coteja contra el resto del
        #    ordenamiento vigente (leyes/decretos), en paralelo a la
        #    verificación constitucional que ya hizo procesar_legislativo() ──
        resultado_consistencia = verificar_consistencia_normativa(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=resultado_nivel2.get("task_id_verificacion") or task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
            id_proyecto=id_proyecto,
            nombre_archivo=nombre_archivo,
        )
        resultado_nivel2["consistencia_normativa"] = resultado_consistencia

        if id_proyecto:
            guardar_proyecto_ley(
                sesion_id=sesion_id,
                texto_documento=texto_documento,
                nombre_archivo=nombre_archivo,
                comision_data=comision_data,
                dictamen=dictamen,
                tipo_entrada=tipo_entrada,
            )
            id_obs_neon = resultado_nivel2.get("id_observacion_neon")
            if id_obs_neon:
                actualizar_proyecto_con_observacion(
                    id_proyecto=id_proyecto,
                    id_observacion=id_obs_neon,
                    valido=bool(dictamen.get("valido", True)),
                )
            registrar_bitacora(
                id_proyecto=id_proyecto,
                agente_accion=agente_destino_nombre,
                accion_realizada="Asignación de Comisión + Verificación Constitucional",
                descripcion=(
                    f"Comisión: {comision_data.get('comision_principal')} | "
                    f"Válido: {dictamen.get('valido')} | "
                    f"Severidad: {dictamen.get('severidad_maxima', 'ninguna')}"
                ),
                nivel_confianza=float(dictamen.get("confianza", 0)) if dictamen.get("confianza") else None,
            )
            registrar_bitacora(
                id_proyecto=id_proyecto,
                agente_accion=AGENTE_CONSISTENCIA,
                accion_realizada="Análisis de Consistencia Normativa",
                descripcion=(
                    f"Hallazgos: {resultado_consistencia.get('total_hallazgos', 0)} | "
                    f"Por tipo: {resultado_consistencia.get('resumen_por_tipo', {})}"
                ),
                tiempo_segundos=resultado_consistencia.get("duracion_ms", 0) // 1000,
            )

    elif categoria == "AGENTE_ATENCION_CIUDADANA":
        resultado_nivel2 = procesar_atencion_ciudadana(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
        )
        res_n2 = resultado_nivel2.get("resultado", {})
        registrar_bitacora(
            id_proyecto=None,
            agente_accion=agente_destino_nombre,
            accion_realizada="Procesamiento de Solicitud Ciudadana",
            descripcion=f"Categoría: {res_n2.get('categoria')} | Prioridad: {res_n2.get('prioridad')}",
        )

    else:  # AGENTE_GESTION_CORRESPONDENCIA
        resultado_nivel2 = procesar_correspondencia(
            texto_documento=texto_documento,
            sesion_id=sesion_id,
            task_id_distribuidor=task_id_distribuidor,
            metadata_extra={"nombre_archivo": nombre_archivo},
        )
        res_n2 = resultado_nivel2.get("resultado", {})
        registrar_bitacora(
            id_proyecto=None,
            agente_accion=agente_destino_nombre,
            accion_realizada="Gestión de Correspondencia Oficial",
            descripcion=f"Tipo: {res_n2.get('tipo_tramite')} | Urgencia: {res_n2.get('nivel_urgencia')}",
        )

    # ── Paso 4: Construir resultado consolidado ──────────────────────────────
    duracion_total_ms = int((time.time() - t_total) * 1000)

    if categoria == "AGENTE_REGISTRO_LEGISLATIVO":
        comision_data = resultado_nivel2.get("comision_data", {})
        dictamen = resultado_nivel2.get("dictamen", {})
        comision_display = comision_data.get("comision_principal", "COMISION_DE_CONSTITUCION")
        resumen = comision_data.get("resumen", "Proyecto legislativo procesado.")
        palabras_clave = comision_data.get("palabras_clave", [])
        valido_const = dictamen.get("valido", True)
        confianza = dictamen.get("confianza", 85.0)
        severidad = dictamen.get("severidad_maxima", "ninguna")
        num_contradicciones = len(dictamen.get("contradicciones", []))
        consistencia_normativa = resultado_nivel2.get("consistencia_normativa", {})
        hallazgos_consistencia = consistencia_normativa.get("hallazgos", [])
    else:
        res_n2 = resultado_nivel2.get("resultado", {})
        comision_display = (
            res_n2.get("area_responsable")
            or res_n2.get("unidad_receptora")
            or agente_destino_nombre
        )
        resumen = (
            res_n2.get("resumen")
            or res_n2.get("asunto_principal")
            or "Documento procesado correctamente."
        )
        palabras_clave = []
        valido_const = None
        confianza = None
        severidad = None
        num_contradicciones = 0
        consistencia_normativa = {}
        hallazgos_consistencia = []

    resultado_final = {
        "sesion_id": sesion_id,
        "task_id_inicial": task_id_inicial,
        "categoria": categoria,
        "agente_destino": agente_destino_nombre,
        "comision_display": comision_display,
        "resumen": resumen,
        "palabras_clave": palabras_clave if isinstance(palabras_clave, list) else [],
        "valido_constitucional": valido_const,
        "confianza_constitucional": confianza,
        "severidad_maxima": severidad,
        "num_contradicciones": num_contradicciones,
        "consistencia_normativa": consistencia_normativa,
        "hallazgos_consistencia": hallazgos_consistencia,
        "num_hallazgos_consistencia": len(hallazgos_consistencia),
        "duracion_total_ms": duracion_total_ms,
        "tipo_entrada": tipo_entrada,
        "nombre_archivo": nombre_archivo or "texto_directo",
        "nivel2": resultado_nivel2,
        # IDs de PostgreSQL para trazabilidad cruzada
        "id_proyecto_pg": id_proyecto,
        "solicitud_id_pg": solicitud_id,
        "id_observacion_neon": resultado_nivel2.get("id_observacion_neon"),
        "obs_id_mongo": resultado_nivel2.get("obs_id_mongo"),
    }

    # ── Paso 5: Guardar snapshot consolidado en MongoDB ──────────────────────
    expediente_id = guardar_documento({
        "sesion_id": sesion_id,
        "nombre_archivo": nombre_archivo or "texto_directo",
        "tipo_entrada": tipo_entrada,
        "texto_preview": texto_documento[:300],
        "categoria": categoria,
        "agente_destino": agente_destino_nombre,
        "comision": comision_display,
        "resumen": resumen,
        "palabras_clave": palabras_clave,
        "valido_constitucional": valido_const,
        "confianza": confianza,
        "severidad_maxima": severidad,
        "num_contradicciones": num_contradicciones,
        "duracion_total_ms": duracion_total_ms,
        "estado": "completado",
        # Referencias cruzadas a PostgreSQL
        "id_proyecto_pg": id_proyecto,
        "solicitud_id_pg": solicitud_id,
    })

    resultado_final["expediente_id"] = expediente_id

    # Completar mensaje inicial en MongoDB
    marcar_completado(
        task_id_inicial,
        resultado={
            "expediente_id": expediente_id,
            "categoria": categoria,
            "duracion_ms": duracion_total_ms,
            "id_proyecto_pg": id_proyecto,
        },
        duracion_ms=duracion_total_ms,
    )

    # Registrar cierre del pipeline en bitácora Neon
    registrar_bitacora(
        id_proyecto=id_proyecto,
        agente_accion="Pipeline",
        accion_realizada="Pipeline Completado",
        descripcion=f"Sesión {sesion_id[:8]} finalizada | {duracion_total_ms}ms | expediente: {expediente_id}",
        tiempo_segundos=duracion_total_ms // 1000,
        metadata={
            "expediente_id": expediente_id,
            "categoria": categoria,
            "num_contradicciones": num_contradicciones,
        },
    )

    logger.info(
        f"🏁 Pipeline completado | sesión {sesion_id[:8]}... | "
        f"categoría: {categoria} | total: {duracion_total_ms}ms"
    )

    return resultado_final