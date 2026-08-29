import React, { useState, useEffect } from 'react';
import { 
  FolderArchive, 
  Search, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  FileText, 
  X, 
  Activity, 
  Scale, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export default function Expedientes() {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpedienteId, setSelectedExpedienteId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    cargarExpedientes();
  }, []);

  const cargarExpedientes = async () => {
    setLoading(true);
    try {
      const res = await api.getExpedientes(50);
      setExpedientes(res.data || []);
    } catch (err) {
      console.error('Error cargando expedientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = async (id_proyecto) => {
    setSelectedExpedienteId(id_proyecto);
    setLoadingDetalle(true);
    try {
      const res = await api.getExpedienteDetalle(id_proyecto);
      setDetalle(res.data);
    } catch (err) {
      console.error('Error cargando detalle de expediente:', err);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const cerrarModal = () => {
    setSelectedExpedienteId(null);
    setDetalle(null);
  };

  const expedientesFiltrados = expedientes.filter((exp) => {
    const term = searchTerm.toLowerCase();
    const titulo = (exp.titulo || '').toLowerCase();
    const numero = (exp.numero_expediente || '').toLowerCase();
    const comision = (exp.nombre_comision || '').toLowerCase();
    return titulo.includes(term) || numero.includes(term) || comision.includes(term);
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-green">Archivo Oficial</span>
            <span className="badge badge-blue">Neon PostgreSQL + MongoDB</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Registro de Expedientes y Auditoría Parlamentaria
          </h1>
          <p style={{ color: '#475569', fontSize: '0.96rem' }}>
            Historial de proyectos legislativos tramitados con trazabilidad de auditoría, bitácora y dictámenes.
          </p>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', width: '340px' }}>
          <Search size={18} color="#059669" style={{ position: 'absolute', left: '14px', top: '14px' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título o expediente..."
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: '0.9rem',
              outline: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card" style={{ padding: '24px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
            <Clock size={32} className="pulse-active" style={{ margin: '0 auto 12px', color: '#059669' }} />
            Cargando expedientes desde Neon PostgreSQL...
          </div>
        ) : expedientesFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
            No se encontraron expedientes registrados con el criterio de búsqueda.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                <th style={{ padding: '14px 16px' }}>Nº Expediente</th>
                <th style={{ padding: '14px 16px' }}>Título del Proyecto</th>
                <th style={{ padding: '14px 16px' }}>Comisión Asignada</th>
                <th style={{ padding: '14px 16px' }}>Conformidad CPE</th>
                <th style={{ padding: '14px 16px' }}>Fecha Ingreso</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {expedientesFiltrados.map((exp) => {
                const isConforme = exp.valido_constitucional === true || exp.valido_constitucional === 'True';
                const hasObs = exp.valido_constitucional === false || exp.valido_constitucional === 'False';

                return (
                  <tr
                    key={exp.id_proyecto}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#d97706', fontWeight: 700, fontSize: '0.92rem' }}>
                      {exp.numero_expediente || `PL-${exp.id_proyecto}`}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: 600, fontSize: '0.92rem', maxWidth: '380px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {exp.titulo || exp.resumen || 'Proyecto de Ley'}
                      </div>
                      {exp.archivo_pdf && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {exp.archivo_pdf}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155', fontSize: '0.88rem', fontWeight: 500 }}>
                      {exp.nombre_comision || exp.comision_corto || (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin comisión</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {isConforme ? (
                        <span className="badge badge-green">
                          <CheckCircle2 size={12} /> Conforme
                        </span>
                      ) : hasObs ? (
                        <span className="badge badge-red">
                          <ShieldAlert size={12} /> {exp.severidad_maxima || 'Observado'}
                        </span>
                      ) : (
                        <span className="badge badge-gray">Pendiente</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                      {exp.fecha_ingreso ? exp.fecha_ingreso.split('T')[0] : 'Hoy'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => verDetalle(exp.id_proyecto)}
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      >
                        <Eye size={14} />
                        <span>Ver Auditoría</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Detalle de Expediente */}
      {selectedExpedienteId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '24px',
        }}>
          <div className="glass-card" style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '32px',
            position: 'relative',
            background: '#041f1a',
            border: '1px solid rgba(52, 211, 153, 0.4)',
          }}>
            <button
              onClick={cerrarModal}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>

            {loadingDetalle || !detalle ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#a7f3d0' }}>
                <Clock size={32} className="pulse-active" style={{ margin: '0 auto 12px' }} />
                Cargando expediente completo...
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className="badge badge-gold">
                    {detalle.proyecto.numero_expediente || `PL-${detalle.proyecto.id_proyecto}`}
                  </span>
                  <span className="badge badge-green">
                    {detalle.proyecto.nombre_comision || 'Comisión Asignada'}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.45rem', color: '#ffffff', marginBottom: '12px' }}>
                  {detalle.proyecto.titulo || detalle.proyecto.resumen}
                </h2>
                {detalle.proyecto.resumen && (
                  <p style={{ color: '#a7f3d0', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
                    {detalle.proyecto.resumen}
                  </p>
                )}

                {/* Observaciones Constitucionales */}
                {detalle.observaciones_constitucionales && detalle.observaciones_constitucionales.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.05rem', color: '#34d399', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldAlert size={18} />
                      Dictamen de Auditoría Constitucional (CPE)
                    </h3>
                    {detalle.observaciones_constitucionales.map((obs, i) => (
                      <div key={i} style={{
                        background: 'rgba(6, 40, 32, 0.7)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#ffffff', fontWeight: 600 }}>
                            Estado: {obs.valido ? '✅ Conforme a la Constitución' : '⚠️ Contradicciones Detectadas'}
                          </span>
                          <span className="badge badge-gold">Confianza: {obs.confianza}%</span>
                        </div>
                        <div style={{ color: '#f0fdf4', fontSize: '0.88rem', lineHeight: 1.5 }}>
                          {obs.fundamentacion}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bitacora de Proceso */}
                {detalle.bitacora && detalle.bitacora.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1.05rem', color: '#34d399', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} />
                      Bitácora de Auditoría y Trazabilidad (sistema.bitacora_proceso)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {detalle.bitacora.map((b, i) => (
                        <div key={i} style={{
                          background: 'rgba(3, 20, 16, 0.5)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ color: '#34d399', fontWeight: 600, fontSize: '0.88rem' }}>
                              {b.agente_accion} → {b.accion_realizada}
                            </div>
                            <div style={{ color: '#a7f3d0', fontSize: '0.8rem' }}>
                              {b.descripcion_detallada}
                            </div>
                          </div>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            {b.fecha_hora ? b.fecha_hora.split('T')[0] : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
