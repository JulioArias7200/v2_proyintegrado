import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import AsistenteMultifacetaPanel from './AsistenteMultifacetaPanel';
import { api } from '../services/api';

/**
 * Botón Flotante y Ventana Modal/Drawer del Asistente Ciudadano Multi-Faceta
 * ------------------------------------------------------------------------
 * Permite acceder al asistente ciudadano desde cualquier pantalla del sistema
 * manteniendo la estética institucional dark-glassmorphism.
 */
export default function FloatingCitizenAssistant({ sesionId = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalFacetas, setTotalFacetas] = useState(0);

  useEffect(() => {
    api.getAgentesCiudadanos(true)
      .then((res) => {
        if (res && res.data) {
          setTotalFacetas(res.data.length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ── BOTÓN FLOTANTE (FAB) ── */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1050,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px'
      }}>
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #00B4D8 0%, #0284C7 50%, #0B2545 100%)',
              border: '1.5px solid rgba(0, 240, 255, 0.6)',
              color: '#FFFFFF',
              boxShadow: '0 8px 30px rgba(0, 180, 216, 0.45), 0 0 16px rgba(0, 180, 216, 0.3)',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.90rem',
              fontFamily: 'Outfit, sans-serif',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: 'pulse-glow-blue 3s infinite'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(0, 180, 216, 0.65)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 180, 216, 0.45)';
            }}
            title="Abrir Asistente Ciudadano Multi-Faceta"
          >
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src="/robots/logos/asistente_profesional.jpg" alt="Asistente ciudadano" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: '50%' }} />
            </div>
            <span>Atención Ciudadana</span>
            {totalFacetas > 0 && (
              <span style={{
                background: 'rgba(16, 185, 129, 0.35)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '999px'
              }}>
                {totalFacetas} facetas
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── VENTANA MODAL / DRAWER FLOTANTE ── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: isExpanded ? 'min(900px, 94vw)' : 'min(500px, 94vw)',
          height: isExpanded ? 'min(820px, 88vh)' : 'min(640px, 80vh)',
          zIndex: 1100,
          background: 'linear-gradient(160deg, rgba(11, 37, 69, 0.97) 0%, rgba(7, 18, 36, 0.98) 100%)',
          border: '1.5px solid rgba(0, 180, 216, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 180, 216, 0.25)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'fade-in 0.25s ease-out'
        }}>
          {/* Header de la ventana flotante */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(11, 37, 69, 0.85)',
            borderBottom: '1px solid rgba(0, 180, 216, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00B4D8, #0284C7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(0, 180, 216, 0.5)'
              }}>
                <img src="/robots/logos/asistente_profesional.jpg" alt="Asistente multifacético" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 10 }} />
              </div>
              <div>
                <div style={{
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  fontFamily: 'Outfit, sans-serif',
                  lineHeight: 1.2
                }}>
                  Asistente Ciudadano Multi-Faceta
                </div>
                <div style={{
                  color: '#38BDF8',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Orientación profesional y ciudadana
                </div>
              </div>
            </div>

            {/* Controles del modal (Expandir / Cerrar) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setIsExpanded(v => !v)}
                title={isExpanded ? 'Reducir' : 'Expandir'}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94A3B8',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Cerrar"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Cuerpo con el panel multifaceta */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px'
          }}>
            <AsistenteMultifacetaPanel sesionId={sesionId} />
          </div>
        </div>
      )}
    </>
  );
}
