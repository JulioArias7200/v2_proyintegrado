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
  MessageSquare
} from 'lucide-react';
import { api } from '../services/api';

export default function AtencionCiudadana() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Formulario de nueva atención
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [medio, setMedio] = useState('Presencial');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

  const handleRegistrarAtencion = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !motivo.trim()) return;

    setIsSubmitting(true);
    try {
      // Registrar mediante el pipeline de Atención Ciudadana
      const texto = `Ciudadano: ${nombre}\nMedio: ${medio}\nMotivo / Petitorio:\n${motivo}`;
      const resFase1 = await api.runPhase1({
        texto: texto,
        nombre_archivo: `atencion_${nombre.toLowerCase().replace(/\s+/g, '_')}.txt`,
        tipo_entrada: `Atención Ciudadana (${medio})`,
      });

      if (resFase1.success) {
        await api.runPhase2({
          sesion_id: resFase1.data.sesion_id,
          task_id_inicial: resFase1.data.task_id_inicial,
          task_id_distribuidor: resFase1.data.task_id_distribuidor,
          categoria: 'AGENTE_ATENCION_CIUDADANA',
          agente_destino_nombre: 'Agente_Atencion_Ciudadana',
          texto_documento: texto,
          nombre_archivo: resFase1.data.nombre_archivo,
          tipo_entrada: resFase1.data.tipo_entrada,
          solicitud_id: resFase1.data.solicitud_id,
        });

        setSubmitSuccess(true);
        setNombre('');
        setMotivo('');
        cargarSolicitudes();
        setTimeout(() => setSubmitSuccess(false), 5000);
      }
    } catch (err) {
      console.error('Error registrando atención ciudadana:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-green">Ventanilla Única</span>
          <span className="badge badge-gold">Agente de Interacción Ciudadana</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
          Módulo de Atención y Solicitudes Ciudadanas
        </h1>
        <p style={{ color: '#475569', fontSize: '0.96rem', maxWidth: '850px', lineHeight: 1.6 }}>
          Recepción y canalización inteligente de peticiones ciudadanas, quejas y denuncias procesadas por el SMA con persistencia en PostgreSQL Neon.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        {/* Formulario de Registro Rápido */}
        <div className="glass-card" style={{ padding: '28px' }}>
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
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(3, 20, 16, 0.7)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#ffffff',
                  outline: 'none',
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

            <div style={{ marginBottom: '20px' }}>
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
      </div>
    </div>
  );
}
