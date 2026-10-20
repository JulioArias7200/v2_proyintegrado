import { API_BASE_URL } from '../services/api';
/**
 * AgentVoiceModule.jsx - Módulo de Voz Contextual por Agente
 * ============================================================
 * Componente interactivo de voz que adapta su comportamiento e interfaz
 * según el agente específico de la Mesa de Partes Legislativa.
 * Soporta conversación bidireccional (micrófono STT ↔ audio TTS).
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic, Square, Volume2, VolumeX, Loader, CheckCircle2,
  AlertCircle, Radio, Mail, FileAudio, Newspaper, Zap,
  X, Info, Bell, Gavel, Send, Plus, Check
} from "lucide-react";

const AGENT_VOICE_CONFIG = {
  distribuidor: {
    icon: "📥",
    title: "Dictado de Documento",
    subtitle: "Habla para ingresar o complementar el texto del proyecto de ley",
    features: ["dictado", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Clasificación",
    successMsg: "Texto dictado e incorporado al documento correctamente.",
  },
  comision: {
    icon: "🏛️",
    title: "Asistente de Comisión",
    subtitle: "Escucha la comisión asignada o interactúa por voz con el agente",
    features: ["leer_resultado", "dictar_nota", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Comisión Asignada",
    successMsg: "Interacción con la comisión registrada.",
  },
  constitucional: {
    icon: "⚖️",
    title: "Revisión Constitucional por Voz",
    subtitle: "Escucha las observaciones constitucionales o dicta notas adicionales",
    features: ["leer_resultado", "dictar_nota", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Observaciones Constitucionales",
    successMsg: "Observación constitucional registrada.",
  },
  consistencia: {
    icon: "🔍",
    title: "Consistencia Normativa",
    subtitle: "Escucha los hallazgos normativos y leyes en conflicto",
    features: ["leer_resultado", "dictar_nota", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Hallazgos Normativos",
    successMsg: "Hallazgos revisados con el agente.",
  },
  emisor: {
    icon: "📄",
    title: "Emisión de Observaciones PDF",
    subtitle: "Escucha el dictamen y dicta observaciones para enviar notificación con audio",
    features: ["leer_resultado", "dictar_nota", "envio_notificacion", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Reporte de Observaciones PDF",
    successMsg: "Observación y notificación enviadas correctamente.",
  },
  bicameral: {
    icon: "🤝",
    title: "Comunicación Bicameral por Correo y Audio",
    subtitle: "Graba tu mensaje de voz para enviarlo por correo con audio adjunto",
    features: ["grabar_audio", "envio_audio_correo", "leer_resultado", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Dictamen Bicameral",
    successMsg: "Mensaje de voz y correo enviados a la Cámara Revisora.",
  },
  veto_promulgacion: {
    icon: "📜",
    title: "Promulgación por Voz",
    subtitle: "Escucha la evaluación y dicta modificaciones para promulgar o vetar",
    features: ["leer_resultado", "dictar_nota", "modificar_promulgacion", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Evaluación de Promulgación",
    successMsg: "Datos de promulgación actualizados por voz.",
  },
  publicacion: {
    icon: "📰",
    title: "Gaceta Oficial — Lectura de Ley",
    subtitle: "Lee en voz alta la ley final oficial promulgada",
    features: ["leer_resultado", "envio_comando"],
    autoRead: false,
    ttsLabel: "📰 Leer Ley Final Completa",
    successMsg: "Ley oficial leída y verificada.",
  },
  secretario: {
    icon: "✍️",
    title: "Secretaría — Registro de Correcciones y Votos",
    subtitle: "Dicta correcciones al proyecto de ley para enviar con las votaciones al Bicameral",
    features: ["dictar_nota", "subir_correccion", "envio_audio_correo", "leer_resultado", "envio_comando"],
    autoRead: false,
    ttsLabel: "Leer Acta y Votaciones",
    successMsg: "Corrección registrada y enviada al proceso legislativo.",
  },
};

export function buildTTSText(agentId, resultData) {
  if (!resultData) return null;
  try {
    switch (agentId) {
      case "distribuidor": {
        const cat = resultData.categoria || "LEGISLATIVO";
        const com = resultData.comision_sugerida || resultData.agente_destino_nombre || "Comisión competente";
        const res = resultData.resumen_ejecutivo || "";
        const tit = resultData.titulo || "";
        const titTxt = tit ? `para el proyecto ${tit}.` : "";
        return `Agente Distribuidor: Clasificación formal completada ${titTxt} Categoría asignada: ${cat}. Derivación técnica: ${com}. ${res}`;
      }
      case "comision": {
        const principal = resultData.comision_principal || resultData.comision_asignada || "Comisión Legislativa";
        const sec = resultData.comision_secundaria ? `Comisión secundaria recomendada: ${resultData.comision_secundaria}.` : "";
        const just = resultData.resumen || resultData.justificacion_asignacion || "";
        return `Comisión Legislativa Competente: Asignado formalmente a ${principal}. ${sec} ${just}`;
      }
      case "constitucional": {
        const valido = resultData.valido;
        const numObs = resultData.num_contradicciones || resultData.contradicciones?.length || 0;
        const normas = resultData.articulos_consultados?.length || resultData.articulos_a_favor?.length || 0;
        let obsDetalle = "";
        if (Array.isArray(resultData.contradicciones) && resultData.contradicciones.length > 0) {
          obsDetalle = "Observaciones identificadas: " + resultData.contradicciones.slice(0, 3).map(c => 
            `Artículo ${c.articulo_cpe || 'observado'}: ${c.descripcion || c.motivo || ''}`
          ).join(". ");
        }
        return `Dictamen Constitucional: El proyecto es ${valido ? "conforme a la Constitución Política del Estado" : "observado por posibles contradicciones constitucionales"}. Se cotejaron ${normas} normas y se registraron ${numObs} observaciones. ${obsDetalle}`;
      }
      case "consistencia": {
        const tot = resultData.total_hallazgos || resultData.hallazgos?.length || resultData.analisis?.length || 0;
        const riesgo = resultData.nivel_riesgo_global || "MEDIO";
        let hallazgosTxt = "";
        if (Array.isArray(resultData.analisis) && resultData.analisis.length > 0) {
          hallazgosTxt = "Hallazgos principales: " + resultData.analisis.slice(0, 2).map(h => 
            `${h.tipo || 'hallazgo'}: ${h.descripcion || h.texto || ''}`
          ).join(". ");
        }
        return `Auditoría de Consistencia Normativa. Nivel de riesgo detectado: ${riesgo}. Total de hallazgos identificados: ${tot}. ${hallazgosTxt}`;
      }
      case "emisor": {
        const file = resultData.filename || "informe_tecnico.pdf";
        const sum = resultData.resumen || "El informe técnico oficial ha sido generado y compilado.";
        return `Agente Emisor: Informe técnico tricolor compilado exitosamente como ${file}. ${sum} Puede dictar observaciones complementarias por voz para notificar a la presidencia de comisión.`;
      }
      case "secretario": {
        const acta = resultData.acta_debate || resultData;
        const cam = acta.camara || "Cámara de Diputados";
        const ses = acta.sesion_numero || 42;
        const titulo = acta.normativa_titulo || resultData.titulo_proyecto || resultData.titulo || "Proyecto de Ley en tratamiento plenario";

        // Votación en Grande
        const vg = acta.votacion_en_grande || resultData.votacion_esencial || {};
        const favorGrande = vg.favor !== undefined ? vg.favor : 71;
        const contraGrande = vg.contra !== undefined ? vg.contra : 25;
        const abstGrande = vg.abstenciones !== undefined ? vg.abstenciones : 4;
        const totalVotantes = vg.total_votantes || vg.total_presentes || (favorGrande + contraGrande + abstGrande);
        const resGrande = (vg.resultado || "APROBADO").toUpperCase();

        // Votación en Detalle
        const vd = acta.votacion_en_detalle || resultData.articulos_documento || [];
        const cantArticulos = Array.isArray(vd) ? vd.length : (acta.votaciones ? Math.max(0, acta.votaciones.length - 1) : 0);
        
        const detalleTexto = cantArticulos > 0
          ? `Asimismo, en el tratamiento en detalle se aprobaron nominalmente los ${cantArticulos} artículos del proyecto de reformas normativas.`
          : "Asimismo, el tratamiento en detalle fue aprobado por el pleno camaral.";

        const estadoSig = (acta.estado_siguiente === "EN_TRAMITE_BICAMERAL" || acta.resultado_final?.includes("APROBADO"))
          ? "El expediente y las correcciones de comisión quedan debidamente certificados para su remisión al Circuito Bicameral de Revisión."
          : (acta.observaciones_secretaria || "Acta de sesión plenaria registrada con fe de secretaría.");

        return `Secretaría de Cámara de la ${cam}, Sesión Ordinaria número ${ses}. Se certifica el Acta Oficial del proyecto: ${titulo}. En la votación en grande resultó ${resGrande} con ${favorGrande} votos a favor, ${contraGrande} en contra y ${abstGrande} abstenciones, sobre ${totalVotantes} legisladores presentes. ${detalleTexto} ${estadoSig}`;
      }
      case "bicameral": {
        const ciclo = resultData.ciclo_bicameral || resultData;
        const c2 = ciclo.circuito_dos_camaras || {};
        const cOrigen = c2.camara_origen || {};
        const cRevisora = c2.camara_revisora || {};
        const titulo = ciclo.normativa_en_tratamiento || resultData.titulo || "el proyecto de ley";
        const pctOrigen = cOrigen.porcentaje_aprobacion || 71.0;
        const pctRevisora = cRevisora.porcentaje_aprobacion || 77.8;
        const cantArticulos = cOrigen.votacion_en_detalle?.length || cRevisora.votacion_en_detalle?.length || 13;
        const enmiendas = c2.enmiendas_detectadas ? "con modificaciones conciliadas" : "sin enmiendas discrepantes";

        return `Trámite y Revisión Bicameral de la Asamblea Legislativa Plurinacional sobre ${titulo}. Cámara de Origen, Diputados: aprobó el proyecto con ${pctOrigen} por ciento de respaldo legislativo. Cámara Revisora, Senadores: ratificó la aprobación de los ${cantArticulos} artículos con ${pctRevisora} por ciento de respaldo, ${enmiendas}. Concluido el circuito legislativo, la ley queda formalmente sancionada y expedita para su remisión al Órgano Ejecutivo conforme al artículo 163 de la Constitución.`;
      }
      case "veto_promulgacion": {
        const ev = resultData.evaluacion_veto || resultData;
        const dec = (ev.decision || "PROMULGAR").toUpperCase();
        const score = ev.score_final || "7.8";
        const titulo = ev.normativa_evaluada || resultData.titulo || "del proyecto de ley";
        const respaldo = ev.respaldo_legislativo || "74.4% en la Asamblea Legislativa Plurinacional";
        const rec = ev.recomendacion_ejecutiva || "";
        const destino = dec.includes("PROMULGAR") 
          ? "promulgación inmediata y pase a la Gaceta Oficial del Estado"
          : "devolución con observaciones fundamentadas a la Asamblea Legislativa Plurinacional";

        return `Evaluación Presidencial del Órgano Ejecutivo sobre ${titulo}. Dictamen del Asesor Presidencial: Decisión ejecutiva: ${dec}, con un índice de favorabilidad institucional de ${score} sobre 10 y un respaldo parlamentario de ${respaldo}. Ruta determinada: ${destino}. ${rec}`;
      }
      case "publicacion": {
        const pub = resultData.publicacion_oficial || resultData;
        const num = pub.numero_ley || "Ley Oficial del Estado Plurinacional";
        const bol = pub.boletin_oficial || "Gaceta Oficial del Estado Plurinacional de Bolivia";
        const tit = pub.titulo || "Ley sancionada";
        const vig = pub.fecha_vigencia || "desde la fecha de su publicación";
        return `Gaceta Oficial del Estado Plurinacional de Bolivia. Certificación de publicación de la ${num}. Título oficial: ${tit}. En plena vigencia ${vig}. Norma promulgada de observancia general y cumplimiento obligatorio en todo el territorio nacional.`;
      }
      default:
        return typeof resultData === "string" ? resultData : JSON.stringify(resultData).substring(0, 200);
    }
  } catch (err) {
    return "Resultado procesado por el agente legislativo.";
  }
}

export default function AgentVoiceModule({
  agentId = "distribuidor",
  agentLabel,
  primaryColor = "#00B4D8",
  sesionId = null,
  resultData = null,
  speechHook = {},
  onDictadoText = null,
  onVoiceAction = null,
  compact = false,
  emailDestino = null,
  onModificarPromulgacion = null,
  onAgregarCorreccion = null,
}) {
  const config = AGENT_VOICE_CONFIG[agentId] || AGENT_VOICE_CONFIG.distribuidor;
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  const [notifResult, setNotifResult] = useState(null);
  const [isReadingResult, setIsReadingResult] = useState(false);
  const [currentSpokenText, setCurrentSpokenText] = useState("");
  const [dictadoNote, setDictadoNote] = useState("");
  const [correccionArticulo, setCorreccionArticulo] = useState("Artículo 1");
  const prevTranscriptRef = useRef("");

  const {
    isSTTSupported,
    isListening,
    isRecording,
    recognitionStatus,
    whisperStatus,
    transcript,
    interimTranscript,
    isSpeaking,
    error,
    startListening,
    stopListening,
    startRecordingWAV,
    stopRecordingWAV,
    clearTranscript,
    speakWithFallback,
    sendVoiceCommand,
    stopSpeaking,
  } = speechHook;

  // Auto-leer resultado si estuviera configurado
  useEffect(() => {
    if (config.autoRead && resultData && speakWithFallback) {
      const ttsText = buildTTSText(agentId, resultData);
      if (ttsText) {
        setCurrentSpokenText(ttsText);
        const timer = setTimeout(() => speakWithFallback(ttsText, agentId, sesionId), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [agentId, resultData, config.autoRead, speakWithFallback, sesionId]);

  // Capturar dictado para el Distribuidor: actualiza automáticamente el documento
  useEffect(() => {
    if (
      agentId === "distribuidor" &&
      transcript &&
      transcript !== prevTranscriptRef.current &&
      recognitionStatus === "ready" &&
      !isListening
    ) {
      prevTranscriptRef.current = transcript;
      if (onDictadoText) {
        onDictadoText(transcript);
      }
    }
  }, [transcript, recognitionStatus, isListening, agentId, onDictadoText]);

  const isActive = isListening || isRecording;
  const isProcessingSTT = recognitionStatus === "processing" || whisperStatus === "processing";

  // Activar / desactivar micrófono
  const handleMicToggle = useCallback(() => {
    if (isSTTSupported) {
      if (isListening) {
        stopListening?.();
      } else {
        clearTranscript?.();
        startListening?.();
      }
    } else {
      if (isRecording) {
        stopRecordingWAV?.();
      } else {
        clearTranscript?.();
        startRecordingWAV?.(agentId, sesionId);
      }
    }
  }, [
    isSTTSupported,
    isListening,
    isRecording,
    agentId,
    sesionId,
    startListening,
    stopListening,
    startRecordingWAV,
    stopRecordingWAV,
    clearTranscript,
  ]);

  // Leer resultado en voz alta (TTS)
  const handleReadResult = useCallback(async () => {
    if (!speakWithFallback) return;
    const ttsText = buildTTSText(agentId, resultData);
    if (!ttsText) return;
    setIsReadingResult(true);
    setCurrentSpokenText(ttsText);
    try {
      await speakWithFallback(ttsText, agentId, sesionId);
    } finally {
      setIsReadingResult(false);
    }
  }, [agentId, resultData, sesionId, speakWithFallback]);

  // Enviar notificación con la observación de voz
  const handleSendVoiceNotification = useCallback(async () => {
    const texto = transcript || dictadoNote;
    if (!texto || !texto.trim()) return;

    setIsSendingNotif(true);
    setNotifResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/voz/notificacion-voz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto_observacion: texto.trim(),
          agente: agentId,
          sesion_id: sesionId,
          email_destino: emailDestino,
          incluir_audio: config.features.includes("envio_audio_correo") || agentId === "emisor",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotifResult({
          ok: true,
          mensaje: data.mensaje || config.successMsg,
        });
        if (speakWithFallback) {
          await speakWithFallback(
            "La observación ha sido registrada y la notificación fue enviada exitosamente.",
            agentId,
            sesionId
          );
        }
        if (onVoiceAction) {
          onVoiceAction({ type: "notificacion_enviada", texto, agente: agentId });
        }
        setDictadoNote("");
        clearTranscript?.();
      } else {
        setNotifResult({
          ok: false,
          mensaje: data.detail || "Error al enviar la notificación.",
        });
      }
    } catch (err) {
      setNotifResult({ ok: false, mensaje: `Error de conexión: ${err.message}` });
    } finally {
      setIsSendingNotif(false);
    }
  }, [
    transcript,
    dictadoNote,
    agentId,
    sesionId,
    emailDestino,
    config,
    speakWithFallback,
    onVoiceAction,
    clearTranscript,
  ]);

  // Enviar corrección dictada por el Secretario
  const handleSubirCorreccionSecretario = useCallback(async () => {
    const texto = transcript || dictadoNote;
    if (!texto || !texto.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/voz/correccion-secretario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesion_id: sesionId,
          correccion: texto.trim(),
          articulo: correccionArticulo,
          autor: "Secretaría de Cámara - Voz",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotifResult({
          ok: true,
          mensaje: data.mensaje || `Corrección agregada a ${correccionArticulo}`,
        });
        if (onAgregarCorreccion) {
          onAgregarCorreccion({ articulo: correccionArticulo, texto: texto.trim() });
        }
        if (speakWithFallback) {
          await speakWithFallback(
            `Corrección para ${correccionArticulo} incorporada al expediente para el bicameral.`,
            agentId,
            sesionId
          );
        }
        setDictadoNote("");
        clearTranscript?.();
      }
    } catch (err) {
      setNotifResult({ ok: false, mensaje: `Error: ${err.message}` });
    }
  }, [
    transcript,
    dictadoNote,
    correccionArticulo,
    sesionId,
    agentId,
    speakWithFallback,
    onAgregarCorreccion,
    clearTranscript,
  ]);

  // Modificar decisión de promulgación por voz
  const handleModificarDecisionPromulgacion = useCallback(
    (nuevaDecision) => {
      if (onModificarPromulgacion) {
        onModificarPromulgacion(nuevaDecision);
      }
      if (speakWithFallback) {
        speakWithFallback(
          `Decisión de promulgación modificada a: ${nuevaDecision === "PROMULGAR" ? "Promulgación Aprobada" : "Observar para Veto"}.`,
          agentId,
          sesionId
        );
      }
      setNotifResult({
        ok: true,
        mensaje: `Decisión modificada a: ${nuevaDecision}`,
      });
    },
    [onModificarPromulgacion, speakWithFallback, agentId, sesionId]
  );

  // Enviar comando por voz
  const handleSendCommand = useCallback(async () => {
    const cmd = transcript || dictadoNote;
    if (!cmd || !sendVoiceCommand) return;
    const res = await sendVoiceCommand(cmd, agentId, sesionId, resultData ? { result: resultData } : {});
    if (res?.texto_respuesta_tts && speakWithFallback) {
      setCurrentSpokenText(res.texto_respuesta_tts);
      await speakWithFallback(res.texto_respuesta_tts, agentId, sesionId);
    }
  }, [transcript, dictadoNote, sendVoiceCommand, agentId, sesionId, resultData, speakWithFallback]);

  return (
    <div
      id={`agent-voice-module-${agentId}`}
      style={{
        fontFamily: "'Inter', 'Outfit', sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* ── Fila principal de interacción de voz ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          borderRadius: "14px",
          background: isActive
            ? "rgba(239,68,68,0.09)"
            : `linear-gradient(135deg, rgba(15,23,42,0.92), ${primaryColor}0c)`,
          border: `1.5px solid ${isActive ? "rgba(239,68,68,0.45)" : `${primaryColor}35`}`,
          boxShadow: isActive
            ? "0 0 20px rgba(239,68,68,0.2)"
            : `0 4px 18px ${primaryColor}12`,
          transition: "all 0.3s ease",
        }}
      >
        {/* Ícono de estado animado */}
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: `linear-gradient(135deg, ${primaryColor}28, ${primaryColor}10)`,
            border: `1.5px solid ${primaryColor}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <Radio
            size={16}
            color={primaryColor}
            style={{ animation: isActive ? "pulse 1s ease-in-out infinite" : "none" }}
          />
          {isActive && (
            <div
              style={{
                position: "absolute",
                inset: "-4px",
                borderRadius: "14px",
                border: `2px solid ${primaryColor}`,
                opacity: 0.4,
                animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
          )}
        </div>

        {/* Título y subtítulo contextual */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 800,
              color: "#e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{config.icon}</span>
            <span>{config.title}</span>
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: isActive ? "#f87171" : "#64748b",
              fontWeight: 600,
              marginTop: "1px",
            }}
          >
            {isActive
              ? isListening
                ? "🎙️ Escuchando... habla ahora en español"
                : "🔴 Grabando audio para el agente..."
              : isProcessingSTT
              ? "⏳ Procesando audio..."
              : config.subtitle}
          </div>
        </div>

        {/* Botón Micrófono principal */}
        <button
          id={`mic-btn-module-${agentId}`}
          onClick={handleMicToggle}
          title={isActive ? "Detener micrófono" : "Activar micrófono"}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : `linear-gradient(135deg, ${primaryColor}35, ${primaryColor}18)`,
            color: isActive ? "#ffffff" : primaryColor,
            boxShadow: isActive
              ? "0 0 20px rgba(239,68,68,0.55)"
              : `0 0 12px ${primaryColor}25`,
            transition: "all 0.25s ease",
            flexShrink: 0,
          }}
        >
          {isProcessingSTT ? (
            <Loader size={18} style={{ animation: "spin 1s linear infinite" }} />
          ) : isActive ? (
            <Square size={17} />
          ) : (
            <Mic size={18} />
          )}
        </button>

        {/* Botón TTS Rápido */}
        {config.features.includes("leer_resultado") && resultData && (
          <button
            id={`tts-btn-module-${agentId}`}
            onClick={isSpeaking ? () => stopSpeaking?.() : handleReadResult}
            title={isSpeaking ? "Detener lectura" : config.ttsLabel}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isSpeaking
                ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                : "rgba(100,116,139,0.2)",
              color: isSpeaking ? "#c4b5fd" : "#94a3b8",
              boxShadow: isSpeaking ? "0 0 16px rgba(124,58,237,0.4)" : "none",
              transition: "all 0.25s ease",
              flexShrink: 0,
            }}
          >
            {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
      </div>

      {/* ── Transcripción en tiempo real ── */}
      {(transcript || interimTranscript) && (
        <div
          style={{
            background: "rgba(15,23,42,0.85)",
            borderRadius: "12px",
            padding: "12px 14px",
            border: `1px solid ${primaryColor}30`,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              color: primaryColor,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            Texto Reconocido por Voz:
          </div>
          {transcript && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#f1f5f9", lineHeight: 1.5 }}>
              "{transcript}"
            </p>
          )}
          {interimTranscript && (
            <p
              style={{
                margin: `${transcript ? "4px" : 0} 0 0 0`,
                fontSize: "0.78rem",
                color: "#94a3b8",
                fontStyle: "italic",
              }}
            >
              {interimTranscript}...
            </p>
          )}
          <button
            onClick={() => clearTranscript?.()}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
            title="Limpiar texto"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Visualización de Lectura de Voz Oficial (TTS) ── */}
      {currentSpokenText && (isSpeaking || isReadingResult) && (
        <div
          style={{
            background: "rgba(15, 23, 42, 0.95)",
            borderRadius: "12px",
            padding: "12px 14px",
            border: `1.5px solid ${primaryColor}70`,
            boxShadow: `0 0 16px ${primaryColor}25`,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: "0.66rem",
              fontWeight: 800,
              color: primaryColor,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Volume2 size={13} style={{ animation: "pulse 1.2s infinite" }} />
              Lectura TTS Oficial en Curso:
            </span>
            <button
              onClick={() => {
                stopSpeaking?.();
                setCurrentSpokenText("");
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              title="Detener voz"
            >
              <X size={13} />
            </button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.82rem",
              color: "#f8fafc",
              lineHeight: 1.55,
              fontWeight: 500,
            }}
          >
            "{currentSpokenText}"
          </p>
        </div>
      )}

      {/* ── Mensaje de Error si lo hay ── */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "0.75rem",
            color: "#f87171",
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── Notificación de Resultado ── */}
      {notifResult && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: notifResult.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notifResult.ok ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "0.76rem",
            color: notifResult.ok ? "#34d399" : "#f87171",
          }}
        >
          {notifResult.ok ? (
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
          ) : (
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
          )}
          <span>{notifResult.mensaje}</span>
        </div>
      )}

      {/* ── Acciones Específicas por Agente ── */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {/* Botón: Leer Resultado Completo */}
        {config.features.includes("leer_resultado") && resultData && !compact && (
          <button
            id={`read-result-btn-${agentId}`}
            onClick={isSpeaking ? () => stopSpeaking?.() : handleReadResult}
            style={{
              flex: 1,
              minWidth: "150px",
              padding: "10px 14px",
              borderRadius: "10px",
              border: `1px solid ${primaryColor}45`,
              background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}08)`,
              color: primaryColor,
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.2s",
            }}
          >
            {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {isSpeaking ? "Detener Lectura" : config.ttsLabel}
          </button>
        )}

        {/* Agente Emisor: Dictar observación y enviar notificación */}
        {config.features.includes("envio_notificacion") && (
          <button
            id={`send-voice-notif-${agentId}`}
            onClick={handleSendVoiceNotification}
            disabled={isSendingNotif || (!transcript && !dictadoNote)}
            style={{
              flex: 1,
              minWidth: "160px",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(2,132,199,0.5)",
              background: "linear-gradient(135deg, rgba(2,132,199,0.3), rgba(2,132,199,0.1))",
              color: "#38bdf8",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: isSendingNotif || (!transcript && !dictadoNote) ? "not-allowed" : "pointer",
              opacity: (!transcript && !dictadoNote) && !isSendingNotif ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {isSendingNotif ? (
              <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Send size={14} />
            )}
            <span>Enviar Observación por Voz</span>
          </button>
        )}

        {/* Agente Bicameral: Grabar y Enviar Audio con Correo */}
        {agentId === "bicameral" && (
          <button
            id="send-bicameral-audio-email"
            onClick={handleSendVoiceNotification}
            disabled={isSendingNotif || (!transcript && !dictadoNote)}
            style={{
              flex: 1,
              minWidth: "160px",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(14,165,233,0.5)",
              background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(14,165,233,0.08))",
              color: "#7dd3fc",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: isSendingNotif || (!transcript && !dictadoNote) ? "not-allowed" : "pointer",
              opacity: (!transcript && !dictadoNote) && !isSendingNotif ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {isSendingNotif ? (
              <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Mail size={14} />
            )}
            <span>Enviar Correo y Audio a Cámara</span>
          </button>
        )}

        {/* Agente Secretario: Registrar corrección por voz */}
        {agentId === "secretario" && (
          <button
            id="subir-correccion-secretario-btn"
            onClick={handleSubirCorreccionSecretario}
            disabled={!transcript && !dictadoNote}
            style={{
              flex: 1,
              minWidth: "160px",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(30,64,175,0.6)",
              background: "linear-gradient(135deg, rgba(30,64,175,0.3), rgba(30,64,175,0.1))",
              color: "#93c5fd",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: !transcript && !dictadoNote ? "not-allowed" : "pointer",
              opacity: (!transcript && !dictadoNote) ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} />
            <span>Subir Corrección Votada</span>
          </button>
        )}

        {/* Agente Veto/Promulgación: Opciones de modificación por voz */}
        {agentId === "veto_promulgacion" && (
          <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "4px" }}>
            <button
              onClick={() => handleModificarDecisionPromulgacion("PROMULGAR")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(138,201,38,0.5)",
                background: "rgba(138,201,38,0.15)",
                color: "#8AC926",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <Check size={14} /> Modificar: Promulgar
            </button>
            <button
              onClick={() => handleModificarDecisionPromulgacion("OBSERVAR_VETO_PARCIAL")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(244,162,97,0.5)",
                background: "rgba(244,162,97,0.15)",
                color: "#F4A261",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <Gavel size={14} /> Modificar: Veto Parcial
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
