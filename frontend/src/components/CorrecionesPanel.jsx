import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  Mic, 
  MicOff, 
  FileText, 
  Filter, 
  UserCheck, 
  Building2,
  PlusCircle,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Scale,
  Sparkles,
  BookOpen,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';

export default function CorrecionesPanel({ idProyecto, sesionId, onCorreccionActualizada }) {
  const [activeTab, setActiveTab] = useState('VER'); // 'VER' | 'SUBIR'
  const [correcciones, setCorrecciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filtro, setFiltro] = useState('TODAS'); // 'TODAS' | 'PENDIENTES' | 'APLICADAS' | 'RECHAZADAS'
  const [observacionesInput, setObservacionesInput] = useState({});
  const [actualizandoId, setActualizandoId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [activeSpeechField, setActiveSpeechField] = useState(null); // 'motivo' | 'texto' | idCorreccion
  const [speechFeedback, setSpeechFeedback] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Formulario para Subir Actualización / Corrección
  const [formNuevo, setFormNuevo] = useState({
    articulo_afectado: '',
    tipo_corrector: 'AUTOR_PROYECTO',
    texto_original: '',
    texto_corregido: '',
    motivo: '',
    referencia_cpe: '',
    referencia_norma: '',
    corrector_nombre: 'Mesa de Partes',
  });

  const cargarCorrecciones = async () => {
    if (!idProyecto) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/correcciones/${idProyecto}`);
      if (res.data && res.data.data) {
        setCorrecciones(res.data.data);
      }
    } catch (err) {
      console.error('Error cargando correcciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCorrecciones();
  }, [idProyecto]);

  const handleCambiarEstado = async (idCorreccion, nuevoEstado) => {
    setActualizandoId(idCorreccion);
    try {
      const obs = observacionesInput[idCorreccion] || '';
      await api.patch(`/api/correcciones/${idCorreccion}`, {
        estado: nuevoEstado,
        observacion_respuesta: obs
      });
      setStatusMessage({
        tipo: 'success',
        texto: `Enmienda #${idCorreccion} marcada como ${nuevoEstado}.`
      });
      setTimeout(() => setStatusMessage(null), 4000);
      await cargarCorrecciones();
      if (onCorreccionActualizada) onCorreccionActualizada();
    } catch (err) {
      console.error('Error actualizando estado de corrección:', err);
      setStatusMessage({
        tipo: 'error',
        texto: 'No se pudo actualizar el estado de la corrección.'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setActualizandoId(null);
    }
  };

  const handleSubmitNueva = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!idProyecto) {
      alert('No hay un proyecto de ley activo seleccionado.');
      return;
    }
    if (!formNuevo.texto_corregido.trim()) {
      alert('Por favor ingrese el texto modificado o enmienda propuesta.');
      return;
    }
    if (!formNuevo.motivo.trim()) {
      alert('Por favor detalle el motivo o fundamento de la observación/actualización.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/correcciones', {
        id_proyecto: parseInt(idProyecto, 10),
        articulo_afectado: formNuevo.articulo_afectado.trim() || 'General',
        tipo_corrector: formNuevo.tipo_corrector,
        texto_original: formNuevo.texto_original.trim() || null,
        texto_corregido: formNuevo.texto_corregido.trim(),
        motivo: formNuevo.motivo.trim(),
        referencia_cpe: formNuevo.referencia_cpe.trim() || null,
        referencia_norma: formNuevo.referencia_norma.trim() || null,
        corrector_nombre: formNuevo.corrector_nombre.trim() || 'Mesa de Partes',
        sesion_id: sesionId || null
      });

      setStatusMessage({
        tipo: 'success',
        texto: '¡Actualización y observación registrada exitosamente en el expediente legislativo!'
      });
      setTimeout(() => setStatusMessage(null), 5000);

      // Limpiar formulario y volver a la vista
      setFormNuevo({
        articulo_afectado: '',
        tipo_corrector: 'AUTOR_PROYECTO',
        texto_original: '',
        texto_corregido: '',
        motivo: '',
        referencia_cpe: '',
        referencia_norma: '',
        corrector_nombre: 'Mesa de Partes',
      });
      setActiveTab('VER');
      await cargarCorrecciones();
      if (onCorreccionActualizada) onCorreccionActualizada();
    } catch (err) {
      console.error('Error creando nueva corrección:', err);
      setStatusMessage({
        tipo: 'error',
        texto: 'Error al registrar la actualización. Intente nuevamente.'
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const startVoiceInput = (targetField) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz nativo (Web Speech API).');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-BO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setActiveSpeechField(targetField);
    setIsListening(true);
    setSpeechFeedback('Escuchando voz...');

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (typeof targetField === 'number' || typeof targetField === 'string' && !isNaN(targetField)) {
        // Es un id de corrección en la lista de respuestas
        setObservacionesInput(prev => ({
          ...prev,
          [targetField]: (prev[targetField] ? prev[targetField] + ' ' : '') + text
        }));
      } else if (targetField === 'motivo') {
        setFormNuevo(prev => ({
          ...prev,
          motivo: (prev.motivo ? prev.motivo + ' ' : '') + text
        }));
      } else if (targetField === 'texto_corregido') {
        setFormNuevo(prev => ({
          ...prev,
          texto_corregido: (prev.texto_corregido ? prev.texto_corregido + ' ' : '') + text
        }));
      } else if (targetField === 'articulo_afectado') {
        setFormNuevo(prev => ({
          ...prev,
          articulo_afectado: text
        }));
      }
      setSpeechFeedback(`Dictado capturado: "${text}"`);
      setTimeout(() => setSpeechFeedback(''), 4000);
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setSpeechFeedback('Error al captar audio.');
      setTimeout(() => setSpeechFeedback(''), 3000);
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.start();
  };

  const correccionesFiltradas = correcciones.filter(c => {
    if (filtro === 'PENDIENTES') return c.estado === 'PENDIENTE';
    if (filtro === 'APLICADAS') return c.estado === 'APLICADA';
    if (filtro === 'RECHAZADAS') return c.estado === 'RECHAZADA';
    return true;
  });

  const pendientesCount = correcciones.filter(c => c.estado === 'PENDIENTE').length;
  const aplicadasCount = correcciones.filter(c => c.estado === 'APLICADA').length;
  const rechazadasCount = correcciones.filter(c => c.estado === 'RECHAZADA').length;

  if (!idProyecto) {
    return (
      <div style={{
        background: 'rgba(13, 27, 42, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center',
        color: '#94a3b8'
      }}>
        <AlertTriangle size={32} color="#f59e0b" style={{ margin: '0 auto 10px auto' }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          No hay un proyecto de ley activo seleccionado para gestionar correcciones normativas.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(13, 27, 42, 0.94) 0%, rgba(27, 42, 74, 0.90) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      borderRadius: '20px',
      padding: '24px',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
      marginTop: '16px',
      transition: 'all 0.3s ease'
    }}>
      {/* ── HEADER DEL PANEL ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '12px',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.2)'
          }}>
            <Scale size={22} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.01em'
              }}>
                Mesa de Actualizaciones & Observaciones Normativas
              </h3>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                Proyecto #{idProyecto}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Gestión interactiva de enmiendas, observaciones de constitucionalidad y subida de actualizaciones.
            </p>
          </div>
        </div>

        {/* Acciones del Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={cargarCorrecciones}
            disabled={loading}
            title="Recargar observaciones"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '8px',
              color: '#cbd5e1',
              padding: '7px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: '#38bdf8' }} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expandir sección" : "Minimizar sección"}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '8px',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Feedback de voz y mensajes de estado */}
      {statusMessage && (
        <div style={{
          background: statusMessage.tipo === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${statusMessage.tipo === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          color: statusMessage.tipo === 'success' ? '#34d399' : '#f87171',
          padding: '10px 16px',
          borderRadius: '10px',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {statusMessage.tipo === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{statusMessage.texto}</span>
        </div>
      )}

      {speechFeedback && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#38bdf8',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Mic size={14} className="animate-pulse" />
          <span>{speechFeedback}</span>
        </div>
      )}

      {!isCollapsed && (
        <>
          {/* ── SELECTOR DE PESTAÑAS: VER OBSERVACIONES vs SUBIR ACTUALIZACIÓN ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            background: 'rgba(15, 23, 42, 0.7)',
            padding: '6px',
            borderRadius: '12px',
            border: '1px solid rgba(148, 163, 184, 0.15)'
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setActiveTab('VER')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '9px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                  background: activeTab === 'VER'
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                    : 'transparent',
                  color: activeTab === 'VER' ? '#ffffff' : '#94a3b8',
                  boxShadow: activeTab === 'VER' ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
                }}
              >
                <ListFilter size={16} />
                <span>Ver Observaciones ({correcciones.length})</span>
                {pendientesCount > 0 && (
                  <span style={{
                    background: '#f59e0b',
                    color: '#0f172a',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    marginLeft: '4px'
                  }}>
                    {pendientesCount} pend.
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('SUBIR')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '9px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                  background: activeTab === 'SUBIR'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'transparent',
                  color: activeTab === 'SUBIR' ? '#ffffff' : '#94a3b8',
                  boxShadow: activeTab === 'SUBIR' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                }}
              >
                <PlusCircle size={16} />
                <span>Subir Actualización / Enmienda</span>
              </button>
            </div>

            {activeTab === 'VER' && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFiltro('TODAS')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: filtro === 'TODAS' ? 700 : 500,
                    border: '1px solid',
                    borderColor: filtro === 'TODAS' ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
                    background: filtro === 'TODAS' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                    color: filtro === 'TODAS' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Todas ({correcciones.length})
                </button>
                <button
                  onClick={() => setFiltro('PENDIENTES')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: filtro === 'PENDIENTES' ? 700 : 500,
                    border: '1px solid',
                    borderColor: filtro === 'PENDIENTES' ? '#f59e0b' : 'rgba(148, 163, 184, 0.2)',
                    background: filtro === 'PENDIENTES' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                    color: filtro === 'PENDIENTES' ? '#fbbf24' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Pendientes ({pendientesCount})
                </button>
                <button
                  onClick={() => setFiltro('APLICADAS')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: filtro === 'APLICADAS' ? 700 : 500,
                    border: '1px solid',
                    borderColor: filtro === 'APLICADAS' ? '#10b981' : 'rgba(148, 163, 184, 0.2)',
                    background: filtro === 'APLICADAS' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                    color: filtro === 'APLICADAS' ? '#34d399' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Aplicadas ({aplicadasCount})
                </button>
                <button
                  onClick={() => setFiltro('RECHAZADAS')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: filtro === 'RECHAZADAS' ? 700 : 500,
                    border: '1px solid',
                    borderColor: filtro === 'RECHAZADAS' ? '#ef4444' : 'rgba(148, 163, 184, 0.2)',
                    background: filtro === 'RECHAZADAS' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                    color: filtro === 'RECHAZADAS' ? '#f87171' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Rechazadas ({rechazadasCount})
                </button>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════
              PESTAÑA 1: VER TODAS LAS OBSERVACIONES & CORRECCIONES
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'VER' && (
            <div>
              {correccionesFiltradas.length === 0 ? (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px dashed rgba(148, 163, 184, 0.25)',
                  borderRadius: '14px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: '#94a3b8'
                }}>
                  <Clock size={36} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: '#cbd5e1', fontWeight: 600 }}>
                    No hay correcciones registradas para el filtro seleccionado.
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Utilice la pestaña <strong style={{ color: '#38bdf8' }}>"Subir Actualización / Enmienda"</strong> para registrar una observación normativa.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {correccionesFiltradas.map((c) => {
                    const isPending = c.estado === 'PENDIENTE';
                    const isApplied = c.estado === 'APLICADA';
                    const isRejected = c.estado === 'RECHAZADA';

                    const borderColor = isPending 
                      ? 'rgba(245, 158, 11, 0.4)' 
                      : isApplied 
                      ? 'rgba(16, 185, 129, 0.4)' 
                      : 'rgba(239, 68, 68, 0.4)';

                    const bgColor = isPending
                      ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)'
                      : isApplied
                      ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)'
                      : 'linear-gradient(145deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)';

                    return (
                      <div
                        key={c.id}
                        style={{
                          background: bgColor,
                          border: `1px solid ${borderColor}`,
                          borderRadius: '14px',
                          padding: '18px',
                          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Cabecera de la tarjeta */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: '#1e293b',
                              color: '#38bdf8',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              border: '1px solid rgba(56, 189, 248, 0.3)'
                            }}>
                              {c.articulo_afectado || 'General'}
                            </span>

                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.78rem',
                              color: '#cbd5e1',
                              background: 'rgba(30, 41, 59, 0.6)',
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}>
                              {c.tipo_corrector === 'SENADO_NORMATIVA' ? (
                                <>
                                  <Building2 size={13} color="#60a5fa" />
                                  <span style={{ color: '#93c5fd', fontWeight: 600 }}>Mesa Senadores Normativa</span>
                                </>
                              ) : c.tipo_corrector === 'COMISION_REVISORA' ? (
                                <>
                                  <Scale size={13} color="#34d399" />
                                  <span style={{ color: '#6ee7b7', fontWeight: 600 }}>Comisión Revisora</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck size={13} color="#c084fc" />
                                  <span style={{ color: '#d8b4fe', fontWeight: 600 }}>Autor del Proyecto</span>
                                </>
                              )}
                            </span>

                            {c.agente_origen && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                • {c.agente_origen.replace('AGENTE_', '')}
                              </span>
                            )}
                          </div>

                          {/* Estado Badge */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: isPending
                              ? 'rgba(245, 158, 11, 0.2)'
                              : isApplied
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                            color: isPending ? '#fbbf24' : isApplied ? '#34d399' : '#f87171',
                            border: `1px solid ${borderColor}`
                          }}>
                            {isPending && <Clock size={12} />}
                            {isApplied && <CheckCircle2 size={12} />}
                            {isRejected && <XCircle size={12} />}
                            {c.estado}
                          </span>
                        </div>

                        {/* Contenido: Textos y Motivos */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                          {c.texto_original && (
                            <div style={{
                              background: 'rgba(15, 23, 42, 0.65)',
                              border: '1px solid rgba(148, 163, 184, 0.15)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              color: '#94a3b8',
                              fontFamily: 'monospace'
                            }}>
                              <span style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px', fontSize: '0.74rem' }}>
                                TEXTO ORIGINAL:
                              </span>
                              "{c.texto_original}"
                            </div>
                          )}

                          {c.texto_corregido && (
                            <div style={{
                              background: 'rgba(2, 132, 199, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              color: '#e0f2fe'
                            }}>
                              <span style={{ color: '#38bdf8', fontWeight: 700, display: 'block', marginBottom: '4px', fontSize: '0.74rem' }}>
                                PROPUESTA DE MODIFICACIÓN / ENMIENDA:
                              </span>
                              {c.texto_corregido}
                            </div>
                          )}

                          {c.motivo && (
                            <div style={{
                              background: 'rgba(15, 23, 42, 0.8)',
                              border: '1px solid rgba(148, 163, 184, 0.2)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              color: '#cbd5e1'
                            }}>
                              <span style={{ color: '#fbbf24', fontWeight: 700, display: 'block', marginBottom: '4px', fontSize: '0.74rem' }}>
                                MOTIVO / FUNDAMENTO OBSERVADO:
                              </span>
                              {c.motivo}
                            </div>
                          )}

                          {/* Referencias CPE / Norma */}
                          {(c.referencia_cpe || c.referencia_norma) && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                              {c.referencia_cpe && (
                                <span style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#6ee7b7',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600
                                }}>
                                  ⚖️ CPE: {c.referencia_cpe}
                                </span>
                              )}
                              {c.referencia_norma && (
                                <span style={{
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#93c5fd',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600
                                }}>
                                  📜 Norma: {c.referencia_norma}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Respuesta previa si ya fue resuelta */}
                        {c.observacion_respuesta && (
                          <div style={{
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            marginTop: '10px',
                            fontSize: '0.8rem'
                          }}>
                            <span style={{ color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '2px', fontSize: '0.72rem' }}>
                              RESOLUCIÓN / RESPUESTA REGISTRADA:
                            </span>
                            <span style={{ color: '#f1f5f9' }}>{c.observacion_respuesta}</span>
                          </div>
                        )}

                        {/* Acciones de resolución si está pendiente */}
                        {isPending && (
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Observación o sustento de la resolución (opcional)..."
                                value={observacionesInput[c.id] || ''}
                                onChange={(e) =>
                                  setObservacionesInput({ ...observacionesInput, [c.id]: e.target.value })
                                }
                                style={{
                                  flex: 1,
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  border: '1px solid rgba(148, 163, 184, 0.25)',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  color: '#ffffff',
                                  fontSize: '0.8rem',
                                  outline: 'none'
                                }}
                              />

                              <button
                                onClick={() => startVoiceInput(c.id)}
                                title="Dictar resolución por voz"
                                style={{
                                  background: isListening && activeSpeechField === c.id
                                    ? '#ef4444'
                                    : 'rgba(30, 41, 59, 0.8)',
                                  border: '1px solid rgba(148, 163, 184, 0.3)',
                                  borderRadius: '8px',
                                  color: '#ffffff',
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Mic size={14} className={isListening && activeSpeechField === c.id ? 'animate-pulse' : ''} />
                              </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                onClick={() => handleCambiarEstado(c.id, 'APLICADA')}
                                disabled={actualizandoId === c.id}
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  color: '#ffffff',
                                  padding: '7px 16px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                <CheckCircle2 size={14} />
                                <span>Aceptar / Aplicar</span>
                              </button>

                              <button
                                onClick={() => handleCambiarEstado(c.id, 'RECHAZADA')}
                                disabled={actualizandoId === c.id}
                                style={{
                                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  color: '#ffffff',
                                  padding: '7px 16px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                                }}
                              >
                                <XCircle size={14} />
                                <span>Rechazar Enmienda</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              PESTAÑA 2: SUBIR ACTUALIZACIÓN / ENMIENDA
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'SUBIR' && (
            <form onSubmit={handleSubmitNueva} style={{
              background: 'rgba(15, 23, 42, 0.55)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '10px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.15)'
              }}>
                <Sparkles size={18} color="#38bdf8" />
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.96rem', fontWeight: 800 }}>
                  Registrar Nueva Observación o Enmienda Legislativa
                </h4>
              </div>

              {/* Fila 1: Artículo afectado y Tipo de Corrector */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Artículo o Disposición Afectada *
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Ej. Artículo 4, Disposición Transitoria Segunda..."
                      value={formNuevo.articulo_afectado}
                      onChange={(e) => setFormNuevo({ ...formNuevo, articulo_afectado: e.target.value })}
                      style={{
                        flex: 1,
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ffffff',
                        fontSize: '0.84rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => startVoiceInput('articulo_afectado')}
                      title="Dictar artículo por voz"
                      style={{
                        background: isListening && activeSpeechField === 'articulo_afectado' ? '#ef4444' : 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '0 12px',
                        cursor: 'pointer'
                      }}
                    >
                      <Mic size={14} className={isListening && activeSpeechField === 'articulo_afectado' ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Tipo de Proponente / Enmienda *
                  </label>
                  <select
                    value={formNuevo.tipo_corrector}
                    onChange={(e) => setFormNuevo({ ...formNuevo, tipo_corrector: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="AUTOR_PROYECTO">Autor del Proyecto (Iniciativa / Diputado / Senador)</option>
                    <option value="SENADO_NORMATIVA">Mesa de Senadores (Revisión Normativa)</option>
                    <option value="COMISION_REVISORA">Comisión Legislativa Revisora</option>
                    <option value="SECRETARIA_CAMARA">Secretaría General de Cámara</option>
                  </select>
                </div>
              </div>

              {/* Fila 2: Texto Original (opcional) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Texto Original / Vigente (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Pegue aquí el texto original previo a la modificación..."
                  value={formNuevo.texto_original}
                  onChange={(e) => setFormNuevo({ ...formNuevo, texto_original: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Fila 3: Texto Corregido / Propuesta de Enmienda */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8' }}>
                    Texto Modificado / Enmienda Propuesta *
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('texto_corregido')}
                    title="Dictar enmienda por voz"
                    style={{
                      background: isListening && activeSpeechField === 'texto_corregido' ? '#ef4444' : 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '6px',
                      color: '#38bdf8',
                      padding: '3px 9px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Mic size={13} className={isListening && activeSpeechField === 'texto_corregido' ? 'animate-pulse' : ''} />
                    <span>Dictar Texto</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  required
                  placeholder="Escriba o dicte el nuevo texto propuesto para este artículo..."
                  value={formNuevo.texto_corregido}
                  onChange={(e) => setFormNuevo({ ...formNuevo, texto_corregido: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Fila 4: Motivo / Fundamento Jurídico */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24' }}>
                    Motivo / Fundamento Jurídico de la Observación *
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('motivo')}
                    title="Dictar motivo por voz"
                    style={{
                      background: isListening && activeSpeechField === 'motivo' ? '#ef4444' : 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '6px',
                      color: '#fbbf24',
                      padding: '3px 9px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Mic size={13} className={isListening && activeSpeechField === 'motivo' ? 'animate-pulse' : ''} />
                    <span>Dictar Motivo</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Explique las razones constitucionales, de técnica legislativa o de coherencia normativa..."
                  value={formNuevo.motivo}
                  onChange={(e) => setFormNuevo({ ...formNuevo, motivo: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Fila 5: Referencias Normativas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#6ee7b7', marginBottom: '6px' }}>
                    Referencia CPE (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Art. 108 Numeral 1, Art. 158 CPE..."
                    value={formNuevo.referencia_cpe}
                    onChange={(e) => setFormNuevo({ ...formNuevo, referencia_cpe: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', marginBottom: '6px' }}>
                    Norma Conexa / Ley Vigente (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ley N° 026, Ley N° 004..."
                    value={formNuevo.referencia_norma}
                    onChange={(e) => setFormNuevo({ ...formNuevo, referencia_norma: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Botón de Envío */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('VER')}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    padding: '10px 18px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 24px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  <Send size={15} />
                  <span>{submitting ? 'Registrando...' : 'Subir y Registrar Actualización'}</span>
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
