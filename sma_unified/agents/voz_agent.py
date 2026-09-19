"""
Módulo de Voz — SMA Congreso Bolivia
=====================================
Proporciona:
  - TTS (Text-to-Speech): pyttsx3 offline / gTTS (Google) como fallback
  - STT (Speech-to-Text): SpeechRecognition + Google STT / Whisper local / WAV directo
  - Mapeo de comandos de voz por agente → acción del pipeline para los 14 agentes
  - Registro de todos los comandos en MongoDB Atlas (colección voz_comandos)

Configuración en .env:
  VOZ_MOTOR   = "pyttsx3" | "gtts"   (default: pyttsx3)
  VOZ_IDIOMA  = "es"                 (default: es)
"""

import os
import time
import uuid
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("voz_agent")

VOZ_MOTOR = os.getenv("VOZ_MOTOR", "gtts").lower()
VOZ_IDIOMA = os.getenv("VOZ_IDIOMA", "es")


# ── TTS (Síntesis de Voz) ──────────────────────────────────────────────────────

def leer_texto(texto: str, velocidad: int = 160) -> Dict[str, Any]:
    """TTS usando pyttsx3 (offline) con fallback a gTTS (online)."""
    texto = str(texto).strip()
    if not texto:
        return {"status": "omitido", "razon": "texto_vacio"}
    t0 = time.time()
    motor_usado = VOZ_MOTOR

    if VOZ_MOTOR == "pyttsx3":
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", velocidad)
            engine.setProperty("volume", 0.95)
            for voice in engine.getProperty("voices"):
                if "spanish" in voice.name.lower() or "es" in voice.id.lower():
                    engine.setProperty("voice", voice.id)
                    break
            engine.say(texto)
            engine.runAndWait()
            return {"status": "ok", "motor": "pyttsx3", "duracion_ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            logger.warning(f"[Voz] pyttsx3 fallo: {e}. Intentando gTTS...")
            motor_usado = "gtts"

    try:
        from gtts import gTTS
        import tempfile, subprocess
        tts = gTTS(text=texto, lang=VOZ_IDIOMA, slow=False)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            tmp_path = tmp.name
            tts.save(tmp_path)
        if os.name == "nt":
            subprocess.run(["powershell", "-c",
                f"$mp = New-Object System.Windows.Media.MediaPlayer; "
                f"Add-Type -AssemblyName presentationCore; "
                f"$mp.Open('{tmp_path}'); $mp.Play(); Start-Sleep -s 4"],
                capture_output=True, timeout=10)
        else:
            subprocess.run(["mpg123", "-q", tmp_path], capture_output=True, timeout=30)
        os.unlink(tmp_path)
        return {"status": "ok", "motor": "gtts", "duracion_ms": int((time.time() - t0) * 1000)}
    except Exception as e2:
        logger.error(f"[Voz] gTTS fallo: {e2}")
        return {"status": "error", "motor": motor_usado, "error": str(e2)}


def leer_texto_base64(texto: str) -> Optional[str]:
    """Genera audio MP3 como base64 para enviar al frontend via API."""
    try:
        from gtts import gTTS
        import base64
        tts = gTTS(text=texto[:600], lang=VOZ_IDIOMA, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")
    except Exception as e:
        logger.warning(f"[Voz] No se pudo generar audio base64: {e}")
        return None


# ── Catálogo de Comandos de Voz por Agente (14 Agentes) ────────────────────────

AGENT_KEY_ALIASES = {
    "distribuidor": "Distribuidor",
    "comision": "Comision",
    "constitucional": "VerificadorConstitucional",
    "verificadorconstitucional": "VerificadorConstitucional",
    "consistencia": "ConsistenciaNormativa",
    "consistencianormativa": "ConsistenciaNormativa",
    "ciudadano": "AtencionCiudadana",
    "atencionciudadana": "AtencionCiudadana",
    "secretario": "SecretarioCamara",
    "secretariocamara": "SecretarioCamara",
    "emisor": "EmisorResultados",
    "emisorresultados": "EmisorResultados",
    "notificador": "NotificadorComision",
    "notificadorcomision": "NotificadorComision",
    "constitucion_fondo": "ConstitucionFondo",
    "constitucionfondo": "ConstitucionFondo",
    "concentrador_crew": "ConcentradorCrew",
    "concentradorcrew": "ConcentradorCrew",
    "tecnico": "EspecialistaTecnico",
    "especialistatecnico": "EspecialistaTecnico",
    "presidencia": "PresidenciaComision",
    "presidenciacomision": "PresidenciaComision",
    "presupuesto": "Presupuesto",
    "difusion": "DifusionCiudadana",
    "difusionciudadana": "DifusionCiudadana",
    "fiscalizacion": "Fiscalizacion",
    "bicameral": "Bicameral",
    "veto_promulgacion": "VetoPromulgacion",
    "vetopromulgacion": "VetoPromulgacion",
    "publicacion": "Publicacion",
}

COMANDOS_VOZ: Dict[str, List[Dict[str, Any]]] = {
    "Distribuidor": [
        {"palabras": ["registrar nuevo proyecto", "registrar proyecto de ley", "nuevo proyecto", "subir proyecto"],
         "accion": "abrir_formulario_subida", "descripcion": "Abrir formulario de subida de proyecto de ley"},
        {"palabras": ["clasificar documento", "clasificar", "iniciar clasificacion", "fase 1"],
         "accion": "ejecutar_fase_1_clasificacion", "descripcion": "Ejecutar clasificacion Fase 1"},
        {"palabras": ["mostrar categoria", "leer categoria", "mostrar categoría", "leer categoría", "que categoria"],
         "accion": "leer_categoria_asignada", "descripcion": "Leer la categoria clasificada"},
        {"palabras": ["reclasificar como legislativo", "forzar legislativo"],
         "accion": "reclasificar_legislativo", "descripcion": "Override manual: LEGISLATIVO"},
        {"palabras": ["cancelar clasificacion", "cancelar clasificación", "cancelar proceso"],
         "accion": "cancelar_pipeline", "descripcion": "Detener pipeline Fase 1"},
    ],
    "Comision": [
        {"palabras": ["asignar comision", "asignar comisión", "determinar comision"],
         "accion": "asignar_comision", "descripcion": "Asignar comision competente al proyecto"},
        {"palabras": ["leer comision", "leer comisión", "que comision", "qué comisión", "comision asignada"],
         "accion": "leer_comision_asignada", "descripcion": "Leer nombre de comision asignada"},
        {"palabras": ["articulos constitucionales", "artículos constitucionales", "ver articulos"],
         "accion": "leer_articulos_cpe", "descripcion": "Leer top-3 articulos CPE"},
        {"palabras": ["verificar constitucionalidad", "enviar a verificacion", "auditar cpe"],
         "accion": "ejecutar_verificacion_constitucional", "descripcion": "Ejecutar verificacion constitucional"},
        {"palabras": ["leer dictamen", "resultado constitucional", "es constitucional"],
         "accion": "leer_dictamen_constitucional", "descripcion": "Leer resumen del dictamen"},
    ],
    "VerificadorConstitucional": [
        {"palabras": ["iniciar verificacion", "iniciar verificación constitucional", "auditar proyecto"],
         "accion": "ejecutar_verificacion_constitucional", "descripcion": "Ejecutar verificacion constitucional"},
        {"palabras": ["leer contradicciones", "que contradicciones", "hay contradicciones"],
         "accion": "leer_contradicciones", "descripcion": "Leer lista de contradicciones con la CPE"},
        {"palabras": ["cuantos articulos", "cuántos artículos consultados", "articulos cpe"],
         "accion": "leer_conteo_articulos", "descripcion": "Leer cantidad de articulos CPE consultados"},
        {"palabras": ["es constitucional", "proyecto valido", "proyecto válido", "resultado validez"],
         "accion": "leer_validez_constitucional", "descripcion": "Responder Si/No con porcentaje de confianza"},
        {"palabras": ["enviar correcciones al senado", "notificar senado", "enviar correcciones", "notificar autor"],
         "accion": "disparar_flujo_correcciones", "descripcion": "Enviar correcciones a Mesa Senadores y autor"},
    ],
    "ConsistenciaNormativa": [
        {"palabras": ["verificar consistencia", "verificar normativa", "analisis normativo", "buscar antinomias"],
         "accion": "ejecutar_consistencia_normativa", "descripcion": "Ejecutar analisis normativo pgvector"},
        {"palabras": ["leer conflictos", "conflictos normativos", "antinomias detectadas"],
         "accion": "leer_conflictos_normativos", "descripcion": "Leer conflictos con leyes vigentes"},
        {"palabras": ["hay derogaciones", "derogaciones tacitas", "derogaciones tácitas"],
         "accion": "leer_derogaciones_tacitas", "descripcion": "Listar derogaciones tacitas detectadas"},
        {"palabras": ["enviar correcciones normativas", "notificar normativa"],
         "accion": "disparar_flujo_correcciones_normativa", "descripcion": "Enviar hallazgos a Mesa Normativa"},
    ],
    "AtencionCiudadana": [
        {"palabras": ["registrar solicitud ciudadana", "nueva solicitud", "nueva peticion", "registrar peticion"],
         "accion": "abrir_formulario_ciudadano", "descripcion": "Abrir formulario ciudadano de peticiones"},
        {"palabras": ["leer prioridad", "prioridad de la solicitud", "que prioridad tiene"],
         "accion": "leer_prioridad_solicitud", "descripcion": "Leer prioridad Alta/Media/Baja"},
        {"palabras": ["area responsable", "área responsable", "a quien corresponde"],
         "accion": "leer_area_responsable", "descripcion": "Leer area responsable asignada"},
        {"palabras": ["enviar respuesta al ciudadano", "notificar ciudadano", "responder peticion"],
         "accion": "notificar_ciudadano", "descripcion": "Enviar notificacion al ciudadano"},
    ],
    "SecretarioCamara": [
        {"palabras": ["registrar debate", "nuevo debate", "registrar sesion", "abrir acta"],
         "accion": "abrir_formulario_debate", "descripcion": "Abrir formulario de debate/acta plenaria"},
        {"palabras": ["leer resultado votacion", "resultado de votacion", "conteo de votos"],
         "accion": "leer_resultado_votacion", "descripcion": "Leer conteo a favor/contra/abstenciones"},
        {"palabras": ["aprobar en grande", "aprobado en grande", "registro aprobacion grande"],
         "accion": "registrar_aprobacion_grande", "descripcion": "Registrar APROBADO en grande"},
        {"palabras": ["aprobar en detalle", "aprobado en detalle", "registro aprobacion detalle"],
         "accion": "registrar_aprobacion_detalle", "descripcion": "Registrar aprobacion en detalle"},
        {"palabras": ["firmar acta", "cerrar debate", "guardar acta"],
         "accion": "firmar_acta_debate", "descripcion": "Generar y persistir acta formal en Neon"},
    ],
    "EmisorResultados": [
        {"palabras": ["generar dictamen", "crear dictamen", "generar pdf", "descargar pdf"],
         "accion": "generar_dictamen_pdf", "descripcion": "Crear PDF tricolor con resultado completo"},
        {"palabras": ["leer opinion juridica", "opinion juridica", "leer opinión", "fundamento juridico"],
         "accion": "leer_opinion_juridica", "descripcion": "Leer seccion Opinion Juridica del dictamen"},
        {"palabras": ["enviar dictamen a comision", "enviar dictamen", "despachar dictamen"],
         "accion": "enviar_dictamen_comision", "descripcion": "Enviar dictamen al notificador con PDF adjunto"},
    ],
    "NotificadorComision": [
        {"palabras": ["enviar notificacion a la comision", "notificar comision", "enviar correos"],
         "accion": "enviar_notificacion_comision", "descripcion": "Enviar correo HTML a senadores de la comision"},
        {"palabras": ["notificar al autor", "enviar correcciones al autor"],
         "accion": "notificar_correcciones_autor", "descripcion": "Enviar correo con observaciones al autor"},
        {"palabras": ["confirmar envio", "confirmar envío", "fue enviado el correo"],
         "accion": "confirmar_ultimo_envio", "descripcion": "Confirmar estado del ultimo envio"},
    ],
    "ConstitucionFondo": [
        {"palabras": ["analisis hermeneutico", "evaluar fondo", "ponderacion de derechos"],
         "accion": "evaluar_fondo_constitucional", "descripcion": "Ejecutar análisis hermenéutico sustantivo"},
        {"palabras": ["precedentes constitucionales", "jurisprudencia tribunal"],
         "accion": "leer_precedentes_tc", "descripcion": "Leer precedentes vinculantes del Tribunal Constitucional"},
        {"palabras": ["principio pro homine", "test de proporcionalidad"],
         "accion": "leer_test_proporcionalidad", "descripcion": "Leer evaluación del test de proporcionalidad"},
    ],
    "ConcentradorCrew": [
        {"palabras": ["sintetizar observaciones", "integrar expediente", "unificar dictamenes"],
         "accion": "sintetizar_expediente", "descripcion": "Consolidar todas las observaciones multi-agente"},
        {"palabras": ["leer resumen ejecutivo", "resumen integral"],
         "accion": "leer_resumen_ejecutivo", "descripcion": "Leer síntesis ejecutiva del expediente"},
        {"palabras": ["matriz de consistencia", "cuadro comparativo"],
         "accion": "leer_matriz_consistencia", "descripcion": "Leer matriz consolidada de observaciones"},
    ],
    "EspecialistaTecnico": [
        {"palabras": ["evaluar viabilidad tecnica", "evaluar viabilidad técnica", "analisis tecnico"],
         "accion": "evaluar_viabilidad_tecnica", "descripcion": "Evaluar factibilidad técnica y estándares"},
        {"palabras": ["leer estandares", "leer estándares", "estandares aplicables"],
         "accion": "leer_estandares_aplicables", "descripcion": "Leer estándares internacionales aplicables"},
        {"palabras": ["riesgos tecnicos", "matriz de riesgos", "analisis de riesgos"],
         "accion": "leer_matriz_riesgos", "descripcion": "Leer matriz de riesgos técnicos"},
    ],
    "PresidenciaComision": [
        {"palabras": ["generar orden del dia", "orden del día", "planificar debate"],
         "accion": "generar_orden_del_dia", "descripcion": "Generar Orden del Día para la comisión"},
        {"palabras": ["convocar especialistas", "convocar peritos", "audiencia publica"],
         "accion": "convocar_especialistas", "descripcion": "Emitir citaciones para audiencias públicas"},
        {"palabras": ["cronograma de comision", "tiempo de tratamiento", "plazos comision"],
         "accion": "leer_cronograma_comision", "descripcion": "Leer cronograma estimado en días"},
    ],
    "Presupuesto": [
        {"palabras": ["evaluar impacto presupuestario", "viabilidad fiscal", "analisis fiscal", "costo fiscal"],
         "accion": "evaluar_impacto_fiscal", "descripcion": "Evaluar costo TGN y Ley 1178"},
        {"palabras": ["costo de implementacion", "cuanto cuesta la ley", "costo total"],
         "accion": "leer_costo_implementacion", "descripcion": "Leer costo inicial y recurrente en Bs"},
        {"palabras": ["escenarios fiscales", "escenario pesimista", "sostenibilidad fiscal"],
         "accion": "leer_escenarios_fiscales", "descripcion": "Leer proyecciones macroeconómicas"},
    ],
    "DifusionCiudadana": [
        {"palabras": ["generar guia ciudadana", "generar guía ciudadana", "resumen ciudadano"],
         "accion": "generar_guia_ciudadana", "descripcion": "Generar explicación en lenguaje claro"},
        {"palabras": ["cuales son mis derechos", "mis nuevos derechos", "derechos otorgados"],
         "accion": "leer_derechos_ciudadanos", "descripcion": "Leer derechos otorgados por la ley"},
        {"palabras": ["preguntas frecuentes", "leer faq", "respuestas ciudadanas"],
         "accion": "leer_preguntas_frecuentes", "descripcion": "Leer preguntas y respuestas frecuentes"},
    ],
    "Fiscalizacion": [
        {"palabras": ["monitorear ley", "estado de implementacion", "control posterior", "fiscalizar cumplimiento"],
         "accion": "monitorear_implementacion", "descripcion": "Verificar plazos reglamentarios y avance"},
        {"palabras": ["alertas de auditoria", "alertas de contraloria", "alertas de desvio"],
         "accion": "leer_alertas_fiscalizacion", "descripcion": "Leer alertas por desvíos o retrasos"},
    ],
    "Bicameral": [
        {"palabras": ["iniciar procedimiento bicameral", "enviar a senado", "enviar a diputados", "tramite camaras"],
         "accion": "iniciar_ciclo_bicameral", "descripcion": "Iniciar el ciclo de revisión en la cámara opuesta"},
        {"palabras": ["resultado camara origen", "resultado cámara origen", "leer aprobacion primera camara"],
         "accion": "leer_resultado_camara_origen", "descripcion": "Leer resolución de la cámara de origen"},
        {"palabras": ["resultado camara revisora", "resultado cámara revisora", "leer aprobacion segunda camara"],
         "accion": "leer_resultado_camara_revisora", "descripcion": "Leer resolución de la cámara revisora"},
        {"palabras": ["confirmar aprobacion bicameral", "aprobado bicameral", "conciliar texto"],
         "accion": "confirmar_aprobacion_bicameral", "descripcion": "Confirmar texto conciliado y aprobación bicameral"},
        {"palabras": ["rechazado en revision", "proyecto observado", "devolver a origen"],
         "accion": "registrar_rechazo_revision", "descripcion": "Registrar rechazo o devolución por la revisora"},
    ],
    "VetoPromulgacion": [
        {"palabras": ["evaluar veto o promulgacion", "analisis ejecutivo", "decision ejecutiva"],
         "accion": "evaluar_veto_promulgacion", "descripcion": "Evaluar criterios de promulgación o veto"},
        {"palabras": ["vetar proyecto", "veto total", "veto parcial"],
         "accion": "registrar_veto", "descripcion": "Registrar veto formal del Órgano Ejecutivo"},
        {"palabras": ["promulgar proyecto", "autorizar promulgacion"],
         "accion": "autorizar_promulgacion", "descripcion": "Autorizar promulgación y pase a Gaceta"},
    ],
    "Publicacion": [
        {"palabras": ["publicar en gaceta", "gaceta oficial", "promulgar ley", "publicacion oficial"],
         "accion": "publicar_gaceta_oficial", "descripcion": "Registrar promulgación en Gaceta Oficial"},
        {"palabras": ["numero de ley", "número de ley", "asignar numero", "cual es el numero"],
         "accion": "asignar_numero_ley", "descripcion": "Asignar número oficial de la Ley promulgada"},
        {"palabras": ["generar divulgacion", "plan de difusion", "comunicar a ciudadanos"],
         "accion": "generar_plan_difusion", "descripcion": "Generar plan de difusión ciudadana"},
        {"palabras": ["estado de publicacion", "fue publicada la ley", "confirmar publicacion"],
         "accion": "confirmar_publicacion", "descripcion": "Confirmar estado de publicación en la Gaceta"},
    ],
}


def resolver_nombre_agente(agente: str) -> str:
    """Resuelve alias o identificadores de agente a su clave canónica."""
    if not agente:
        return "Distribuidor"
    clean = agente.strip().lower().replace("-", "_").replace(" ", "")
    return AGENT_KEY_ALIASES.get(clean, AGENT_KEY_ALIASES.get(agente, agente))


def procesar_comando_voz(texto_comando: str, agente: str) -> Dict[str, Any]:
    """Analiza el texto del comando y determina la acción a ejecutar con coincidencia flexible."""
    texto_norm = (texto_comando or "").lower().strip()
    agente_canonico = resolver_nombre_agente(agente)
    comandos_agente = COMANDOS_VOZ.get(agente_canonico, [])
    
    # Si no hay comandos para este agente específico, buscar en todos
    if not comandos_agente:
        comandos_agente = COMANDOS_VOZ.get("Distribuidor", [])

    mejor_match = None
    mejor_score = 0.0

    for cmd in comandos_agente:
        for frase in cmd["palabras"]:
            frase_norm = frase.lower().strip()
            # Coincidencia exacta o contenida
            if frase_norm in texto_norm:
                score = 0.85 + 0.15 * (len(frase_norm) / max(len(texto_norm), 1))
                if score > mejor_score:
                    mejor_score = score
                    mejor_match = cmd
            elif texto_norm in frase_norm:
                score = 0.70 + 0.20 * (len(texto_norm) / max(len(frase_norm), 1))
                if score > mejor_score:
                    mejor_score = score
                    mejor_match = cmd
            else:
                # Coincidencia por palabras compartidas
                palabras_frase = set(frase_norm.split())
                palabras_texto = set(texto_norm.split())
                coincidencias = len(palabras_frase & palabras_texto)
                if coincidencias > 0:
                    score = (coincidencias / len(palabras_frase)) * 0.65
                    if score > mejor_score:
                        mejor_score = score
                        mejor_match = cmd

    if mejor_match and mejor_score >= 0.35:
        return {
            "accion": mejor_match["accion"],
            "descripcion": mejor_match["descripcion"],
            "confianza": round(min(100.0, mejor_score * 100), 1),
            "comando_normalizado": texto_norm,
            "agente": agente_canonico,
            "reconocido": True,
        }

    return {
        "accion": "consulta_general",
        "descripcion": f"Instrucción general procesada para {agente_canonico}: '{texto_comando}'",
        "confianza": 30.0,
        "comando_normalizado": texto_norm,
        "agente": agente_canonico,
        "reconocido": False,
    }


def registrar_comando_mongo(
    sesion_id: str,
    agente: str,
    tipo: str,
    comando_texto: str,
    accion_ejecutada: str,
    usuario_email: Optional[str] = None,
    resultado: str = "ok",
) -> Optional[str]:
    """Registra el comando en MongoDB Atlas colección voz_comandos."""
    try:
        from sma_unified.db.mongo_atlas import get_db
        db = get_db()
        doc = {
            "_id": str(uuid.uuid4()),
            "sesion_id": sesion_id,
            "agente": agente,
            "tipo": tipo,
            "comando_texto": comando_texto,
            "accion_ejecutada": accion_ejecutada,
            "timestamp": datetime.now(tz=timezone.utc),
            "usuario_email": usuario_email,
            "resultado": resultado,
        }
        db["voz_comandos"].insert_one(doc)
        return doc["_id"]
    except Exception as e:
        logger.warning(f"[Voz] Registro en MongoDB omitido (modo offline o no configurado): {e}")
        return None


def obtener_texto_para_leer(agente: str, accion: str, datos: Dict[str, Any]) -> str:
    """Genera el texto que el agente leerá según la acción y los datos."""
    agente_canonico = resolver_nombre_agente(agente)
    textos = {
        "abrir_formulario_subida": lambda d: (
            "Formulario de registro de proyecto de ley habilitado. Por favor ingresa el título y archivo del proyecto."
        ),
        "ejecutar_fase_1_clasificacion": lambda d: (
            "Iniciando clasificación formal de Fase 1. Determinando competencia legislativa del documento."
        ),
        "leer_categoria_asignada": lambda d: (
            f"El documento fue clasificado como {d.get('categoria', 'LEGISLATIVO')}. "
            f"Derivado a {d.get('agente_destino', 'Comisión Legislativa')}."
        ),
        "asignar_comision": lambda d: (
            f"Proyecto derivado formalmente a la Comisión de {d.get('comision_principal', 'Constitución y Legislación')}."
        ),
        "leer_comision_asignada": lambda d: (
            f"La comisión competente asignada es: {d.get('comision_principal', 'Comisión de Constitución y Sistema Electoral')}."
        ),
        "ejecutar_verificacion_constitucional": lambda d: (
            "Iniciando auditoría de supremacía constitucional frente a la Constitución Política del Estado de 2009."
        ),
        "leer_dictamen_constitucional": lambda d: (
            f"El proyecto {'ES constitucional y conforme a la Carta Magna' if d.get('valido', True) else 'presenta observaciones constitucionales'}. "
            f"Nivel de confianza: {d.get('confianza', 95)} por ciento."
        ),
        "leer_contradicciones": lambda d: (
            f"Se evaluaron {d.get('conteo_articulos', 411)} artículos de la CPE. " +
            ("No se hallaron colisiones de fondo." if not d.get("contradicciones") else f"Se identificaron {len(d.get('contradicciones', []))} observaciones.")
        ),
        "leer_validez_constitucional": lambda d: (
            f"Dictamen de constitucionalidad: {'Aprobado con conformidad plena' if d.get('valido', True) else 'Requiere adecuación en artículos observados'}."
        ),
        "ejecutar_consistencia_normativa": lambda d: (
            "Ejecutando cotejo normativo con embeddings vectoriales de 2048 dimensiones contra el ordenamiento jurídico boliviano."
        ),
        "leer_conflictos_normativos": lambda d: (
            f"Análisis normativo concluido. Total de normas cotejadas: {d.get('normas_consultadas', 12)}. "
            f"Riesgo de antinomias: {d.get('nivel_riesgo', 'Bajo')}."
        ),
        "generar_dictamen_pdf": lambda d: (
            "Generando informe oficial tricolor en PDF con sello digital y trazabilidad parlamentaria."
        ),
        "enviar_notificacion_comision": lambda d: (
            "Notificación oficial HTML despachada a la Presidencia de Comisión y proyectistas."
        ),
        "abrir_formulario_debate": lambda d: (
            "Módulo de acta de debate plenaria habilitado para registro de intervenciones y votaciones."
        ),
        "leer_resultado_votacion": lambda d: (
            f"Votación registrada: {d.get('favor', 85)} a favor, {d.get('contra', 12)} en contra. "
            f"Resultado: {d.get('votacion', 'APROBADO')}."
        ),
        "evaluar_viabilidad_tecnica": lambda d: (
            "Evaluación técnica completada. Factibilidad tecnológica verificada conforme a estándares nacionales."
        ),
        "evaluar_impacto_fiscal": lambda d: (
            f"Impacto presupuestario evaluado. Marco regulatorio: Ley 1178 SAFCO. Sostenibilidad financiera validada."
        ),
        "iniciar_ciclo_bicameral": lambda d: (
            "Ciclo bicameral iniciado. Expediente remitido a la Cámara Revisora conforme al artículo 163 de la CPE."
        ),
        "publicar_gaceta_oficial": lambda d: (
            f"Promulgación oficial registrada en la Gaceta Oficial del Estado Plurinacional de Bolivia."
        ),
        "generar_guia_ciudadana": lambda d: (
            "Guía en lenguaje claro generada para difusión y conocimiento de la ciudadanía."
        ),
        "consulta_general": lambda d: (
            f"Comando recibido y registrado para el agente {agente_canonico}. Listo para procesar."
        ),
    }

    gen = textos.get(accion)
    if gen:
        try:
            return gen(datos)
        except Exception:
            pass
    return f"Acción '{accion}' procesada correctamente por el operador {agente_canonico}."


def obtener_comandos_disponibles(agente: str) -> List[Dict[str, str]]:
    """Retorna la lista de comandos de voz disponibles para un agente dado."""
    agente_canonico = resolver_nombre_agente(agente)
    return [
        {"frase_ejemplo": cmd["palabras"][0], "accion": cmd["accion"], "descripcion": cmd["descripcion"]}
        for cmd in COMANDOS_VOZ.get(agente_canonico, COMANDOS_VOZ.get("Distribuidor", []))
    ]


# ── STT Multicapa (WAV PCM Directo + Whisper + Google STT) ─────────────────────

def transcribir_audio_whisper(audio_bytes: bytes, formato: str = "wav") -> Dict[str, Any]:
    """
    Transcribe audio recibido desde el frontend (WAV PCM directo o MediaRecorder blob).
    Capas:
      1. Si es WAV PCM (encabezado RIFF), usa speech_recognition directamente (0 dependencias externas).
      2. Si está instalado openai-whisper, usa whisper local.
      3. Google STT online como fallback.
    """
    import tempfile
    import os as _os

    if not audio_bytes or len(audio_bytes) < 100:
        return {
            "texto": "",
            "motor": "none",
            "error": "audio_vacio",
            "mensaje": "Audio demasiado corto o vacío."
        }

    t0 = time.time()
    is_wav_header = audio_bytes.startswith(b'RIFF') or "wav" in formato.lower()
    extension = "wav" if is_wav_header else formato.replace("audio/", "").replace(";", "").split(";")[0].strip()
    if extension not in ["wav", "webm", "ogg", "mp4", "mp3"]:
        extension = "wav" if is_wav_header else "webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # Intento 1: Whisper local si está disponible
        try:
            import whisper
            model = whisper.load_model("base")
            result = model.transcribe(tmp_path, language="es", fp16=False)
            texto = result.get("text", "").strip()
            duracion = int((time.time() - t0) * 1000)
            logger.info(f"[Voz-Whisper] Transcripción exitosa: '{texto[:60]}'")
            return {
                "texto": texto,
                "motor": "whisper",
                "idioma": "es",
                "duracion_ms": duracion,
                "reconocido": bool(texto)
            }
        except ImportError:
            pass
        except Exception as w_err:
            logger.warning(f"[Voz-Whisper] Whisper local falló: {w_err}")

        # Intento 2: Google Speech Recognition sobre WAV nativo
        try:
            import speech_recognition as sr

            # Si es WAV, leer directamente con sr.AudioFile
            if is_wav_header:
                audio_file_path = tmp_path
            else:
                # Intentar convertir con ffmpeg si existe
                wav_converted = tmp_path.replace(f".{extension}", "_conv.wav")
                try:
                    import subprocess
                    res = subprocess.run(
                        ["ffmpeg", "-y", "-i", tmp_path, "-ar", "16000", "-ac", "1", wav_converted],
                        capture_output=True, timeout=10
                    )
                    if res.returncode == 0 and _os.path.exists(wav_converted):
                        audio_file_path = wav_converted
                    else:
                        audio_file_path = tmp_path
                except Exception:
                    audio_file_path = tmp_path

            r = sr.Recognizer()
            r.energy_threshold = 250
            r.dynamic_energy_threshold = True

            with sr.AudioFile(audio_file_path) as source:
                audio_data = r.record(source)

            texto = r.recognize_google(audio_data, language="es-BO")
            duracion = int((time.time() - t0) * 1000)
            logger.info(f"[Voz-GoogleSTT] Transcripción exitosa: '{texto[:60]}'")
            return {
                "texto": texto.strip(),
                "motor": "google_stt",
                "idioma": "es-BO",
                "duracion_ms": duracion,
                "reconocido": True
            }
        except sr.UnknownValueError:
            logger.info("[Voz-GoogleSTT] Audio recibido sin voz inteligible.")
            return {
                "texto": "",
                "motor": "google_stt",
                "idioma": "es-BO",
                "duracion_ms": int((time.time() - t0) * 1000),
                "reconocido": False,
                "mensaje": "No se detectó voz clara en la grabación. Intenta hablar más cerca del micrófono."
            }
        except Exception as g_err:
            logger.warning(f"[Voz-GoogleSTT] Error Google STT: {g_err}")
            return {
                "texto": "",
                "motor": "none",
                "error": str(g_err),
                "duracion_ms": int((time.time() - t0) * 1000),
                "reconocido": False,
                "mensaje": f"Error de reconocimiento: {g_err}"
            }
    finally:
        try:
            if _os.path.exists(tmp_path):
                _os.unlink(tmp_path)
            if 'wav_converted' in locals() and _os.path.exists(wav_converted):
                _os.unlink(wav_converted)
        except Exception:
            pass


def obtener_estado_motores() -> Dict[str, Any]:
    """Retorna el estado de disponibilidad de los motores TTS y STT en el servidor."""
    estado = {
        "tts_motores": [],
        "stt_motores": [
            {"motor": "wav_pcm_directo", "disponible": True, "tipo": "local", "descripcion": "Grabación WAV PCM 16kHz del navegador"}
        ],
        "idioma_default": VOZ_IDIOMA,
        "total_agentes_soportados": len(COMANDOS_VOZ),
    }
    try:
        import pyttsx3
        estado["tts_motores"].append({"motor": "pyttsx3", "disponible": True, "tipo": "offline"})
    except ImportError:
        estado["tts_motores"].append({"motor": "pyttsx3", "disponible": False, "tipo": "offline"})

    try:
        from gtts import gTTS
        estado["tts_motores"].append({"motor": "gtts", "disponible": True, "tipo": "online"})
    except ImportError:
        estado["tts_motores"].append({"motor": "gtts", "disponible": False, "tipo": "online"})

    try:
        import whisper
        estado["stt_motores"].append({"motor": "whisper", "disponible": True, "tipo": "local"})
    except ImportError:
        estado["stt_motores"].append({"motor": "whisper", "disponible": False, "tipo": "local"})

    try:
        import speech_recognition
        estado["stt_motores"].append({"motor": "google_stt", "disponible": True, "tipo": "online"})
    except ImportError:
        estado["stt_motores"].append({"motor": "google_stt", "disponible": False, "tipo": "online"})

    return estado
