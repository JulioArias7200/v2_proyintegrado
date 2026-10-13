/**
 * LateralAgentHero — Banner lateral nítido
 * Muestra la imagen completa del banner de manera nítida,
 * sin recuadros ni texto superpuesto, solamente la imagen institucional.
 */
import React, { useState } from 'react';

// Mapeo de banners institucionales de alta resolución desde /robots/banner/
const AGENT_BANNER_MAP = {
  distribuidor: '/robots/banner/DISTRIBUIDOR.png',
  comision: '/robots/banner/COMISION.png',
  constitucional: '/robots/banner/CONSTITUCIONALIDAD.png',
  consistencia: '/robots/banner/CONSISTENCIA.png',
  concentrador: '/robots/banner/CONCENTRADOR.png',
  emisor: '/robots/banner/CONCENTRADOR.png',
  notificador: '/robots/banner/CONCENTRADOR.png',
  constitucion_fondo: '/robots/banner/CONSTITUCIONALIDAD.png',
  concentrador_crew: '/robots/banner/CONCENTRADOR.png',
  secretario: '/robots/banner/SECRETARIO.png',
  bicameral: '/robots/banner/BICAMARAL.png',
  veto_promulgacion: '/robots/banner/VETO.png',
  publicacion: '/robots/banner/GACETAA.png',
  ciudadania: '/robots/banner/DISTRIBUIDOR.png',
  comodin: '/robots/banner/DISTRIBUIDOR.png',
};

// Colores de acento institucional (diferenciación cromática en espectro de azul por agente)
const AGENT_ACCENT = {
  distribuidor: '#00B4D8', // Celeste Neón Eléctrico
  comision: '#38BDF8', // Azul Cielo Radiante
  constitucional: '#2563EB', // Azul Zafiro Real
  consistencia: '#1D4ED8', // Azul Cobalto Profundo
  concentrador: '#0284C7', // Azul Océano Cerúleo
  emisor: '#0284C7', // Azul Océano Cerúleo
  notificador: '#06B6D4', // Turquesa Azulado
  constitucion_fondo: '#4338CA', // Azul Índigo Parlamentario
  concentrador_crew: '#3B82F6', // Azul Acero Técnico
  secretario: '#1E40AF', // Azul Marino Clásico
  bicameral: '#7DD3FC', // Azul Hielo Glaciar
  veto_promulgacion: '#1E3A8A', // Azul Medianoche Ultramar
  publicacion: '#00C2CB', // Azul Lapislázuli Brillante
};

export default function LateralAgentHero({
  agent,
  isProcessing = false,
  isCompleted = false,
}) {
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!agent) return null;

  const bannerUrl = AGENT_BANNER_MAP[agent.id] || '/robots/banner/DISTRIBUIDOR.png';
  const accent = AGENT_ACCENT[agent.id] || '#00B4D8';

  return (
    <>
      <div
        onClick={() => setIsZoomed(true)}
        title="Clic para ampliar banner en alta definición"
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: '20px',
          overflow: 'hidden',
          border: isProcessing ? `2px solid ${accent}` : `1.5px solid ${accent}55`,
          boxShadow: isProcessing
            ? `0 0 32px ${accent}77, 0 12px 36px rgba(0,0,0,0.6)`
            : `0 10px 32px rgba(0,0,0,0.5), 0 0 18px ${accent}22`,
          background: 'linear-gradient(180deg, #0B2545 0%, #07192F 100%)',
          transition: 'all 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {!imgError ? (
          <img
            src={bannerUrl}
            alt={`Banner ${agent.name}`}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: 'calc(100vh - 60px)',
              objectFit: 'contain',
              display: 'block',
              filter: 'none',
              transition: 'transform 0.3s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            minHeight: '540px',
            background: `linear-gradient(160deg, #0B2545 0%, #134074 50%, ${accent}33 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            fontWeight: 700,
            fontSize: '1rem'
          }}>
            {agent.name}
          </div>
        )}
      </div>

      {/* Modal Zoom en Alta Definición */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(5, 15, 30, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxHeight: '92vh',
              maxWidth: '90vw',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: `0 0 50px ${accent}88, 0 20px 60px rgba(0,0,0,0.8)`,
              border: `2px solid ${accent}`,
              background: '#0B2545',
            }}
          >
            <button
              onClick={() => setIsZoomed(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.65)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              &times;
            </button>
            <img
              src={bannerUrl}
              alt={`Banner ${agent.name}`}
              style={{
                display: 'block',
                maxHeight: '90vh',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
