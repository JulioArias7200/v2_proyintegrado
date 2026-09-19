import React, { useState } from 'react';
import {
  FileCheck,
  Mail,
  CheckCircle2,
  AlertTriangle,
  X,
  Mic,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';
import CorrecionesPanel from './CorrecionesPanel';

export function GacetaCorreccionesSection({ idProyecto, sesionId, onCorreccionActualizada }) {
  const [showCorreccionesFinal, setShowCorreccionesFinal] = useState(false);

  return (
    <div style={{ marginBottom: '24px' }}>
      <button
        type="button"
        onClick={() => setShowCorreccionesFinal(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
          background: 'linear-gradient(145deg, rgba(13,27,42,0.95), rgba(27,42,74,0.90))',
          border: '1.5px solid rgba(138,201,38,0.45)',
          borderRadius: '14px', padding: '14px 18px', cursor: 'pointer',
          color: '#ffffff', fontFamily: 'Outfit, sans-serif',
          transition: 'all 0.25s ease',
          boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(138,201,38,0.75)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(138,201,38,0.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(138,201,38,0.45)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.3)'; }}
      >
        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(138,201,38,0.18)', border: '1px solid rgba(138,201,38,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileCheck size={18} color="#8AC926" />
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
            Correcciones Finales para la Gaceta
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            Subir o revisar observaciones del Secretario antes de la publicación oficial
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#8AC926', fontWeight: 700 }}>
          {showCorreccionesFinal ? '▲ Ocultar' : '▼ Expandir'}
        </div>
      </button>

      {showCorreccionesFinal && idProyecto && (
        <div style={{ marginTop: '12px', border: '1px solid rgba(138,201,38,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
          <CorrecionesPanel
            idProyecto={idProyecto}
            sesionId={sesionId}
            onCorreccionActualizada={onCorreccionActualizada}
          />
        </div>
      )}
    </div>
  );
}

export function GacetaNotificacionEmailSection({ fase1Data, pub = {}, defaultEmail = '', onSent }) {
  const [gacetaEmail1, setGacetaEmail1] = useState(defaultEmail);
  const [gacetaEmail2, setGacetaEmail2] = useState('');
  const [gacetaEmail3, setGacetaEmail3] = useState('');
  const [gacetaAsunto, setGacetaAsunto] = useState(`Publicación Oficial en Gaceta — ${pub?.numero_ley || 'Ley Sancionada'}`);
  const [gacetaMensaje, setGacetaMensaje] = useState('');
  const [gacetaSending, setGacetaSending] = useState(false);
  const [gacetaSentOk, setGacetaSentOk] = useState(false);
  const [gacetaError, setGacetaError] = useState('');
  const [gacetaListening, setGacetaListening] = useState(false);
  const [gacetaPreview, setGacetaPreview] = useState(false);

  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const destinatarios = [gacetaEmail1, gacetaEmail2, gacetaEmail3].filter(e => e && e.trim() && emailValido(e.trim()));

  const startGacetaMic = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setGacetaError('Reconocimiento de voz no disponible en este navegador.'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'es-BO'; rec.interimResults = false;
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      setGacetaMensaje(prev => (prev ? prev + ' ' : '') + text);
    };
    rec.onerror = () => { setGacetaListening(false); };
    rec.onend = () => setGacetaListening(false);
    rec.start();
    setGacetaListening(true);
  };

  const handleGacetaSend = async () => {
    setGacetaError('');
    if (destinatarios.length === 0) {
      setGacetaError('Ingrese al menos un correo electrónico válido en el campo "Correo Principal".');
      return;
    }
    setGacetaSending(true);
    try {
      for (const dest of destinatarios) {
        await api.post('/api/pipeline/agent_notificador', {
          sesion_id: fase1Data?.sesion_id || `gaceta-${Date.now()}`,
          id_proyecto: fase1Data?.id_proyecto || null,
          email_autor: dest,
          destinatario_extra: dest,
          asunto_personalizado: gacetaAsunto.trim() || undefined,
          mensaje_extra: gacetaMensaje.trim()
            ? `PUBLICACIÓN OFICIAL EN GACETA\n\n${gacetaMensaje.trim()}`
            : `Se comunica la publicación oficial de la ley ${pub?.numero_ley || ''} en la Gaceta Oficial del Estado Plurinacional de Bolivia.`,
        });
      }
      setGacetaSentOk(true);
      if (onSent) onSent(destinatarios);
      setTimeout(() => setGacetaSentOk(false), 8000);
    } catch (err) {
      setGacetaError(err?.response?.data?.detail || err.message || 'Error al enviar notificaciones.');
    } finally {
      setGacetaSending(false);
    }
  };

  const readGacetaMsg = () => {
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(gacetaMensaje || '(Sin mensaje extra)');
      utt.lang = 'es-BO'; utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    }
  };

  return (
    <div style={{
      marginBottom: '28px',
      background: 'linear-gradient(145deg, rgba(13,27,42,0.97), rgba(27,42,74,0.92))',
      border: '1.5px solid rgba(56,189,248,0.4)',
      borderRadius: '16px',
      padding: '22px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid rgba(56,189,248,0.15)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(2,132,199,0.3), rgba(56,189,248,0.15))', border: '1px solid rgba(56,189,248,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mail size={20} color="#38bdf8" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.97rem', fontWeight: 800, color: '#ffffff' }}>
            Notificación Oficial de Publicación en Gaceta
          </h4>
          <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8' }}>
            Envíe confirmación a Cámaras, Presidente y demás autoridades vía Token de Google (Gmail SMTP).
          </p>
        </div>
      </div>

      {/* Feedback de éxito */}
      {gacetaSentOk && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '10px', padding: '12px 16px', color: '#34d399', marginBottom: '16px' }}>
          <CheckCircle2 size={20} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Correos enviados exitosamente vía Token de Google</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Enviado a {destinatarios.length} destinatario(s): {destinatarios.join(' · ')}</div>
          </div>
        </div>
      )}

      {/* Feedback de error */}
      {gacetaError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', marginBottom: '16px' }}>
          <AlertTriangle size={18} />
          <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{gacetaError}</span>
          <button onClick={() => setGacetaError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '2px' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Campos de correo — 3 destinatarios */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#7dd3fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ✉️ Correo Principal *
          </label>
          <input
            type="email"
            placeholder="presidencia@estado.gob.bo"
            value={gacetaEmail1}
            onChange={e => setGacetaEmail1(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '9px',
              background: 'rgba(15,23,42,0.9)',
              border: gacetaEmail1 && !emailValido(gacetaEmail1) ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid rgba(56,189,248,0.3)',
              color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {gacetaEmail1 && !emailValido(gacetaEmail1) && (
            <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '3px' }}>Correo no válido</div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#7dd3fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ✉️ Cámara de Senadores (Opcional)
          </label>
          <input
            type="email"
            placeholder="senado@asamblea.gob.bo"
            value={gacetaEmail2}
            onChange={e => setGacetaEmail2(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '9px',
              background: 'rgba(15,23,42,0.9)',
              border: gacetaEmail2 && !emailValido(gacetaEmail2) ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid rgba(56,189,248,0.25)',
              color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#7dd3fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ✉️ Cámara de Diputados (Opcional)
          </label>
          <input
            type="email"
            placeholder="diputados@asamblea.gob.bo"
            value={gacetaEmail3}
            onChange={e => setGacetaEmail3(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '9px',
              background: 'rgba(15,23,42,0.9)',
              border: gacetaEmail3 && !emailValido(gacetaEmail3) ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid rgba(56,189,248,0.25)',
              color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Asunto */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#7dd3fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📌 Asunto del Correo
        </label>
        <input
          type="text"
          value={gacetaAsunto}
          onChange={e => setGacetaAsunto(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: '9px',
            background: 'rgba(15,23,42,0.9)',
            border: '1.5px solid rgba(56,189,248,0.3)',
            color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Mensaje extra con voz */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📝 Observación / Nota del Secretario
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button" onClick={readGacetaMsg}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#7dd3fc', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >
              <span>🔊</span><span>Leer</span>
            </button>
            <button
              type="button"
              onClick={gacetaListening ? () => setGacetaListening(false) : startGacetaMic}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: gacetaListening ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)', border: `1px solid ${gacetaListening ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.4)'}`, borderRadius: '6px', color: gacetaListening ? '#f87171' : '#fbbf24', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >
              <Mic size={12} />
              <span>{gacetaListening ? 'Detener' : 'Dictar'}</span>
            </button>
          </div>
        </div>
        <textarea
          rows={4}
          placeholder="Escriba aquí o dicte por voz la observación o nota del Secretario para incluir en el correo oficial..."
          value={gacetaMensaje}
          onChange={e => setGacetaMensaje(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '9px',
            background: 'rgba(15,23,42,0.9)',
            border: gacetaListening ? '1.5px solid rgba(245,158,11,0.6)' : '1.5px solid rgba(245,158,11,0.3)',
            color: '#ffffff', fontSize: '0.84rem', outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', transition: 'border-color 0.3s',
            boxShadow: gacetaListening ? '0 0 12px rgba(245,158,11,0.2)' : 'none',
          }}
        />
      </div>

      {/* Vista previa */}
      <div style={{ marginBottom: '18px' }}>
        <button
          type="button"
          onClick={() => setGacetaPreview(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, padding: '4px 0' }}
        >
          <span>{gacetaPreview ? '▲' : '▼'}</span>
          <span>{gacetaPreview ? 'Ocultar vista previa' : 'Ver vista previa del correo'}</span>
        </button>
        {gacetaPreview && (
          <div style={{ marginTop: '10px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', padding: '16px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.7 }}>
            <div style={{ borderBottom: '1px solid rgba(56,189,248,0.15)', paddingBottom: '8px', marginBottom: '10px', fontSize: '0.8rem' }}>
              <strong style={{ color: '#7dd3fc' }}>Para:</strong> {destinatarios.join(' · ') || '(sin destinatario válido)'}<br />
              <strong style={{ color: '#7dd3fc' }}>Asunto:</strong> {gacetaAsunto}
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#94a3b8', fontSize: '0.78rem' }}>
              {gacetaMensaje
                ? `PUBLICACIÓN OFICIAL EN GACETA\n\n${gacetaMensaje}`
                : `Se comunica la publicación oficial de la ley ${pub?.numero_ley || ''} en la Gaceta Oficial del Estado Plurinacional de Bolivia.`}
            </p>
          </div>
        )}
      </div>

      {/* Indicador de destinatarios válidos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{ fontSize: '0.78rem', color: destinatarios.length > 0 ? '#34d399' : '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {destinatarios.length > 0
            ? <><CheckCircle2 size={14} /> {destinatarios.length} destinatario(s) válido(s) listo(s) para envío</>
            : <><AlertTriangle size={14} /> Sin destinatarios válidos — complete al menos el Correo Principal</>}
        </div>
      </div>

      {/* Botón de envío */}
      <button
        type="button"
        onClick={handleGacetaSend}
        disabled={gacetaSending || destinatarios.length === 0}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          background: gacetaSending || destinatarios.length === 0
            ? 'rgba(59,130,246,0.3)'
            : 'linear-gradient(135deg, #0284C7 0%, #38bdf8 100%)',
          border: '1px solid rgba(56,189,248,0.5)',
          borderRadius: '12px', color: '#ffffff', padding: '13px 24px',
          fontSize: '0.95rem', fontWeight: 800, cursor: gacetaSending || destinatarios.length === 0 ? 'not-allowed' : 'pointer',
          boxShadow: destinatarios.length > 0 && !gacetaSending ? '0 6px 24px rgba(56,189,248,0.4)' : 'none',
          transition: 'all 0.25s ease', fontFamily: 'Outfit, sans-serif',
        }}
      >
        {gacetaSending ? (
          <><Cpu size={18} style={{ animation: 'spin 0.8s linear infinite' }} /><span>Enviando correos oficiales...</span></>
        ) : (
          <><Mail size={18} /><span>Enviar Notificación Oficial de Gaceta ({destinatarios.length} destinatario{destinatarios.length !== 1 ? 's' : ''})</span></>
        )}
      </button>
    </div>
  );
}
