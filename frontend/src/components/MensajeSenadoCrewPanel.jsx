import React, { useState, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  Mic,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Mail,
  FileCheck,
  Building2,
  Cpu,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';

export default function MensajeSenadoCrewPanel({
  idProyecto,
  sesionId,
  numeroLey = 'Ley Sancionada y Promulgada',
  tituloProyecto = 'Proyecto de Ley',
  boletinOficial = 'GAC-2026-BOL',
  defaultEmail = 'rebalicbecky2@gmail.com',
  onSent
}) {
  const [emailDestino, setEmailDestino] = useState(defaultEmail);
  const [asunto, setAsunto] = useState(`[ALP NOTIFICACIÓN OFICIAL] Promulgación y Publicación en Gaceta: ${numeroLey}`);
  const [mensaje, setMensaje] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);

  // Redacción automática mediante Agente CrewAI
  const handleDraftWithCrew = async () => {
    setIsDrafting(true);
    setErrorMsg('');
    try {
      const res = await api.redactarMensajeSenado({
        id_proyecto: idProyecto,
        sesion_id: sesionId,
        numero_ley: numeroLey,
        titulo_proyecto: tituloProyecto,
        boletin_oficial: boletinOficial
      });
      if (res?.data?.mensaje_redactado) {
        setMensaje(res.data.mensaje_redactado);
        setAsunto(`[ALP NOTIFICACIÓN OFICIAL] Promulgación y Publicación en Gaceta: ${numeroLey}`);
      } else {
        throw new Error('No se recibió texto generado por el agente.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al redactar con Agente CrewAI.');
    } finally {
      setIsDrafting(false);
    }
  };

  // Reconocimiento de Voz para dictar o agregar observaciones
  const toggleVoiceDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMsg('El reconocimiento de voz no está soportado en este navegador.');
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = 'es-BO';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onresult = (ev) => {
      const transcript = ev.results[0][0].transcript;
      setMensaje((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  // Lectura en voz alta del mensaje
  const toggleSpeechSynthesis = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(mensaje || 'No hay mensaje para leer.');
    utt.lang = 'es-BO';
    utt.rate = 0.92;
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utt);
  };

  // Despacho Oficial vía Token de Google
  const handleSendToSenatePresident = async () => {
    if (!emailDestino.trim() || !emailDestino.includes('@')) {
      setErrorMsg('Por favor ingrese un correo institucional válido para el Presidente del Senado.');
      return;
    }

    if (!mensaje.trim()) {
      setErrorMsg('Por favor redacte el mensaje oficial o use el botón del Agente CrewAI para generarlo.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');
    try {
      const res = await api.enviarMensajeSenado({
        id_proyecto: idProyecto,
        sesion_id: sesionId,
        numero_ley: numeroLey,
        titulo_proyecto: tituloProyecto,
        boletin_oficial: boletinOficial,
        email_destino: emailDestino.trim(),
        mensaje_personalizado: mensaje.trim()
      });

      if (res?.data?.enviado) {
        setSentOk(true);
        if (onSent) {
          onSent({
            destinatario: emailDestino.trim(),
            metodo: res.data.metodo || 'gmail_smtp_token_google',
            timestamp: new Date().toISOString()
          });
        }
        setTimeout(() => setSentOk(false), 9000);
      } else {
        throw new Error(res?.data?.detalle?.error || 'No se pudo certificar el envío del correo.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al despachar el mensaje al Presidente del Senado.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(13, 27, 42, 0.98) 0%, rgba(27, 42, 74, 0.95) 100%)',
      border: '1.5px solid rgba(0, 194, 203, 0.5)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '26px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Luz ambiental de fondo */}
      <div style={{
        position: 'absolute',
        top: '-30px',
        right: '-30px',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'rgba(0, 194, 203, 0.12)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      {/* Encabezado del Módulo con CrewAI */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid rgba(0, 194, 203, 0.25)',
        paddingBottom: '16px',
        marginBottom: '18px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: '2px solid rgba(0, 194, 203, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0, 194, 203, 0.35)',
            overflow: 'hidden',
            background: '#0B2545'
          }}>
            <img
              src="/robots/logos/agente_publicacion.jpeg"
              alt="Agente Publicación / CrewAI"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                Mensaje Oficial al Presidente del Senado
              </h4>
              <span style={{
                background: 'rgba(0, 194, 203, 0.18)',
                border: '1px solid rgba(0, 194, 203, 0.45)',
                color: '#38BDF8',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.04em'
              }}>
                CREWAI AGENT INTERACTION
              </span>
              <span style={{
                background: 'rgba(138, 201, 38, 0.15)',
                border: '1px solid rgba(138, 201, 38, 0.4)',
                color: '#8AC926',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                TOKEN DE GOOGLE GMAIL ACTIVO
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Notificación protocolar de promulgación y publicación en Gaceta dirigida a la Presidencia de la Cámara de Senadores (ALP).
            </p>
          </div>
        </div>

        {/* Botón de Generación Asistida por CrewAI */}
        <button
          type="button"
          onClick={handleDraftWithCrew}
          disabled={isDrafting}
          style={{
            background: isDrafting
              ? 'rgba(0, 194, 203, 0.2)'
              : 'linear-gradient(135deg, rgba(2, 132, 199, 0.35) 0%, rgba(0, 194, 203, 0.25) 100%)',
            border: '1px solid rgba(0, 194, 203, 0.6)',
            borderRadius: '10px',
            color: '#00C2CB',
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: isDrafting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(0, 194, 203, 0.25)',
            transition: 'all 0.2s ease',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          {isDrafting ? (
            <>
              <Cpu size={15} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Redactando con Agente CrewAI...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>🤖 Redactar Mensaje Oficial con Agente CrewAI</span>
            </>
          )}
        </button>
      </div>

      {/* Alerta de Éxito */}
      {sentOk && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1.5px solid rgba(16, 185, 129, 0.5)',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#34d399',
          marginBottom: '16px'
        }}>
          <CheckCircle2 size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
              ✓ Mensaje remitido exitosamente al Presidente del Senado
            </div>
            <div style={{ fontSize: '0.76rem', opacity: 0.9 }}>
              Despachado con Token de Google a: <strong>{emailDestino}</strong> · Registro certificado en bitácora de la ALP.
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Error */}
      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1.5px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#f87171',
          marginBottom: '16px'
        }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, flex: 1 }}>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg('')}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Campos del Oficio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#7dd3fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏛️ Correo Institucional del Presidente del Senado *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="presidencia.senado@asamblea.gob.bo o su correo personal"
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: '9px',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1.5px solid rgba(0, 194, 203, 0.35)',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <Mail size={16} color="#00C2CB" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
            Despacha directamente con la autenticación oficial de Google (Gmail SMTP).
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#7dd3fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📌 Asunto Protocolar
          </label>
          <input
            type="text"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '9px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1.5px solid rgba(0, 194, 203, 0.35)',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Área de Mensaje / Oficio con Asistente de Voz */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📜 Texto Oficial del Oficio Parlamentario
          </label>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={toggleSpeechSynthesis}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.12)',
                border: isSpeaking ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.3)',
                color: isSpeaking ? '#f87171' : '#7dd3fc',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              <span>{isSpeaking ? 'Detener Voz' : 'Leer en Voz Alta'}</span>
            </button>

            <button
              type="button"
              onClick={toggleVoiceDictation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: isListening ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.15)',
                border: isListening ? '1px solid #ef4444' : '1px solid rgba(245, 158, 11, 0.4)',
                color: isListening ? '#f87171' : '#fbbf24',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Mic size={13} />
              <span>{isListening ? 'Grabando... (Detener)' : 'Dictar por Micrófono'}</span>
            </button>
          </div>
        </div>

        <textarea
          rows={7}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Haga clic en '🤖 Redactar Mensaje Oficial con Agente CrewAI' para que el agente elabore el texto solemne de promulgación, o escriba/dicte directamente aquí..."
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: isListening ? '1.5px solid #f59e0b' : '1.5px solid rgba(0, 194, 203, 0.3)',
            color: '#f1f5f9',
            fontSize: '0.84rem',
            lineHeight: 1.6,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'monospace'
          }}
        />
      </div>

      {/* Botón de Despacho Oficial */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          type="button"
          onClick={handleSendToSenatePresident}
          disabled={isSending || !emailDestino || !mensaje}
          style={{
            background: isSending || !emailDestino || !mensaje
              ? 'rgba(59, 130, 246, 0.3)'
              : 'linear-gradient(135deg, #0284C7 0%, #00C2CB 100%)',
            border: '1px solid rgba(0, 194, 203, 0.6)',
            borderRadius: '12px',
            color: '#ffffff',
            padding: '12px 24px',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: isSending || !emailDestino || !mensaje ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0, 194, 203, 0.35)',
            transition: 'all 0.2s ease',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          {isSending ? (
            <>
              <Cpu size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Despachando Oficialmente con Token de Google...</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>Enviar Mensaje al Presidente del Senado</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
