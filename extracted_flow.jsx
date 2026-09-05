import React, { useRef, useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Eye, 
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Scale,
  Building2,
  FileCheck,
  Mail,
  Zap,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  FolderInput,
  FileSearch,
  SendHorizontal
} from 'lucide-react';

export const AGENTS_DEFINITION = [
  {
    id: 'distribuidor',
    key: 'distribuidor',
    stepNumber: '01',
    name: 'Agente Distribuidor',
    shortName: 'Distribuidor',
    role: 'Clasificación Institucional',
    phaseKey: 'fase1',
    phaseName: 'Fase 1: Admisión',
    theme: 'cyan',
    activeStep: 1,
    doneAtStep: 2,
    image: '/robots/robot_distribuidor_hi.jpg',
    desc: 'Determina si el documento es legislativo, ciudadano o correspondencia.',
    justificacion: 'Debido proceso parlamentario: canaliza cada documento por su vía institucional correcta.',
    model: 'Nemotron-3 30B',
    workflowIcon: FolderInput,
    iconLabel: 'Admisión'
  },
  {
    id: 'comision',
    key: 'comision',
    stepNumber: '02',
    name: 'Comisión Legislativa',
    shortName: 'Comisión',
    role: 'Asignación Parlamentaria',
    phaseKey: 'fase2',
    phaseName: 'Fase 2: Asignación',
    theme: 'blue',
    activeStep: 3,
    doneAtStep: 4,
    image: '/robots/robot_ciudadano_hi.jpg',
    desc: 'Asigna la comisión parlamentaria competente según la materia de ley.',
    justificacion: 'Art. 158 CPE: distribución por especialidad temática a comisiones camarales.',
    model: 'Nemotron-3 30B',
    workflowIcon: Building2,
    iconLabel: 'Comisiones'
  },
  {
    id: 'constitucional',
    key: 'constitucional',
    stepNumber: '03',
    name: 'Verificador Constitucional',
    shortName: 'Constitucional',
    role: 'Auditoría contra CPE 2009',
    phaseKey: 'fase2',
    phaseName: 'Fase 2: CPE 2009',
    theme: 'green',
    activeStep: 4,
    doneAtStep: 5,
    image: '/robots/robot_constitucional_hi.jpg',
    desc: 'Coteja artículos contra la Constitución Política del Estado.',
    justificacion: 'Art. 410 CPE: Supremacía Constitucional frente a cualquier proyecto de ley.',
    model: 'Nemotron-3 30B',
    workflowIcon: Scale,
    iconLabel: 'CPE 2009'
  },
  {
    id: 'consistencia',
    key: 'consistencia',
    stepNumber: '04',
    name: 'Consistencia Normativa',
    shortName: 'Consistencia',
    role: 'pgvector & Antinomias',
    phaseKey: 'fase2',
    phaseName: 'Fase 2: Leyes Vigentes',
    theme: 'gold',
    activeStep: 5,
    doneAtStep: 6,
    image: '/robots/robot_consistencia_hi.jpg',
    desc: 'Detecta contradicciones o repeticiones contra leyes vigentes.',
    justificacion: 'Seguridad jurídica: previene antinomias con códigos y leyes vigentes.',
    model: 'pgvector 2048d',
    workflowIcon: FileSearch,
    iconLabel: 'Leyes 2048d'
  },
  {
    id: 'emisor',
    key: 'emisor',
    stepNumber: '05',
    name: 'Concentrador y Emisor',
    shortName: 'Emisor PDF',
    role: 'Síntesis Oficial & PDF',
    phaseKey: 'fase3',
    phaseName: 'Fase 3: Dictamen PDF',
    theme: 'pink',
    activeStep: 6,
    doneAtStep: 7,
    image: '/robots/robot_concentrador_hi.jpg',
    desc: 'Consolida los dictámenes y emite el reporte profesional en PDF.',
    justificacion: 'Publicidad y rigor técnico: consolida todos los hallazgos en un informe oficial.',
    model: 'ReportLab + IA',
    workflowIcon: FileCheck,
    iconLabel: 'Informe PDF'
  },
  {
    id: 'notificador',
    key: 'notificador',
    stepNumber: '06',
    name: 'Notificador de Comisión',
    shortName: 'Notificador',
    role: 'Correo Institucional HTML',
    phaseKey: 'fase3',
    phaseName: 'Fase 3: Notificación',
    theme: 'violet',
    activeStep: 7,
    doneAtStep: 8,
    image: '/robots/robot_notificador_hi.jpg',
    desc: 'Redacta y despacha la notificación formal HTML a los legisladores.',
    justificacion: 'Notificación oportuna: comunica formalmente el dictamen a los parlamentarios.',
    model: 'SMTP / HTML SMA',
    workflowIcon: SendHorizontal,
    iconLabel: 'Despacho HTML'
  }
];

export default function HorizontalAgentFlow({
  pipelineStep = 0,
  inspectedAgentId = null,
  onSelectAgent = () => {}
}) {
  const scrollContainerRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'fase1' | 'fase2' | 'fase3'
  const [viewSize, setViewSize] = useState('large'); // 'large' | 'compact'

  const themeColors = {
    cyan: { 
      primary: '#00f0ff', 
      border: '#06b6d4',
      glow: 'rgba(0, 240, 255, 0.45)', 
      bg: 'linear-gradient(170deg, rgba(8, 51, 68, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      badgeBg: 'rgba(6, 182, 212, 0.25)',
      roleColor: '#22d3ee'
    },
    blue: { 
      primary: '#3b82f6', 
      border: '#2563eb',
      glow: 'rgba(59, 130, 246, 0.45)', 
      bg: 'linear-gradient(170deg, rgba(23, 37, 84, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      badgeBg: 'rgba(37, 99, 235, 0.25)',
      roleColor: '#60a5fa'
    },
    green: { 
      primary: '#10b981', 
      border: '#059669',
      glow: 'rgba(16, 185, 129, 0.45)', 
      bg: 'linear-gradient(170deg, rgba(2, 44, 34, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      badgeBg: 'rgba(16, 185, 129, 0.25)',
      roleColor: '#34d399'
    },
    gold: { 
      primary: '#f59e0b', 
      border: '#d97706',
      glow: 'rgba(245, 158, 11, 0.45)', 
      bg: 'linear-gradient(170deg, rgba(69, 26, 3, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      badgeBg: 'rgba(245, 158, 11, 0.25)',
      roleColor: '#fbbf24'
    },
    pink: { 
      primary: '#ec4899', 
      border: '#db2777',
      glow: 'rgba(236, 72, 153, 0.45)', 
      bg: 'linear-gradient(170deg, rgba(80, 7, 36, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      badgeBg: 'rgba(236, 72, 153, 0.25)',
      roleColor: '#f472b6'
    },
    violet: { 
      primary: '#a855f7', 
      border: '#9333ea',
      glow: 'rgba(168, 85, 247, 0.45)', 
      bg: 'linear-gradient(170deg, rgba(46, 16, 101, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      badgeBg: 'rgba(168, 85, 247, 0.25)',
      roleColor: '#a78bfa'
    }
  };

  // Auto-scroll to active agent
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.querySelector('.agent-node-active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [pipelineStep]);

  // Scroll controls
  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  const completedCount = AGENTS_DEFINITION.filter(a => pipelineStep >= a.doneAtStep).length;
  const progressPercent = Math.round((completedCount / AGENTS_DEFINITION.length) * 100);

  const visibleAgents = activeFilter === 'all'
    ? AGENTS_DEFINITION
    : AGENTS_DEFINITION.filter(a => a.phaseKey === activeFilter);

  const isLarge = viewSize === 'large';

  return (
    <div style={{
      width: '100%',
      marginBottom: '26px'
    }}>
      {/* ── WORKFLOW INTERACTIVE CONTROLS BAR ── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '16px',
        padding: '10px 18px',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Left: Workflow title & Interactive Phase Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            color: '#ffffff',
            background: 'linear-gradient(135deg, #059669, #10b981)',
            padding: '4px 12px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.03em'
          }}>
            <Zap size={13} />
            <span>FLUX PIPELINE MULTI-AGENTE</span>
          </div>

          {/* Phase Filter Tabs */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {[
              { key: 'all', label: `Todos (${AGENTS_DEFINITION.length})` },
              { key: 'fase1', label: '📥 Admisión' },
              { key: 'fase2', label: '⚖️ Auditoría' },
              { key: 'fase3', label: '📨 Despacho' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  border: 'none',
                  background: activeFilter === f.key ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  color: activeFilter === f.key ? '#38bdf8' : '#94a3b8',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '0.74rem',
                  fontWeight: activeFilter === f.key ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Size Toggle + Progress Track + Scroll Arrows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          
          {/* Toggle Tamaño de Imagen: Grande vs Compacto */}
          <button
            onClick={() => setViewSize(s => s === 'large' ? 'compact' : 'large')}
            className="btn-secondary"
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#e2e8f0'
            }}
            title="Alternar entre visualización de robot ampliada o compacta"
          >
            {isLarge ? <Minimize2 size={13} color="#38bdf8" /> : <Maximize2 size={13} color="#38bdf8" />}
            <span>{isLarge ? 'Robots Grandes' : 'Robots Compactos'}</span>
          </button>

          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '110px',
              height: '7px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00f0ff, #10b981, #f59e0b, #ec4899, #a855f7)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 700 }}>
              {completedCount}/{AGENTS_DEFINITION.length} ({progressPercent}%)
            </span>
          </div>

          {/* Left / Right Scroll buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleScrollLeft}
              title="Anterior"
              style={{
                border: '1px solid rgba(148, 163, 184, 0.3)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#e2e8f0',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleScrollRight}
              title="Siguiente"
              style={{
                border: '1px solid rgba(148, 163, 184, 0.3)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#e2e8f0',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── HORIZONTAL FLOW TRACK WITH CONNECTORS & LARGE ROBOT IMAGES ── */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          padding: '8px 4px 16px 4px',
          scrollBehavior: 'smooth',
          userSelect: 'none'
        }}
      >
        {visibleAgents.map((agent, index) => {
          const tc = themeColors[agent.theme] || themeColors.green;
          const isActive = pipelineStep === agent.activeStep;
          const isDone = pipelineStep >= agent.doneAtStep;
          const isInspected = inspectedAgentId === agent.id;
          const canInspect = isDone;
          const ActionIcon = agent.workflowIcon;

          const cardBorder = isInspected
            ? `2.5px solid ${tc.primary}`
            : isActive
            ? `2.5px solid ${tc.primary}`
            : isDone
            ? '2px solid rgba(16, 185, 129, 0.75)'
            : '1.5px solid rgba(148, 163, 184, 0.22)';

          const cardShadow = isActive
            ? `0 0 24px ${tc.glow}, 0 8px 30px rgba(0, 0, 0, 0.6)`
            : isInspected
            ? `0 0 20px ${tc.glow}`
            : isDone
            ? '0 4px 16px rgba(16, 185, 129, 0.2)'
            : '0 4px 14px rgba(0, 0, 0, 0.3)';

          const imgSize = isLarge ? '84px' : '56px';
          const cardWidth = isLarge ? '165px' : '138px';

          return (
            <React.Fragment key={agent.id}>
              {/* ── AGENT CARD ── */}
              <div
                className={isActive ? 'agent-node-active' : ''}
                onClick={() => {
                  if (canInspect || isActive) {
                    onSelectAgent(agent);
                  }
                }}
                style={{
                  flex: `0 0 ${cardWidth}`,
                  minWidth: cardWidth,
                  maxWidth: cardWidth,
                  background: tc.bg,
                  border: cardBorder,
                  borderRadius: '18px',
                  padding: isLarge ? '14px 10px' : '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: (canInspect || isActive) ? 'pointer' : 'default',
                  boxShadow: cardShadow,
                  transform: isActive || isInspected ? 'translateY(-3px)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (canInspect || isActive) {
                    e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                    e.currentTarget.style.boxShadow = `0 10px 24px ${tc.glow}`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = (isActive || isInspected) ? 'translateY(-3px)' : 'none';
                  e.currentTarget.style.boxShadow = cardShadow;
                }}
                title={`${agent.name} — ${agent.role}\nJustificación: ${agent.justificacion}`}
              >
                {/* Header Row: Step number + Function Icon */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: isLarge ? '10px' : '6px'
                }}>
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    color: tc.primary,
                    background: tc.badgeBg,
                    border: `1px solid ${tc.primary}55`,
                    borderRadius: '6px',
                    padding: '1px 6px',
                    fontFamily: 'monospace'
                  }}>
                    P{agent.stepNumber}
                  </span>

                  {/* Specific Action/Activity Icon with label */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontSize: '0.64rem',
                    color: tc.primary,
                    fontWeight: 700
                  }}>
                    <ActionIcon size={12} />
                    <span>{agent.iconLabel}</span>
                  </div>
                </div>

                {/* ── ROBOT HERO IMAGE (Much Larger, Detailed & Prominent) ── */}
                <div style={{
                  position: 'relative',
                  width: imgSize,
                  height: imgSize,
                  borderRadius: isLarge ? '20px' : '50%',
                  marginBottom: isLarge ? '10px' : '6px',
                  border: `2.5px solid ${isActive ? tc.primary : isDone ? '#10b981' : tc.border}`,
                  boxShadow: isActive ? `${tc.glow}, 0 0 16px ${tc.primary}88` : '0 6px 18px rgba(0, 0, 0, 0.45)',
                  overflow: 'hidden',
                  background: '#0a0f1d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.3s ease'
                }}>
                  <img
                    src={agent.image}
                    alt={agent.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: isActive ? 'brightness(1.15) contrast(1.1)' : 'none',
                      transition: 'transform 0.3s ease'
                    }}
                  />

                  {/* Active animated rotating border */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: isLarge ? '18px' : '50%',
                      border: `3px dashed ${tc.primary}`,
                      animation: 'spin 4s linear infinite',
                      pointerEvents: 'none'
                    }} />
                  )}

                  {/* Checkmark overlay for completed status */}
                  {isDone && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      background: '#10b981',
                      borderRadius: '50%',
                      width: isLarge ? '22px' : '18px',
                      height: isLarge ? '22px' : '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff',
                      boxShadow: '0 0 8px #10b981'
                    }}>
                      <CheckCircle2 size={isLarge ? 14 : 11} color="#ffffff" />
                    </div>
                  )}
                </div>

                {/* Agent Name */}
                <h4 style={{
                  color: '#ffffff',
                  fontSize: isLarge ? '0.86rem' : '0.78rem',
                  fontWeight: 800,
                  margin: '0 0 2px 0',
                  lineHeight: 1.2,
                  fontFamily: 'Outfit, sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {agent.name}
                </h4>

                {/* Role */}
                <div style={{
                  color: tc.roleColor,
                  fontSize: isLarge ? '0.7rem' : '0.64rem',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  marginBottom: isLarge ? '10px' : '6px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {agent.role}
                </div>

                {/* Bottom Status Button */}
                <div style={{ width: '100%', marginTop: 'auto' }}>
                  {isActive ? (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.45))',
                      border: '1px solid #f59e0b',
                      color: '#fef08a',
                      borderRadius: '8px',
                      padding: '3px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
                    }}>
                      <Sparkles size={11} className="animate-spin" color="#fbbf24" />
                      <span>Activo</span>
                    </div>
                  ) : isDone ? (
                    <div style={{
                      background: isInspected ? tc.primary : 'rgba(16, 185, 129, 0.22)',
                      border: `1px solid ${isInspected ? '#ffffff' : '#10b981'}`,
                      color: isInspected ? '#0f172a' : '#34d399',
                      borderRadius: '8px',
                      padding: '3px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={11} color={isInspected ? '#0f172a' : '#34d399'} />
                      <span>{isInspected ? 'Revisando' : '✓ Concluido'}</span>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      padding: '3px 6px',
                      fontSize: '0.64rem',
                      fontWeight: 600
                    }}>
                      En Espera
                    </div>
                  )}
                </div>
              </div>

              {/* ── FLOW PIPELINE CONNECTOR (Visible Arrow Between Agents) ── */}
              {index < visibleAgents.length - 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 2px',
                  opacity: isDone ? 1 : 0.4,
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{
                    width: '18px',
                    height: '2px',
                    background: isDone ? '#10b981' : 'rgba(148, 163, 184, 0.3)',
                    position: 'relative'
                  }}>
                    <ChevronRight
                      size={14}
                      color={isDone ? '#10b981' : '#64748b'}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px'
                      }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
