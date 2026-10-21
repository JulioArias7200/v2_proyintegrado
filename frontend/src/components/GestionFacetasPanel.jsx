import React, { useState, useEffect } from 'react';
import { Settings, Plus, Pencil, Trash2, Save, X, Power, Loader2 } from 'lucide-react';
import { api } from '../services/api';

const VACIO = {
  nombre: '',
  logo: '/robots/logos/asistente_profesional.jpg',
  trigger_description: '',
  system_prompt: '',
  temperature: 0.4,
};

/**
 * Administración de facetas del Asistente Ciudadano Multi-Faceta.
 * Crea, edita, activa/desactiva y elimina sub-agentes (facetas) del router
 * automático. Pensado para roles internos (Secretaría, Comisión, etc.).
 */
export default function GestionFacetasPanel() {
  const [abierto, setAbierto] = useState(false);
  const [facetas, setFacetas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const [editandoId, setEditandoId] = useState(null); // null = cerrado, 'nueva' = creando
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.getAgentesCiudadanos(false); // incluye inactivas para administrarlas
      setFacetas(res.data || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las facetas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto]);

  const abrirNueva = () => {
    setForm(VACIO);
    setEditandoId('nueva');
  };

  const abrirEdicion = (f) => {
    setForm({
      nombre: f.nombre,
      logo: f.logo || '',
      trigger_description: f.trigger_description,
      system_prompt: f.system_prompt,
      temperature: f.temperature,
    });
    setEditandoId(f.id);
  };

  const cancelar = () => {
    setEditandoId(null);
    setForm(VACIO);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.trigger_description.trim() || !form.system_prompt.trim()) {
      setError('Nombre, disparador (trigger) y system prompt son obligatorios.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      if (editandoId === 'nueva') {
        await api.crearAgenteCiudadano(form);
      } else {
        await api.actualizarAgenteCiudadano(editandoId, form);
      }
      cancelar();
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la faceta.');
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (f) => {
    try {
      await api.actualizarAgenteCiudadano(f.id, { activo: !f.activo });
      setFacetas((prev) => prev.map((x) => (x.id === f.id ? { ...x, activo: !x.activo } : x)));
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.');
    }
  };

  const eliminar = async (f) => {
    if (!window.confirm(`¿Eliminar la faceta "${f.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarAgenteCiudadano(f.id);
      setFacetas((prev) => prev.filter((x) => x.id !== f.id));
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la faceta.');
    }
  };

  const campoEstilo = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'rgba(3, 20, 16, 0.7)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#ffffff',
    outline: 'none',
    fontSize: '0.85rem',
  };
  const labelEstilo = { display: 'block', fontSize: '0.78rem', color: '#a7f3d0', marginBottom: '5px', fontWeight: 600 };

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <Settings size={19} color="#5eead4" />
        <span style={{ color: '#ffffff', fontSize: '1.02rem', fontWeight: 700 }}>
          Administrar facetas del Asistente Ciudadano
        </span>
        <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: '0.8rem' }}>
          {abierto ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>

      {abierto && (
        <div style={{ marginTop: '18px' }}>
          <p style={{ color: '#94A3B8', fontSize: '0.82rem', marginBottom: '14px' }}>
            Cada faceta necesita un <b>disparador (trigger)</b>: una frase que le dice al router
            CUÁNDO usarla. Cuantas más facetas tengas, más específico conviene que sea.
          </p>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px', padding: '10px 14px', color: '#fca5a5',
              fontSize: '0.82rem', marginBottom: '14px',
            }}>
              {error}
            </div>
          )}

          {editandoId === null && (
            <button onClick={abrirNueva} className="btn-primary" style={{ marginBottom: '16px' }}>
              <Plus size={16} />
              <span>Nueva faceta</span>
            </button>
          )}

          {editandoId !== null && (
            <div style={{
              background: 'rgba(3, 20, 16, 0.5)', border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px', padding: '18px', marginBottom: '18px',
            }}>
              <h3 style={{ color: '#ffffff', fontSize: '0.95rem', marginBottom: '14px' }}>
                {editandoId === 'nueva' ? 'Nueva faceta' : 'Editar faceta'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelEstilo}>Nombre</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Impuestos y Tributos"
                    style={campoEstilo}
                  />
                </div>
                <div>
                  <label style={labelEstilo}>Logo (ruta o URL de imagen)</label>
                  <input
                    type="text"
                    value={form.logo}
                    onChange={(e) => setForm({ ...form, logo: e.target.value })}
                    placeholder="/robots/logos/asistente_profesional.jpg"
                    style={campoEstilo}
                  />
                </div>
                <div>
                  <label style={labelEstilo}>Temperatura</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                    style={campoEstilo}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={labelEstilo}>
                  Disparador (trigger_description) — cuándo debe usarse esta faceta
                </label>
                <textarea
                  value={form.trigger_description}
                  onChange={(e) => setForm({ ...form, trigger_description: e.target.value })}
                  placeholder="Ej: Consultas sobre impuestos municipales, patentes, formularios tributarios o multas"
                  rows={2}
                  style={{ ...campoEstilo, resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelEstilo}>System prompt — cómo debe responder</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder="Eres un asistente tributario municipal. Explica en lenguaje simple..."
                  rows={4}
                  style={{ ...campoEstilo, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={guardar} disabled={guardando} className="btn-primary">
                  {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{guardando ? 'Guardando…' : 'Guardar'}</span>
                </button>
                <button onClick={cancelar} disabled={guardando} className="btn-secondary">
                  <X size={16} />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          )}

          {cargando ? (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Cargando facetas…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {facetas.map((f) => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'rgba(3, 20, 16, 0.4)',
                  border: `1px solid ${f.activo ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.2)'}`,
                  opacity: f.activo ? 1 : 0.55,
                }}>
                  <img src={/^(\/|https?:\/\/)/.test(f.logo || '') ? f.logo : '/robots/logos/asistente_profesional.jpg'}
                    alt={f.nombre} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem' }}>{f.nombre}</div>
                    <div style={{
                      color: '#64748B', fontSize: '0.76rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {f.trigger_description}
                    </div>
                  </div>
                  <button
                    onClick={() => alternarActivo(f)}
                    title={f.activo ? 'Desactivar' : 'Activar'}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: f.activo ? '#5eead4' : '#64748B', display: 'flex',
                    }}
                  >
                    <Power size={16} />
                  </button>
                  <button
                    onClick={() => abrirEdicion(f)}
                    title="Editar"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => eliminar(f)}
                    title="Eliminar"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {facetas.length === 0 && (
                <div style={{ color: '#64748B', fontSize: '0.85rem' }}>Todavía no hay facetas creadas.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
