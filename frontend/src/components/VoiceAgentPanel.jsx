/**
 * VoiceAgentPanel.jsx — Módulo de Voz Embebido por Agente
 * =========================================================
 * Componente reutilizable que integra STT + TTS en la tarjeta de cada agente.
 *
 * Funcionalidades:
 *  - Botón 🎙️ con modo nativo (Web Speech API) y fallback (MediaRecorder → Whisper)
 *  - Lista de comandos disponibles del agente (cargados desde /api/voz/comandos/{agente})
 *  - Indicador visual del motor STT activo
 *  - TTS automático de la respuesta del agente (speakWithFallback)
 *  - Badge de estado animado: escuchando / grabando / procesando / respondiendo
 *  - Historial de comandos de la sesión actual
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  Loader,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Radio,
  Cpu,
  Keyboard,
  Zap,
  MessageSquare,
} from 'lucide-react';

// ── Constantes de diseño ────────────────────────────────────────────────────

const STT_ENGINE_LABELS = {
  native: { label: 'Web Speech API', icon: '🌐', color: '#10b981' },
  google_stt: { label: 'Google STT (Servidor)', icon: '🔍', color: '#3b82f6' },
  whisper: { label: 'Whisper local', icon: '🖥️', color: '#6366f1' },
  wav_pcm_directo: { label: 'WAV PCM 16kHz (Servidor)', icon: '🎙️', color: '#00f0ff' },
  manual: { label: 'Modo texto', icon: '✍️', color: '#f59e0b' },
};

const STATUS_STYLES = {
  idle: { bg: 'rgba(71, 85, 105, 0.2)', border: 'rgba(71, 85, 105, 0.4)', color: '#94a3b8', label: 'En espera' },
  listening: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', color: '#34d399', label: 'Escuchando…' },
  recording: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.5)', color: '#f87171', label: 'Grabando…' },
  processing: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)', color: '#818cf8', label: 'Procesando…' },
  ready: { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.4)', color: '#38bdf8', label: 'Listo' },
  done: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', color: '#34d399', label: 'Completado' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', color: '#f87171', label: 'Error' },
};

// ── Componente Principal ────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string} props.agente  — Nombre del agente backend (ej. "Distribuidor")
 * @param {string} [props.agenteLabel]  — Nombre amigable para mostrar
 * @param {string} [props.primaryColor] — Color del agente (#hex)
 * @param {object} useSpeechHook — El objeto retornado por useLatinSpeech()
 * @param {string} [props.sesionId]     — ID de sesión actual
 * @param {boolean} [props.compact]     — Modo compacto (sin lista de comandos)
 * @param {function} [props.onCommandResult] — Callback cuando se procesa un comando
 */
export default function VoiceAgentPanel({
  agente,
  agenteLabel,
  primaryColor = '#00f0ff',
  sesionId = null,
  compact = false,
  onCommandResult = null,
  // Recibimos el hook desde el padre para compartir estado
  isSTTSupported,
  isListening,
  isRecording,
  recognitionStatus,
  whisperStatus,
  sttEngineUsed,
  transcript,
  interimTranscript,
  isSpeaking,
  error,
  startListening,
  stopListening,
  startRecordingFallback,
  stopRecordingFallback,
  clearTranscript,
  sendVoiceCommand,
  speakWithFallback,
  fetchAgentCommands,
  commandHistory,
}) {
  const [agentCommands, setAgentCommands] = useState([]);
  const [showCommands, setShowCommands] = useState(false);
  const [lastCommandResult, setLastCommandResult] = useState(null);
  const [manualText, setManualText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const transcriptRef = useRef(transcript);

  // Mantener ref actualizada del transcript para usar en callbacks
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Cargar comandos disponibles para este agente al montar
  useEffect(() => {
    if (!fetchAgentCommands || !agente) return;
    fetchAgentCommands(agente).then((cmds) => {
      if (cmds && cmds.length > 0) setAgentCommands(cmds);
    });
  }, [agente, fetchAgentCommands]);

  // Determinar el status combinado
  const effectiveStatus = isListening
    ? 'listening'
    : isRecording
      ? 'recording'
      : recognitionStatus === 'processing' || whisperStatus === 'processing'
        ? 'processing'
        : whisperStatus === 'done' || recognitionStatus === 'ready'
          ? 'ready'
          : whisperStatus === 'error'
            ? 'error'
            : 'idle';

  const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.idle;
  const engineInfo = STT_ENGINE_LABELS[sttEngineUsed] || null;

  // ── Manejar el botón de micrófono ────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    if (isSTTSupported) {
      // Capa 1: Web Speech API nativa
      if (isListening) {
        stopListening();
      } else {
        clearTranscript();
        startListening();
      }
    } else {
      // Capa 2: MediaRecorder → Whisper
      if (isRecording) {
        stopRecordingFallback();
      } else {
        clearTranscript();
        startRecordingFallback(agente, sesionId);
      }
    }
  }, [
    isSTTSupported,
    isListening,
    isRecording,
    agente,
    sesionId,
    startListening,
    stopListening,
    startRecordingFallback,
    stopRecordingFallback,
    clearTranscript,
  ]);

  // ── Enviar texto (transcripción o manual) como comando ───────────────────
  const handleSendCommand = useCallback(
    async (textOverride = null) => {
      const textoAEnviar = (textOverride || transcriptRef.current || manualText || '').trim();
      if (!textoAEnviar || !sendVoiceCommand) return;

      setIsSendingCommand(true);
      try {
        const result = await sendVoiceCommand(textoAEnviar, agente, sesionId, {});
        if (result) {
          setLastCommandResult(result);
          // TTS de la respuesta
          if (result.texto_respuesta_tts && speakWithFallback) {
            await speakWithFallback(result.texto_respuesta_tts, agente, sesionId);
          }
          if (onCommandResult) onCommandResult(result);
        }
      } finally {
        setIsSendingCommand(false);
      }
    },
    [agente, sesionId, manualText, sendVoiceCommand, speakWithFallback, onCommandResult]
  );

  // Auto-enviar cuando la transcripción se estabiliza (modo nativo)
  const prevTranscriptRef = useRef('');
  useEffect(() => {
    if (
      transcript &&
      transcript !== prevTranscriptRef.current &&
      recognitionStatus === 'ready' &&
      isSTTSupported &&
      !isListening
    ) {
      prevTranscriptRef.current = transcript;
      // Pequeño debounce: esperar 800ms después de que el reconocimiento termine
      const timer = setTimeout(() => {
        handleSendCommand(transcript);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [transcript, recognitionStatus, isListening, isSTTSupported, handleSendCommand]);

  const isActiveMode = isListening || isRecording;
  const micIcon = isActiveMode ? (
    <Square size={20} />
  ) : recognitionStatus === 'processing' || whisperStatus === 'processing' ? (
    <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
  ) : (
    <Mic size={20} />
  );

  return (
    <div
      id={`voice-panel-${agente.toLowerCase()}`}
      style={{
        borderRadius: '16px',
        border: `1px solid ${statusStyle.border}`,
        background: statusStyle.bg,
        padding: compact ? '12px 14px' : '16px',
        transition: 'all 0.3s ease',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Header del panel ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        {/* Icono de estado animado */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${primaryColor}25, ${primaryColor}10)`,
            border: `1.5px solid ${primaryColor}50`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <Radio
            size={16}
            color={primaryColor}
            style={{
              animation: isActiveMode ? 'pulse 1s ease-in-out infinite' : 'none',
            }}
          />
          {isActiveMode && (
            <div
              style={{
                position: 'absolute',
                inset: '-3px',
                borderRadius: '12px',
                border: `2px solid ${primaryColor}`,
                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                opacity: 0.4,
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' }}>
            {agenteLabel || agente}
          </div>
          <div
            style={{
              fontSize: '0.7rem',
              color: statusStyle.color,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: statusStyle.color,
                flexShrink: 0,
                animation: isActiveMode ? 'pulse 1s ease-in-out infinite' : 'none',
              }}
            />
            {statusStyle.label}
            {engineInfo && (
              <span style={{ color: engineInfo.color, marginLeft: '4px' }}>
                · {engineInfo.icon} {engineInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Botón micrófono */}
        <button
          id={`mic-btn-${agente.toLowerCase()}`}
          onClick={handleMicToggle}
          title={isActiveMode ? 'Detener escucha' : 'Activar micrófono'}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isActiveMode
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : `linear-gradient(135deg, ${primaryColor}30, ${primaryColor}15)`,
            color: isActiveMode ? '#fff' : primaryColor,
            boxShadow: isActiveMode
              ? '0 0 16px rgba(239, 68, 68, 0.5)'
              : `0 0 8px ${primaryColor}30`,
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
        >
          {micIcon}
        </button>
      </div>

      {/* ── Área de transcripción ─────────────────────────────── */}
      {(transcript || interimTranscript) && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            minHeight: '40px',
          }}
        >
          {transcript && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.5 }}>
              {transcript}
            </p>
          )}
          {interimTranscript && (
            <p style={{ margin: `${transcript ? '4px' : 0} 0 0 0`, fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
              {interimTranscript}
            </p>
          )}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '7px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '8px 10px',
            marginBottom: '10px',
            fontSize: '0.75rem',
            color: '#f87171',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          {error}
        </div>
      )}

      {/* ── Resultado del último comando ─────────────────────── */}
      {lastCommandResult && (
        <div
          style={{
            background: lastCommandResult.resultado?.reconocido
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${lastCommandResult.resultado?.reconocido ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {lastCommandResult.resultado?.reconocido ? (
              <CheckCircle2 size={13} color="#34d399" />
            ) : (
              <AlertCircle size={13} color="#f87171" />
            )}
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: lastCommandResult.resultado?.reconocido ? '#34d399' : '#f87171' }}>
              {lastCommandResult.resultado?.reconocido ? 'Comando reconocido' : 'Comando no reconocido'}
            </span>
            {lastCommandResult.resultado?.confianza > 0 && (
              <span style={{ fontSize: '0.67rem', color: '#94a3b8', marginLeft: 'auto' }}>
                {lastCommandResult.resultado.confianza}% confianza
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1' }}>
            <strong style={{ color: '#e2e8f0' }}>Acción: </strong>
            {lastCommandResult.resultado?.descripcion || lastCommandResult.resultado?.accion}
          </p>
          {lastCommandResult.texto_respuesta_tts && (
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.73rem', color: '#94a3b8', fontStyle: 'italic', flex: 1 }}>
                "{lastCommandResult.texto_respuesta_tts}"
              </p>
              <button
                onClick={() => speakWithFallback && speakWithFallback(lastCommandResult.texto_respuesta_tts, agente, sesionId)}
                title="Reproducir respuesta"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Volume2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Acciones ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {/* Enviar comando manualmente si hay transcripción */}
        {(transcript || manualText) && !isActiveMode && (
          <button
            id={`send-cmd-btn-${agente.toLowerCase()}`}
            onClick={() => handleSendCommand()}
            disabled={isSendingCommand}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '9px',
              border: `1px solid ${primaryColor}50`,
              background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}10)`,
              color: primaryColor,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: isSendingCommand ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              opacity: isSendingCommand ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isSendingCommand ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
            {isSendingCommand ? 'Enviando…' : 'Enviar Comando'}
          </button>
        )}

        {/* Modo texto manual (fallback de último recurso) */}
        <button
          onClick={() => setShowManual((p) => !p)}
          title="Escribir comando manualmente"
          style={{
            padding: '8px',
            borderRadius: '9px',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            background: 'rgba(71, 85, 105, 0.15)',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.72rem',
          }}
        >
          <Keyboard size={13} />
          {!compact && 'Manual'}
        </button>
      </div>

      {/* ── Entrada de texto manual ───────────────────────────── */}
      {showManual && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              id={`manual-input-${agente.toLowerCase()}`}
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualText.trim()) {
                  handleSendCommand(manualText.trim());
                  setManualText('');
                }
              }}
              placeholder={`Ej: "${agentCommands[0]?.frase_ejemplo || 'registrar nuevo proyecto'}"`}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9px',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#e2e8f0',
                fontSize: '0.78rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (manualText.trim()) {
                  handleSendCommand(manualText.trim());
                  setManualText('');
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '9px',
                border: 'none',
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)`,
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <MessageSquare size={13} />
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de comandos disponibles (colapsable) ────────── */}
      {!compact && agentCommands.length > 0 && (
        <div>
          <button
            onClick={() => setShowCommands((p) => !p)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: '#64748b',
              fontSize: '0.72rem',
              padding: '4px 0',
              fontWeight: 600,
            }}
          >
            <Cpu size={11} />
            {agentCommands.length} comandos disponibles
            {showCommands ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {showCommands && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {agentCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  id={`cmd-${agente.toLowerCase()}-${idx}`}
                  onClick={() => handleSendCommand(cmd.frase_ejemplo)}
                  title={cmd.descripcion}
                  style={{
                    textAlign: 'left',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    lineHeight: 1.4,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${primaryColor}12`;
                    e.currentTarget.style.color = '#e2e8f0';
                    e.currentTarget.style.borderColor = `${primaryColor}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
                  }}
                >
                  <span style={{ fontWeight: 600, color: primaryColor, marginRight: '5px' }}>»</span>
                  "{cmd.frase_ejemplo}"
                  <span style={{ display: 'block', color: '#475569', fontSize: '0.67rem', marginTop: '2px' }}>
                    → {cmd.descripcion}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keyframes inline para animaciones */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes ping {
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
