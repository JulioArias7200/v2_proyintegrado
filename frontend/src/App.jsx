import React, { useState, useEffect, useCallback } from 'react';
import { FileText, X, ExternalLink, Clock3, Activity, History } from 'lucide-react';
import Navbar from './components/Navbar';
import MesaPartes from './pages/MesaPartes';
import Expedientes from './pages/Expedientes';
import ConsistenciaNormativa from './pages/ConsistenciaNormativa';
import AtencionCiudadana from './pages/AtencionCiudadana';
import Monitoreo from './pages/Monitoreo';
import DespachoEjecutivo from './pages/DespachoEjecutivo';
import Login from './pages/Login';
import VoiceAssistantPage from './pages/VoiceAssistantPage';
import { api } from './services/api';
import { useAuth, esRolInterno } from './context/AuthContext';

const ACTIVE_CASE_KEY = 'sma_active_master_case_id';

function PersistentCaseContext({ caso, onClose }) {
  const [showPdf, setShowPdf] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const savedName = caso?.uploadStats?.saved_as || caso?.documentPdf?.saved_as || caso?.archivo_pdf;
  const hasPdf = Boolean(savedName && /\.pdf$/i.test(savedName));
  useEffect(() => {
    if (!showPdf || !hasPdf || !caso?.id) return undefined;
    let cancelled = false;
    let objectUrl = '';
    setPdfError('');
    setPdfUrl('');
    api.getCasoDocumento(caso.id).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    }).catch(err => { if (!cancelled) setPdfError(err.message); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [showPdf, hasPdf, caso?.id, savedName]);
  if (!caso) return null;
  const title = caso.title || caso.titulo || caso.documentName || 'Expediente seleccionado';
  const status = caso.estadoCompartido || (caso.isProcessing ? 'En ejecución' : caso.pipelineStep ? 'En seguimiento' : 'Recibido');
  const currentAgent = caso.agentesEnProceso?.length ? caso.agentesEnProceso.join(', ') : 'Sin agente activo';
  const stages = ['Presentación', 'Recepción', 'Revisión documental', 'Validación', 'Distribución', 'Asignación', 'Auditorías', 'Seguimiento', 'Cierre'];
  const stageIndex = Math.min(stages.length - 1, Math.max(0, caso.pipelineStep ? Math.floor(caso.pipelineStep / 2) : 0));
  const progress = Math.min(100, Math.max(4, Math.round((stageIndex + (caso.isProcessing ? 0.5 : 0)) / (stages.length - 1) * 100)));
  return <>
    <section aria-label="Contexto persistente del expediente" style={{ background: '#ffffff', borderBottom: '1px solid #d5e3ed', color: '#26445c', padding: '10px clamp(16px,3vw,40px)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 300px', minWidth: 220 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 9, background: '#e5f3fb', color: '#087db8' }}><FileText size={18}/></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#17628d', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Expediente activo · {caso.id || caso.fase1Data?.id_proyecto || 'Sin número asignado'}</div>
          <div title={title} style={{ color: '#183650', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: '#31536b' }}><Activity size={13} style={{ verticalAlign: 'middle', marginRight: 5 }}/>{status}</span>
        <span style={{ color: '#637e92' }}>Agente: {currentAgent}</span>
        <span style={{ color: '#637e92' }}>Etapa: {stages[stageIndex]}</span>
        <span style={{ color: '#637e92' }}><Clock3 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }}/>{caso.updatedAt ? new Date(caso.updatedAt).toLocaleString() : 'Etapa ' + (caso.pipelineStep || 0)}</span>
        <button type="button" onClick={() => setShowHistory(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #c9dbe7', borderRadius: 8, padding: '7px 9px', color: '#31536b', background: '#f8fbfd', cursor: 'pointer' }}><History size={14}/> Historial</button>
        {hasPdf ? <button type="button" onClick={() => setShowPdf(true)} style={{ border: 0, borderRadius: 8, padding: '8px 12px', color: '#06223d', background: '#38bdf8', fontWeight: 800, cursor: 'pointer' }}>Abrir PDF</button> : <span title="El expediente no tiene un PDF original disponible">PDF original no disponible</span>}
        <button type="button" onClick={onClose} aria-label="Quitar expediente del contexto" title="Quitar expediente del contexto" style={{ border: '1px solid rgba(148,163,184,.25)', background: 'transparent', color: '#94a3b8', borderRadius: 8, padding: 7, cursor: 'pointer' }}><X size={16}/></button>
      </div>
      <div aria-label={`Progreso aproximado del flujo: ${progress}%`} style={{ height: 3, background: '#dbe8f0' }}><div style={{ width: `${progress}%`, height: '100%', background: '#1592ca', transition: 'width .25s' }}/></div>
    </section>
    {showPdf && hasPdf && <div role="dialog" aria-modal="true" aria-label="Documento original" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(2,8,23,.82)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: 'min(1100px,96vw)', height: 'min(88vh,900px)', background: '#0b1d33', border: '1px solid #254765', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', color: '#f8fafc' }}><strong>{title} · Documento original</strong><div style={{ display: 'flex', gap: 8 }}>{pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>Abrir en pestaña <ExternalLink size={14}/></a>}<button onClick={() => setShowPdf(false)} aria-label="Cerrar visor" style={{ background: 'transparent', border: 0, color: '#e2e8f0', cursor: 'pointer' }}><X/></button></div></div>
        {pdfError ? <div role="alert" style={{ padding: 24, color: '#fecaca' }}>{pdfError}</div> : pdfUrl ? <iframe title={`PDF original: ${title}`} src={pdfUrl} style={{ flex: 1, width: '100%', border: 0, background: '#fff' }}/> : <div role="status" style={{ padding: 24, color: '#cbd5e1' }}>Cargando documento protegido…</div>}
      </div>
    </div>}
    {showHistory && <div role="dialog" aria-modal="true" aria-label="Historial del expediente" style={{ position: 'fixed', inset: 0, zIndex: 121, background: 'rgba(2,8,23,.78)', display: 'grid', placeItems: 'center', padding: 20 }}><div style={{ width: 'min(720px,96vw)', maxHeight: '82vh', overflow: 'auto', background: '#0b1d33', border: '1px solid #254765', borderRadius: 14, padding: 20, color: '#e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div><div style={{ color: '#7dd3fc', fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>Trazabilidad del expediente</div><strong>{title}</strong></div><button onClick={() => setShowHistory(false)} aria-label="Cerrar historial" style={{ background: 'transparent', border: 0, color: '#e2e8f0', cursor: 'pointer' }}><X/></button></div>{caso.pipelineLog?.length ? <ol style={{ margin: 0, paddingLeft: 22 }}>{[...caso.pipelineLog].reverse().map((item, index) => <li key={`${item.ts || index}-${index}`} style={{ padding: '8px 4px', borderBottom: '1px solid rgba(148,163,184,.12)' }}><strong>{item.etapa || 'Actualización'}</strong><div style={{ color: '#94a3b8', fontSize: 12 }}>{item.msg || item.estado || 'Evento registrado'} · {item.ts ? new Date(item.ts).toLocaleString() : 'Fecha no disponible'}</div></li>)}</ol> : <p style={{ color: '#94a3b8' }}>Este expediente aún no tiene movimientos registrados en su línea de tiempo.</p>}</div></div>}
  </>;
}

const FOOTER = (
  <footer style={{
    background: '#ffffff',
    borderTop: '1px solid #e2e8f0',
    padding: '24px',
    textAlign: 'center',
    color: '#475569',
    fontSize: '0.85rem',
  }}>
    <div style={{ maxWidth: '1720px', width: '96%', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
      <div>
        <strong style={{ color: '#0f172a' }}>SMA Congreso</strong> — Sistema Multi-Agente de Registro, Clasificación y Auditoría Parlamentaria
      </div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: '#64748b' }}>
        <span>FastAPI 0.110+</span>
        <span>•</span>
        <span>React + Vite</span>
        <span>•</span>
        <span>PostgreSQL Neon (pgvector)</span>
        <span>•</span>
        <span>MongoDB Atlas</span>
        <span>•</span>
        <span>NVIDIA NIM</span>
      </div>
    </div>
  </footer>
);

export default function App() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('mesa');
  const [healthStatus, setHealthStatus] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [casoCiudadano, setCasoCiudadano] = useState(null);
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  const [activeCase, setActiveCase] = useState(null);

  const setMasterCase = useCallback((caso) => {
    setActiveCase(caso || null);
    try {
      if (caso?.id) localStorage.setItem(ACTIVE_CASE_KEY, caso.id);
      else localStorage.removeItem(ACTIVE_CASE_KEY);
    } catch { /* La selección sigue disponible mientras la app permanezca abierta. */ }
  }, []);

  // Rehidrata el expediente desde MongoDB al recargar. El ID local solo identifica
  // qué registro pedir; los datos visibles siempre se recuperan del servidor.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refreshMasterCase = async () => {
      try {
        const id = localStorage.getItem(ACTIVE_CASE_KEY);
        if (!id) return;
        const res = await api.getCasosCompartidos();
        if (!cancelled) {
          const found = res.data.find(c => c.id === id) || null;
          setActiveCase(found);
          if (found && !esRolInterno(user.rol)) {
            setCasoCiudadano(found.id);
            setVerSeguimiento(true);
          }
          if (!found) localStorage.removeItem(ACTIVE_CASE_KEY);
        }
      } catch { /* Mesa de Partes mostrará el error de sincronización correspondiente. */ }
    };
    refreshMasterCase();
    const timer = setInterval(refreshMasterCase, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [user]);

  useEffect(() => {
    const seguir = event => {
      if (user?.rol !== 'Ciudadano' || !event.detail?.casoId) return;
      setCasoCiudadano(event.detail.casoId);
      setVerSeguimiento(true);
    };
    window.addEventListener('caso-ciudadano-presentado', seguir);
    return () => window.removeEventListener('caso-ciudadano-presentado', seguir);
  }, [user?.rol]);

  useEffect(() => {
    // Comprobar salud del backend periódicamente
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealthStatus(res);
      } catch (err) {
        setHealthStatus({ status: 'offline' });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Al iniciar sesión exitosamente, cerrar la pantalla de login
  useEffect(() => {
    if (user) setMostrarLogin(false);
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B2545', color: '#94A3B8' }}>
        Cargando sesión...
      </div>
    );
  }

  // ── Sin sesión: vista ciudadana pública (por defecto), meramente informativa ──
  if (!user) {
    if (mostrarLogin) {
      return <Login onBack={() => setMostrarLogin(false)} />;
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar
          activeTab="ciudadana"
          setActiveTab={() => { }}
          healthStatus={healthStatus}
          user={null}
          onLogout={null}
          simplified={true}
        />
        <main style={{ flex: 1 }}>
          <AtencionCiudadana isAuthenticated={false} onNavigateLogin={() => setMostrarLogin(true)} />
        </main>
        {FOOTER}
      </div>
    );
  }

  // ── Sesión Ciudadano: solo su vista interactiva (subir archivos, agente) ──
  if (!esRolInterno(user.rol)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar
          activeTab="ciudadana"
          setActiveTab={() => { }}
          healthStatus={healthStatus}
          user={user}
          onLogout={logout}
          simplified={true}
        />
        <main style={{ flex: 1 }}>
          <PersistentCaseContext caso={activeCase} onClose={() => setMasterCase(null)} />
          <nav aria-label="Participación y seguimiento" style={{ display: 'flex', gap: 12, padding: 16 }}>
            <button className="btn-secondary" onClick={() => setVerSeguimiento(false)}>Presentar consulta o iniciativa</button>
            <button className="btn-secondary" onClick={() => setVerSeguimiento(true)}>Ver agentes, flujo y observaciones</button>
          </nav>
          {verSeguimiento ? <MesaPartes key={user.usuario_id} currentUser={user} readOnly initialCaseId={casoCiudadano} onActiveCaseChange={setMasterCase} /> :
            <AtencionCiudadana isAuthenticated currentUser={user} onVerCaso={id => {
              setCasoCiudadano(id); setVerSeguimiento(true);
            }} />}
        </main>
        {FOOTER}
      </div>
    );
  }

  // ── Roles internos (Senador, Diputado, Operador_Mesa_Partes, etc.): panel completo ──
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthStatus={healthStatus}
        user={user}
        onLogout={logout}
      />

      <main style={{ flex: 1 }}>
        <PersistentCaseContext caso={activeCase} onClose={() => setMasterCase(null)} />
        {activeTab === 'mesa' && <MesaPartes onNavigateExpedientes={() => setActiveTab('expedientes')} onNavigateEjecutivo={() => setActiveTab('ejecutivo')} currentUser={user} onActiveCaseChange={setMasterCase} />}
        {activeTab === 'ejecutivo' && <DespachoEjecutivo currentUser={user} activeCase={activeCase} onActiveCaseChange={setMasterCase} />}
        {activeTab === 'expedientes' && <Expedientes />}
        {activeTab === 'consistencia' && <ConsistenciaNormativa />}
        {activeTab === 'ciudadana' && <AtencionCiudadana isAuthenticated={true} currentUser={user} />}
        {activeTab === 'voz' && <VoiceAssistantPage onNavigateTab={setActiveTab} />}
        {activeTab === 'monitoreo' && <Monitoreo />}
      </main>

      {FOOTER}
    </div>
  );
}
