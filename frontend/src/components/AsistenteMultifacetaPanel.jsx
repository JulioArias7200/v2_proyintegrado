import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Bot, User, Zap, Paperclip, FlaskConical, FileText, X } from 'lucide-react';
import { api } from '../services/api';
import PresentacionCiudadana from './PresentacionCiudadana';

/**
 * Asistente Ciudadano Multi-Faceta
 * --------------------------------
 * Chat sin estado contra POST /api/ciudadana/chat. El ciudadano NO elige la
 * faceta: el backend enruta automáticamente el mensaje al sub-agente
 * (Arquitectura, Salud, Educación, Trámites Legislativos…) cuyo trigger encaja.
 * Cada respuesta muestra qué faceta atendió y con qué modelo NVIDIA NIM.
 */
export default function AsistenteMultifacetaPanel({ sesionId = null }) {
  const [facetas, setFacetas] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Caso adjunto + Especialista Técnico
  const [caso, setCaso] = useState(null);        // { nombre, texto }
  const [subiendo, setSubiendo] = useState(false);
  const [usarEspecialista, setUsarEspecialista] = useState(false);
  const [dictamen, setDictamen] = useState(null);
  const [peritando, setPeritando] = useState(false);

  const finRef = useRef(null);

  useEffect(() => {
    api.getAgentesCiudadanos(true)
      .then((res) => setFacetas(res.data || []))
      .catch((err) => console.error('Error cargando facetas ciudadanas:', err));
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, enviando]);

  const subirCaso = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const res = await api.uploadDocument(archivo);
      setCaso({ nombre: archivo.name, texto: res.texto_completo || res.texto_preview || '' });
      setDictamen(null);
      setUsarEspecialista(false);
    } catch (err) {
      setError(err.message || 'No se pudo leer el documento.');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  const quitarCaso = () => {
    setCaso(null);
    setDictamen(null);
    setUsarEspecialista(false);
  };

  // Al activar el especialista se emite el dictamen pericial una sola vez;
  // después cada mensaje del chat se responde sobre ese dictamen.
  const alternarEspecialista = async () => {
    if (usarEspecialista) {
      setUsarEspecialista(false);
      return;
    }
    setUsarEspecialista(true);
    if (dictamen || !caso?.texto) return;
    setPeritando(true);
    setError(null);
    try {
      const res = await api.dictamenEspecialista({ casoTexto: caso.texto, casoNombre: caso.nombre, sesionId });
      setDictamen(res.dictamen || null);
    } catch (err) {
      setError(err.message || 'No se pudo emitir el dictamen técnico.');
      setUsarEspecialista(false);
    } finally {
      setPeritando(false);
    }
  };

  const enviar = async (e) => {
    e?.preventDefault();
    const consulta = texto.trim();
    if (!consulta || enviando) return;

    setTexto('');
    setError(null);
    setMensajes((prev) => [...prev, { rol: 'ciudadano', texto: consulta }]);
    setEnviando(true);
    try {
      const res = await api.chatCiudadano({
        mensaje: consulta,
        sesionId,
        casoTexto: caso?.texto || null,
        casoNombre: caso?.nombre || null,
        usarEspecialista: usarEspecialista && !!caso?.texto,
        dictamen,
      });
      if (res.dictamen) setDictamen(res.dictamen);
      setMensajes((prev) => [...prev, {
        rol: 'agente',
        texto: res.reply,
        faceta: res.agente_nombre,
        logo: res.agente_logo,
        modelo: res.modelo_usado,
        ms: res.duracion_ms,
        especialista: !!res.especialista,
      }]);
    } catch (err) {
      setError(err.message || 'No se pudo contactar al asistente ciudadano.');
    } finally {
      setEnviando(false);
    }
  };

  const burbuja = (fondo, borde) => ({
    background: fondo,
    border: `1px solid ${borde}`,
    borderRadius: '14px',
    padding: '12px 14px',
    maxWidth: '82%',
    color: '#E2E8F0',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  });

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <Sparkles size={20} color="#2dd4bf" />
        <h2 style={{ fontSize: '1.15rem', color: '#ffffff', margin: 0 }}>
          Asistente Ciudadano Multi-Faceta
        </h2>
      </div>
      <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '14px' }}>
        Escribe tu consulta en lenguaje natural. El sistema elige solo la especialidad
        que corresponde — no necesitas seleccionar nada.
      </p>
      <details style={{ marginBottom: 16 }}>
        <summary>Presentar mi consulta o iniciativa a Diputados o Senadores</summary>
        <PresentacionCiudadana textoInicial={caso?.texto || mensajes.filter(m => m.rol === 'ciudadano').at(-1)?.texto || texto}
          archivoInicial={caso?.nombre || ''} mostrarCasos={false} />
      </details>

      {facetas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {facetas.map((f) => (
            <span key={f.id} style={{
              background: 'rgba(45, 212, 191, 0.12)',
              border: '1px solid rgba(45, 212, 191, 0.35)',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '0.78rem',
              color: '#5eead4',
              fontWeight: 600,
            }}>
              {f.logo} {f.nombre}
            </span>
          ))}
        </div>
      )}

      {/* Caso adjunto + activación del Especialista Técnico */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px',
        padding: '12px 14px', marginBottom: '14px', borderRadius: '12px',
        background: 'rgba(3, 20, 16, 0.45)', border: '1px dashed rgba(16, 185, 129, 0.3)',
      }}>
        {!caso ? (
          <>
            <label className="btn-secondary" style={{ cursor: subiendo ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Paperclip size={16} />
              <span>{subiendo ? 'Leyendo documento…' : 'Subir caso (PDF/DOCX)'}</span>
              <input type="file" accept=".pdf,.docx,.doc,.txt,.rtf,.odt" onChange={subirCaso} disabled={subiendo} style={{ display: 'none' }} />
            </label>
            <span style={{ color: '#64748B', fontSize: '0.8rem' }}>
              Opcional: adjunta tu caso para habilitar al Especialista Técnico.
            </span>
          </>
        ) : (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a7f3d0', fontSize: '0.85rem', fontWeight: 600 }}>
              <FileText size={16} /> {caso.nombre}
            </span>
            <button onClick={quitarCaso} title="Quitar caso" style={{
              background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex',
            }}>
              <X size={16} />
            </button>

            <button
              onClick={alternarEspecialista}
              disabled={peritando}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', borderRadius: '999px', cursor: peritando ? 'wait' : 'pointer',
                fontSize: '0.82rem', fontWeight: 700,
                background: usarEspecialista ? 'rgba(168, 85, 247, 0.22)' : 'rgba(148, 163, 184, 0.12)',
                border: `1px solid ${usarEspecialista ? 'rgba(168, 85, 247, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
                color: usarEspecialista ? '#d8b4fe' : '#94A3B8',
              }}
            >
              <FlaskConical size={15} />
              <span>
                {peritando
                  ? 'Emitiendo dictamen pericial…'
                  : usarEspecialista ? 'Especialista Técnico activo' : 'Usar Especialista Técnico'}
              </span>
            </button>
          </>
        )}
      </div>

      {usarEspecialista && dictamen && (
        <div style={{
          background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.28)',
          borderRadius: '12px', padding: '14px', marginBottom: '14px', fontSize: '0.83rem', color: '#CBD5E1',
        }}>
          <div style={{ color: '#d8b4fe', fontWeight: 700, marginBottom: '6px' }}>
            🔬 Dictamen pericial — {dictamen.viabilidad_tecnica || 'N/D'}
            {dictamen.puntuacion_viabilidad != null && ` · ${dictamen.puntuacion_viabilidad}/10`}
          </div>
          <div style={{ lineHeight: 1.6 }}>{dictamen.dictamen_tecnico_resumen}</div>
          {(dictamen.matriz_riesgos || []).length > 0 && (
            <div style={{ marginTop: '8px', color: '#94A3B8' }}>
              Riesgos detectados: {(dictamen.matriz_riesgos || []).length} · Pregunta por cualquiera de ellos en el chat.
            </div>
          )}
        </div>
      )}

      <div style={{
        background: 'rgba(3, 20, 16, 0.5)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '12px',
        padding: '16px',
        minHeight: '220px',
        maxHeight: '380px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginBottom: '14px',
      }}>
        {mensajes.length === 0 && !enviando && (
          <div style={{ color: '#64748B', fontSize: '0.85rem', margin: 'auto', textAlign: 'center' }}>
            Ej: «¿Qué necesito para aprobar los planos de una ampliación?» ·
            «¿Cómo me afilio al seguro de salud?» · «¿En qué etapa está un proyecto de ley?»
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            flexDirection: m.rol === 'ciudadano' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: m.rol === 'ciudadano' ? 'rgba(0, 180, 216, 0.2)' : 'rgba(45, 212, 191, 0.2)',
            }}>
              {m.rol === 'ciudadano'
                ? <User size={16} color="#38bdf8" />
                : (m.logo ? <span style={{ fontSize: '15px' }}>{m.logo}</span> : <Bot size={16} color="#2dd4bf" />)}
            </div>
            <div>
              {m.rol === 'agente' && (
                <div style={{ fontSize: '0.72rem', color: '#2dd4bf', fontWeight: 700, marginBottom: '4px' }}>
                  {m.faceta}
                  {m.modelo && (
                    <span style={{ color: '#64748B', fontWeight: 500 }}>
                      {' '}· {m.modelo}{m.ms ? ` · ${(m.ms / 1000).toFixed(1)}s` : ''}
                    </span>
                  )}
                </div>
              )}
              <div style={m.rol === 'ciudadano'
                ? burbuja('rgba(0, 180, 216, 0.12)', 'rgba(0, 180, 216, 0.3)')
                : m.especialista
                ? burbuja('rgba(168, 85, 247, 0.1)', 'rgba(168, 85, 247, 0.3)')
                : burbuja('rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.28)')}>
                {m.texto}
              </div>
            </div>
          </div>
        ))}

        {enviando && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5eead4', fontSize: '0.82rem' }}>
            <Zap size={14} />
            <span>{usarEspecialista ? 'El Especialista Técnico está revisando tu caso…' : 'Enrutando tu consulta a la especialidad correcta…'}</span>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '10px', padding: '10px 14px', color: '#fca5a5',
          fontSize: '0.82rem', marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={enviar} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={usarEspecialista ? "Pregunta al Especialista Técnico sobre tu caso…" : "Escribe tu consulta ciudadana…"}
          disabled={enviando}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(3, 20, 16, 0.7)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#ffffff',
            outline: 'none',
          }}
        />
        <button type="submit" className="btn-primary" disabled={enviando || !texto.trim()}>
          <Send size={16} />
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
}
