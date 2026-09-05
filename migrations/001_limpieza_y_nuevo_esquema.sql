-- =====================================================================
-- MIGRACIÓN 001: LIMPIEZA DE TABLAS REDUNDANTES Y NUEVO ESQUEMA SISTEMA
-- SMA CONGRESO v2.0
-- =====================================================================

-- 1. Asegurar esquema sistema
CREATE SCHEMA IF NOT EXISTS sistema;

-- 2. Asegurar extensiones
CREATE EXTENSION IF NOT EXISTS vector;

-- 3. Migrar preventivamente datos de Solicitudes_Documentos a sistema.proyecto_ley
--    para no perder historial de atención ciudadana / correspondencia
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Solicitudes_Documentos'
    ) THEN
        INSERT INTO sistema.proyecto_ley (
            numero_expediente, titulo, resumen, texto_completo, 
            tipo_documento, fecha_ingreso, prioridad, activo, observaciones_generales,
            drive_file_id, drive_link
        )
        SELECT 
            CONCAT('SOL-', TO_CHAR(COALESCE(fecha_ingreso, NOW()), 'YYYYMMDD'), '-', solicitud_id),
            COALESCE(SUBSTRING(resumen_ia FROM 1 FOR 250), nombre_archivo, 'Solicitud Ciudadana'),
            COALESCE(resumen_ia, 'Documento de atención ciudadana/mesa de partes'),
            COALESCE(texto_extraido, ''),
            CASE 
                WHEN origen ILIKE '%ciudadan%' THEN 'Peticion_Ciudadana'
                WHEN origen ILIKE '%oficio%' OR origen ILIKE '%corresp%' THEN 'Oficio'
                ELSE 'Peticion_Ciudadana'
            END,
            COALESCE(fecha_ingreso, NOW()),
            'Media',
            TRUE,
            CONCAT('Migrado desde public.Solicitudes_Documentos ID: ', solicitud_id),
            drive_file_id,
            drive_link
        FROM public."Solicitudes_Documentos"
        WHERE NOT EXISTS (
            SELECT 1 FROM sistema.proyecto_ley p 
            WHERE p.observaciones_generales LIKE CONCAT('%Solicitudes_Documentos ID: ', solicitud_id)
        );
    END IF;
END $$;

-- 4. ELIMINAR TABLAS REDUNDANTES / EN DESUSO
DROP TABLE IF EXISTS public."Clasificacion_Agente" CASCADE;
DROP TABLE IF EXISTS public."Clasificacion_Comision" CASCADE;
DROP TABLE IF EXISTS public."Solicitudes_Documentos" CASCADE;

-- 5. Asegurar columnas en sistema.proyecto_ley para el nuevo ciclo de vida
ALTER TABLE sistema.proyecto_ley ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(50) DEFAULT 'Proyecto_Ley';
ALTER TABLE sistema.proyecto_ley ADD COLUMN IF NOT EXISTS agente_distribuidor_decision JSONB;
ALTER TABLE sistema.proyecto_ley ADD COLUMN IF NOT EXISTS confirmacion_humana BOOLEAN DEFAULT FALSE;
ALTER TABLE sistema.proyecto_ley ADD COLUMN IF NOT EXISTS fecha_confirmacion_humana TIMESTAMP WITH TIME ZONE;
ALTER TABLE sistema.proyecto_ley ADD COLUMN IF NOT EXISTS usuario_confirmacion VARCHAR(100);

-- 6. Crear tabla sistema.observaciones_unificadas
CREATE TABLE IF NOT EXISTS sistema.observaciones_unificadas (
    id SERIAL PRIMARY KEY,
    id_proyecto INT REFERENCES sistema.proyecto_ley(id_proyecto) ON DELETE CASCADE,
    sesion_id VARCHAR(50),
    tipo_observacion VARCHAR(50) NOT NULL,
    agente_generador VARCHAR(100) NOT NULL,
    hallazgos JSONB NOT NULL DEFAULT '[]'::jsonb,
    articulos_afectados JSONB DEFAULT '[]'::jsonb,
    riesgo_normativo VARCHAR(20) DEFAULT 'BAJO',
    recomendacion TEXT,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INT DEFAULT 1,
    estado_revision VARCHAR(30) DEFAULT 'PENDIENTE'
);

CREATE INDEX IF NOT EXISTS idx_obs_unif_proyecto ON sistema.observaciones_unificadas(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_obs_unif_tipo ON sistema.observaciones_unificadas(tipo_observacion);
CREATE INDEX IF NOT EXISTS idx_obs_unif_agente ON sistema.observaciones_unificadas(agente_generador);

-- 7. Crear tabla sistema.pasos_proceso (para visualización paso a paso y control de retroceso)
CREATE TABLE IF NOT EXISTS sistema.pasos_proceso (
    id SERIAL PRIMARY KEY,
    id_proyecto INT REFERENCES sistema.proyecto_ley(id_proyecto) ON DELETE CASCADE,
    sesion_id VARCHAR(50),
    num_paso INT NOT NULL,
    nombre_paso VARCHAR(200) NOT NULL,
    justificacion_paso TEXT,
    agente_responsable VARCHAR(100) NOT NULL,
    estado_paso VARCHAR(30) DEFAULT 'PENDIENTE' CHECK (estado_paso IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'ERROR')),
    resultado JSONB,
    timestamp_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    timestamp_fin TIMESTAMP WITH TIME ZONE,
    duracion_segundos INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pasos_proyecto ON sistema.pasos_proceso(id_proyecto, num_paso);
CREATE INDEX IF NOT EXISTS idx_pasos_sesion ON sistema.pasos_proceso(sesion_id);
CREATE INDEX IF NOT EXISTS idx_pasos_estado ON sistema.pasos_proceso(estado_paso);

-- 8. Crear tabla sistema.agentes_registrados
CREATE TABLE IF NOT EXISTS sistema.agentes_registrados (
    id SERIAL PRIMARY KEY,
    nombre_agente VARCHAR(100) UNIQUE NOT NULL,
    tipo_agente VARCHAR(50) NOT NULL,
    descripcion TEXT,
    justificacion_constitucional TEXT,
    logo_url VARCHAR(500),
    color_tema VARCHAR(20) DEFAULT 'blue',
    estado_operativo BOOLEAN DEFAULT TRUE,
    capabilities JSONB DEFAULT '{}'::jsonb
);

-- 9. Registrar agentes del SMA Congreso v2.0
INSERT INTO sistema.agentes_registrados 
(nombre_agente, tipo_agente, descripcion, justificacion_constitucional, logo_url, color_tema, estado_operativo, capabilities)
VALUES
  (
    'Agente_Distribuidor',
    'NIVEL_1',
    'Clasifica el documento de entrada (Proyecto de Ley, Petición, Oficio) y propone la ruta legislativa.',
    'Principio de orden y debido proceso parlamentario: cada expediente debe canalizarse por su vía procedimental correcta.',
    '/robots/robot_distribuidor_hi.jpg',
    'cyan',
    true,
    '{"clasificacion": true, "enrutamiento": true}'::jsonb
  ),
  (
    'Agente_Comision_Legislativa',
    'NIVEL_2',
    'Determina la comisión parlamentaria competente y asigna el expediente a sus miembros.',
    'Art. 158 CPE: Organización y distribución por especialidad temática de las Cámaras Legislativas.',
    '/robots/robot_ciudadano_hi.jpg',
    'blue',
    true,
    '{"asignacion_comision": true, "analisis_competencia": true}'::jsonb
  ),
  (
    'Agente_Verificador_Constitucional',
    'NIVEL_2',
    'Audita la compatibilidad formal y sustantiva del proyecto contra la Constitución Política del Estado (CPE 2009).',
    'Art. 410 CPE: Principio de Supremacía Constitucional. Ninguna ley puede contravenir la norma suprema del ordenamiento.',
    '/robots/robot_constitucional_hi.jpg',
    'green',
    true,
    '{"auditoria_constitucional": true, "cotejo_cpe": true, "deteccion_antinomias": true}'::jsonb
  ),
  (
    'Agente_Consistencia_Normativa',
    'NIVEL_2',
    'Coteja el proyecto contra el corpus de leyes vigentes mediante búsqueda vectorial pgvector para detectar derogaciones tácitas.',
    'Seguridad jurídica y coherencia del ordenamiento positivo boliviano: evitar leyes contradictorias o vacíos normativos.',
    '/robots/robot_consistencia_hi.jpg',
    'gold',
    true,
    '{"similitud_pgvector": true, "deteccion_derogaciones": true, "analisis_especialidad": true}'::jsonb
  ),
  (
    'Agente_Concentrador_Emisor',
    'NIVEL_3',
    'Integra y sintetiza las observaciones de todos los agentes en el Dictamen Oficial y genera el reporte PDF consolidado.',
    'Garantía de transparencia legislativa y dictamen motivado previo al tratamiento en plenario de la Cámara.',
    '/robots/robot_concentrador_hi.jpg',
    'pink',
    true,
    '{"sintesis_multidisciplinaria": true, "emision_pdf": true, "trazabilidad": true}'::jsonb
  ),
  (
    'Agente_Notificador_Comision',
    'NIVEL_3',
    'Redacta y despacha comunicaciones formales e invitaciones institucionales a los parlamentarios de la comisión.',
    'Debida notificación y publicidad de los actos legislativos a los representantes electos.',
    '/robots/robot_notificador_hi.jpg',
    'violet',
    true,
    '{"notificacion_html": true, "despacho_correo": true}'::jsonb
  )
ON CONFLICT (nombre_agente) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    justificacion_constitucional = EXCLUDED.justificacion_constitucional,
    logo_url = EXCLUDED.logo_url,
    color_tema = EXCLUDED.color_tema,
    capabilities = EXCLUDED.capabilities;
