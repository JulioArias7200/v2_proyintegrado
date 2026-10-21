import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, FileUp, Landmark, LockKeyhole, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PresentacionCiudadana({ textoInicial = '', archivoInicial = '', mostrarCasos = true, onVerCaso }) {
  const { user } = useAuth();
  const fileInput = useRef(null);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState(textoInicial);
  const [archivo, setArchivo] = useState(archivoInicial);
  const [documento, setDocumento] = useState(null);
  const [tipo, setTipo] = useState('iniciativa');
  const [destino, setDestino] = useState('Ambas');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [casos, setCasos] = useState([]);

  useEffect(() => { if (textoInicial) setTexto(prev => prev || textoInicial); }, [textoInicial]);
  useEffect(() => {
    if (!user || !mostrarCasos) return;
    let activo = true;
    const cargar = () => api.getCasosCompartidos().then(res => {
      if (activo) setCasos(res.data || []);
    }).catch(err => { if (activo) setError(err.message); });
    cargar();
    const timer = setInterval(cargar, 15000);
    return () => { activo = false; clearInterval(timer); };
  }, [user, mostrarCasos]);

  if (!user) return <section className="citizen-submit-card"><p>Inicia sesión para presentar una consulta o iniciativa ciudadana.</p></section>;

  const subir = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      const data = await api.uploadDocument(file);
      setTexto(data.texto_completo || data.texto_preview || '');
      setArchivo(file.name);
      setDocumento({ nombre: file.name, tipo: file.type || '', saved_as: data.saved_as,
        upload_id: data.upload_id, drive_link: data.drive_link, drive_file_id: data.drive_file_id,
        drive_status: data.drive_status });
    } catch (err) { setError(err.message || 'No se pudo cargar el archivo. Intenta nuevamente.'); }
    finally { setOcupado(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const enviar = async e => {
    e.preventDefault(); setOcupado(true); setError(''); setMensaje('');
    try {
      const res = await api.presentarCasoCiudadano({ titulo, texto, tipo, camara_destino: destino,
        nombre_archivo: archivo || null, documento_original: documento?.upload_id ? documento : null });
      const casoId = res.data.id;
      setMensaje(`Tu iniciativa fue recibida con el código ${casoId}. Puedes consultar su avance en “Ver agentes, flujo y observaciones”.`);
      setCasos(prev => [res.data, ...prev]);
      setTitulo(''); setTexto(''); setArchivo(''); setDocumento(null);
      onVerCaso?.(casoId);
      window.dispatchEvent(new CustomEvent('caso-ciudadano-presentado', { detail: { casoId } }));
    } catch (err) { setError(err.message || 'No se pudo enviar. Revisa los datos e inténtalo nuevamente.'); }
    finally { setOcupado(false); }
  };

  return <section className="citizen-submit-card" aria-labelledby="citizen-submit-title">
    <header className="citizen-submit-heading">
      <div className="citizen-submit-icon"><Landmark size={23} aria-hidden="true" /></div>
      <div>
        <span className="citizen-eyebrow">Participación ciudadana</span>
        <h2 id="citizen-submit-title">Presenta tu propuesta de ley</h2>
        <p>No necesitas redactarla en lenguaje jurídico. Cuéntanos qué problema quieres resolver y qué cambio propones.</p>
      </div>
    </header>

    <div className="citizen-steps" aria-label="Pasos para presentar una propuesta">
      <div><span><FileText size={17} /></span><p><strong>1. Explica tu idea</strong><small>Describe el problema y la solución.</small></p></div>
      <ArrowRight className="citizen-step-arrow" size={17} aria-hidden="true" />
      <div><span><FileUp size={17} /></span><p><strong>2. Adjunta tu borrador</strong><small>Opcional: PDF, Word o texto.</small></p></div>
      <ArrowRight className="citizen-step-arrow" size={17} aria-hidden="true" />
      <div><span><Send size={17} /></span><p><strong>3. Envía y sigue</strong><small>Recibirás un código de seguimiento.</small></p></div>
    </div>

    <form className="citizen-submit-form" onSubmit={enviar}>
      <div className="citizen-form-grid">
        <label>¿Qué deseas presentar?
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="iniciativa">Propuesta o iniciativa de ley</option>
            <option value="consulta">Consulta ciudadana</option>
          </select>
        </label>
        <label>¿A quién quieres enviarla?
          <select value={destino} onChange={e => setDestino(e.target.value)}>
            <option value="Ambas">A Diputados y Senadores</option><option value="Diputados">A Diputados</option><option value="Senadores">A Senadores</option>
          </select>
        </label>
      </div>
      <label>Título de tu propuesta
        <input required minLength={3} maxLength={200} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej.: Apoyo al riego para pequeños productores" />
      </label>
      <label>Cuéntanos tu propuesta
        <textarea required minLength={10} maxLength={300000} rows={6} value={texto} onChange={e => setTexto(e.target.value)} placeholder="¿Qué situación quieres mejorar? ¿Qué cambio propones? ¿A quiénes ayudaría?" />
        <small className="citizen-field-hint">Puedes escribir con tus propias palabras. El equipo legislativo revisará el contenido.</small>
      </label>

      <div className="citizen-upload-area">
        <input ref={fileInput} className="citizen-file-input" id="citizen-proposal-file" type="file" accept=".pdf,.docx,.doc,.txt" disabled={ocupado} onChange={subir} />
        {!documento ? <label className="citizen-upload-button" htmlFor="citizen-proposal-file">
          <span className="citizen-upload-icon"><FileUp size={21} /></span>
          <span><strong>{ocupado ? 'Estamos leyendo tu documento…' : 'Adjunta el borrador de tu proyecto'}</strong><small>PDF, Word o TXT · También puedes enviar solo tu descripción</small></span>
          <span className="citizen-upload-action">{ocupado ? <Sparkles size={18} className="pulse-active" /> : 'Elegir archivo'}</span>
        </label> : <div className="citizen-uploaded-file">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span><strong>{documento.nombre}</strong><small>{documento.drive_status === 'GUARDADO' ? 'Archivo guardado y listo para vincular a tu expediente' : 'Archivo listo para adjuntar'}</small></span>
          <button type="button" aria-label="Quitar documento" onClick={() => { setDocumento(null); setArchivo(''); }}><Trash2 size={17} /></button>
        </div>}
        {archivo && !documento && <small className="citizen-field-hint">Documento seleccionado: {archivo}</small>}
      </div>

      {error && <div className="citizen-message error" role="alert">{error}</div>}
      {mensaje && <div className="citizen-message success" role="status"><CheckCircle2 size={18} />{mensaje}</div>}
      <div className="citizen-submit-footer">
        <span><LockKeyhole size={15} /> Tu envío queda registrado para revisión y seguimiento.</span>
        <button className="citizen-submit-button" type="submit" disabled={ocupado || !titulo.trim() || !texto.trim()}>
          {ocupado ? 'Procesando…' : 'Enviar propuesta'} <Send size={17} />
        </button>
      </div>
      <p className="citizen-human-review"><ShieldCheck size={15} /> La IA ayuda a organizar la información; las decisiones las toman las autoridades y equipos legislativos.</p>
    </form>

    {mostrarCasos && <div className="citizen-tracking-list">
      <h3><CheckCircle2 size={18} /> Mis envíos y seguimiento</h3>
      {casos.length === 0 && <p>Aún no tienes propuestas registradas.</p>}
      {casos.map(caso => <article key={caso.id}>
        <div><strong>{caso.title || caso.documentName}</strong><small>{caso.id} · {caso.camaraDestino || 'Ambas cámaras'}</small></div>
        <span className="citizen-case-status">{caso.estadoCompartido || 'EN_SEGUIMIENTO'}</span>
        {onVerCaso && <button type="button" className="citizen-track-button" onClick={() => onVerCaso(caso.id)}>Ver avance <ArrowRight size={15} /></button>}
      </article>)}
    </div>}
  </section>;
}
