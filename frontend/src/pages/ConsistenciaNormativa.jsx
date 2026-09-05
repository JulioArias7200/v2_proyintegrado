import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Search, 
  BookOpen, 
  Cpu, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

import CssRobotAvatar from '../components/CssRobotAvatar';

export default function ConsistenciaNormativa() {
  const [normativaData, setNormativaData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Búsqueda Semántica Vectorial
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    cargarNormativa();
  }, []);

  const cargarNormativa = async () => {
    setLoading(true);
    try {
      const res = await api.getNormativa(30);
      setNormativaData(res);
    } catch (err) {
      console.error('Error cargando normativa:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarSemantica = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    try {
      const res = await api.searchNormativa(searchQuery, null, 0.45, 8);
      setSearchResults(res.resultados || []);
    } catch (err) {
      setSearchError(err.message || 'Error en la búsqueda vectorial');
    } finally {
      setIsSearching(false);
    }
  };

  const stats = normativaData?.stats || {};
  const documentos = normativaData?.documentos || [];
  const ultimosAnalisis = normativaData?.ultimos_analisis || [];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header with CSS Robot Avatar Banner */}
      <div style={{
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '24px',
        background: 'linear-gradient(135deg, rgba(69, 26, 3, 0.8) 0%, rgba(120, 53, 15, 0.5) 100%)',
        padding: '24px 30px',
        borderRadius: '24px',
        border: '1.5px solid rgba(245, 158, 11, 0.4)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-green">Corpus Legal Vigente</span>
            <span className="badge badge-gold">Embeddings NVIDIA + pgvector</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Agente de Consistencia Normativa
          </h1>
          <p style={{ color: '#fde68a', fontSize: '0.96rem', maxWidth: '850px', lineHeight: 1.6 }}>
            Auditoría semántica de artículos contra todo el ordenamiento jurídico vigente (leyes, decretos, códigos) usando vectores de 2048 dimensiones.
          </p>
        </div>

        {/* Dynamic HTML/CSS Bot Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(33, 13, 2, 0.6)', padding: '16px 24px', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <CssRobotAvatar
            theme="gold"
            status={isSearching ? 'working' : 'idle'}
            size="lg"
            showBubble={true}
            thinkingText={isSearching ? 'Buscando en vectores 2048d...' : 'Auditoría semántica lista'}
          />
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1rem' }}>Bot Normativo</div>
            <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>NVIDIA Nemotron 1B Embeddings</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Cuerpos Normativos Cargados:</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>
            {stats.total_normas || 0}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Artículos Indexados (pgvector):</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#059669' }}>
            {(stats.total_articulos || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Hallazgos / Conflictos Detectados:</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706' }}>
            {stats.total_analisis || 0}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Modelo de Embeddings:</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2563eb', marginTop: '6px' }}>
            NVIDIA nemotron-3-embed-1b
          </div>
        </div>
      </div>

      {/* Semantic Vector Search Playground */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '32px', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} color="#34d399" />
          Probador de Búsqueda Semántica Vectorial
        </h2>
        <p style={{ color: '#a7f3d0', fontSize: '0.85rem', marginBottom: '16px' }}>
          Ingrese un artículo o proposición para generar su embedding y buscar normas vigentes con significado equivalente o contradictorio en Neon pgvector.
        </p>

        <form onSubmit={handleBuscarSemantica} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ej: Sanción a la minería ilegal en reservas naturales..."
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(3, 20, 16, 0.7)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#ffffff',
              fontSize: '0.95rem',
              outline: 'none',
            }}
          />
          <button type="submit" disabled={isSearching || !searchQuery.trim()} className="btn-primary">
            {isSearching ? <Cpu size={18} className="pulse-active" /> : <Search size={18} />}
            <span>Buscar Similitud</span>
          </button>
        </form>

        {searchError && (
          <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>
            {searchError}
          </div>
        )}

        {/* Resultados de Busqueda Vectorial */}
        {searchResults.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1rem', color: '#34d399', marginBottom: '12px' }}>
              Candidatos Semánticos Encontrados ({searchResults.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {searchResults.map((res, i) => (
                <div key={i} style={{
                  background: 'rgba(6, 40, 32, 0.8)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                      {res.documento} — Art. {res.numero}
                    </strong>
                    <span className="badge badge-blue">
                      Similitud: {Math.round(res.similitud * 100)}%
                    </span>
                  </div>
                  <p style={{ color: '#a7f3d0', fontSize: '0.85rem', lineHeight: 1.5, maxHeight: '100px', overflowY: 'auto' }}>
                    {res.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legal Bodies List */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="#34d399" />
          Cuerpos Normativos en Base de Datos (public.articulos_normativos)
        </h2>

        {documentos.length === 0 ? (
          <div style={{ color: '#a7f3d0', fontSize: '0.9rem', textAlign: 'center', padding: '24px' }}>
            No hay leyes registradas aún en el corpus. Puede cargar normas usando <code>python cargar_normativa.py</code>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {documentos.map((doc, i) => (
              <div key={i} style={{
                background: 'rgba(3, 20, 16, 0.6)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}>
                <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                  {doc.documento}
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem', color: '#a7f3d0' }}>
                  <span>Tipo: <strong style={{ color: '#ffffff' }}>{doc.tipo_documento}</strong></span>
                  <span>•</span>
                  <span>Artículos: <strong style={{ color: '#ffffff' }}>{doc.num_articulos}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Consistency Analyses */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={18} color="#34d399" />
          Últimas Llamadas de Atención Emitidas
        </h2>

        {ultimosAnalisis.length === 0 ? (
          <div style={{ color: '#a7f3d0', fontSize: '0.9rem', textAlign: 'center', padding: '24px' }}>
            No se han registrado hallazgos de consistencia recientemente.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ultimosAnalisis.map((item, i) => (
              <div key={i} style={{
                background: 'rgba(6, 40, 32, 0.6)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>
                      {item.norma || 'Norma Vigente'} — Art. {item.numero_articulo}
                    </strong>
                    {item.nombre_archivo && (
                      <span style={{ fontSize: '0.78rem', color: '#a7f3d0', marginLeft: '8px' }}>
                        (Origen: {item.nombre_archivo})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-gold">{item.tipo_relacion}</span>
                    {item.similitud && (
                      <span className="badge badge-blue">{Math.round(item.similitud * 100)}%</span>
                    )}
                  </div>
                </div>
                <div style={{ color: '#f0fdf4', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '6px' }}>
                  {item.justificacion}
                </div>
                {item.sugerencia && (
                  <div style={{ color: '#fbbf24', fontSize: '0.82rem', fontStyle: 'italic' }}>
                    💡 {item.sugerencia}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
