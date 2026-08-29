import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

export default function RobotCard({ name, role, level, image, isActive, desc, model, theme = 'green' }) {
  // Unique color-coded themes per Agent: Cyan, Blue, Emerald, Amber Gold, Pink Rose, Electric Violet
  const themes = {
    cyan: {
      borderActive: '#06b6d4', borderInactive: 'rgba(6, 182, 212, 0.4)',
      bgActive: 'linear-gradient(145deg, #0891b2 0%, #0e7490 100%)',
      bgInactive: 'linear-gradient(145deg, #083344 0%, #0e4e6c 100%)',
      iconColor: '#67e8f9', roleColor: '#22d3ee', sparkColor: '#06b6d4',
      badgeClass: 'badge-blue', shadow: '0 8px 25px rgba(6, 182, 212, 0.35)',
      gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'
    },
    blue: {
      borderActive: '#3b82f6', borderInactive: 'rgba(59, 130, 246, 0.4)',
      bgActive: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 100%)',
      bgInactive: 'linear-gradient(145deg, #172554 0%, #1e3a8a 100%)',
      iconColor: '#93c5fd', roleColor: '#60a5fa', sparkColor: '#3b82f6',
      badgeClass: 'badge-blue', shadow: '0 8px 25px rgba(59, 130, 246, 0.35)',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
    },
    green: {
      borderActive: '#10b981', borderInactive: 'rgba(16, 185, 129, 0.4)',
      bgActive: 'linear-gradient(145deg, #059669 0%, #047857 100%)',
      bgInactive: 'linear-gradient(145deg, #022c22 0%, #064e3b 100%)',
      iconColor: '#6ee7b7', roleColor: '#34d399', sparkColor: '#10b981',
      badgeClass: 'badge-green', shadow: '0 8px 25px rgba(16, 185, 129, 0.35)',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
    },
    gold: {
      borderActive: '#f59e0b', borderInactive: 'rgba(245, 158, 11, 0.4)',
      bgActive: 'linear-gradient(145deg, #d97706 0%, #b45309 100%)',
      bgInactive: 'linear-gradient(145deg, #451a03 0%, #78350f 100%)',
      iconColor: '#fde047', roleColor: '#fbbf24', sparkColor: '#f59e0b',
      badgeClass: 'badge-gold', shadow: '0 8px 25px rgba(245, 158, 11, 0.35)',
      gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
    },
    pink: {
      borderActive: '#ec4899', borderInactive: 'rgba(236, 72, 153, 0.4)',
      bgActive: 'linear-gradient(145deg, #db2777 0%, #be185d 100%)',
      bgInactive: 'linear-gradient(145deg, #500724 0%, #831843 100%)',
      iconColor: '#fbcfe8', roleColor: '#f472b6', sparkColor: '#ec4899',
      badgeClass: 'badge-red', shadow: '0 8px 25px rgba(236, 72, 153, 0.35)',
      gradient: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)'
    },
    violet: {
      borderActive: '#8b5cf6', borderInactive: 'rgba(139, 92, 246, 0.4)',
      bgActive: 'linear-gradient(145deg, #7c3aed 0%, #6d28d9 100%)',
      bgInactive: 'linear-gradient(145deg, #2e1065 0%, #4c1d95 100%)',
      iconColor: '#ddd6fe', roleColor: '#a78bfa', sparkColor: '#8b5cf6',
      badgeClass: 'badge-violet', shadow: '0 8px 25px rgba(139, 92, 246, 0.35)',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
    },
    white: {
      borderActive: '#06b6d4', borderInactive: 'rgba(6, 182, 212, 0.4)',
      bgActive: 'linear-gradient(145deg, #0891b2 0%, #0e7490 100%)',
      bgInactive: 'linear-gradient(145deg, #083344 0%, #0e4e6c 100%)',
      iconColor: '#67e8f9', roleColor: '#22d3ee', sparkColor: '#06b6d4',
      badgeClass: 'badge-blue', shadow: '0 8px 25px rgba(6, 182, 212, 0.35)',
      gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'
    }
  };

  const t = themes[theme] || themes.green;

  return (
    <div style={{
      padding: '18px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      borderRadius: '16px',
      border: isActive ? `2px solid ${t.borderActive}` : `1.5px solid ${t.borderInactive}`,
      background: isActive ? t.bgActive : t.bgInactive,
      boxShadow: isActive ? `${t.shadow}, 0 0 20px ${t.borderActive}55` : '0 6px 20px rgba(0, 0, 0, 0.12)',
      transform: isActive ? 'scale(1.02)' : 'none',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: 'default'
    }}>
      <div style={{ position: 'relative', width: '62px', height: '62px', flexShrink: 0 }}>
        {image ? (
          <img
            src={image}
            alt={name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '14px',
              border: `2px solid ${isActive ? t.borderActive : t.borderInactive}`,
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '14px',
            background: t.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
          }}>
            <Bot size={30} color={t.iconColor} />
          </div>
        )}
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

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.98rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
            {name}
          </span>
          <span className={`badge ${t.badgeClass || 'badge-green'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
            {level}
          </span>
        </div>
        <div style={{ fontSize: '0.82rem', color: t.roleColor, fontWeight: 700, marginBottom: '4px' }}>
          {role}
        </div>
        <div style={{ fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.35 }}>
          {desc}
        </div>
        {model && (
          <div style={{ fontSize: '0.68rem', color: '#fbbf24', marginTop: '6px', fontFamily: 'monospace', opacity: 0.9 }}>
            LLM: {model}
          </div>
        )}
      </div>
    </div>
  );
}
