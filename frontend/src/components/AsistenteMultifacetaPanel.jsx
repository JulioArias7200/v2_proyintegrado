import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Bot, Building2, CheckCircle2, FileText, FileUp, FlaskConical,
  GraduationCap, HeartPulse, Landmark, Leaf, LockKeyhole, MessageCircle,
  Paperclip, Scale, Send, ShieldCheck, Sparkles, User, WalletCards, X, Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const categoriaVisual = (nombre = '') => {
  const n = nombre.toLowerCase();
  if (/salud|seguro|médic/.test(n)) return { Icon: HeartPulse, ejemplo: '¿Cómo puedo acceder a un servicio de salud?' };
  if (/educ|escuela|univers/.test(n)) return { Icon: GraduationCap, ejemplo: '¿Qué apoyo existe para estudiantes?' };
  if (/arquitect|vivienda|constru|planos/.test(n)) return { Icon: Building2, ejemplo: '¿Qué requisitos necesito para aprobar los planos de una ampliación?' };
  if (/ley|legis|congreso|cámara|camara/.test(n)) return { Icon: Landmark, ejemplo: '¿En qué etapa está un proyecto de ley?' };
  if (/norm|juríd|jurid|legal/.test(n)) return { Icon: Scale, ejemplo: 'Necesito orientación sobre una norma vigente.' };
  if (/econom|finan|presup|impuesto/.test(n)) return { Icon: WalletCards, ejemplo: '¿Qué apoyo o trámite corresponde a mi situación?' };
  if (/agri|ambien|rural|tierra/.test(n)) return { Icon: Leaf, ejemplo: '¿Qué programa puede ayudar a mi comunidad?' };
  return { Icon: MessageCircle, ejemplo: `Necesito orientación sobre ${nombre.toLowerCase()}.` };
};

export default function AsistenteMultifacetaPanel({ sesionId = null, onNavigateLogin }) {
  const { user } = useAuth();
  const [facetas, setFacetas] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [invitado, setInvitado] = useState(false);
  const [caso, setCaso] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [usarEspecialista, setUsarEspecialista] = useState(false);
  const [dictamen, setDictamen] = useState(null);
  const [peritando, setPeritando] = useState(false);
  const finRef = useRef(null);
  const textoRef = useRef(null);
  const tieneAccesoChat = Boolean(user || invitado);

  useEffect(() => {
    api.getAgentesCiudadanos(true)
      .then((res) => setFacetas(res.data || []))
      .catch((err) => console.error('Error cargando facetas ciudadanas:', err));
  }, []);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, enviando]);

  const procesarArchivo = async archivo => {
    if (!archivo) return;
    const extension = archivo.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(extension)) {
      setError('Elige un archivo PDF o DOCX.');
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setError('El archivo supera el máximo de 10 MB. Elige uno más pequeño.');
      return;
    }
    setSubiendo(true); setError(null);
    try {
      const res = await api.uploadDocument(archivo);
      setCaso({ nombre: archivo.name, texto: res.texto_completo || res.texto_preview || '' });
      setDictamen(null); setUsarEspecialista(false);
    } catch (err) {
      setError(err.message || 'No se pudo leer el documento.');
    } finally { setSubiendo(false); }
  };

  const subirCaso = e => { procesarArchivo(e.target.files?.[0]); e.target.value = ''; };
  const quitarCaso = () => { setCaso(null); setDictamen(null); setUsarEspecialista(false); };

  const alternarEspecialista = async () => {
    if (usarEspecialista) { setUsarEspecialista(false); return; }
    setUsarEspecialista(true);
    if (dictamen || !caso?.texto) return;
    setPeritando(true); setError(null);
    try {
      const res = await api.dictamenEspecialista({ casoTexto: caso.texto, casoNombre: caso.nombre, sesionId });
      setDictamen(res.dictamen || null);
    } catch (err) {
      setError(err.message || 'No se pudo emitir el dictamen técnico.');
      setUsarEspecialista(false);
    } finally { setPeritando(false); }
  };

  const enviar = async e => {
    e?.preventDefault();
    const consulta = texto.trim();
    if (!consulta || enviando) return;
    setTexto(''); setError(null);
    setMensajes(prev => [...prev, { rol: 'ciudadano', texto: consulta }]);
    setEnviando(true);
    try {
      const res = await api.chatCiudadano({
        mensaje: consulta, sesionId, casoTexto: caso?.texto || null, casoNombre: caso?.nombre || null,
        usarEspecialista: usarEspecialista && !!caso?.texto, dictamen,
      });
      if (res.dictamen) setDictamen(res.dictamen);
      setMensajes(prev => [...prev, {
        rol: 'agente', texto: res.reply, faceta: res.agente_nombre, logo: res.agente_logo,
        modelo: res.modelo_usado, ms: res.duracion_ms, especialista: !!res.especialista,
      }]);
    } catch (err) { setError(err.message || 'No se pudo contactar al asistente ciudadano.'); }
    finally { setEnviando(false); }
  };

  const elegirCategoria = nombre => {
    setTexto(categoriaVisual(nombre).ejemplo);
    requestAnimationFrame(() => textoRef.current?.focus());
  };

  return (
    <section className="citizen-chat-card" aria-labelledby="citizen-chat-title">
      <div className="citizen-chat-welcome">
        <div className="citizen-chat-avatar">
          <img src="/robots/logos/agente_ciudadania.jpeg" alt="" />
          <span aria-label="Agente activo"><CheckCircle2 size={15} /></span>
        </div>
        <div className="citizen-chat-welcome-copy">
          <span className="citizen-chat-active"><i /> Agente IA activo</span>
          <h2 id="citizen-chat-title">Hola{user?.nombre_completo ? `, ${user.nombre_completo.trim().split(/\s+/)[0]}` : ''}. Soy tu asistente ciudadano.</h2>
          <p>¿En qué te ayudo hoy? Escribe tu consulta con tus propias palabras y te orientaré.</p>
        </div>
        <Sparkles className="citizen-chat-sparkle" size={24} aria-hidden="true" />
      </div>

      {!tieneAccesoChat ? <div className="citizen-chat-access">
        <div><LockKeyhole size={19} /><span><strong>Elige cómo continuar</strong><small>Inicia sesión para adjuntar documentos o continúa como invitado para consultar.</small></span></div>
        <div className="citizen-chat-access-actions">
          {onNavigateLogin && <button type="button" className="citizen-login-button" onClick={onNavigateLogin}>Iniciar sesión para consultar <ArrowRight size={17} /></button>}
          <button type="button" className="citizen-guest-button" onClick={() => setInvitado(true)}>Continuar como invitado</button>
        </div>
      </div> : <>
        {!user && <div className="citizen-guest-notice"><User size={15} /> Estás consultando como invitado. Para adjuntar un caso, inicia sesión.</div>}

        {facetas.length > 0 && <div className="citizen-chat-categories" aria-label="Temas frecuentes">
          <strong>Elige un tema para empezar</strong>
          <div>{facetas.map(f => {
            const { Icon } = categoriaVisual(f.nombre);
            return <button key={f.id} type="button" onClick={() => elegirCategoria(f.nombre)}>
              <Icon size={16} aria-hidden="true" /><span>{f.nombre}</span>
            </button>;
          })}</div>
        </div>}

        {!caso ? <div className={`citizen-chat-dropzone${!user ? ' locked' : ''}`}
          onDragOver={e => { if (user) e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); if (user) procesarArchivo(e.dataTransfer.files?.[0]); }}>
          <div className="citizen-drop-icon"><FileUp size={21} /></div>
          <div className="citizen-drop-copy"><strong>{!user ? '¿Quieres adjuntar un caso?' : 'Arrastra tu caso aquí'}</strong>
            <small>{!user ? 'Inicia sesión para subir documentos y analizarlos.' : 'Formatos aceptados: PDF, DOCX (máx. 10 MB).'}</small></div>
          {user ? <label className="citizen-drop-button">
            <input type="file" accept=".pdf,.docx" disabled={subiendo} onChange={subirCaso} />
            <Paperclip size={16} /> {subiendo ? 'Leyendo archivo…' : 'Haz clic para buscar'}
          </label> : <button type="button" className="citizen-drop-button" onClick={onNavigateLogin}>Iniciar sesión</button>}
        </div> : <div className="citizen-chat-case">
          <FileText size={18} /><span><strong>{caso.nombre}</strong><small>Documento listo para consultar</small></span>
          <button type="button" onClick={quitarCaso} aria-label="Quitar documento"><X size={17} /></button>
          <button type="button" className={`citizen-expert-button${usarEspecialista ? ' active' : ''}`} onClick={alternarEspecialista} disabled={peritando}>
            <FlaskConical size={15} />{peritando ? 'Analizando…' : usarEspecialista ? 'Especialista activo' : 'Análisis técnico'}
          </button>
        </div>}

        {usarEspecialista && dictamen && <div className="citizen-expert-result">
          <strong><ShieldCheck size={16} /> Dictamen técnico: {dictamen.viabilidad_tecnica || 'En revisión'}
            {dictamen.puntuacion_viabilidad != null && ` · ${dictamen.puntuacion_viabilidad}/10`}</strong>
          <p>{dictamen.dictamen_tecnico_resumen}</p>
        </div>}

        <div className="citizen-chat-transcript" aria-live="polite">
          {mensajes.length === 0 && !enviando && <div className="citizen-chat-empty">
            <Bot size={23} /><strong>Tu conversación empieza aquí</strong><span>Prueba una consulta sugerida o escribe tu pregunta abajo.</span>
            <div><button type="button" onClick={() => elegirCategoria('Arquitectura')}>¿Qué necesito para aprobar los planos de una ampliación?</button>
              <button type="button" onClick={() => elegirCategoria('Legislación')}>¿En qué etapa está un proyecto de ley?</button></div>
          </div>}
          {mensajes.map((m, i) => <div key={i} className={`citizen-chat-message ${m.rol}`}>
            <span className="citizen-message-avatar">{m.rol === 'ciudadano' ? <User size={16} /> : (m.logo || <Bot size={16} />)}</span>
            <div className="citizen-message-content">
              {m.rol === 'agente' && <small>{m.faceta || 'Asistente ciudadano'}{m.ms ? ` · ${(m.ms / 1000).toFixed(1)} s` : ''}</small>}
              <p>{m.texto}</p>
            </div>
          </div>)}
          {enviando && <div className="citizen-chat-loading"><Zap size={15} />{usarEspecialista ? 'Revisando tu caso…' : 'Buscando orientación para tu consulta…'}</div>}
          <div ref={finRef} />
        </div>

        {error && <div className="citizen-chat-error" role="alert">{error}</div>}
        <form className="citizen-chat-composer" onSubmit={enviar}>
          <label htmlFor="citizen-chat-input">Escribe tu consulta</label>
          <textarea id="citizen-chat-input" ref={textoRef} value={texto} onChange={e => setTexto(e.target.value)}
            placeholder={usarEspecialista ? 'Pregunta sobre el documento que adjuntaste…' : 'Ej.: ¿Qué necesito para aprobar los planos de una ampliación?'}
            disabled={enviando} rows={3} />
          <div className="citizen-chat-composer-footer">
            <small>El asistente elegirá automáticamente la especialidad adecuada.</small>
            <button type="submit" disabled={enviando || !texto.trim()}><Send size={16} /> Enviar consulta</button>
          </div>
        </form>
      </>}
    </section>
  );
}
