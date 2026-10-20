-- ============================================================================
-- MIGRACIÓN 004: MEJORAS AL CIRCUITO BICAMERAL Y EJECUTIVO (SMA CONGRESO)
-- ============================================================================
-- 1. Ampliación de la tabla transaccional maestra sistema.proyecto_ley
--    para seguimiento bicameral (Origen vs Revisora) e informe asesor presidencial.
-- 2. Creación de la tabla sistema.trazabilidad_devoluciones para control
--    del bucle de retorno (Loopback) desde Bicameral a Comisiones y Veto a la ALP.
-- ============================================================================

-- 1. Nuevas columnas en sistema.proyecto_ley
ALTER TABLE sistema.proyecto_ley
  ADD COLUMN IF NOT EXISTS estado_bicameral VARCHAR(50) DEFAULT 'EN_ORIGEN',
  ADD COLUMN IF NOT EXISTS camara_origen VARCHAR(20) DEFAULT 'DIPUTADOS',
  ADD COLUMN IF NOT EXISTS camara_revisora VARCHAR(20) DEFAULT 'SENADORES',
  ADD COLUMN IF NOT EXISTS votos_origen JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS votos_revisora JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS informe_asesor_presidencial JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pliego_veto JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decreto_promulgacion_ref VARCHAR(100);

-- Comentarios explicativos
COMMENT ON COLUMN sistema.proyecto_ley.estado_bicameral IS 'Estado del circuito entre cámaras: EN_ORIGEN, EN_REVISORA, SANCIONADO, DEVUELTO_A_COMISION';
COMMENT ON COLUMN sistema.proyecto_ley.camara_origen IS 'Cámara de Origen del trámite (DIPUTADOS o SENADORES)';
COMMENT ON COLUMN sistema.proyecto_ley.camara_revisora IS 'Cámara Revisora del trámite (SENADORES o DIPUTADOS)';
COMMENT ON COLUMN sistema.proyecto_ley.votos_origen IS 'Cómputo {favor, contra, abstenciones, porcentaje} de Cámara de Origen';
COMMENT ON COLUMN sistema.proyecto_ley.votos_revisora IS 'Cómputo {favor, contra, abstenciones, porcentaje} de Cámara Revisora';
COMMENT ON COLUMN sistema.proyecto_ley.informe_asesor_presidencial IS 'Dictamen técnico emitido por el Asesor Presidencial Inteligente';
COMMENT ON COLUMN sistema.proyecto_ley.pliego_veto IS 'Objeciones de fondo del Presidente si la norma fue observada/vetada';

-- 2. Tabla de auditoría del bucle de retorno y devoluciones formales
CREATE TABLE IF NOT EXISTS sistema.trazabilidad_devoluciones (
  id_devolucion         SERIAL PRIMARY KEY,
  id_proyecto           INT NOT NULL REFERENCES sistema.proyecto_ley(id_proyecto) ON DELETE CASCADE,
  etapa_origen          VARCHAR(50) NOT NULL,   -- 'BICAMERAL' | 'EJECUTIVO_VETO'
  etapa_destino         VARCHAR(50) NOT NULL,   -- 'COMISION_SUBSANACION' | 'PLENARIA_ALP'
  motivo_rechazo        TEXT NOT NULL,
  articulos_observados  JSONB DEFAULT '[]'::jsonb,
  usuario_responsable   VARCHAR(150),
  fecha_devolucion      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  estado_subsanacion    VARCHAR(30) DEFAULT 'PENDIENTE' -- 'PENDIENTE' | 'SUBSANADO'
);

-- Índices para optimización de trazabilidad
CREATE INDEX IF NOT EXISTS idx_devoluciones_proyecto 
  ON sistema.trazabilidad_devoluciones(id_proyecto);

CREATE INDEX IF NOT EXISTS idx_devoluciones_etapa 
  ON sistema.trazabilidad_devoluciones(etapa_origen, etapa_destino);
