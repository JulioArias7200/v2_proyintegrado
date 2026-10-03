-- =====================================================
-- 003 — Agente Multi-Faceta de Atención Ciudadana
-- =====================================================
-- Sub-agentes ciudadanos (facetas) del asistente con routing automático
-- de prompts. La aplicación crea esta tabla sola al primer arranque
-- (sma_unified/agents/multiagente_ciudadano.py::_ensure_tabla); este script
-- existe para despliegues donde el esquema se aplica por migración.

CREATE SCHEMA IF NOT EXISTS sistema;

CREATE TABLE IF NOT EXISTS sistema.agentes_ciudadanos (
    id UUID PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    logo VARCHAR(500),                  -- emoji, URL de imagen o data-uri
    system_prompt TEXT NOT NULL,
    trigger_description TEXT NOT NULL,  -- CUÁNDO usar esta faceta (lo lee el router)
    modelo VARCHAR(200),                -- NULL ⇒ cascada de modelos NIM del SMA
    temperature REAL NOT NULL DEFAULT 0.5,
    top_p REAL NOT NULL DEFAULT 1.0,
    max_tokens INT NOT NULL DEFAULT 1024,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agentes_ciudadanos_activo
    ON sistema.agentes_ciudadanos(activo);

-- Registro en el catálogo general de agentes del SMA (/api/agentes)
INSERT INTO sistema.agentes_registrados
    (nombre_agente, tipo_agente, descripcion, logo_url, estado_operativo, capabilities)
VALUES (
    'Agente Multi-Faceta Ciudadano',
    'ATENCION_CIUDADANA',
    'Asistente ciudadano con múltiples facetas (arquitectura, salud, educación, trámites legislativos). Enruta automáticamente cada consulta al prompt adecuado.',
    '/robots/robot_ciudadano.jpg',
    TRUE,
    '{"routing_automatico": true, "multi_prompt": true, "sin_estado": true}'::jsonb
)
ON CONFLICT (nombre_agente) DO NOTHING;
