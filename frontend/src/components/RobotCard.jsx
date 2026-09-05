import React from 'react';
import { Sparkles, Cpu, Activity, CheckCircle2, Target } from 'lucide-react';
import CssRobotAvatar from './CssRobotAvatar';

export default function RobotCard({
  name,
  role,
  level,
  image,
  isActive,
  isCompleted,
  desc,
  justificacion = '',
  model,
  theme = 'green',
  thinkingText = ''
}) {
  // Themes
  const themes = {
    cyan: {
      borderActive: '#06b6d4', borderInactive: 'rgba(6, 182, 212, 0.4)',
      bgActive: 'linear-gradient(145deg, #0891b2 0%, #0e7490 100%)',
      bgInactive: 'linear-gradient(145deg, #083344 0%, #0e4e6c 100%)',
      iconColor: '#67e8f9', roleColor: '#22d3ee', sparkColor: '#06b6d4',
      badgeClass: 'badge-blue', shadow: '0 8px 25px rgba(6, 182, 212, 0.5)',
      statusLabel: 'Fase 1: Registro & Clasificación'
    },
    blue: {
      borderActive: '#3b82f6', borderInactive: 'rgba(59, 130, 246, 0.4)',
      bgActive: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 100%)',
      bgInactive: 'linear-gradient(145deg, #172554 0%, #1e3a8a 100%)',
      iconColor: '#93c5fd', roleColor: '#60a5fa', sparkColor: '#3b82f6',
      badgeClass: 'badge-blue', shadow: '0 8px 25px rgba(59, 130, 246, 0.5)',
      statusLabel: 'Fase 2: Asignación Temática'
    },
    green: {
      borderActive: '#10b981', borderInactive: 'rgba(16, 185, 129, 0.4)',
      bgActive: 'linear-gradient(145deg, #059669 0%, #047857 100%)',
      bgInactive: 'linear-gradient(145deg, #022c22 0%, #064e3b 100%)',
      iconColor: '#6ee7b7', roleColor: '#34d399', sparkColor: '#10b981',
      badgeClass: 'badge-green', shadow: '0 8px 25px rgba(16, 185, 129, 0.5)',
      statusLabel: 'Fase 2: Auditoría Constitucional'
    },
    gold: {
      borderActive: '#f59e0b', borderInactive: 'rgba(245, 158, 11, 0.4)',
      bgActive: 'linear-gradient(145deg, #d97706 0%, #b45309 100%)',
      bgInactive: 'linear-gradient(145deg, #451a03 0%, #78350f 100%)',
      iconColor: '#fde047', roleColor: '#fbbf24', sparkColor: '#f59e0b',
      badgeClass: 'badge-gold', shadow: '0 8px 25px rgba(245, 158, 11, 0.5)',
      statusLabel: 'Fase 2: Vectores & Similitud pgvector'
    },
    pink: {
      borderActive: '#ec4899', borderInactive: 'rgba(236, 72, 153, 0.4)',
      bgActive: 'linear-gradient(145deg, #db2777 0%, #be185d 100%)',
      bgInactive: 'linear-gradient(145deg, #500724 0%, #831843 100%)',
      iconColor: '#fbcfe8', roleColor: '#f472b6', sparkColor: '#ec4899',
      badgeClass: 'badge-red', shadow: '0 8px 25px rgba(236, 72, 153, 0.5)',
      statusLabel: 'Fase 3: Redacción & PDF'
    },
    violet: {
      borderActive: '#a855f7', borderInactive: 'rgba(168, 85, 247, 0.4)',
      bgActive: 'linear-gradient(145deg, #7c3aed 0%, #6d28d9 100%)',
      bgInactive: 'linear-gradient(145deg, #2e1065 0%, #4c1d95 100%)',
      iconColor: '#ddd6fe', roleColor: '#a78bfa', sparkColor: '#a855f7',
      badgeClass: 'badge-violet', shadow: '0 8px 25px rgba(168, 85, 247, 0.5)',
      statusLabel: 'Fase 3: Notificación Oficial HTML'
    },
    teal: {
      borderActive: '#14b8a6', borderInactive: 'rgba(20, 184, 166, 0.4)',
      bgActive: 'linear-gradient(145deg, #0d9488 0%, #0f766e 100%)',
      bgInactive: 'linear-gradient(145deg, #042f2e 0%, #134e4a 100%)',
      iconColor: '#99f6e4', roleColor: '#2dd4bf', sparkColor: '#14b8a6',
      badgeClass: 'badge-blue', shadow: '0 8px 25px rgba(20, 184, 166, 0.5)',
      statusLabel: 'Fase Atención: Atención Ciudadana'
    }
  };

  const t = themes[theme] || themes.green;
  const botStatus = isActive ? 'thinking' : isCompleted ? 'completed' : 'idle';

  return (
    <div style={{
      padding: '20px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      borderRadius: '20px',
      border: isActive ? `2px solid ${t.borderActive}` : isCompleted ? '2px solid #10b981' : `1.5px solid ${t.borderInactive}`,
      background: isActive ? t.bgActive : t.bgInactive,
      boxShadow: isActive ? `${t.shadow}, 0 0 25px ${t.borderActive}88` : isCompleted ? '0 6px 20px rgba(16, 185, 129, 0.25)' : '0 6px 20px rgba(0, 0, 0, 0.3)',
      transform: isActive ? 'scale(1.03) translateY(-3px)' : 'none',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* Top row: Avatar + Core Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Avatar Container with glowing border */}
        <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
          {image ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={image}
                alt={name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '16px',
                  border: `2px solid ${isActive ? t.borderActive : isCompleted ? '#10b981' : t.borderInactive}`,
                  boxShadow: isActive ? `0 0 16px ${t.borderActive}` : '0 4px 10px rgba(0,0,0,0.4)',
                  transition: 'all 0.3s ease'
                }}
              />
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: '-4px',
                  right: '-4px',
                  background: t.sparkColor,
                  borderRadius: '50%',
                  padding: '4px',
                  boxShadow: `0 0 10px ${t.sparkColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={12} color="#ffffff" />
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <CssRobotAvatar
                theme={theme}
                status={botStatus}
                size="md"
                showBubble={isActive}
                thinkingText={thinkingText || (isActive ? 'Procesando...' : '')}
              />
            </div>
          )}
        </div>

        {/* Content Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '6px' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
              {name}
            </span>
            <span className={`badge ${t.badgeClass || 'badge-green'}`} style={{ fontSize: '0.68rem', padding: '2px 8px', fontWeight: 700 }}>
              {level}
            </span>
          </div>

          <div style={{ fontSize: '0.84rem', color: t.roleColor, fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isActive && <Activity size={14} className="animate-spin" color={t.borderActive} />}
            {role}
          </div>

          <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.35 }}>
            {desc}
          </div>
        </div>
      </div>

      {/* Why it is executed (Justificación) */}
      {justificacion && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          borderLeft: `3px solid ${isActive ? t.borderActive : isCompleted ? '#10b981' : 'rgba(255, 255, 255, 0.2)'}`,
          borderRadius: '6px',
          padding: '7px 10px',
          fontSize: '0.74rem',
          color: '#e2e8f0',
          lineHeight: 1.35
        }}>
          <span style={{ fontWeight: 700, color: t.roleColor, marginRight: '4px' }}>
            🎯 ¿Por qué se realiza?
          </span>
          {justificacion}
        </div>
      )}

      {/* Dynamic Status Badges: In Execution OR Completed Check */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', flexWrap: 'wrap', gap: '6px' }}>
        {model && (
          <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontFamily: 'monospace', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={12} color="#fbbf24" /> {model}
          </div>
        )}

        {isActive ? (
          <div style={{
            fontSize: '0.74rem',
            color: '#ffffff',
            background: 'rgba(245, 158, 11, 0.3)',
            border: '1px solid #f59e0b',
            padding: '3px 10px',
            borderRadius: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)'
          }}>
            <Sparkles size={12} className="animate-spin" color="#fbbf24" /> En Ejecución...
          </div>
        ) : isCompleted ? (
          <div style={{
            fontSize: '0.74rem',
            color: '#ffffff',
            background: 'rgba(16, 185, 129, 0.35)',
            border: '1px solid #10b981',
            padding: '3px 10px',
            borderRadius: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)'
          }}>
            <CheckCircle2 size={13} color="#34d399" /> ✓ Ejecutado
          </div>
        ) : (
          <div style={{
            fontSize: '0.7rem',
            color: '#94a3b8',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            Pendiente
          </div>
        )}
      </div>
    </div>
  );
}
