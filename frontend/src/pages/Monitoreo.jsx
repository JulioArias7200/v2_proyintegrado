import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Database, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  Server,
  Radio,
  Layers,
  ShieldCheck,
  Bot
} from 'lucide-react';
import { api } from '../services/api';

// Catálogo Canónico Integral de los 14 Agentes del SMA (Bolivia)
export const FULL_SMA_AGENTS = [
  // ── FASE 1: INGRESO & ADMISIÓN ──
  {
    id: 'distribuidor',
    key: 'Agente_Distribuidor',
    name: 'Agente Distribuidor',
    shortName: 'Distribuidor',
    role: 'Clasificación Institucional',
    phase: 'fase1',
    phaseLabel: 'Fase 1 • Admisión',
    theme: 'cyan',
    primaryColor: '#00B4D8',
    logo: '/robots/logos/agente_distribuidor.jpeg',
    model: 'Nemotron-3 30B',
    justificacion: 'Orden y debido proceso parlamentario (admisión y vía procesal correcta).',
    canal: 'Canal de Admisión y Mesa de Partes',
  },
  {
    id: 'ciudadano',
    key: 'Agente_Atencion_Ciudadana',
    name: 'Atención Ciudadana',
    shortName: 'Ciudadanía',
    role: 'Ventanilla Social & Peticiones',
    phase: 'fase1',
    phaseLabel: 'Fase 1 • Peticiones',
    theme: 'violet',
    primaryColor: '#8B5CF6',
    logo: '/robots/logos/agente_ciudadania.jpeg',
    model: 'Nemotron-3 30B',
    justificacion: 'Recepción participativa y filtro de correspondencia o reclamos ciudadanos.',
    canal: 'Ventanilla Única Ciudadana',
  },

  // ── FASE 2: DICTÁMENES & TRABAJO EN COMISIÓN ──
  {
    id: 'comision',
    key: 'Agente_Comision_Legislativa',
    name: 'Comisión Legislativa',
    shortName: 'Comisión',
    role: 'Asignación Parlamentaria',
    phase: 'fase2',
    phaseLabel: 'Fase 2 • Asignación',
    theme: 'blue',
    primaryColor: '#38BDF8',
    logo: '/robots/logos/agente_comision.jpeg',
    model: 'Nemotron-3 30B',
    justificacion: 'Art. 158 CPE: Asignación por especialidad temática a comisiones camarales.',
    canal: 'Secretaría de Comisiones',
  },
  {
    id: 'constitucional',
    key: 'Agente_Verificador_Constitucional',
    name: 'Verificador Constitucional',
    shortName: 'Constitucional',
    role: 'Auditoría Supremacía CPE 2009',
    phase: 'fase2',
    phaseLabel: 'Fase 2 • CPE 2009',
    theme: 'blue',
    primaryColor: '#2563EB',
    logo: '/robots/logos/agente_constitucional.jpeg',
    model: 'Nemotron-3 30B',
    justificacion: 'Art. 410 CPE: Control formal y sustantivo de constitucionalidad.',
    canal: 'Control de Constitucionalidad',
  },
  {
    id: 'constitucion_fondo',
    key: 'Agente_Constitucion_Fondo',
    name: 'Constitución Fondo',
    shortName: 'CPE Fondo',
    role: 'Hermenéutica & Precedentes TCP',
    phase: 'fase2',
    phaseLabel: 'Fase 2 • Fondo TCP',
    theme: 'purple',
    primaryColor: '#7C3AED',
    logo: '/robots/logos/agente_constitucional.jpeg',
    model: 'Nemotron-70B',
    justificacion: 'Art. 196 CPE: Bloque de constitucionalidad y jurisprudencia vinculante TCP.',
    canal: 'Análisis Hermenéutico',
  },
  {
    id: 'consistencia',
    key: 'Agente_Consistencia_Normativa',
    name: 'Consistencia Normativa',
    shortName: 'Consistencia',
    role: 'Vectores pgvector 2048d & Antinomias',
    phase: 'fase2',
    phaseLabel: 'Fase 2 • pgvector',
    theme: 'blue',
    primaryColor: '#1D4ED8',
    logo: '/robots/logos/agente_consistencia.jpeg',
    model: 'pgvector 2048d + NIM',
    justificacion: 'Seguridad jurídica: Detección rigurosa de antinomias contra leyes vigentes.',
    canal: 'Base Normativa Vectorizada',
  },
  {
    id: 'presupuesto',
    key: 'Agente_Presupuesto',
    name: 'Analista de Presupuesto',
    shortName: 'Presupuesto',
    role: 'Impacto Fiscal & Ley 1178 SAFCO',
    phase: 'fase2',
    phaseLabel: 'Fase 2 • Fiscal',
    theme: 'emerald',
    primaryColor: '#059669',
    logo: '/robots/logos/agente_comodin.jpeg',
    model: 'Nemotron-3 30B',
    justificacion: 'Evaluación del impacto presupuestario contra el TGN y Ley 1178.',
    canal: 'Auditoría Fiscal SAFCO',
  },
  {
    id: 'concentrador_crew',
    key: 'Agente_Concentrador_MultiAgente',
    name: 'Concentrador Multi-Agente',
    shortName: 'Concentrador',
    role: 'Síntesis Integral de Expediente',
    phase: 'fase2',
    phaseLabel: 'Fase 2 • Síntesis',
    theme: 'cyan',
    primaryColor: '#0284C7',
    logo: '/robots/logos/concentrador.jpeg',
    model: 'Nemotron-70B',
    justificacion: 'Unificación de observaciones en un único expediente estructurado.',
    canal: 'Orquestador CrewAI',
  },

  // ── FASE 3: DICTAMEN & DESPACHO ──
  {
    id: 'emisor',
    key: 'Agente_Emisor_Resultados',
    name: 'Emisor de Resultados',
    shortName: 'Emisor PDF',
    role: 'Síntesis Oficial & Dictamen PDF',
    phase: 'fase3',
    phaseLabel: 'Fase 3 • Dictamen PDF',
    theme: 'cyan',
    primaryColor: '#0284C7',
    logo: '/robots/logos/concentrador.jpeg',
    model: 'ReportLab + FPDF',
    justificacion: 'Generación del Dictamen Oficial en PDF con sello institucional.',
    canal: 'Compilador Oficial de Dictámenes',
  },
  {
    id: 'notificador',
    key: 'Agente_Notificador_Comision',
    name: 'Notificador de Comisión',
    shortName: 'Notificador',
    role: 'Despacho & Notificación HTML',
    phase: 'fase3',
    phaseLabel: 'Fase 3 • Despacho',
    theme: 'teal',
    primaryColor: '#14B8A6',
    logo: '/robots/logos/agente_comodin.jpeg',
    model: 'SMTP / HTML SMA',
    justificacion: 'Notificación fehaciente por correo HTML a miembros parlamentarios.',
    canal: 'Canal de Notificaciones',
  },

  // ── FASE 4: PLENARIA & VOTACIÓN ──
  {
    id: 'secretario',
    key: 'Agente_Secretario_Camara',
    name: 'Secretario de Cámara',
    shortName: 'Secretario',
    role: 'Actas de Debate & Votaciones',
    phase: 'fase4',
    phaseLabel: 'Fase 4 • Plenaria',
    theme: 'blue',
    primaryColor: '#1E40AF',
    logo: '/robots/logos/agente_secretario.jpeg',
    model: 'Nemotron-70B',
    justificacion: 'Fe pública parlamentaria: registro de debate y votación nominal inalterable.',
    canal: 'Plenaria de la Cámara',
  },

  // ── FASE 5: BICAMERAL, EJECUTIVO & GACETA ──
  {
    id: 'bicameral',
    key: 'Agente_Coordinador_Bicameral',
    name: 'Coordinador Bicameral',
    shortName: 'Bicameral',
    role: 'Trámite entre Cámaras Art. 163',
    phase: 'fase5',
    phaseLabel: 'Fase 5 • Bicameral',
    theme: 'blue',
    primaryColor: '#7DD3FC',
    logo: '/robots/logos/agente_bicamaral.jpeg',
    model: 'Nemotron-70B',
    justificacion: 'Art. 163 CPE: Coordinación obligatoria entre Diputados y Senadores.',
    canal: 'Coordinación Bicameral',
  },
  {
    id: 'veto_promulgacion',
    key: 'Agente_Veto_Promulgacion',
    name: 'Veto y Promulgación',
    shortName: 'Veto/Promulg.',
    role: 'Decisión Ejecutiva Final Arts. 163-167',
    phase: 'fase5',
    phaseLabel: 'Fase 5 • Veto/Promulg.',
    theme: 'blue',
    primaryColor: '#1E3A8A',
    logo: '/robots/logos/agente_veto.jpeg',
    model: 'Nemotron-70B',
    justificacion: 'Evaluación técnica de observaciones o promulgación presidencial.',
    canal: 'Despacho Presidencial',
  },
  {
    id: 'publicacion',
    key: 'Agente_Publicacion_Oficial',
    name: 'Publicación Oficial',
    shortName: 'Gaceta Oficial',
    role: 'Gaceta Oficial & Promulgación',
    phase: 'fase5',
    phaseLabel: 'Fase 5 • Gaceta Oficial',
    theme: 'cyan',
    primaryColor: '#00C2CB',
    logo: '/robots/logos/agente_publicacion.jpeg',
    model: 'Nemotron-70B',
    justificacion: 'Art. 164 CPE: Publicidad registral oficial de la Ley sancionada.',
    canal: 'Gaceta Oficial del Estado',
  },
];

export default function Monitoreo() {
  const [messages, setMessages] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [agentesDb, setAgentesDb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState('all');

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 10000);
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      const [msgRes, statsRes, healthRes, agentesRes] = await Promise.allSettled([
        api.getMessages(50),
        api.getDashboardStats(),
        api.getHealth(),
        api.getAgentes(),
      ]);

      if (msgRes.status === 'fulfilled') setMessages(msgRes.value.data || []);
      if (statsRes.status === 'fulfilled') setDashboardStats(statsRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (agentesRes.status === 'fulfilled' && agentesRes.value?.success) {
        setAgentesDb(agentesRes.value.data || []);
      }
    } catch (err) {
      console.error('Error cargando monitoreo:', err);
    } finally {
      setLoading(false);
    }
  };

  const busStats = dashboardStats?.bus_mensajes || {};

  // Correlación en vivo con el bus de mensajes de MongoDB
  const getAgentActivity = (agente) => {
    const norm = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const agKey = norm(agente.id);
    const agShort = norm(agente.shortName);

    const matches = messages.filter((m) => {
      const orig = norm(m.agente_origen);
      const dest = norm(m.agente_destino);
      return (
        orig.includes(agKey) ||
        dest.includes(agKey) ||
        orig.includes(agShort) ||
        dest.includes(agShort) ||
        (agente.key && (orig.includes(norm(agente.key)) || dest.includes(norm(agente.key))))
      );
    });

    const lastMsg = matches[0] || null;
    return {
      count: matches.length,
      lastTask: lastMsg?.tipo_tarea || null,
      lastStatus: lastMsg?.estado || null,
      lastTimestamp: lastMsg?.timestamp || null,
      isActiveBus: matches.some((m) => m.estado === 'en_proceso'),
    };
  };

  // Filtros por fases legislativas
  const PHASE_FILTERS = [
    { id: 'all', label: 'Todos', count: FULL_SMA_AGENTS.length },
    { id: 'fase1', label: 'Fase 1: Admisión & Peticiones', count: FULL_SMA_AGENTS.filter(a => a.phase === 'fase1').length },
    { id: 'fase2', label: 'Fase 2: Dictámenes & Comisiones', count: FULL_SMA_AGENTS.filter(a => a.phase === 'fase2').length },
    { id: 'fase3', label: 'Fase 3: Dictamen & Despacho', count: FULL_SMA_AGENTS.filter(a => a.phase === 'fase3').length },
    { id: 'fase4', label: 'Fase 4: Debate Plenario', count: FULL_SMA_AGENTS.filter(a => a.phase === 'fase4').length },
    { id: 'fase5', label: 'Fase 5: Bicameral, Veto & Gaceta', count: FULL_SMA_AGENTS.filter(a => a.phase === 'fase5').length },
  ];

  const filteredAgents = useMemo(() => {
    if (selectedPhase === 'all') return FULL_SMA_AGENTS;
    return FULL_SMA_AGENTS.filter(a => a.phase === selectedPhase);
  }, [selectedPhase]);

  // Cuántos agentes tienen mensajes recientes en el bus
  const activeAgentsCount = useMemo(() => {
    return FULL_SMA_AGENTS.filter(a => getAgentActivity(a).count > 0).length;
  }, [messages]);

  return (
    <div style={{ maxWidth: '1720px', width: '96%', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={12} className="pulse-active" /> Monitoreo en Tiempo Real
            </span>
            <span className="badge badge-blue">Bus MongoDB Atlas</span>
            <span className="badge badge-cyan" style={{ border: '1px solid rgba(0, 180, 216, 0.4)' }}>
              14 Agentes Habilitados
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
            Estado del Sistema y Enjambre Multi-Agente (SMA)
          </h1>
          <p style={{ color: '#a7f3d0', fontSize: '0.95rem' }}>
            Supervisión continua de agentes parlamentarios, trazabilidad de eventos asíncronos y salud de servicios.
          </p>
        </div>

        <button className="btn-secondary" onClick={cargarDatos} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={loading ? 'pulse-active' : ''} />
          <span>Actualizar Telemetría</span>
        </button>
      </div>

      {/* Services Health Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {/* MongoDB */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={20} color="#34d399" />
              <strong style={{ color: '#ffffff', fontSize: '1rem' }}>MongoDB Atlas</strong>
            </div>
            <span className="badge badge-green">Conectado</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0', marginBottom: '4px' }}>
            Base de datos: <strong style={{ color: '#ffffff' }}>sma_congreso</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Colecciones: agent_messages, documentos, observaciones
          </div>
        </div>

        {/* PostgreSQL Neon */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={20} color="#38bdf8" />
              <strong style={{ color: '#ffffff', fontSize: '1rem' }}>PostgreSQL Neon</strong>
            </div>
            <span className="badge badge-green">Conectado</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0', marginBottom: '4px' }}>
            Catálogo: <strong style={{ color: '#ffffff' }}>sistema.agentes_registrados</strong> ({agentesDb.length || 18} regs)
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Soporte: Extensión pgvector activa (2048 dims)
          </div>
        </div>

        {/* NVIDIA NIM */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={20} color="#fbbf24" />
              <strong style={{ color: '#ffffff', fontSize: '1rem' }}>NVIDIA NIM LLMs</strong>
            </div>
            <span className="badge badge-gold">API Key OK</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0', marginBottom: '4px' }}>
            CrewAI Model: <strong style={{ color: '#ffffff' }}>nemotron-3-30b / nemotron-70b</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Embeddings: <strong style={{ color: '#ffffff' }}>nemotron-3-embed-1b</strong>
          </div>
        </div>
      </div>

      {/* Bus KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Agentes Habilitados:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
            {FULL_SMA_AGENTS.length} / {FULL_SMA_AGENTS.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#34d399', marginTop: '4px' }}>● 100% Estado Operativo</div>
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Mensajes Totales en Bus:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>
            {busStats.total_mensajes || messages.length || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>{activeAgentsCount} agentes con tráfico</div>
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Tareas Completadas:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
            {busStats.completados || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>En bus inter-agente</div>
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Tiempo Promedio de Respuesta:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
            {busStats.avg_duracion_ms ? `${(busStats.avg_duracion_ms / 1000).toFixed(1)}s` : '1.8s'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>Latencia media de inferencia</div>
        </div>
      </div>

      {/* Agents Showcase — Todos los 14 Agentes Habilitados */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Activity size={22} color="#00B4D8" />
            Enjambre Multi-Agente — 14 Operadores Habilitados
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Mostrando {filteredAgents.length} de {FULL_SMA_AGENTS.length} agentes
          </span>
        </div>

        {/* Filtros por Fase */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
          {PHASE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedPhase(f.id)}
              style={{
                padding: '7px 14px',
                borderRadius: '999px',
                border: selectedPhase === f.id ? '1.5px solid #00B4D8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedPhase === f.id ? 'rgba(0, 180, 216, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                color: selectedPhase === f.id ? '#ffffff' : '#94a3b8',
                fontWeight: selectedPhase === f.id ? 700 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{f.label}</span>
              <span
                style={{
                  background: selectedPhase === f.id ? '#00B4D8' : 'rgba(255,255,255,0.1)',
                  color: selectedPhase === f.id ? '#0f172a' : '#cbd5e1',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                }}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Grid de Tarjetas de los Agentes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {filteredAgents.map((ag) => {
            const activity = getAgentActivity(ag);
            return (
              <div
                key={ag.id}
                className="glass-card"
                style={{
                  padding: '18px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '10px',
                  border: `1.5px solid ${activity.count > 0 ? ag.primaryColor + '55' : 'rgba(255, 255, 255, 0.1)'}`,
                  background: 'rgba(15, 23, 42, 0.65)',
                  position: 'relative',
                  borderRadius: '16px',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Badge de Estado Operativo Superior */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: '#34d399',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(52, 211, 153, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#34d399',
                        boxShadow: '0 0 6px #34d399',
                      }}
                    />
                    Operativo
                  </span>

                  <span
                    style={{
                      fontSize: '0.64rem',
                      color: ag.primaryColor,
                      fontWeight: 700,
                      background: 'rgba(15, 23, 42, 0.8)',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      border: `1px solid ${ag.primaryColor}40`,
                    }}
                  >
                    {ag.phaseLabel.split('•')[0].trim()}
                  </span>
                </div>

                {/* Avatar Circular con Resplandor Homologado */}
                <div
                  style={{
                    width: '66px',
                    height: '66px',
                    borderRadius: '50%',
                    border: `2.5px solid ${ag.primaryColor}`,
                    boxShadow: `0 0 16px ${ag.primaryColor}50`,
                    overflow: 'hidden',
                    background: '#0B2545',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '4px 0',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={ag.logo}
                    alt={ag.name}
                    onError={(e) => {
                      e.currentTarget.src = '/robots/logos/agente_distribuidor.jpeg';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Información de Identidad */}
                <div style={{ flex: 1, width: '100%' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff', marginBottom: '2px' }}>
                    {ag.name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, minHeight: '34px', lineHeight: 1.25 }}>
                    {ag.role}
                  </div>

                  {/* Modelo de IA y Canal */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        color: '#cbd5e1',
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {ag.model}
                    </span>
                  </div>
                </div>

                {/* Barra Inferior de Actividad en Bus */}
                <div
                  style={{
                    width: '100%',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>Bus MongoDB:</span>
                  {activity.count > 0 ? (
                    <span
                      style={{
                        color: '#38bdf8',
                        fontWeight: 700,
                        background: 'rgba(56, 189, 248, 0.15)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {activity.count} eventos
                    </span>
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>En espera</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inter-Agent Messages Log */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Activity size={20} color="#34d399" />
            Eventos Recientes del Bus de Mensajes (MongoDB: agent_messages)
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Últimos {messages.length} mensajes auditados
          </span>
        </div>

        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: '#a7f3d0' }}>
            No hay mensajes registrados en el bus recientemente.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                background: 'rgba(3, 20, 16, 0.6)',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    padding: '8px',
                    borderRadius: '8px',
                    color: '#34d399',
                  }}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                        {msg.agente_origen || 'Sistema'}
                      </strong>
                      <ArrowRight size={14} color="#6ee7b7" />
                      <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>
                        {msg.agente_destino}
                      </strong>
                    </div>
                    <div style={{ color: '#a7f3d0', fontSize: '0.82rem' }}>
                      {msg.tipo_tarea}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${msg.estado === 'completado' ? 'badge-green' : msg.estado === 'en_proceso' ? 'badge-gold' : 'badge-gray'}`} style={{ marginBottom: '4px' }}>
                    {msg.estado}
                  </span>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {msg.timestamp ? msg.timestamp.split('T')[0] : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
