import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PresentacionCiudadana({ textoInicial = '', archivoInicial = '', mostrarCasos = true, onVerCaso }) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState(textoInicial);
  const [archivo, setArchivo] = useState(archivoInicial);
  const [tipo, setTipo] = useState('consulta');
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
  if (!user) return <p>Inicie sesión para presentar una consulta o iniciativa a una cámara.</p>;

  const subir = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcupado(true); setError('');
    try {
      const data = await api.uploadDocument(file);
      setTexto(data.texto_completo || data.texto_preview || '');
      setArchivo(file.name);
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };
  const enviar = async e => {
    e.preventDefault(); setOcupado(true); setError(''); setMensaje('');
    try {
      const res = await api.presentarCasoCiudadano({ titulo, texto, tipo, camara_destino: destino, nombre_archivo: archivo || null });
      setMensaje(`Caso ${res.data.id} recibido para ${destino}. Los agentes lo procesarán hasta el Concentrador; después continuará un Diputado o Senador.`);
      setCasos(prev => [res.data, ...prev]);
      setTitulo(''); setTexto(''); setArchivo('');
      onVerCaso?.(res.data.id);
      window.dispatchEvent(new CustomEvent('caso-ciudadano-presentado', { detail: { casoId: res.data.id } }));
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };
  return <section className="revision-panel">
    <h2>Enviar consulta o iniciativa a las cámaras</h2>
    <p>El caso queda guardado en el servidor y puede consultarse desde otros equipos.</p>
    <form onSubmit={enviar} style={{ display: 'grid', gap: 12 }}>
      <label>Tipo<select value={tipo} onChange={e => setTipo(e.target.value)}>
        <option value="consulta">Consulta ciudadana</option><option value="iniciativa">Iniciativa ciudadana</option>
      </select></label>
      <label>Cámara destinataria<select value={destino} onChange={e => setDestino(e.target.value)}>
        <option>Ambas</option><option>Diputados</option><option>Senadores</option>
      </select></label>
      <label>Título<input required minLength={3} maxLength={200} value={titulo} onChange={e => setTitulo(e.target.value)} /></label>
      <label>Contenido<textarea required minLength={10} maxLength={300000} rows={6} value={texto} onChange={e => setTexto(e.target.value)} /></label>
      <label>Documento opcional<input type="file" accept=".pdf,.docx,.txt" disabled={ocupado} onChange={subir} /></label>
      {archivo && <p>Documento: {archivo}</p>}
      <button className="btn-primary" type="submit" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Presentar caso a la cámara'}</button>
    </form>
    {mensaje && <p role="status">{mensaje}</p>}
    {error && <p role="alert">{error}</p>}
    {mostrarCasos && <div>
      <h3>Casos compartidos y seguimiento</h3>
      {casos.length === 0 && <p>No hay casos compartidos todavía.</p>}
      {casos.map(caso => <article key={caso.id} style={{ borderBottom: '1px solid #334155', padding: 12 }}>
        <strong>{caso.title || caso.documentName}</strong>
        <p>{caso.id} · Destino: {caso.camaraDestino} · Autor: {caso.autorCaso || caso.nombreAutor}</p>
        <p>{caso.estadoCompartido || 'EN_SEGUIMIENTO'} · Paso {caso.pipelineStep}</p>
        {onVerCaso && <button type="button" className="btn-secondary" onClick={() => onVerCaso(caso.id)}>Ver flujo y observaciones</button>}
        {caso.errorMessage && <p>{caso.errorMessage}</p>}
        {caso.concentradorData?.expediente_consolidado?.resumen_ejecutivo && <p>{caso.concentradorData.expediente_consolidado.resumen_ejecutivo}</p>}
      </article>)}
    </div>}
  </section>;
}
