import React from 'react';

/**
 * AgentResultCard — Tarjeta de resultado a ancho completo (solo contenido del dictamen).
 * La columna lateral con la imagen del robot fue eliminada: el banner grande
 * (renderAgentHeaderContainer) es la única cabecera visual del agente.
 * Las props image/phaseLabel/badgeText/justificacion/onViewPrev se aceptan por
 * compatibilidad con las páginas de agentes, pero ya no se renderizan.
 */
export default function AgentResultCard({
  agentName = 'Agente Inteligente',
  role = 'Procesamiento de Datos',
  theme = 'green',
  status = 'completed',
  thinkingText = 'Resultado de procesamiento',
  model = '',
  phaseLabel = '',
  children,
  badgeText = '',
  image = '',
  justificacion = '',
  garantiaEtica = '',
  onViewPrev = null,
  prevLabel = 'Ver Ejecución Anterior',
}) {
  const themeStyles = {
    cyan: {
      border: 'rgba(0, 180, 216, 0.45)',
      bg: 'linear-gradient(135deg, rgba(11, 37, 69, 0.95) 0%, rgba(19, 64, 116, 0.85) 100%)',
      titleColor: '#00B4D8',
      glow: '0 12px 35px rgba(0, 180, 216, 0.25)',
      badgeClass: 'badge-blue',
      accent: '#00B4D8',
      glowShadow: '0 0 25px rgba(0, 180, 216, 0.5)'
    },
    blue: {
      border: 'rgba(2, 132, 199, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#38BDF8',
      glow: '0 12px 35px rgba(2, 132, 199, 0.25)',
      badgeClass: 'badge-blue',
      accent: '#0284C7',
      glowShadow: '0 0 25px rgba(2, 132, 199, 0.5)'
    },
    green: {
      border: 'rgba(138, 201, 38, 0.45)',
      bg: 'linear-gradient(135deg, rgba(11, 37, 69, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
      titleColor: '#8AC926',
      glow: '0 12px 35px rgba(138, 201, 38, 0.25)',
      badgeClass: 'badge-green',
      accent: '#8AC926',
      glowShadow: '0 0 25px rgba(138, 201, 38, 0.5)'
    },
    gold: {
      border: 'rgba(244, 162, 97, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#F4A261',
      glow: '0 12px 35px rgba(244, 162, 97, 0.25)',
      badgeClass: 'badge-gold',
      accent: '#F4A261',
      glowShadow: '0 0 25px rgba(244, 162, 97, 0.5)'
    },
    pink: {
      border: 'rgba(231, 111, 81, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#E76F51',
      glow: '0 12px 35px rgba(231, 111, 81, 0.25)',
      badgeClass: 'badge-red',
      accent: '#E76F51',
      glowShadow: '0 0 25px rgba(231, 111, 81, 0.5)'
    },
    violet: {
      border: 'rgba(168, 85, 247, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#a78bfa',
      glow: '0 12px 35px rgba(168, 85, 247, 0.25)',
      badgeClass: 'badge-violet',
      accent: '#a855f7',
      glowShadow: '0 0 25px rgba(168, 85, 247, 0.5)'
    },
    purple: {
      border: 'rgba(168, 85, 247, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#c084fc',
      glow: '0 12px 35px rgba(168, 85, 247, 0.25)',
      badgeClass: 'badge-violet',
      accent: '#a855f7',
      glowShadow: '0 0 25px rgba(168, 85, 247, 0.5)'
    },
    emerald: {
      border: 'rgba(138, 201, 38, 0.45)',
      bg: 'linear-gradient(135deg, rgba(11, 37, 69, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
      titleColor: '#8AC926',
      glow: '0 12px 35px rgba(138, 201, 38, 0.25)',
      badgeClass: 'badge-green',
      accent: '#8AC926',
      glowShadow: '0 0 25px rgba(138, 201, 38, 0.5)'
    },
    amber: {
      border: 'rgba(244, 162, 97, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#F4A261',
      glow: '0 12px 35px rgba(244, 162, 97, 0.25)',
      badgeClass: 'badge-gold',
      accent: '#F4A261',
      glowShadow: '0 0 25px rgba(244, 162, 97, 0.5)'
    },
    sky: {
      border: 'rgba(0, 180, 216, 0.45)',
      bg: 'linear-gradient(135deg, rgba(11, 37, 69, 0.95) 0%, rgba(19, 64, 116, 0.85) 100%)',
      titleColor: '#00B4D8',
      glow: '0 12px 35px rgba(0, 180, 216, 0.25)',
      badgeClass: 'badge-blue',
      accent: '#00B4D8',
      glowShadow: '0 0 25px rgba(0, 180, 216, 0.5)'
    },
    rose: {
      border: 'rgba(231, 111, 81, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#E76F51',
      glow: '0 12px 35px rgba(231, 111, 81, 0.25)',
      badgeClass: 'badge-red',
      accent: '#E76F51',
      glowShadow: '0 0 25px rgba(231, 111, 81, 0.5)'
    },
    indigo: {
      border: 'rgba(2, 132, 199, 0.45)',
      bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      titleColor: '#38BDF8',
      glow: '0 12px 35px rgba(2, 132, 199, 0.25)',
      badgeClass: 'badge-blue',
      accent: '#0284C7',
      glowShadow: '0 0 25px rgba(2, 132, 199, 0.5)'
    }
  };

  const ts = themeStyles[theme] || themeStyles.green;

  return (
    <div style={{
      borderRadius: '24px',
      border: `2px solid ${ts.border}`,
      background: ts.bg,
      boxShadow: ts.glow,
      padding: '24px',
      marginBottom: '32px',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(16px)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient lighting */}
      <div style={{
        position: 'absolute',
        top: '-80px',
        left: '-80px',
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        background: ts.accent,
        filter: 'blur(100px)',
        opacity: 0.25,
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Contenido del dictamen a ancho completo (sin columna lateral) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
