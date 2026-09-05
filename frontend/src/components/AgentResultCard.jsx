import React from 'react';
import { 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Target, 
  Zap
} from 'lucide-react';
import CssRobotAvatar from './CssRobotAvatar';

/**
 * AgentResultCard — Tarjeta de resultado con Robot Visual y Dictamen Estructurado
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
}) {
  const themeStyles = {
    cyan: {
      border: 'rgba(6, 182, 212, 0.55)',
      bg: 'linear-gradient(135deg, rgba(8, 51, 68, 0.95) 0%, rgba(14, 78, 108, 0.85) 100%)',
      titleColor: '#22d3ee',
      glow: '0 12px 35px rgba(6, 182, 212, 0.35)',
      badgeClass: 'badge-blue',
      accent: '#06b6d4',
      glowShadow: '0 0 25px rgba(6, 182, 212, 0.6)'
    },
    blue: {
      border: 'rgba(59, 130, 246, 0.55)',
      bg: 'linear-gradient(135deg, rgba(23, 37, 84, 0.95) 0%, rgba(30, 58, 138, 0.85) 100%)',
      titleColor: '#60a5fa',
      glow: '0 12px 35px rgba(59, 130, 246, 0.35)',
      badgeClass: 'badge-blue',
      accent: '#3b82f6',
      glowShadow: '0 0 25px rgba(59, 130, 246, 0.6)'
    },
    green: {
      border: 'rgba(16, 185, 129, 0.55)',
      bg: 'linear-gradient(135deg, rgba(2, 44, 34, 0.95) 0%, rgba(6, 78, 59, 0.85) 100%)',
      titleColor: '#34d399',
      glow: '0 12px 35px rgba(16, 185, 129, 0.35)',
      badgeClass: 'badge-green',
      accent: '#10b981',
      glowShadow: '0 0 25px rgba(16, 185, 129, 0.6)'
    },
    gold: {
      border: 'rgba(245, 158, 11, 0.55)',
      bg: 'linear-gradient(135deg, rgba(69, 26, 3, 0.95) 0%, rgba(120, 53, 15, 0.85) 100%)',
      titleColor: '#fbbf24',
      glow: '0 12px 35px rgba(245, 158, 11, 0.35)',
      badgeClass: 'badge-gold',
      accent: '#f59e0b',
      glowShadow: '0 0 25px rgba(245, 158, 11, 0.6)'
    },
    pink: {
      border: 'rgba(236, 72, 153, 0.55)',
      bg: 'linear-gradient(135deg, rgba(80, 7, 36, 0.95) 0%, rgba(131, 24, 67, 0.85) 100%)',
      titleColor: '#f472b6',
      glow: '0 12px 35px rgba(236, 72, 153, 0.35)',
      badgeClass: 'badge-red',
      accent: '#ec4899',
      glowShadow: '0 0 25px rgba(236, 72, 153, 0.6)'
    },
    violet: {
      border: 'rgba(168, 85, 247, 0.55)',
      bg: 'linear-gradient(135deg, rgba(46, 16, 101, 0.95) 0%, rgba(76, 29, 149, 0.85) 100%)',
      titleColor: '#a78bfa',
      glow: '0 12px 35px rgba(168, 85, 247, 0.35)',
      badgeClass: 'badge-violet',
      accent: '#a855f7',
      glowShadow: '0 0 25px rgba(168, 85, 247, 0.6)'
    },
    purple: {
      border: 'rgba(168, 85, 247, 0.6)',
      bg: 'linear-gradient(135deg, rgba(59, 7, 100, 0.95) 0%, rgba(88, 28, 135, 0.85) 100%)',
      titleColor: '#c084fc',
      glow: '0 12px 35px rgba(168, 85, 247, 0.4)',
      badgeClass: 'badge-violet',
      accent: '#a855f7',
      glowShadow: '0 0 25px rgba(168, 85, 247, 0.6)'
    },
    emerald: {
      border: 'rgba(16, 185, 129, 0.6)',
      bg: 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(4, 120, 87, 0.85) 100%)',
      titleColor: '#34d399',
      glow: '0 12px 35px rgba(16, 185, 129, 0.4)',
      badgeClass: 'badge-green',
      accent: '#10b981',
      glowShadow: '0 0 25px rgba(16, 185, 129, 0.6)'
    },
    amber: {
      border: 'rgba(245, 158, 11, 0.6)',
      bg: 'linear-gradient(135deg, rgba(69, 26, 3, 0.95) 0%, rgba(180, 83, 9, 0.85) 100%)',
      titleColor: '#fbbf24',
      glow: '0 12px 35px rgba(245, 158, 11, 0.4)',
      badgeClass: 'badge-gold',
      accent: '#f59e0b',
      glowShadow: '0 0 25px rgba(245, 158, 11, 0.6)'
    },
    sky: {
      border: 'rgba(14, 165, 233, 0.6)',
      bg: 'linear-gradient(135deg, rgba(12, 74, 110, 0.95) 0%, rgba(3, 105, 161, 0.85) 100%)',
      titleColor: '#38bdf8',
      glow: '0 12px 35px rgba(14, 165, 233, 0.4)',
      badgeClass: 'badge-blue',
      accent: '#0ea5e9',
      glowShadow: '0 0 25px rgba(14, 165, 233, 0.6)'
    },
    rose: {
      border: 'rgba(244, 63, 94, 0.6)',
      bg: 'linear-gradient(135deg, rgba(76, 5, 25, 0.95) 0%, rgba(159, 18, 57, 0.85) 100%)',
      titleColor: '#fb7185',
      glow: '0 12px 35px rgba(244, 63, 94, 0.4)',
      badgeClass: 'badge-red',
      accent: '#f43f5e',
      glowShadow: '0 0 25px rgba(244, 63, 94, 0.6)'
    },
    indigo: {
      border: 'rgba(99, 102, 241, 0.6)',
      bg: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(67, 56, 202, 0.85) 100%)',
      titleColor: '#818cf8',
      glow: '0 12px 35px rgba(99, 102, 241, 0.4)',
      badgeClass: 'badge-blue',
      accent: '#6366f1',
      glowShadow: '0 0 25px rgba(99, 102, 241, 0.6)'
    }
  };

  const ts = themeStyles[theme] || themeStyles.green;
  const isWorking = status === 'thinking' || status === 'working';
  const isDone = status === 'completed';

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

      {/* Main Split Layout: Lateral Robot Panel + Content Body */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 280px) 1fr',
        gap: '24px',
        position: 'relative',
        zIndex: 1,
        alignItems: 'start'
      }} className="agent-result-grid">

        {/* ── COLUMNA LATERAL: ROBOT DE GRAN IMPACTO VISUAL ── */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: `1.5px solid ${ts.border}`,
          borderRadius: '20px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          position: 'sticky',
          top: '20px'
        }}>
          {/* Header Tag / Phase */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {phaseLabel && <span className={`badge ${ts.badgeClass}`} style={{ fontSize: '0.72rem' }}>{phaseLabel}</span>}
            {badgeText && <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>{badgeText}</span>}
          </div>

          {/* Imagen de Alto Impacto con marco brillante */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '230px',
            borderRadius: '16px',
            overflow: 'hidden',
            marginBottom: '16px',
            border: `2px solid ${ts.accent}`,
            boxShadow: isWorking ? ts.glowShadow : '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            {image ? (
              <img
                src={image}
                alt={agentName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: isWorking ? 'brightness(1.1) contrast(1.05)' : 'none',
                  transition: 'all 0.5s ease'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(30, 41, 59, 0.8)'
              }}>
                <CssRobotAvatar
                  theme={theme}
                  status={status}
                  size="lg"
                  showBubble={isWorking}
                  thinkingText={thinkingText}
                />
              </div>
            )}

            {/* Checkmark overlay badge if completed */}
            {isDone && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#10b981',
                color: '#ffffff',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px #10b981',
                border: '2px solid #ffffff'
              }}>
                <CheckCircle2 size={20} />
              </div>
            )}

            {/* Active processing pulse overlay */}
            {isWorking && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(6px)',
                borderRadius: '10px',
                padding: '6px 10px',
                color: '#fbbf24',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center'
              }}>
                <Sparkles size={14} className="animate-spin" />
                <span>Analizando en Vivo...</span>
              </div>
            )}
          </div>

          {/* Nombre y Rol */}
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.01em',
            margin: '0 0 4px 0',
            lineHeight: 1.2
          }}>
            {agentName}
          </h3>
          <div style={{
            fontSize: '0.82rem',
            color: ts.titleColor,
            fontWeight: 700,
            marginBottom: '12px'
          }}>
            {role}
          </div>

          {/* Status Badge con Check Prominente */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: isWorking ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)',
            border: `1.5px solid ${isWorking ? '#f59e0b' : '#10b981'}`,
            borderRadius: '12px',
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: isWorking ? '#fbbf24' : '#34d399',
            marginBottom: '16px',
            boxShadow: isDone ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
          }}>
            {isWorking ? (
              <>
                <Zap size={16} className="animate-pulse" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} color="#34d399" />
                <span>✓ Fase Ejecutada</span>
              </>
            )}
          </div>

          {/* ¿Por qué se realiza este paso? */}
          {justificacion && (
            <div style={{
              width: '100%',
              background: 'rgba(30, 41, 59, 0.85)',
              borderLeft: `4px solid ${ts.accent}`,
              borderRadius: '8px',
              padding: '10px 12px',
              textAlign: 'left',
              fontSize: '0.78rem',
              color: '#e2e8f0',
              lineHeight: 1.45,
              marginBottom: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                color: ts.titleColor,
                marginBottom: '4px',
                fontSize: '0.76rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                <Target size={13} />
                <span>¿Por qué se realiza?</span>
              </div>
              <div>{justificacion}</div>
            </div>
          )}

          {/* LLM Model Info */}
          {model && (
            <div style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: 'auto'
            }}>
              <Cpu size={12} color="#fbbf24" /> {model}
            </div>
          )}
        </div>

        {/* ── COLUMNA DERECHA: RESULTADOS Y DICTAMEN ESTRUCTURADO ── */}
        <div style={{ minWidth: 0 }}>
          {children}
        </div>

      </div>
    </div>
  );
}
