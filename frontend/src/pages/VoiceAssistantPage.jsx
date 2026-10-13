/**
 * VoiceAssistantPage.jsx — Módulo de Interacción por Voz Multimodal (TTS & STT)
 * ==============================================================================
 * Sistema Multi-Agente (SMA) Congreso de Bolivia.
 *
 * Características:
 *  - 14 Operadores Robóticos Parlamentarios totalmente interactivos e integrados.
 *  - Reconocimiento de Voz Multicapa con Auto-Recuperación de Errores de Red.
 *  - Grabador WAV PCM 16kHz nativo directo al servidor FastAPI (/api/voz/transcribir).
 *  - Síntesis de voz (Text-to-Speech) en español latinoamericano neutral.
 *  - Visualizador en cuadrícula y carrusel de todos los agentes.
 *  - Comandos interactivos de 1 clic por agente con respuestas vocales inmediatas.
 *  - Historial de comandos en tiempo real con reproducción de audio.
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Bot,
  Copy,
  Check,
  Cpu,
  Settings,
  AlertCircle,
  CheckCircle2,
  Send,
  MessageSquare,
  Radio,
  Sliders,
  FileText,
  Scale,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  ChevronRight,
  Activity,
  Award
} from 'lucide-react';
import { useLatinSpeech } from '../hooks/useLatinSpeech';
import VoiceAgentPanel from '../components/VoiceAgentPanel';

// Catálogo completo de los 14 operadores robóticos parlamentarios (logos homologados con Mesa de Partes)
export const VOICE_OPERATORS = [
  {
    id: 'distribuidor',
    agente: 'Distribuidor',
    name: 'Operador Distribuidor',
    shortName: 'Distribuidor',
    role: 'Mesa de Partes & Admisión',
    image: '/robots/logos/agente_distribuidor.jpeg',
    theme: 'cyan',
    primaryColor: '#00B4D8',
    badge: 'Fase 1 • Admisión',
    model: 'Nemotron-3 30B',
    greeting: 'Saludos parlamentarios. Soy el Operador de Admisión de la Mesa de Partes. Dicta o escribe el resumen o título del documento que deseas canalizar al sistema legislativo.',
    suggestedQuery: 'Registrar nuevo proyecto de ley sobre soberanía alimentaria y riego tecnificado.',
  },
  {
    id: 'comision',
    agente: 'Comision',
    name: 'Comisión Legislativa',
    shortName: 'Comisión',
    role: 'Asignación Temática CPE Art. 158',
    image: '/robots/logos/agente_comision.jpeg',
    theme: 'blue',
    primaryColor: '#38BDF8',
    badge: 'Fase 2 • Asignación',
    model: 'Nemotron-3 30B',
    greeting: 'Comisión parlamentaria conectada. Clasifico y asigno proyectos de ley a las comisiones camarales competentes según materia.',
    suggestedQuery: 'Asignar comisión competente para el proyecto de ley minera y ambiental.',
  },
  {
    id: 'constitucional',
    agente: 'VerificadorConstitucional',
    name: 'Verificador Constitucional',
    shortName: 'Constitucional',
    role: 'Auditoría Supremacía CPE 2009',
    image: '/robots/logos/agente_constitucional.jpeg',
    theme: 'blue',
    primaryColor: '#2563EB',
    badge: 'Fase 2 • CPE 2009',
    model: 'Nemotron-3 30B',
    greeting: 'Atención legislativa. Me encargo del control de constitucionalidad. ¿Deseas consultar la conformidad de algún artículo o principio fundamental de la CPE?',
    suggestedQuery: 'Verificar constitucionalidad del artículo 12 sobre régimen penitenciario frente al artículo 15 de la CPE.',
  },
  {
    id: 'consistencia',
    agente: 'ConsistenciaNormativa',
    name: 'Consistencia Normativa',
    shortName: 'Consistencia',
    role: 'Vectores pgvector 2048d & Antinomias',
    image: '/robots/logos/agente_consistencia.jpeg',
    theme: 'blue',
    primaryColor: '#1D4ED8',
    badge: 'Fase 2 • pgvector',
    model: 'pgvector 2048d',
    greeting: 'Base normativa conectada con embeddings de 2048 dimensiones. Pregúntame sobre posibles colisiones normativas con códigos o leyes sectoriales vigentes.',
    suggestedQuery: 'Verificar consistencia normativa frente al Código Penal y Ley del Medio Ambiente.',
  },
  {
    id: 'emisor',
    agente: 'EmisorResultados',
    name: 'Concentrador y Emisor',
    shortName: 'Emisor PDF',
    role: 'Síntesis Oficial & Dictamen PDF',
    image: '/robots/logos/concentrador.jpeg',
    theme: 'cyan',
    primaryColor: '#0284C7',
    badge: 'Fase 3 • Dictamen',
    model: 'ReportLab + IA',
    greeting: 'Módulo de emisión de dictámenes constitucionales y normativos. Genero el PDF tricolor con el resultado completo del análisis legislativo.',
    suggestedQuery: 'Generar dictamen PDF oficial con sello digital institucional.',
  },
  {
    id: 'notificador',
    agente: 'NotificadorComision',
    name: 'Notificador de Comisión',
    shortName: 'Notificador',
    role: 'Correos Institucionales HTML',
    image: '/robots/logos/agente_comodin.jpeg',
    theme: 'teal',
    primaryColor: '#14B8A6',
    badge: 'Fase 3 • Notificación',
    model: 'SMTP / HTML SMA',
    greeting: 'Canal de notificación parlamentaria activo. Envío correos HTML a comisiones, senadores y al autor del proyecto con el dictamen adjunto.',
    suggestedQuery: 'Enviar notificación a la comisión con dictamen y observaciones adjuntas.',
  },
  {
    id: 'constitucion_fondo',
    agente: 'ConstitucionFondo',
    name: 'Constitución Fondo',
    shortName: 'CPE Fondo',
    role: 'Hermenéutica & Precedentes TC',
    image: '/robots/logos/agente_constitucional.jpeg',
    theme: 'purple',
    primaryColor: '#7C3AED',
    badge: 'Fase 4 • Fondo',
    model: 'Nemotron-70B',
    greeting: 'Análisis hermenéutico de fondo. Evalúo precedentes del Tribunal Constitucional Plurinacional y ponderación de derechos fundamentales.',
    suggestedQuery: 'Evaluar fondo constitucional y precedentes vinculantes del Tribunal Constitucional.',
  },
  {
    id: 'concentrador_crew',
    agente: 'ConcentradorCrew',
    name: 'Concentrador Multi-Agente',
    shortName: 'Concentrador',
    role: 'Síntesis Integral de Expediente',
    image: '/robots/logos/concentrador.jpeg',
    theme: 'cyan',
    primaryColor: '#0284C7',
    badge: 'Fase 4 • Síntesis',
    model: 'Nemotron-70B',
    greeting: 'Módulo de consolidación integral. Unifico las observaciones de todos los agentes en un único expediente estructurado.',
    suggestedQuery: 'Sintetizar observaciones multi-agente en el expediente integral.',
  },
  {
    id: 'secretario',
    agente: 'SecretarioCamara',
    name: 'Secretario de Cámara',
    shortName: 'Secretario',
    role: 'Actas de Debate & Votaciones',
    image: '/robots/logos/agente_secretario.jpeg',
    theme: 'blue',
    primaryColor: '#1E40AF',
    badge: 'Fase 4 • Plenario',
    model: 'Nemotron-70B',
    greeting: 'Sistema de registro parlamentario activo. Puedo registrar debates, votos nominales y emitir actas formales de sesión plenaria.',
    suggestedQuery: 'Registrar debate y votación plenaria: 85 a favor, 12 en contra.',
  },
  {
    id: 'bicameral',
    agente: 'Bicameral',
    name: 'Coordinador Bicameral',
    shortName: 'Bicameral',
    role: 'Trámite entre Cámaras Art. 163',
    image: '/robots/logos/agente_bicamaral.jpeg',
    theme: 'blue',
    primaryColor: '#7DD3FC',
    badge: 'Fase 5 • Bicameral',
    model: 'Nemotron-70B',
    greeting: 'Procedimiento bicameral en curso. Gestiono el intercambio entre la Cámara de Diputados y el Senado, incluyendo la conciliación del texto aprobado.',
    suggestedQuery: 'Iniciar procedimiento bicameral y remitir a la Cámara Revisora.',
  },
  {
    id: 'veto_promulgacion',
    agente: 'VetoPromulgacion',
    name: 'Veto y Promulgación',
    shortName: 'Veto/Promulg.',
    role: 'Decisión Ejecutiva Final Art. 163-167',
    image: '/robots/logos/agente_veto.jpeg',
    theme: 'blue',
    primaryColor: '#1E3A8A',
    badge: 'Fase 5 • Veto/Promulg.',
    model: 'Nemotron-70B',
    greeting: 'Módulo de evaluación ejecutiva. Analizo los criterios de promulgación o veto presidencial conforme a la CPE.',
    suggestedQuery: 'Evaluar veto o promulgación ejecutiva del proyecto sancionado.',
  },
  {
    id: 'publicacion',
    agente: 'Publicacion',
    name: 'Agente de Publicación',
    shortName: 'Gaceta Oficial',
    role: 'Gaceta Oficial & Promulgación',
    image: '/robots/logos/agente_publicacion.jpeg',
    theme: 'cyan',
    primaryColor: '#00C2CB',
    badge: 'Fase 5 • Gaceta',
    model: 'Nemotron-70B',
    greeting: 'Módulo de promulgación y publicación oficial. Registro la ley en la Gaceta Oficial del Estado Plurinacional y asigno su número oficial.',
    suggestedQuery: 'Publicar en Gaceta Oficial y asignar número oficial de Ley.',
  },
  {
    id: 'ciudadano',
    agente: 'AtencionCiudadana',
    name: 'Atención Ciudadana',
    shortName: 'Ciudadano',
    role: 'Ventanilla Social & Peticiones',
    image: '/robots/logos/agente_ciudadania.jpeg',
    theme: 'violet',
    primaryColor: '#8B5CF6',
    badge: 'Fase Social • Peticiones',
    model: 'Nemotron-3 30B',
    greeting: 'Bienvenido. Estoy listo para escuchar y transcribir solicitudes, peticiones o reclamos de la ciudadanía para derivarlos a la unidad competente.',
    suggestedQuery: 'Registrar solicitud ciudadana de la Federación de Productores Agrícolas.',
  },
  {
    id: 'presupuesto',
    agente: 'Presupuesto',
    name: 'Analista de Presupuesto',
    shortName: 'Presupuesto',
    role: 'Impacto Fiscal & Ley 1178 SAFCO',
    image: '/robots/logos/agente_comodin.jpeg',
    theme: 'emerald',
    primaryColor: '#059669',
    badge: 'Nivel 2 • Fiscal',
    model: 'Nemotron-3 30B',
    greeting: 'Módulo de evaluación presupuestaria. Analizo el impacto fiscal de la ley propuesta contra el TGN y el marco regulatorio de la Ley 1178 SAFCO.',
    suggestedQuery: 'Evaluar impacto presupuestario y sostenibilidad fiscal SAFCO.',
  },
];

export default function VoiceAssistantPage({ onNavigateTab }) {
  // Hook de voz en español latinoamericano con autorecuperación
  const {
    sttMode,
    setSttMode,
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    recognitionStatus,
    startListening,
    stopListening,
    clearTranscript,
    sttEngineUsed,
    isRecording,
    whisperStatus,
    startRecordingWAV,
    stopRecordingWAV,
    isWhisperAvailable,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSpeaking,
    isPaused,
    rate,
    setRate,
    pitch,
    setPitch,
    speak,
    speakWithFallback,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    ttsEngineUsed,
    sendVoiceCommand,
    fetchAgentCommands,
    commandHistory,
    handleVoiceAction,
    isSTTSupported,
    isTTSSupported,
    serverVoiceStatus,
    networkWarning,
    setNetworkWarning,
    error,
    setError,
  } = useLatinSpeech();

  // Operador robótico activo
  const [activeOperator, setActiveOperator] = useState(VOICE_OPERATORS[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState(VOICE_OPERATORS[0].greeting);
  const [agentCommands, setAgentCommands] = useState([]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Al cambiar de operador, cargar sus comandos y su saludo inicial
  const handleSelectOperator = (op) => {
    setActiveOperator(op);
    setAssistantResponse(op.greeting);
    if (isSpeaking) {
      stopSpeaking();
    }
  };

  useEffect(() => {
    if (fetchAgentCommands && activeOperator) {
      fetchAgentCommands(activeOperator.agente || activeOperator.id).then((cmds) => {
        if (cmds) setAgentCommands(cmds);
      });
    }
  }, [activeOperator, fetchAgentCommands]);

  // Copiar transcripción al portapapeles
  const handleCopy = async () => {
    const textToCopy = transcript.trim() || assistantResponse;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Error al copiar:', e);
    }
  };

  // Cargar una consulta parlamentaria de prueba
  const handleLoadSample = (sampleText) => {
    setTranscript(sampleText);
    setError(null);
  };

  // Reproducir el saludo del operador o la transcripción con TTS
  const handleSpeakText = (textToRead) => {
    const targetText = textToRead || transcript || assistantResponse;
    if (!targetText) return;
    speakWithFallback(targetText, activeOperator.agente || activeOperator.id);
  };

  // Ejecutar un comando de voz rápidamente
  const handleExecuteVoiceCommand = async (commandText) => {
    const text = (commandText || transcript).trim();
    if (!text || !sendVoiceCommand) return;

    setIsExecutingCommand(true);
    try {
      const res = await sendVoiceCommand(text, activeOperator.agente || activeOperator.id);
      if (res) {
        if (res.texto_respuesta_tts) {
          setAssistantResponse(res.texto_respuesta_tts);
          await speakWithFallback(res.texto_respuesta_tts, activeOperator.agente || activeOperator.id);
        }
      }
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const isActiveAudio = isListening || isRecording;

  return (
    <div
      style={{
        maxWidth: '1720px',
        width: '96%',
        margin: '0 auto',
        padding: '24px 20px 80px 20px',
        color: '#f8fafc',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── 1. HEADER HERO MULTIMODAL CON SELECTOR DE MODO ── */}
      <div
        style={{
          background: 'linear-gradient(145deg, #091322 0%, #0d1b2e 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '24px',
          padding: '22px 28px',
          marginBottom: '20px',
          boxShadow: '0 12px 35px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Título & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(14, 165, 233, 0.45)',
                border: '1.5px solid rgba(255, 255, 255, 0.25)',
                flexShrink: 0,
              }}
            >
              <Radio size={26} color="#ffffff" className={isActiveAudio ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: '1.55rem',
                    color: '#ffffff',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Asistente de Voz Parlamentario
                </h1>
                <span
                  className="badge badge-blue"
                  style={{ fontSize: '0.7rem', padding: '2px 8px', fontWeight: 700 }}
                >
                  14 Agentes
                </span>
                <span
                  className="badge badge-green"
                  style={{ fontSize: '0.7rem', padding: '2px 8px', fontWeight: 700 }}
                >
                  STT + TTS Latino Neutro
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                Interacción multimodal por voz con cada uno de los 14 operadores del SMA Congreso de Bolivia.
              </p>
            </div>
          </div>

          {/* Selector de Modo STT y Ajustes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Selector de Modo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '3px',
                gap: '4px',
              }}
            >
              <button
                onClick={() => setSttMode('auto')}
                title="Modo Inteligente: Web Speech con fallback automático a Servidor WAV ante cortes de red"
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sttMode === 'auto' ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                  color: sttMode === 'auto' ? '#ffffff' : '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={12} /> Auto Híbrido
              </button>

              <button
                onClick={() => setSttMode('native')}
                title="Forzar Web Speech API del navegador"
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sttMode === 'native' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: sttMode === 'native' ? '#34d399' : '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🌐 Web Speech
              </button>

              <button
                onClick={() => setSttMode('backend')}
                title="Forzar grabación directa WAV PCM al servidor (100% compatible y sin error de red de Google)"
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sttMode === 'backend' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                  color: sttMode === 'backend' ? '#c084fc' : '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Mic size={12} /> Servidor WAV
              </button>
            </div>

            {/* Botón Ajustes de Audio */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '10px',
                background: showSettings ? 'rgba(14, 165, 233, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${showSettings ? '#0ea5e9' : 'rgba(255, 255, 255, 0.15)'}`,
                color: '#f8fafc',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
            >
              <Settings size={14} color={showSettings ? '#38bdf8' : '#cbd5e1'} />
              <span>Ajustes</span>
            </button>
          </div>
        </div>

        {/* ── PANEL DESPLEGABLE: AJUSTES DE VOZ LATINA ── */}
        {showSettings && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px 18px',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              alignItems: 'center',
            }}
          >
            {/* Selector de Voz */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                <Sliders size={13} /> Voz en Español Latinoamericano:
              </label>
              <select
                value={selectedVoice?.id || ''}
                onChange={(e) => {
                  const found = voices.find((v) => v.id === e.target.value);
                  if (found) setSelectedVoice(found);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#0a101d',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              >
                {voices.length === 0 ? (
                  <option value="">Cargando voces del navegador...</option>
                ) : (
                  voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Slider de Velocidad */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>Velocidad (Rate):</span>
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>{rate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>

            {/* Slider de Tono */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>Tono (Pitch):</span>
                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>{pitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── BANNER DE AVISO DE CONMUTACIÓN DE RED ── */}
      {networkWarning && (
        <div
          style={{
            background: 'rgba(14, 165, 233, 0.15)',
            border: '1px solid #0ea5e9',
            borderRadius: '12px',
            padding: '10px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#38bdf8" />
            <span style={{ fontSize: '0.82rem', color: '#bae6fd' }}>{networkWarning}</span>
          </div>
          <button
            onClick={() => setNetworkWarning(null)}
            style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}
          >
            OK
          </button>
        </div>
      )}

      {/* ── BANNER DE ERROR ── */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '10px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#f87171" />
            <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}
          >
            Descartar
          </button>
        </div>
      )}

      {/* ── 2. SELECTOR VISUAL DE LOS 14 AGENTES PARLAMENTARIOS ── */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="#00f0ff" />
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em', fontFamily: "'Outfit', sans-serif" }}>
              Panel de los 14 Agentes Legislativos — Selecciona un agente para interactuar por voz:
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {VOICE_OPERATORS.length} operadores disponibles
          </span>
        </div>

        {/* Carrusel / Grid de Agentes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '10px',
          }}
        >
          {VOICE_OPERATORS.map((op) => {
            const isSelected = op.id === activeOperator.id;
            return (
              <div
                key={op.id}
                onClick={() => handleSelectOperator(op)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: isSelected
                    ? `linear-gradient(145deg, ${op.primaryColor}25, ${op.primaryColor}10)`
                    : 'rgba(15, 23, 42, 0.6)',
                  border: isSelected ? `2px solid ${op.primaryColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isSelected ? `0 0 15px ${op.primaryColor}35` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: `2px solid ${isSelected ? op.primaryColor : 'rgba(255,255,255,0.2)'}`,
                      boxShadow: isSelected ? `0 0 10px ${op.primaryColor}60` : 'none',
                      background: 'linear-gradient(145deg, #0f172a, #1e293b)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={op.image}
                      alt={op.name}
                      onError={(e) => {
                        e.currentTarget.src = '/robots/logos/agente_distribuidor.jpeg';
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: isSelected ? 'brightness(1.1)' : 'brightness(0.85)',
                        transition: 'filter 0.2s ease',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: isSelected ? '#ffffff' : '#e2e8f0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {op.shortName}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: op.primaryColor, fontWeight: 600 }}>
                      {op.badge.split('•')[0].trim()}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.66rem',
                    color: '#94a3b8',
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {op.role}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. WORKBENCH PRINCIPAL: OPERADOR SELECCIONADO + CONSOLA DE VOZ ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* COLUMNA IZQUIERDA: AVATAR ROBOT + CONTROLES DEL AGENTE */}
        <div
          style={{
            background: 'linear-gradient(160deg, #0a1727 0%, #060e1a 100%)',
            border: `2px solid ${isActiveAudio ? activeOperator.primaryColor : 'rgba(56, 189, 248, 0.35)'}`,
            borderRadius: '24px',
            padding: '20px',
            boxShadow: isActiveAudio
              ? `0 0 35px ${activeOperator.primaryColor}35`
              : '0 10px 30px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Avatar del Robot con animación institucional estilo Mesa de Partes */}
          <div
            style={{
              width: '100%',
              height: '230px',
              borderRadius: '20px',
              overflow: 'hidden',
              position: 'relative',
              background: 'radial-gradient(circle at center, #132238 0%, #070d18 100%)',
              border: `1.5px solid ${isActiveAudio ? activeOperator.primaryColor : 'rgba(255, 255, 255, 0.14)'}`,
              boxShadow: isActiveAudio
                ? `0 0 25px ${activeOperator.primaryColor}40, inset 0 0 20px ${activeOperator.primaryColor}20`
                : 'inset 0 0 25px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Halo difuminado de luz institucional */}
            <div
              style={{
                position: 'absolute',
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                background: activeOperator.primaryColor,
                opacity: isActiveAudio ? 0.28 : 0.12,
                filter: 'blur(30px)',
                pointerEvents: 'none',
                transition: 'all 0.3s ease',
              }}
            />

            {/* Nodo Avatar Circular / Squircle Central Homologado */}
            <div
              style={{
                width: '128px',
                height: '128px',
                borderRadius: '50%',
                border: `3px solid ${activeOperator.primaryColor}`,
                boxShadow: isActiveAudio
                  ? `0 0 25px ${activeOperator.primaryColor}80, 0 0 10px ${activeOperator.primaryColor}`
                  : `0 0 16px ${activeOperator.primaryColor}40`,
                overflow: 'hidden',
                position: 'relative',
                background: 'linear-gradient(145deg, #0f172a, #1e293b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                transform: isActiveAudio ? 'scale(1.05)' : isSpeaking ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
              }}
            >
              <img
                src={activeOperator.image}
                alt={activeOperator.name}
                onError={(e) => {
                  e.currentTarget.src = '/robots/logos/agente_distribuidor.jpeg';
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: isActiveAudio
                    ? 'brightness(1.15) contrast(1.05)'
                    : isSpeaking
                    ? 'brightness(1.12)'
                    : 'brightness(0.95)',
                  transition: 'all 0.3s ease',
                }}
              />
            </div>

            {/* Láser de escaneo al escuchar */}
            {isActiveAudio && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: `linear-gradient(90deg, transparent, ${activeOperator.primaryColor}, transparent)`,
                  boxShadow: `0 0 15px ${activeOperator.primaryColor}`,
                  animation: 'scan-laser 2s linear infinite',
                }}
              />
            )}

            {/* Badge de Estado del Robot */}
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                right: '8px',
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(8px)',
                borderRadius: '8px',
                padding: '5px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>
                {isListening
                  ? '🎙️ Web Speech activo...'
                  : isRecording
                  ? '🎙️ Grabando WAV (Servidor)...'
                  : isSpeaking
                  ? '🔊 Leyendo respuesta...'
                  : 'En Espera'}
              </span>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isActiveAudio ? activeOperator.primaryColor : isSpeaking ? '#10b981' : '#64748b',
                  boxShadow: isActiveAudio ? `0 0 8px ${activeOperator.primaryColor}` : 'none',
                }}
              />
            </div>
          </div>

          {/* Información del Operador Activo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.1rem', color: '#ffffff', margin: 0 }}>
                {activeOperator.name}
              </h3>
              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                {activeOperator.badge}
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: activeOperator.primaryColor, fontWeight: 600, margin: '0 0 8px 0' }}>
              {activeOperator.role}
            </p>

            {/* Saludo / Respuesta activa */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '0.76rem',
                color: '#e2e8f0',
                lineHeight: 1.4,
                borderLeft: `3px solid ${activeOperator.primaryColor}`,
                marginBottom: '10px',
              }}
            >
              {assistantResponse}
            </div>

            {/* Botón para escuchar el saludo con TTS */}
            <button
              onClick={() => handleSpeakText(assistantResponse)}
              disabled={isSpeaking}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                background: isSpeaking ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${isSpeaking ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}`,
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '12px',
              }}
            >
              <Volume2 size={14} color="#34d399" />
              <span>{isSpeaking ? 'Hablando...' : 'Escuchar Voz del Agente'}</span>
            </button>

            {/* Panel de Comandos de Voz Embebido */}
            <VoiceAgentPanel
              agente={activeOperator.agente || activeOperator.id}
              agenteLabel={activeOperator.name}
              primaryColor={activeOperator.primaryColor}
              sesionId={null}
              compact={false}
              isSTTSupported={isSTTSupported}
              isListening={isListening}
              isRecording={isRecording}
              recognitionStatus={recognitionStatus}
              whisperStatus={whisperStatus}
              sttEngineUsed={sttEngineUsed}
              transcript={transcript}
              interimTranscript={interimTranscript}
              isSpeaking={isSpeaking}
              error={error}
              startListening={startListening}
              stopListening={stopListening}
              startRecordingFallback={startRecordingWAV}
              stopRecordingFallback={stopRecordingWAV}
              clearTranscript={clearTranscript}
              sendVoiceCommand={sendVoiceCommand}
              speakWithFallback={speakWithFallback}
              fetchAgentCommands={fetchAgentCommands}
              commandHistory={commandHistory}
            />
          </div>
        </div>

        {/* COLUMNA DERECHA: CONSOLA DE DIÁLOGO, DICTADO Y COMANDOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. Transcripción y Dictado */}
          <div
            style={{
              background: 'linear-gradient(145deg, #0f1c2e 0%, #0a1320 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Header del Textarea */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={17} color="#38bdf8" />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                  Transcripción y Dictado en Vivo ({activeOperator.shortName})
                </span>
                {isActiveAudio && (
                  <span className="badge badge-gold animate-pulse" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mic size={11} /> Grabando...
                  </span>
                )}
              </div>

              {/* Botones rápidos */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#e2e8f0',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>

                <button
                  onClick={clearTranscript}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={`Dicta presionando el micrófono o escribe una instrucción para ${activeOperator.name}...`}
                rows={5}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: '#070d17',
                  border: isActiveAudio ? `2px solid ${activeOperator.primaryColor}` : '1px solid rgba(56, 189, 248, 0.25)',
                  boxShadow: isActiveAudio ? `0 0 15px ${activeOperator.primaryColor}30 inset` : 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {interimTranscript && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    right: '12px',
                    background: 'rgba(14, 165, 233, 0.15)',
                    border: '1px dashed #0ea5e9',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    color: '#67e8f9',
                    fontStyle: 'italic',
                  }}
                >
                  Detectando: {interimTranscript}
                </div>
              )}
            </div>

            {/* Comandos Sugeridos para este Agente */}
            {agentCommands && agentCommands.length > 0 && (
              <div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  ⚡ Comandos Rápidos para {activeOperator.shortName} (Clic para ejecutar):
                </span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {agentCommands.map((cmd, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTranscript(cmd.frase_ejemplo);
                        handleExecuteVoiceCommand(cmd.frase_ejemplo);
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#cbd5e1',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${activeOperator.primaryColor}20`;
                        e.currentTarget.style.borderColor = activeOperator.primaryColor;
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        e.currentTarget.style.color = '#cbd5e1';
                      }}
                    >
                      <Zap size={11} color={activeOperator.primaryColor} />
                      "{cmd.frase_ejemplo}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Barra de Control de Micrófono y TTS */}
          <div
            style={{
              background: 'linear-gradient(145deg, #091322 0%, #0d1b2e 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '18px',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.35)',
            }}
          >
            {/* Botón de Micrófono Principal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                {isActiveAudio && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-5px',
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${activeOperator.primaryColor} 0%, transparent 70%)`,
                      animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                    }}
                  />
                )}
                <button
                  onClick={
                    isActiveAudio
                      ? stopListening
                      : () => {
                          if (sttMode === 'backend' || !isSTTSupported) {
                            startRecordingWAV(activeOperator.agente || activeOperator.id);
                          } else {
                            startListening();
                          }
                        }
                  }
                  style={{
                    position: 'relative',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: isActiveAudio
                      ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                      : `linear-gradient(135deg, ${activeOperator.primaryColor}dd, ${activeOperator.primaryColor}77)`,
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isActiveAudio
                      ? '0 0 20px rgba(239, 68, 68, 0.65)'
                      : `0 0 20px ${activeOperator.primaryColor}55`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isActiveAudio ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
              </div>

              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>
                  {isListening
                    ? 'Capturando audio (Web Speech)...'
                    : isRecording
                    ? 'Grabando WAV directo...'
                    : 'Hablar con ' + activeOperator.shortName}
                </div>
                <div style={{ fontSize: '0.74rem', color: isActiveAudio ? '#34d399' : '#94a3b8' }}>
                  {isActiveAudio ? 'Habla claramente en español latino' : 'Presiona para dictar tu comando'}
                </div>
              </div>
            </div>

            {/* Botones de Acción: Enviar Comando y Leer TTS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {transcript && (
                <button
                  onClick={() => handleExecuteVoiceCommand(transcript)}
                  disabled={isExecutingCommand}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${activeOperator.primaryColor}dd, ${activeOperator.primaryColor}88)`,
                    border: 'none',
                    color: '#000000',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isExecutingCommand ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Send size={14} />
                  <span>{isExecutingCommand ? 'Procesando...' : 'Enviar Comando'}</span>
                </button>
              )}

              <button
                onClick={() => (isSpeaking ? stopSpeaking() : handleSpeakText(transcript))}
                disabled={!transcript && !assistantResponse}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: isSpeaking
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: !transcript && !assistantResponse ? 'not-allowed' : 'pointer',
                  opacity: !transcript && !assistantResponse ? 0.5 : 1,
                }}
              >
                {isSpeaking ? <Square size={14} /> : <Volume2 size={14} />}
                <span>{isSpeaking ? 'Detener' : 'Leer Texto'}</span>
              </button>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('mesa')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    color: '#34d399',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={14} />
                  <span>Mesa</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. Historial de Comandos de Voz Ejecutados */}
          {commandHistory && commandHistory.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(145deg, #091322 0%, #0d1b2e 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '18px',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bot size={16} color="#00f0ff" />
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontFamily: "'Outfit', sans-serif", color: '#ffffff' }}>
                    Historial de Comandos Ejecutados ({commandHistory.length})
                  </h3>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  Sesión activa • Respuestas con TTS
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {commandHistory.slice().reverse().map((cmd, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${cmd.reconocido ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#00f0ff', fontWeight: 700 }}>
                          [{cmd.agente}]
                        </span>
                        <span style={{ fontSize: '0.66rem', color: '#64748b' }}>{cmd.timestamp}</span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: cmd.reconocido ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: cmd.reconocido ? '#34d399' : '#f87171',
                            fontWeight: 600,
                          }}
                        >
                          {cmd.reconocido ? `Acción: ${cmd.accion}` : 'Consulta'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 500 }}>
                        "{cmd.texto || cmd.comando}"
                      </div>
                      {cmd.respuesta && (
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', fontStyle: 'italic' }}>
                          ↳ {cmd.respuesta}
                        </div>
                      )}
                    </div>
                    {cmd.respuesta && (
                      <button
                        onClick={() => speakWithFallback(cmd.respuesta, cmd.agente)}
                        title="Reproducir respuesta con voz"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Volume2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CSS KEYFRAMES LOCALES ── */}
      <style>{`
        @keyframes scan-laser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 96%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
