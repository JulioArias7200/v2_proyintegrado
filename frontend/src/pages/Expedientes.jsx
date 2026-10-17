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
  ArrowRight,
  ExternalLink
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
    <div style={{ maxWidth: '1720px', width: '96%', margin: '0 auto', padding: '32px 24px' }}>
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
            maxWidth: '920px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '32px',
            position: 'relative',
            background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.96) 0%, rgba(11, 25, 44, 0.98) 100%)',
            border: '1px solid rgba(0, 180, 216, 0.35)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 180, 216, 0.15)',
            borderRadius: '20px',
          }}>
            <button
              onClick={cerrarModal}
              title="Cerrar modal"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(231, 111, 81, 0.2)';
                e.currentTarget.style.borderColor = '#E76F51';
                e.currentTarget.style.color = '#FFA896';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <X size={20} />
            </button>

            {loadingDetalle || !detalle ? (
              <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94A3B8' }}>
                <Clock size={36} className="pulse-active" style={{ margin: '0 auto 16px', color: '#00B4D8' }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 500, color: '#E2E8F0' }}>Cargando expediente completo...</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span className="badge badge-gold" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                    {detalle.proyecto.numero_expediente || `PL-${detalle.proyecto.id_proyecto}`}
                  </span>
                  <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                    {detalle.proyecto.nombre_comision || 'Comisión Asignada'}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.45rem', color: '#FFFFFF', fontWeight: 700, lineHeight: 1.35, marginBottom: '14px' }}>
                  {detalle.proyecto.titulo || detalle.proyecto.resumen}
                </h2>
                {detalle.proyecto.resumen && (
                  <div style={{
                    background: 'rgba(2, 132, 199, 0.06)',
                    borderLeft: '3px solid #00B4D8',
                    padding: '12px 16px',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: '20px',
                  }}>
                    <p style={{ color: '#CBD5E1', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                      {detalle.proyecto.resumen}
                    </p>
                  </div>
                )}

                {detalle.proyecto.drive_link && (
                  <div style={{ marginBottom: '24px' }}>
                    <a
                      href={detalle.proyecto.drive_link}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '9px 16px',
                        borderRadius: '8px',
                        color: '#34d399',
                        fontSize: '0.86rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={16} />
                      <span>Ver Expediente / Documento en Google Drive</span>
                    </a>
                  </div>
                )}

                {/* Observaciones Constitucionales */}
                {detalle.observaciones_constitucionales && detalle.observaciones_constitucionales.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <h3 style={{
                      fontSize: '1.05rem',
                      color: '#38BDF8',
                      fontWeight: 600,
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ShieldAlert size={19} style={{ color: '#00B4D8' }} />
                      Dictamen de Auditoría Constitucional (CPE)
                    </h3>
                    {detalle.observaciones_constitucionales.map((obs, i) => {
                      const esConforme = obs.valido;
                      return (
                        <div key={i} style={{
                          background: esConforme ? 'rgba(15, 23, 42, 0.7)' : 'rgba(231, 111, 81, 0.08)',
                          padding: '18px 20px',
                          borderRadius: '14px',
                          border: esConforme ? '1px solid rgba(138, 201, 38, 0.35)' : '1px solid rgba(231, 111, 81, 0.4)',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                          marginBottom: '12px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {esConforme ? (
                                <CheckCircle2 size={18} style={{ color: '#8AC926' }} />
                              ) : (
                                <AlertTriangle size={18} style={{ color: '#E76F51' }} />
                              )}
                              <span style={{ color: esConforme ? '#8AC926' : '#FFA896', fontWeight: 600, fontSize: '0.92rem' }}>
                                {esConforme ? 'Conforme a la Constitución (CPE 2009)' : 'Contradicciones Detectadas'}
                              </span>
                            </div>
                            <span className="badge badge-gold" style={{ fontSize: '0.78rem' }}>
                              Confianza: {obs.confianza}%
                            </span>
                          </div>
                          <div style={{ color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.55 }}>
                            {obs.fundamentacion}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bitacora de Proceso (Timeline) */}
                {detalle.bitacora && detalle.bitacora.length > 0 && (
                  <div>
                    <h3 style={{
                      fontSize: '1.05rem',
                      color: '#38BDF8',
                      fontWeight: 600,
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Activity size={19} style={{ color: '#00B4D8' }} />
                      Bitácora de Auditoría y Trazabilidad (sistema.bitacora_proceso)
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      position: 'relative',
                      paddingLeft: '18px',
                      borderLeft: '2px dashed rgba(0, 180, 216, 0.25)',
                      marginLeft: '8px',
                    }}>
                      {detalle.bitacora.map((b, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'relative',
                            background: 'rgba(30, 41, 59, 0.45)',
                            padding: '14px 18px',
                            borderRadius: '12px',
                            border: '1px solid rgba(0, 180, 216, 0.16)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(0, 180, 216, 0.4)';
                            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)';
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(0, 180, 216, 0.16)';
                            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.45)';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          {/* Timeline Node Bullet */}
                          <span style={{
                            position: 'absolute',
                            left: '-25px',
                            top: '18px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: '#00B4D8',
                            boxShadow: '0 0 8px rgba(0, 180, 216, 0.6)',
                            border: '2px solid #0F172A',
                          }} />

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                background: 'rgba(0, 180, 216, 0.12)',
                                color: '#38BDF8',
                                fontWeight: 600,
                                fontSize: '0.78rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(0, 180, 216, 0.25)',
                                fontFamily: 'monospace'
                              }}>
                                {b.agente_accion}
                              </span>
                              <span style={{ color: '#64748B', fontSize: '0.78rem' }}>→</span>
                              <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '0.86rem' }}>
                                {b.accion_realizada}
                              </span>
                            </div>
                            <span style={{
                              color: '#94A3B8',
                              fontSize: '0.74rem',
                              fontFamily: 'monospace',
                              background: 'rgba(15, 23, 42, 0.5)',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              {b.fecha_hora ? b.fecha_hora.split('T')[0] : ''}
                            </span>
                          </div>
                          <div style={{ color: '#CBD5E1', fontSize: '0.82rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {b.descripcion_detallada}
                          </div>
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
