import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  Target, 
  Activity,
  Scan,
  Zap,
  Eye
} from 'lucide-react';
import CssRobotAvatar from './CssRobotAvatar';

export default function LateralAgentHero({
  agent,
  isProcessing = false,
  isCompleted = false,
  customThinkingText = '',
  statusLabel = '',
  phaseBadge = ''
}) {
  if (!agent) return null;

  // Estados interactivos en la tarjeta
  const [isScanning, setIsScanning] = useState(true); // Escáner activo por defecto
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });

  const cardRef = useRef(null);

  // Paleta de temas adaptativa
  const themeConfig = {
    cyan: {
      border: 'rgba(6, 182, 212, 0.55)',
      primary: '#00f0ff',
      glow: '0 0 30px rgba(6, 182, 212, 0.5)',
      bg: 'linear-gradient(160deg, rgba(8, 51, 68, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-blue',
      roleColor: '#22d3ee',
      laserColor: '#00f0ff'
    },
    blue: {
      border: 'rgba(59, 130, 246, 0.55)',
      primary: '#3b82f6',
      glow: '0 0 30px rgba(59, 130, 246, 0.5)',
      bg: 'linear-gradient(160deg, rgba(23, 37, 84, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-blue',
      roleColor: '#60a5fa',
      laserColor: '#3b82f6'
    },
    green: {
      border: 'rgba(16, 185, 129, 0.55)',
      primary: '#10b981',
      glow: '0 0 30px rgba(16, 185, 129, 0.5)',
      bg: 'linear-gradient(160deg, rgba(2, 44, 34, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-green',
      roleColor: '#34d399',
      laserColor: '#10b981'
    },
    gold: {
      border: 'rgba(245, 158, 11, 0.55)',
      primary: '#f59e0b',
      glow: '0 0 30px rgba(245, 158, 11, 0.5)',
      bg: 'linear-gradient(160deg, rgba(69, 26, 3, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-gold',
      roleColor: '#fbbf24',
      laserColor: '#fbbf24'
    },
    amber: {
      border: 'rgba(245, 158, 11, 0.55)',
      primary: '#f59e0b',
      glow: '0 0 30px rgba(245, 158, 11, 0.5)',
      bg: 'linear-gradient(160deg, rgba(69, 26, 3, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-gold',
      roleColor: '#fbbf24',
      laserColor: '#fbbf24'
    },
    pink: {
      border: 'rgba(236, 72, 153, 0.55)',
      primary: '#ec4899',
      glow: '0 0 30px rgba(236, 72, 153, 0.5)',
      bg: 'linear-gradient(160deg, rgba(80, 7, 36, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-red',
      roleColor: '#f472b6',
      laserColor: '#ec4899'
    },
    violet: {
      border: 'rgba(168, 85, 247, 0.55)',
      primary: '#a855f7',
      glow: '0 0 30px rgba(168, 85, 247, 0.5)',
      bg: 'linear-gradient(160deg, rgba(46, 16, 101, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-violet',
      roleColor: '#a78bfa',
      laserColor: '#a855f7'
    },
    purple: {
      border: 'rgba(126, 34, 206, 0.55)',
      primary: '#a855f7',
      glow: '0 0 30px rgba(126, 34, 206, 0.5)',
      bg: 'linear-gradient(160deg, rgba(59, 7, 100, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-violet',
      roleColor: '#c084fc',
      laserColor: '#c084fc'
    },
    emerald: {
      border: 'rgba(16, 185, 129, 0.55)',
      primary: '#10b981',
      glow: '0 0 30px rgba(16, 185, 129, 0.5)',
      bg: 'linear-gradient(160deg, rgba(2, 44, 34, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-green',
      roleColor: '#6ee7b7',
      laserColor: '#10b981'
    },
    sky: {
      border: 'rgba(14, 165, 233, 0.55)',
      primary: '#0ea5e9',
      glow: '0 0 30px rgba(14, 165, 233, 0.5)',
      bg: 'linear-gradient(160deg, rgba(7, 89, 133, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-blue',
      roleColor: '#38bdf8',
      laserColor: '#0ea5e9'
    },
    rose: {
      border: 'rgba(244, 63, 94, 0.55)',
      primary: '#f43f5e',
      glow: '0 0 30px rgba(244, 63, 94, 0.5)',
      bg: 'linear-gradient(160deg, rgba(76, 5, 25, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-red',
      roleColor: '#fb7185',
      laserColor: '#f43f5e'
    },
    indigo: {
      border: 'rgba(99, 102, 241, 0.55)',
      primary: '#6366f1',
      glow: '0 0 30px rgba(99, 102, 241, 0.5)',
      bg: 'linear-gradient(160deg, rgba(49, 46, 129, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      badgeClass: 'badge-blue',
      roleColor: '#818cf8',
      laserColor: '#6366f1'
    }
  };

  const tc = themeConfig[agent.theme] || themeConfig.cyan;

  // Manejo del efecto 3D Tilt interactivo al mover el cursor sobre la imagen
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalizar entre -1 y 1
    const normX = (x / rect.width) * 2 - 1;
    const normY = (y / rect.height) * 2 - 1;

    // Inclinación sutil y fluida de hasta 10 grados
    setTilt({
      x: -normY * 10,
      y: normX * 10,
      glareX: (x / rect.width) * 100,
      glareY: (y / rect.height) * 100
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
  };

  const toggleScan = (e) => {
    e.stopPropagation();
    setIsScanning(prev => !prev);
  };

  return (
    <>
      <style>{`
        @keyframes laserScan {
          0% { top: 2%; opacity: 0.85; }
          50% { top: 94%; opacity: 1; }
          100% { top: 2%; opacity: 0.85; }
        }
        @keyframes cyberGlowPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .robot-hero-laser {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, ${tc.laserColor} 20%, #ffffff 50%, ${tc.laserColor} 80%, transparent 100%);
          box-shadow: 0 0 14px ${tc.laserColor}, 0 0 24px ${tc.laserColor};
          animation: laserScan 2.6s ease-in-out infinite;
          z-index: 5;
          pointer-events: none;
        }
        .robot-scanline-grid {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(15, 23, 42, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
          background-size: 100% 4px, 6px 100%;
          pointer-events: none;
          z-index: 3;
          opacity: 0.4;
        }
        .hero-scan-toggle-btn {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
          backdrop-filter: blur(8px);
          border-radius: 8px;
          padding: 5px 9px;
          font-size: 0.72rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .hero-scan-toggle-btn:hover {
          background: ${tc.primary};
          color: #0f172a;
          border-color: ${tc.primary};
          box-shadow: 0 0 12px ${tc.primary}88;
        }
      `}</style>

      <div style={{
        background: tc.bg,
        border: `2px solid ${tc.border}`,
        boxShadow: isProcessing ? tc.glow : '0 12px 35px rgba(0, 0, 0, 0.45)',
        borderRadius: '24px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        height: '100%'
      }}>
        {/* Top Header Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className={`badge ${tc.badgeClass}`} style={{ fontSize: '0.78rem', padding: '5px 12px', fontWeight: 700 }}>
            {phaseBadge || agent.level}
          </span>
          {isProcessing && (
            <span className="badge badge-gold" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Activity size={13} className="animate-spin" /> Procesando en Vivo
            </span>
          )}
          {isCompleted && (
            <span className="badge badge-green" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Ejecutado
            </span>
          )}
        </div>

        {/* ── IMAGEN MÁS GRANDE EN LA TARJETA CON EFECTO DE ESCANEO LÁSER Y 3D TILT ── */}
        <div 
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'relative',
            width: '100%',
            height: '340px', // Más grande en la tarjeta
            borderRadius: '20px',
            overflow: 'hidden',
            border: `2.5px solid ${isHovered ? '#ffffff' : tc.primary}`,
            boxShadow: isHovered 
              ? `0 16px 36px rgba(0, 0, 0, 0.6), 0 0 28px ${tc.primary}77` 
              : isProcessing 
                ? tc.glow 
                : '0 10px 28px rgba(0, 0, 0, 0.5)',
            marginBottom: '18px',
            background: 'radial-gradient(circle at center, #1e293b 0%, #090d16 100%)',
            perspective: '800px',
            transform: isHovered 
              ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)` 
              : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
            transition: isHovered ? 'transform 0.1s ease-out, border-color 0.25s ease' : 'transform 0.4s ease, border-color 0.3s ease, box-shadow 0.3s ease'
          }}
        >
          {/* Subtle Cyber scanline mesh grid */}
          <div className="robot-scanline-grid" />

          {/* Holographic dynamic glare overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, 0.2) 0%, transparent 60%)`,
            pointerEvents: 'none',
            zIndex: 4,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.25s ease'
          }} />

          {/* Laser Scanner Beam (animado recorriendo la imagen) */}
          {(isScanning || isProcessing) && (
            <div className="robot-hero-laser" />
          )}

          {/* Robot Image Content */}
          {agent.image ? (
            <img
              src={agent.image}
              alt={agent.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: '4px',
                filter: isProcessing 
                  ? 'brightness(1.2) contrast(1.1) drop-shadow(0 0 10px rgba(0,240,255,0.4))' 
                  : isHovered 
                    ? 'brightness(1.12) contrast(1.05)' 
                    : 'none',
                transition: 'filter 0.3s ease, transform 0.3s ease',
                transform: isHovered ? 'scale(1.03)' : 'scale(1)'
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CssRobotAvatar
                theme={agent.theme}
                status={isProcessing ? 'thinking' : isCompleted ? 'completed' : 'idle'}
                size="xl"
                showBubble={isProcessing}
                thinkingText={customThinkingText}
              />
            </div>
          )}

          {/* HUD Target Reticles on corners for futuristic look */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '12px',
            height: '12px',
            borderTop: `2px solid ${tc.primary}`,
            borderLeft: `2px solid ${tc.primary}`,
            pointerEvents: 'none',
            zIndex: 3
          }} />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '12px',
            height: '12px',
            borderTop: `2px solid ${tc.primary}`,
            borderRight: `2px solid ${tc.primary}`,
            pointerEvents: 'none',
            zIndex: 3
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            width: '12px',
            height: '12px',
            borderBottom: `2px solid ${tc.primary}`,
            borderLeft: `2px solid ${tc.primary}`,
            pointerEvents: 'none',
            zIndex: 3
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '12px',
            height: '12px',
            borderBottom: `2px solid ${tc.primary}`,
            borderRight: `2px solid ${tc.primary}`,
            pointerEvents: 'none',
            zIndex: 3
          }} />

          {/* Interactive Toggle Button for Laser Scanner */}
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 6
          }}>
            <button
              onClick={toggleScan}
              className="hero-scan-toggle-btn"
              title={isScanning ? 'Pausar escáner láser' : 'Activar escáner láser'}
              style={{
                background: isScanning ? 'rgba(0, 240, 255, 0.2)' : 'rgba(15, 23, 42, 0.85)',
                borderColor: isScanning ? tc.primary : 'rgba(255, 255, 255, 0.2)',
                color: isScanning ? tc.primary : '#cbd5e1'
              }}
            >
              <Scan size={13} />
              <span>{isScanning ? 'Escáner Activo' : 'Escanear'}</span>
            </button>
          </div>

          {/* Live Thinking Status Box */}
          {isProcessing && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '10px',
              right: '10px',
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              borderRadius: '10px',
              border: `1px solid ${tc.primary}`,
              padding: '6px 10px',
              color: '#fbbf24',
              fontSize: '0.74rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              zIndex: 7
            }}>
              <Sparkles size={14} className="animate-spin" />
              <span>{customThinkingText || 'Analizando en vivo...'}</span>
            </div>
          )}
        </div>

        {/* Name and Role */}
        <h3 style={{
          color: '#ffffff',
          fontSize: '1.25rem',
          fontWeight: 800,
          margin: '0 0 4px 0',
          fontFamily: 'Outfit, sans-serif'
        }}>
          {agent.name}
        </h3>
        <div style={{
          color: tc.roleColor,
          fontSize: '0.88rem',
          fontWeight: 700,
          marginBottom: '14px'
        }}>
          {agent.role}
        </div>

        {/* Legal & Procedural Justification */}
        {agent.justificacion && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.45)',
            borderLeft: `3.5px solid ${tc.primary}`,
            borderRadius: '10px',
            padding: '12px 14px',
            textAlign: 'left',
            marginBottom: '14px',
            width: '100%',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: tc.primary,
              fontSize: '0.76rem',
              fontWeight: 700,
              marginBottom: '5px'
            }}>
              <Target size={14} />
              <span>¿Por qué se realiza este paso?</span>
            </div>
            <p style={{
              color: '#e2e8f0',
              fontSize: '0.78rem',
              lineHeight: 1.45,
              margin: 0
            }}>
              {agent.justificacion}
            </p>
          </div>
        )}

        {/* Model & Metadata tag at bottom */}
        <div style={{
          marginTop: 'auto',
          width: '100%',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#94a3b8'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24', fontFamily: 'monospace' }}>
            <Cpu size={13} />
            <span>{agent.model ? (agent.model.includes('/') ? agent.model.split('/')[1] : agent.model) : 'Nemotron-3 30B'}</span>
          </div>
          <span style={{ color: isCompleted ? '#34d399' : isProcessing ? '#fbbf24' : '#94a3b8', fontWeight: 600 }}>
            {statusLabel || (isCompleted ? '✓ Completado' : isProcessing ? '⚡ En Ejecución' : 'Listo para clasificar')}
          </span>
        </div>
      </div>
    </>
  );
}
