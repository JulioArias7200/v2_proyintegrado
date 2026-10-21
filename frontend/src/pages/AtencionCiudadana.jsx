import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail, 
  Send, 
  Bot, 
  User, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  MessageSquare,
  Lock,
  LogIn,
  Download,
  UploadCloud,
  Paperclip,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import PresentacionCiudadana from '../components/PresentacionCiudadana';

import CssRobotAvatar from '../components/CssRobotAvatar';
import AsistenteMultifacetaPanel from '../components/AsistenteMultifacetaPanel';
import GestionFacetasPanel from '../components/GestionFacetasPanel';
import { esRolInterno } from '../context/AuthContext';

export default function AtencionCiudadana({ isAuthenticated = false, currentUser = null, onNavigateLogin, onVerCaso }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Formulario de nueva atención
  const [nombre, setNombre] = useState(currentUser?.nombre_completo || '');
  const [motivo, setMotivo] = useState('');
  const [medio, setMedio] = useState('Presencial');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Adjunto opcional (solo disponible logeado)
  const [adjunto, setAdjunto] = useState(null); // { nombre, texto, paginas, palabras }
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [downloadingAttachment, setDownloadingAttachment] = useState(false);

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      const res = await api.getCiudadana(50);
      setSolicitudes(res.data || []);
    } catch (err) {
      console.error('Error cargando solicitudes ciudadanas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setIsUploadingFile(true);
    setUploadError('');
    try {
      const res = await api.uploadDocument(selectedFile);
      setAdjunto({
        nombre: selectedFile.name,
        texto: res.texto_completo,
        paginas: res.paginas,
        palabras: res.palabras,
        saved_as: res.saved_as,
        upload_id: res.upload_id,
        drive_link: res.drive_link,
        drive_file_id: res.drive_file_id,
        drive_status: res.drive_status,
        tipo: selectedFile.type || '',
      });
    } catch (err) {
      console.error('Error subiendo adjunto ciudadano:', err);
      setUploadError(err.message || 'No se pudo registrar el archivo en Google Drive. Vuelva a intentarlo.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRegistrarAtencion = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !motivo.trim()) return;

    setIsSubmitting(true);
    try {
      // Registrar mediante el pipeline de Atención Ciudadana
      const partesTexto = [`Ciudadano: ${nombre}`, `Medio: ${medio}`, `Motivo / Petitorio:\n${motivo}`];
      if (adjunto?.texto) {
        partesTexto.push(`\n--- Documento adjunto: ${adjunto.nombre} ---\n${adjunto.texto}`);
      }
      const texto = partesTexto.join('\n');
      const presentacion = await api.presentarCasoCiudadano({
        titulo: motivo.trim().slice(0, 180), texto,
        tipo: 'consulta', camara_destino: 'Ambas', nombre_archivo: adjunto?.nombre || null,
        documento_original: adjunto?.saved_as
          ? { saved_as: adjunto.saved_as, nombre: adjunto.nombre, tipo: adjunto.tipo,
            upload_id: adjunto.upload_id, drive_link: adjunto.drive_link,
            drive_file_id: adjunto.drive_file_id, drive_status: adjunto.drive_status } : null,
      });
      if (presentacion.success) {
        onVerCaso?.(presentacion.data.id);
        window.dispatchEvent(new CustomEvent('caso-ciudadano-presentado', { detail: { casoId: presentacion.data.id } }));
        setSubmitSuccess(true);
        setNombre(currentUser?.nombre_completo || '');
        setMotivo('');
        setAdjunto(null);
        cargarSolicitudes();
        setTimeout(() => setSubmitSuccess(false), 5000);
      }
    } catch (err) {
      console.error('Error registrando atención ciudadana:', err);
      setUploadError(err.message || 'No se pudo registrar la solicitud. Revise los datos e inténtelo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const descargarAdjunto = async () => {
    if (!adjunto?.upload_id) return;
    setDownloadingAttachment(true);
    setUploadError('');
    try {
      const blob = await api.getDocumentoIngresado(adjunto.upload_id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = adjunto.nombre || 'documento-original';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setUploadError(err.message); }
    finally { setDownloadingAttachment(false); }
  };

  return (
    <div className="atencion-ciudadana-page" style={{ maxWidth: '1720px', width: '96%', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header with CSS Robot Avatar Banner */}
      <div className="citizen-home-hero" style={{
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '24px',
        background: 'linear-gradient(135deg, rgba(4, 47, 46, 0.8) 0%, rgba(15, 118, 110, 0.5) 100%)',
        padding: '24px 30px',
        borderRadius: '24px',
        border: '1.5px solid rgba(20, 184, 166, 0.4)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-green">Ventanilla Única</span>
            <span className="badge badge-gold">Agente de Interacción Ciudadana</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Módulo de Atención y Solicitudes Ciudadanas
          </h1>
          <p style={{ color: '#99f6e4', fontSize: '0.96rem', maxWidth: '850px', lineHeight: 1.6 }}>
            Recepción y canalización inteligente de peticiones ciudadanas, quejas y denuncias procesadas por el SMA con persistencia en PostgreSQL Neon.
          </p>
        </div>

      </div>

      {/* Administración de facetas: visible solo para roles internos (Secretaría, Comisión, etc.) */}
      {esRolInterno(currentUser?.rol) && <GestionFacetasPanel />}

      {isAuthenticated && <PresentacionCiudadana onVerCaso={onVerCaso} />}
      {/* Asistente ciudadano multi-faceta: el mensaje se enruta solo al prompt correcto */}
      <AsistenteMultifacetaPanel onNavigateLogin={onNavigateLogin} />

      {isAuthenticated && <div className="citizen-legacy-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        {/* Formulario de Registro Rápido (solo autenticado) / Panel informativo (público) */}
        <div className="glass-card" style={{ padding: '28px' }}>
          {!isAuthenticated ? (
            <div style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(0, 180, 216, 0.15)', border: '1px solid rgba(0, 180, 216, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock size={24} color="#00B4D8" />
              </div>
              <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '10px' }}>
                Vista Informativa
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '20px' }}>
                Esta sección explica cómo funciona el módulo de Atención Ciudadana. Para registrar
                una solicitud, adjuntar documentos o interactuar directamente con el Agente de
                Interacción Ciudadana, necesitas iniciar sesión (o crear una cuenta de Ciudadano si
                aún no tienes una).
              </p>
              <ul style={{ textAlign: 'left', color: '#CBD5E1', fontSize: '0.85rem', lineHeight: 1.9, marginBottom: '22px', paddingLeft: '20px' }}>
                <li>El Agente clasifica automáticamente tu petición, queja o denuncia.</li>
                <li>Puedes adjuntar un documento (PDF/DOCX) o describir tu caso en texto.</li>
                <li>Tu solicitud queda registrada con seguimiento en PostgreSQL Neon.</li>
              </ul>
              {onNavigateLogin && (
                <button onClick={onNavigateLogin} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <LogIn size={18} />
                  <span>Iniciar sesión / Registrarme</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={20} color="#34d399" />
                Registrar Nueva Solicitud o Petición
              </h2>

              {submitSuccess && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  color: '#6ee7b7',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <CheckCircle2 size={18} />
                  <span>Solicitud registrada y procesada exitosamente por el Agente.</span>
                </div>
              )}

              <form onSubmit={handleRegistrarAtencion}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '6px', fontWeight: 600 }}>
                    Nombre del Ciudadano / Remitente:
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Juan Carlos Pérez..."
                    readOnly={!!currentUser?.nombre_completo}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      background: currentUser?.nombre_completo ? 'rgba(3, 20, 16, 0.4)' : 'rgba(3, 20, 16, 0.7)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: currentUser?.nombre_completo ? '#a7f3d0' : '#ffffff',
                      outline: 'none',
                      cursor: currentUser?.nombre_completo ? 'not-allowed' : 'text',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '6px', fontWeight: 600 }}>
                    Canal de Ingreso:
                  </label>
                  <select
                    value={medio}
                    onChange={(e) => setMedio(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      background: '#041f1a',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#ffffff',
                      outline: 'none',
                    }}
                  >
                    <option value="Presencial">Mesa de Partes Presencial</option>
                    <option value="Correo Electrónico">Correo Electrónico</option>
                    <option value="Portal Web">Portal Web de Transparencia</option>
                    <option value="Oficio Directo">Oficio Institucional</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '6px', fontWeight: 600 }}>
                    Motivo de la Solicitud o Petición:
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Describa el requerimiento, petición o consulta legal..."
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'rgba(3, 20, 16, 0.7)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#ffffff',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '6px', fontWeight: 600 }}>
                    Adjuntar Documento (opcional):
                  </label>
                  {uploadError && <div role="alert" style={{ marginBottom: 10, padding: '9px 11px', borderRadius: 8, color: '#fecaca', background: 'rgba(127,29,29,.3)', border: '1px solid rgba(248,113,113,.3)', fontSize: 12 }}>{uploadError}</div>}
                  {!adjunto ? (
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '14px', borderRadius: '10px', border: '1.5px dashed rgba(16, 185, 129, 0.4)',
                      background: 'rgba(3, 20, 16, 0.5)', color: '#a7f3d0', fontSize: '0.85rem', cursor: 'pointer',
                    }}>
                      <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                      {isUploadingFile ? (
                        <><Sparkles size={16} className="pulse-active" /> <span>Procesando archivo...</span></>
                      ) : (
                        <><UploadCloud size={16} /> <span>Subir PDF / DOCX (opcional)</span></>
                      )}
                    </label>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                      padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)',
                      background: 'rgba(3, 20, 16, 0.7)', color: '#a7f3d0', fontSize: '0.82rem',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Paperclip size={14} /> {adjunto.nombre} ({adjunto.palabras} palabras)
                      </span>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={descargarAdjunto} disabled={downloadingAttachment} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#7dd3fc', cursor: 'pointer', fontSize: '0.78rem' }}>
                          <Download size={13}/>{downloadingAttachment ? 'Descargando…' : 'Descargar'}
                        </button>
                        <button type="button" onClick={() => setAdjunto(null)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem' }}>
                          Quitar
                        </button>
                      </div>
                    </div>
                  )}
                  {adjunto?.drive_status === 'GUARDADO' && <div style={{ marginTop: 6, color: '#86efac', fontSize: 11 }}>Copia confirmada en Google Drive · registro {adjunto.upload_id}</div>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !nombre.trim() || !motivo.trim()}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles size={18} className="pulse-active" />
                      <span>Canalizando con Agente...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Registrar y Canalizar</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Listado de Solicitudes Recientes */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="#34d399" />
            Historial de Solicitudes y Correspondencia
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#a7f3d0' }}>
              Cargando solicitudes...
            </div>
          ) : solicitudes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#a7f3d0' }}>
              No hay solicitudes ciudadanas registradas aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
              {solicitudes.map((sol) => (
                <div key={sol.solicitud_id} style={{
                  background: 'rgba(6, 40, 32, 0.6)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>
                      {sol.origen || 'Atención Ciudadana'}
                    </strong>
                    <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                      {sol.agente_destino || 'Agente_Atencion_Ciudadana'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#a7f3d0', marginBottom: '6px' }}>
                    {sol.tipo_entrada || 'Mesa de Partes'} • {sol.fecha_ingreso ? sol.fecha_ingreso.split('T')[0] : ''}
                  </div>
                  {sol.resumen_ia && (
                    <p style={{ color: '#f0fdf4', fontSize: '0.85rem', lineHeight: 1.4 }}>
                      {sol.resumen_ia}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
