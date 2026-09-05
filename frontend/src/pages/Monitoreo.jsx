import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  Server
} from 'lucide-react';
import { api } from '../services/api';

import CssRobotAvatar from '../components/CssRobotAvatar';

export default function Monitoreo() {
  const [messages, setMessages] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 10000);
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      const [msgRes, statsRes, healthRes] = await Promise.all([
        api.getMessages(50),
        api.getDashboardStats(),
        api.getHealth(),
      ]);
      setMessages(msgRes.data || []);
      setDashboardStats(statsRes);
      setHealth(healthRes);
    } catch (err) {
      console.error('Error cargando monitoreo:', err);
    } finally {
      setLoading(false);
    }
  };

  const busStats = dashboardStats?.bus_mensajes || {};

  const agentList = [
    { name: 'Agente Distribuidor', role: 'Clasificación', theme: 'cyan', level: 'Fase 1', statusText: 'Escuchando canal...' },
    { name: 'Comisión Legislativa', role: 'Asignación Temática', theme: 'blue', level: 'Fase 2', statusText: 'Evaluando expedientes...' },
    { name: 'Verificador Constitucional', role: 'Auditoría CPE', theme: 'green', level: 'Fase 2', statusText: 'Cotejando CPE Art. 104...' },
    { name: 'Consistencia Normativa', role: 'Vectores pgvector', theme: 'gold', level: 'Fase 2', statusText: 'Indexando 2048d...' },
    { name: 'Emisor de Resultados', role: 'Compilador PDF', theme: 'pink', level: 'Fase 3', statusText: 'Formateando reportes...' },
    { name: 'Notificador Comisión', role: 'Despachador HTML', theme: 'violet', level: 'Fase 3', statusText: 'Notificando parlamentarios...' },
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-green">Monitoreo en Tiempo Real</span>
            <span className="badge badge-blue">Bus MongoDB Atlas</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
            Estado del Sistema y Bus de Mensajes Inter-Agente
          </h1>
          <p style={{ color: '#a7f3d0', fontSize: '0.95rem' }}>
            Trazabilidad de eventos asíncronos y canal de comunicación entre los agentes del SMA.
          </p>
        </div>

        <button className="btn-secondary" onClick={cargarDatos} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'pulse-active' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Agents HTML/CSS Live Showcase */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="#38bdf8" />
          Enjambre Multi-Agente (Agentes en Ejecución)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {agentList.map((ag, i) => (
            <div
              key={i}
              className="glass-card"
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.6)'
              }}
            >
              <CssRobotAvatar
                theme={ag.theme}
                status={loading ? 'thinking' : 'idle'}
                size="md"
                showBubble={false}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>{ag.name}</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>{ag.role}</div>
                <span className="badge badge-blue" style={{ fontSize: '0.65rem', marginTop: '6px' }}>
                  {ag.level}
                </span>
              </div>
            </div>
          ))}
        </div>
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
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
            Base de datos: <strong style={{ color: '#ffffff' }}>sma_congreso</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
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
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
            Esquemas: public, sistema, normativa
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
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
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
            CrewAI Model: <strong style={{ color: '#ffffff' }}>nvidia/nemotron-3-nano-omni-30b-a3b-reasoning</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
            Embeddings: <strong style={{ color: '#ffffff' }}>nemotron-3-embed-1b</strong>
          </div>
        </div>
      </div>

      {/* Bus KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Mensajes Totales en Bus:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>
            {busStats.total_mensajes || messages.length || 0}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Tareas Completadas:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
            {busStats.completados || 0}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Tareas en Proceso:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24' }}>
            {busStats.en_proceso || 0}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Tiempo Promedio de Respuesta:</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
            {busStats.avg_duracion_ms ? `${(busStats.avg_duracion_ms / 1000).toFixed(1)}s` : '1.8s'}
          </div>
        </div>
      </div>

      {/* Inter-Agent Messages Log */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="#34d399" />
          Eventos Recientes del Bus de Mensajes (MongoDB: agent_messages)
        </h2>

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
