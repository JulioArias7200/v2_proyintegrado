-- =====================================================
-- ESQUEMA: sistema (Lógica Transaccional Principal)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS sistema;

-- =====================================================
-- 1. TABLA: comision
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.comision (
    id SERIAL PRIMARY KEY,
    nombre_comision VARCHAR(200) UNIQUE NOT NULL,
    acronimo VARCHAR(20),
    descripcion TEXT,
    presidente VARCHAR(100),
    email_contacto VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_comision_nombre ON sistema.comision(nombre_comision);

-- =====================================================
-- 2. TABLA: agentes_registrados
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.agentes_registrados (
    id SERIAL PRIMARY KEY,
    nombre_agente VARCHAR(100) UNIQUE NOT NULL,
    tipo_agente VARCHAR(50) NOT NULL,
    descripcion TEXT,
    logo_url VARCHAR(500),
    estado_operativo BOOLEAN DEFAULT TRUE,
    url_endpoint VARCHAR(255),
    capabilities JSONB,
    configuracion JSONB,
    ultima_ejecucion TIMESTAMP,
    total_ejecuciones INT DEFAULT 0,
    tasa_exito DECIMAL(5,2) DEFAULT 0.00,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agentes_tipo ON sistema.agentes_registrados(tipo_agente);
CREATE INDEX IF NOT EXISTS idx_agentes_estado ON sistema.agentes_registrados(estado_operativo);

-- =====================================================
-- 3. TABLA: proyecto_ley
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.proyecto_ley (
    id SERIAL PRIMARY KEY,
    id_expediente VARCHAR(50) UNIQUE NOT NULL,
    tipo_documento VARCHAR(50) NOT NULL DEFAULT 'Proyecto_Ley',
    id_comision INT REFERENCES sistema.comision(id),
    titulo_proyecto VARCHAR(500) NOT NULL,
    descripcion_corta TEXT,
    contenido_completo BYTEA,
    contenido_texto TEXT,
    estado_actual VARCHAR(50) NOT NULL DEFAULT 'INGRESADO',
    fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_ingreso VARCHAR(100),
    usuario_ultima_modificacion VARCHAR(100),
    agente_distribuidor_decision JSONB,
    confirmacion_humana BOOLEAN DEFAULT FALSE,
    fecha_confirmacion_humana TIMESTAMP,
    usuario_confirmacion VARCHAR(100),
    numero_ley VARCHAR(50),
    fecha_promulgacion DATE,
    agentes_ejecutados JSONB DEFAULT '[]'::jsonb,
    workflow_actual VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_ley_estado ON sistema.proyecto_ley(estado_actual);
CREATE INDEX IF NOT EXISTS idx_proyecto_ley_comision ON sistema.proyecto_ley(id_comision);
CREATE INDEX IF NOT EXISTS idx_proyecto_ley_fecha ON sistema.proyecto_ley(fecha_ingreso);

-- =====================================================
-- 4. TABLA: observaciones_unificadas
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.observaciones_unificadas (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    tipo_observacion VARCHAR(50) NOT NULL,
    agente_generador VARCHAR(100) NOT NULL,
    hallazgos JSONB NOT NULL,
    articulos_afectados JSONB,
    riesgo_normativo VARCHAR(20),
    recomendacion TEXT,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INT DEFAULT 1,
    estado_revision VARCHAR(30) DEFAULT 'PENDIENTE',
    agente_config JSONB,
    tiempo_ejecucion_ms INT
);

CREATE INDEX IF NOT EXISTS idx_observaciones_proyecto ON sistema.observaciones_unificadas(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_observaciones_tipo ON sistema.observaciones_unificadas(tipo_observacion);
CREATE INDEX IF NOT EXISTS idx_observaciones_agente ON sistema.observaciones_unificadas(agente_generador);

-- =====================================================
-- 5. TABLA: bitacora_proceso
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.bitacora_proceso (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    evento VARCHAR(100) NOT NULL,
    detalle JSONB,
    agente_responsable VARCHAR(100),
    usuario_responsable VARCHAR(100),
    estado_previo VARCHAR(50),
    estado_nuevo VARCHAR(50),
    timestamp_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bitacora_proyecto ON sistema.bitacora_proceso(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_bitacora_timestamp ON sistema.bitacora_proceso(timestamp_evento);
CREATE INDEX IF NOT EXISTS idx_bitacora_evento ON sistema.bitacora_proceso(evento);

-- =====================================================
-- 6. TABLA: pasos_proceso
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.pasos_proceso (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    num_paso INT NOT NULL,
    nombre_paso VARCHAR(200) NOT NULL,
    agente_responsable VARCHAR(100),
    estado_paso VARCHAR(30),
    resultado JSONB,
    timestamp_inicio TIMESTAMP,
    timestamp_fin TIMESTAMP,
    duracion_segundos INT,
    errores JSONB,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_pasos_proyecto ON sistema.pasos_proceso(id_proyecto, num_paso);
CREATE INDEX IF NOT EXISTS idx_pasos_estado ON sistema.pasos_proceso(estado_paso);

-- =====================================================
-- 7. TABLA: ejecuciones_agente
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.ejecuciones_agente (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    nombre_agente VARCHAR(100),
    input_data JSONB,
    output_data JSONB,
    tiempo_ejecucion_ms INT,
    estado VARCHAR(30),
    timestamp_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp_fin TIMESTAMP,
    logs JSONB,
    metricas JSONB
);

CREATE INDEX IF NOT EXISTS idx_ejecuciones_proyecto ON sistema.ejecuciones_agente(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_agente ON sistema.ejecuciones_agente(nombre_agente);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_timestamp ON sistema.ejecuciones_agente(timestamp_inicio);

-- =====================================================
-- 8. TABLA: cache_resultados
-- =====================================================
CREATE TABLE IF NOT EXISTS sistema.cache_resultados (
    id SERIAL PRIMARY KEY,
    id_proyecto INT REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    tipo_cache VARCHAR(50) NOT NULL,
    contenido JSONB NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_en TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_proyecto ON sistema.cache_resultados(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_cache_tipo ON sistema.cache_resultados(tipo_cache);

-- =====================================================
-- REGISTRO INICIAL DE TODOS LOS AGENTES
-- =====================================================
INSERT INTO sistema.agentes_registrados 
(nombre_agente, tipo_agente, descripcion, logo_url, estado_operativo, capabilities, configuracion)
VALUES
  (
    'Agente Distribuidor',
    'DISTRIBUIDOR',
    'Clasificación Institucional del documento y enrutamiento por competencia',
    '/robots/robot_distribuidor_hi.jpg',
    true,
    '{"clasificacion": true, "enrutamiento": true}'::jsonb,
    '{"temp_llm": 0.1, "max_tokens": 1500}'::jsonb
  ),
  (
    'Comisión Legislativa',
    'NIVEL_2',
    'Asignación temática y parlamentaria de comisiones camarales',
    '/robots/robot_ciudadano_hi.jpg',
    true,
    '{"asignacion": true, "miembros": true}'::jsonb,
    '{"temp_llm": 0.1, "max_tokens": 2000}'::jsonb
  ),
  (
    'Verificador Constitucional',
    'NIVEL_2',
    'Control de constitucionalidad formal contra el articulado de la CPE 2009',
    '/robots/robot_constitucional_hi.jpg',
    true,
    '{"control_literal": true, "supremacia_cpe": true}'::jsonb,
    '{"temp_llm": 0.1, "max_tokens": 2500}'::jsonb
  ),
  (
    'Consistencia Normativa',
    'NIVEL_2',
    'Búsqueda vectorial semántica pgvector 2048d contra leyes vigentes',
    '/robots/robot_consistencia_hi.jpg',
    true,
    '{"pgvector": true, "antinomias": true}'::jsonb,
    '{"temp_llm": 0.1, "max_tokens": 2000}'::jsonb
  ),
  (
    'Comisión Constitución (Fondo)',
    'FONDO_CONSTITUCIONAL',
    'Análisis hermenéutico sustantivo, precedentes y ponderación de derechos',
    '/robots/robot_constitucional_hi.jpg',
    true,
    '{"hermeneutica": true, "precedentes": true, "ponderacion_derechos": true}'::jsonb,
    '{"temp_llm": 0.2, "max_tokens": 2500}'::jsonb
  ),
  (
    'Concentrador y Emisor',
    'CONCENTRADOR',
    'Integra observaciones de múltiples agentes en expediente consolidado y emite informe',
    '/robots/robot_concentrador_hi.jpg',
    true,
    '{"sintesis": true, "integracion": true, "trazabilidad": true, "pdf": true}'::jsonb,
    '{"temp_llm": 0.1, "max_tokens": 3000}'::jsonb
  ),
  (
    'Secretario de Cámara',
    'SECRETARIO',
    'Registro estructurado de debates legislativos, votaciones nominales y acuerdos',
    '/robots/robot_ciudadano_hi.jpg',
    true,
    '{"registro": true, "desglose": true, "verificacion_cruzada": true}'::jsonb,
    '{"temp_llm": 0.0, "max_tokens": 2000}'::jsonb
  ),
  (
    'Comunicación Bicameral',
    'BICAMERAL',
    'Gestiona ciclo entre cámaras, coteja modificaciones y reglas de retorno',
    '/robots/robot_distribuidor_hi.jpg',
    true,
    '{"comparacion": true, "reglas_bicamerales": true, "coordinacion": true}'::jsonb,
    '{"temp_llm": 0.1, "max_tokens": 1500}'::jsonb
  ),
  (
    'Veto y Promulgación',
    'VETO',
    'Evaluación estratégica multicriterio: promulga, veto total o parcial',
    '/robots/robot_consistencia_hi.jpg',
    true,
    '{"analisis_multicriterio": true, "simulacion_escenarios": true, "decision_ejecutiva": true}'::jsonb,
    '{"temp_llm": 0.3, "max_tokens": 2000}'::jsonb
  ),
  (
    'Publicación Oficial',
    'PUBLICACION',
    'Asigna número de ley secuencial, vigencia y publica en Gaceta/Boletín oficial',
    '/robots/robot_concentrador_hi.jpg',
    true,
    '{"numeracion": true, "formateo": true, "publicacion": true}'::jsonb,
    '{"temp_llm": 0.0, "max_tokens": 800}'::jsonb
  ),
  (
    'Notificador de Comisión',
    'DISTRIBUIDOR',
    'Despachador formal de notificaciones oficiales HTML a parlamentarios',
    '/robots/robot_notificador_hi.jpg',
    true,
    '{"email_html": true, "destinatarios": true}'::jsonb,
    '{"temp_llm": 0.0, "max_tokens": 1000}'::jsonb
  )
ON CONFLICT (nombre_agente) DO UPDATE SET
  tipo_agente = EXCLUDED.tipo_agente,
  descripcion = EXCLUDED.descripcion,
  logo_url = EXCLUDED.logo_url,
  capabilities = EXCLUDED.capabilities,
  configuracion = EXCLUDED.configuracion,
  fecha_actualizacion = CURRENT_TIMESTAMP;
