import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Zap, 
  ShieldCheck, 
  Check, 
  FolderInput,
  Building2,
  Scale,
  FileSearch,
  FileCheck,
  SendHorizontal,
  BookOpen,
  Merge,
  MessagesSquare,
  GitBranch,
  Gavel,
  Newspaper,
  Database
} from 'lucide-react';

/**
 * Mapeo de paleta sobria, elegante y distinguible para abogados
 */
export const LEGAL_THEMES = {
  teal: {
    primary: '#0f766e',
    secondary: '#14b8a6',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    tintBg: 'rgba(15, 118, 110, 0.09)',
    borderSubtle: 'rgba(15, 118, 110, 0.25)',
    glowShadow: 'rgba(20, 184, 166, 0.35)',
    badgeBg: 'rgba(15, 118, 110, 0.15)',
    textColor: '#0f766e'
  },
  blue: {
    primary: '#1d4ed8',
    secondary: '#3b82f6',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    tintBg: 'rgba(29, 78, 216, 0.08)',
    borderSubtle: 'rgba(29, 78, 216, 0.25)',
    glowShadow: 'rgba(59, 130, 246, 0.35)',
    badgeBg: 'rgba(29, 78, 216, 0.15)',
    textColor: '#1d4ed8'
  },
  green: {
    primary: '#047857',
    secondary: '#10b981',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    tintBg: 'rgba(4, 120, 87, 0.08)',
    borderSubtle: 'rgba(4, 120, 87, 0.25)',
    glowShadow: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(4, 120, 87, 0.15)',
    textColor: '#047857'
  },
  amber: {
    primary: '#b45309',
    secondary: '#f59e0b',
    gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
    tintBg: 'rgba(180, 83, 9, 0.08)',
    borderSubtle: 'rgba(180, 83, 9, 0.25)',
    glowShadow: 'rgba(245, 158, 11, 0.35)',
    badgeBg: 'rgba(180, 83, 9, 0.15)',
    textColor: '#b45309'
  },
  pink: {
    primary: '#be185d',
    secondary: '#ec4899',
    gradient: 'linear-gradient(135deg, #9d174d 0%, #ec4899 100%)',
    tintBg: 'rgba(190, 24, 93, 0.08)',
    borderSubtle: 'rgba(190, 24, 93, 0.25)',
    glowShadow: 'rgba(236, 72, 153, 0.35)',
    badgeBg: 'rgba(190, 24, 93, 0.15)',
    textColor: '#be185d'
  },
  violet: {
    primary: '#6d28d9',
    secondary: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 100%)',
    tintBg: 'rgba(109, 40, 217, 0.08)',
    borderSubtle: 'rgba(109, 40, 217, 0.25)',
    glowShadow: 'rgba(139, 92, 246, 0.35)',
    badgeBg: 'rgba(109, 40, 217, 0.15)',
    textColor: '#6d28d9'
  },
  purple: {
    primary: '#7e22ce',
    secondary: '#a855f7',
    gradient: 'linear-gradient(135deg, #6b21a8 0%, #a855f7 100%)',
    tintBg: 'rgba(126, 34, 206, 0.08)',
    borderSubtle: 'rgba(126, 34, 206, 0.25)',
    glowShadow: 'rgba(168, 85, 247, 0.35)',
    badgeBg: 'rgba(126, 34, 206, 0.15)',
    textColor: '#7e22ce'
  },
  emerald: {
    primary: '#065f46',
    secondary: '#059669',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
    tintBg: 'rgba(6, 95, 70, 0.08)',
    borderSubtle: 'rgba(6, 95, 70, 0.25)',
    glowShadow: 'rgba(5, 150, 105, 0.35)',
    badgeBg: 'rgba(6, 95, 70, 0.15)',
    textColor: '#065f46'
  },
  sky: {
    primary: '#0369a1',
    secondary: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)',
    tintBg: 'rgba(3, 105, 161, 0.08)',
    borderSubtle: 'rgba(3, 105, 161, 0.25)',
    glowShadow: 'rgba(14, 165, 233, 0.35)',
    badgeBg: 'rgba(3, 105, 161, 0.15)',
    textColor: '#0369a1'
  },
  rose: {
    primary: '#be123c',
    secondary: '#f43f5e',
    gradient: 'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
    tintBg: 'rgba(190, 18, 60, 0.08)',
    borderSubtle: 'rgba(190, 18, 60, 0.25)',
    glowShadow: 'rgba(244, 63, 94, 0.35)',
    badgeBg: 'rgba(190, 18, 60, 0.15)',
    textColor: '#be123c'
  },
  indigo: {
    primary: '#4338ca',
    secondary: '#6366f1',
    gradient: 'linear-gradient(135deg, #3730a3 0%, #6366f1 100%)',
    tintBg: 'rgba(67, 56, 202, 0.08)',
    borderSubtle: 'rgba(67, 56, 202, 0.25)',
    glowShadow: 'rgba(99, 102, 241, 0.35)',
    badgeBg: 'rgba(67, 56, 202, 0.15)',
    textColor: '#4338ca'
  },
  gold: {
    primary: '#b45309',
    secondary: '#f59e0b',
    gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
    tintBg: 'rgba(180, 83, 9, 0.08)',
    borderSubtle: 'rgba(180, 83, 9, 0.25)',
    glowShadow: 'rgba(245, 158, 11, 0.35)',
    badgeBg: 'rgba(180, 83, 9, 0.15)',
    textColor: '#b45309'
  },
  cyan: {
    primary: '#0e7490',
    secondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #155e75 0%, #06b6d4 100%)',
    tintBg: 'rgba(14, 116, 144, 0.08)',
    borderSubtle: 'rgba(14, 116, 144, 0.25)',
    glowShadow: 'rgba(6, 182, 212, 0.35)',
    badgeBg: 'rgba(14, 116, 144, 0.15)',
    textColor: '#0e7490'
  }
};

/**
 * Mapeo de iconos legales tradicionales (sin humanoides)
 */
export const LEGAL_ICONS = {
  distribuidor: FolderInput,
  comision: Building2,
  constitucional: Scale,
  consistencia: FileSearch,
  emisor: FileCheck,
  notificador: SendHorizontal,
  constitucion_fondo: BookOpen,
  concentrador_crew: Merge,
  secretario: MessagesSquare,
  bicameral: GitBranch,
  veto_promulgacion: Gavel,
  publicacion: Newspaper
};

/**
 * Estructura Visual Unificada de Tarjeta de Agente Legal
 */
export default function LegalAgentCard({
  agent,
  isActive = false,
  isDone = false,
  isInspected = false,
  onClick = null,
  width = '100%',
  compact = false,
  badgeText = ''
}) {
  if (!agent) return null;

  const themeKey = agent.theme || 'teal';
  const theme = LEGAL_THEMES[themeKey] || LEGAL_THEMES.teal;
  const LegalIcon = LEGAL_ICONS[agent.key || agent.id] || agent.workflowIcon || Scale;

  // Determinar estado textual y de badge
  let estadoText = badgeText || 'Pendiente';
  let estadoBadgeBg = 'rgba(0, 0, 0, 0.25)';
  let avatarBadgeIcon = '⏳';
  let avatarBadgeBg = '#f1f5f9';
  let avatarBadgeColor = '#64748b';

  if (isDone) {
    estadoText = badgeText || 'Completado';
    estadoBadgeBg = 'rgba(16, 185, 129, 0.4)';
    avatarBadgeIcon = '✓';
    avatarBadgeBg = '#10b981';
    avatarBadgeColor = '#ffffff';
  } else if (isActive) {
    estadoText = badgeText || 'Activo';
    estadoBadgeBg = 'rgba(255, 255, 255, 0.35)';
    avatarBadgeIcon = '⚡';
    avatarBadgeBg = theme.primary;
    avatarBadgeColor = '#ffffff';
  }

  const faseLabel = agent.phaseName || agent.phaseBadge || `Fase ${agent.stepNumber || '1'}`;
  const funcionText = agent.desc || agent.justificacion || agent.role || 'Procesamiento y análisis legislativo institucional.';
  const garantiaText = agent.garantiaEtica || 'Garantía de debido proceso y trazabilidad legal verificada.';
  const modeloText = agent.model ? (agent.model.split('/')[1] || agent.model) : 'Nemotron-3 30B';

  return (
    <div
      onClick={onClick}
      style={{
        width: width,
        minWidth: compact ? '220px' : '280px',
        maxWidth: width === '100%' ? 'none' : width,
        background: '#ffffff',
        borderRadius: '16px',
        border: `2px solid ${isActive || isInspected ? theme.primary : theme.borderSubtle}`,
        boxShadow: isActive
          ? `0 0 24px ${theme.glowShadow}, 0 8px 24px rgba(15, 23, 42, 0.12)`
          : isInspected
          ? `0 0 18px ${theme.glowShadow}`
          : isDone
          ? '0 4px 14px rgba(16, 185, 129, 0.12)'
          : '0 4px 14px rgba(15, 23, 42, 0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transform: isActive || isInspected ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.borderColor = theme.primary;
          e.currentTarget.style.boxShadow = `0 12px 28px ${theme.glowShadow}, 0 4px 12px rgba(15, 23, 42, 0.08)`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = (isActive || isInspected) ? 'translateY(-3px)' : 'none';
        e.currentTarget.style.borderColor = (isActive || isInspected) ? theme.primary : theme.borderSubtle;
        e.currentTarget.style.boxShadow = isActive
          ? `0 0 24px ${theme.glowShadow}, 0 8px 24px rgba(15, 23, 42, 0.12)`
          : isDone
          ? '0 4px 14px rgba(16, 185, 129, 0.12)'
          : '0 4px 14px rgba(15, 23, 42, 0.06)';
      }}
      title={`${agent.name} — ${agent.role}\n${garantiaText}`}
    >
      {/* ── HEADER CON GRADIENTE DEL COLOR DEL AGENTE ── */}
      <div style={{
        background: theme.gradient,
        padding: compact ? '12px 14px' : '16px 18px',
        color: '#ffffff',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Top Badges Row */}
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          {/* Badge Superior Izquierdo: Fase X */}
          <span style={{
            background: 'rgba(255, 255, 255, 0.22)',
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            border: '1px solid rgba(255, 255, 255, 0.35)'
          }}>
            {faseLabel}
          </span>

          {/* Badge Superior Derecho: Estado */}
          <span style={{
            background: estadoBadgeBg,
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            {estadoText}
          </span>
        </div>

        {/* ── AVATAR CENTRAL: SELLO / ICONO VECTORIAL SVG LEGAL ── */}
        <div style={{
          position: 'relative',
          width: compact ? '52px' : '64px',
          height: compact ? '52px' : '64px',
          borderRadius: '50%',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)',
          border: `2px solid rgba(255, 255, 255, 0.85)`,
          marginBottom: '10px'
        }}>
          {/* Anillo exterior animado si está activo */}
          {isActive && (
            <div style={{
              position: 'absolute',
              inset: '-5px',
              borderRadius: '50%',
              border: '2.5px dashed #ffffff',
              animation: 'spin 6s linear infinite',
              pointerEvents: 'none'
            }} />
          )}

          <LegalIcon size={compact ? 26 : 32} color={theme.primary} strokeWidth={2.2} />

          {/* Indicador de estado inferior derecho del avatar */}
          <div style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: avatarBadgeBg,
            color: avatarBadgeColor,
            border: '2px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 800,
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}>
            {avatarBadgeIcon}
          </div>
        </div>

        {/* Nombre del Agente */}
        <h4 style={{
          fontSize: compact ? '14px' : '16px',
          fontWeight: 800,
          color: '#ffffff',
          margin: '0 0 3px 0',
          fontFamily: "'Outfit', sans-serif",
          lineHeight: 1.25
        }}>
          {agent.name}
        </h4>

        {/* Rol / Función breve */}
        <div style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.92)',
          fontWeight: 600,
          letterSpacing: '0.01em',
          lineHeight: 1.3
        }}>
          {agent.role}
        </div>
      </div>

      {/* ── CUERPO CON FONDO BLANCO Y CAJA DE INFORMACIÓN ── */}
      <div style={{
        padding: compact ? '12px 14px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        gap: '12px',
        background: '#ffffff'
      }}>
        {/* Caja de información con fondo tintado al 10% y borde izquierdo sólido */}
        <div style={{
          background: theme.tintBg,
          borderLeft: `4px solid ${theme.primary}`,
          borderRadius: '6px',
          padding: '10px 12px'
        }}>
          <span style={{
            fontWeight: 700,
            color: theme.primary,
            fontSize: '12px',
            display: 'block',
            marginBottom: '3px'
          }}>
            Función Parlamentaria:
          </span>
          <p style={{
            color: '#1e293b',
            fontSize: '12px',
            lineHeight: 1.5,
            margin: 0
          }}>
            {funcionText}
          </p>
        </div>

        {/* Footer: Modelo IA y Estado */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid #f1f5f9',
          fontSize: '12px',
          color: '#475569'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ color: theme.primary, fontSize: '14px' }}>◉</span>
            <span>{modeloText}</span>
          </div>

          <span style={{
            fontWeight: 700,
            color: isDone ? '#059669' : isActive ? theme.primary : '#64748b'
          }}>
            {estadoText}
          </span>
        </div>

        {/* Línea de garantía ética específica con icono de verificación */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 10px',
          borderRadius: '8px',
          background: 'rgba(248, 250, 252, 0.9)',
          border: `1px solid ${theme.borderSubtle}`
        }}>
          <ShieldCheck size={16} color={theme.primary} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '12px',
            color: '#334155',
            fontWeight: 600,
            lineHeight: 1.35
          }}>
            {garantiaText}
          </span>
        </div>
      </div>
    </div>
  );
}
