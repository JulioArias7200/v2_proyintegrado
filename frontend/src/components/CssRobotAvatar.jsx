import React from 'react';
import './CssRobotAvatar.css';
import { Sparkles, Cpu, CheckCircle2, Zap } from 'lucide-react';

/**
 * CssRobotAvatar — Custom 100% HTML/CSS Animated Robot Avatar for SMA AI Agents.
 * Supports dynamic color themes, floating animation, laser scan, glowing antenna,
 * eye states (idle, thinking, working, completed), audio equalizer bars, and speech bubble!
 */
export default function CssRobotAvatar({
  theme = 'green',        // 'cyan' | 'blue' | 'green' | 'gold' | 'pink' | 'violet' | 'teal'
  status = 'idle',        // 'idle' | 'thinking' | 'working' | 'completed' | 'error'
  thinkingText = '',     // e.g. "Clasificando materia...", "Auditando CPE..."
  size = 'md',            // 'sm' | 'md' | 'lg' | 'xl'
  showBubble = false,    // Display speech bubble above bot
  showGlow = true,       // Glowing ambient light ring
  agentName = '',        // Name of the agent if needed
}) {
  const isThinking = status === 'thinking' || status === 'working';
  const isWorking = status === 'working';
  const isCompleted = status === 'completed';

  const themeClass = `bot-theme-${theme}`;

  return (
    <div className={`bot-avatar-container ${themeClass} bot-size-${size} ${isThinking ? 'floating' : ''} ${isWorking ? 'active-working' : ''}`}>
      
      {/* Speech / Thinking Bubble */}
      {(showBubble || thinkingText) && (
        <div className="bot-speech-bubble">
          {isThinking && (
            <div className="bot-thinking-dots">
              <span />
              <span />
              <span />
            </div>
          )}
          {isCompleted && <CheckCircle2 size={13} color="#10b981" />}
          <span style={{ fontSize: '0.72rem', color: '#f8fafc', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            {thinkingText || (isThinking ? 'Pensando y procesando...' : isCompleted ? 'Tarea Completada' : 'Agente Listo')}
          </span>
        </div>
      )}

      {/* Antenna */}
      <div className="bot-antenna">
        <div className={`bot-antenna-orb ${isThinking ? 'pinging' : ''}`} />
        <div className="bot-antenna-stem" />
      </div>

      {/* Head Outer Casing */}
      <div className={`bot-head ${isThinking ? 'thinking' : ''}`}>
        
        {/* Left & Right Ear Sensors */}
        <div className="bot-ear left">
          <div className={`bot-ear-indicator ${isThinking ? 'active' : ''}`} />
        </div>
        <div className="bot-ear right">
          <div className={`bot-ear-indicator ${isThinking ? 'active' : ''}`} />
        </div>

        {/* Digital Visor Screen */}
        <div className={`bot-visor ${isThinking ? 'scanning' : ''}`}>
          
          {/* Laser Scan Line */}
          <div className="bot-laser-scan" />

          {/* Animated Eyes */}
          <div className="bot-eyes-row">
            {isCompleted ? (
              <>
                <div className="bot-eye completed" />
                <div className="bot-eye completed" />
              </>
            ) : isThinking ? (
              <>
                <div className={`bot-eye ${isWorking ? 'working' : 'thinking'}`} />
                <div className={`bot-eye ${isWorking ? 'working' : 'thinking'}`} />
              </>
            ) : (
              <>
                <div className="bot-eye idle" />
                <div className="bot-eye idle" />
              </>
            )}
          </div>

          {/* Mouth Equalizer / Audio Bars */}
          <div className={`bot-mouth-eq ${isThinking ? 'animated' : ''}`}>
            <div className="bot-eq-bar" />
            <div className="bot-eq-bar" />
            <div className="bot-eq-bar" />
            <div className="bot-eq-bar" />
          </div>

        </div>
      </div>

      {/* Torso & Core Reactor Orb */}
      <div className="bot-torso">
        <div className={`bot-core-orb ${isThinking ? 'pulse' : ''}`} />
      </div>

    </div>
  );
}
