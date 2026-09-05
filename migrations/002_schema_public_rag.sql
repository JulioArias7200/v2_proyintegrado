-- =====================================================
-- ESQUEMA: public (Corpus RAG y Vectores)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS public;

-- Habilitar extensión vector si no está habilitada
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. Artículos Constitucionales (vectorizados)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.articulos_constitucion (
    id SERIAL PRIMARY KEY,
    articulo_numero VARCHAR(20),
    numero VARCHAR(20),
    titulo VARCHAR(300),
    contenido TEXT NOT NULL,
    extracto TEXT,
    embedding vector(2048),
    fuente_documento VARCHAR(100) DEFAULT 'CPE_2009',
    capitulo VARCHAR(150),
    seccion VARCHAR(150),
    fecha_ingestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    palabras_clave TEXT[],
    temas_relacionados TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_articulos_numero ON public.articulos_constitucion(articulo_numero);

-- =====================================================
-- 2. Normativas Vigentes (vectorizadas)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.normativas_vigentes (
    id SERIAL PRIMARY KEY,
    titulo_norma VARCHAR(300) NOT NULL,
    tipo_norma VARCHAR(50),
    numero_norma VARCHAR(50),
    contenido TEXT NOT NULL,
    embedding vector(2048),
    jerarquia_normativa INT DEFAULT 3,
    fecha_vigencia DATE,
    fecha_derogacion DATE,
    fecha_ingestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ambito_aplicacion TEXT,
    materia_principal VARCHAR(100),
    articulos_principales TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_normativas_titulo ON public.normativas_vigentes(titulo_norma);
CREATE INDEX IF NOT EXISTS idx_normativas_tipo ON public.normativas_vigentes(tipo_norma);

-- =====================================================
-- 3. Jurisprudencia Constitucional (vectorizada)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.jurisprudencia_constitucional (
    id SERIAL PRIMARY KEY,
    id_sentencia VARCHAR(50) UNIQUE NOT NULL,
    fecha_sentencia DATE,
    materia VARCHAR(100),
    voto_mayoritario TEXT,
    contenido_completo TEXT NOT NULL,
    embedding vector(2048),
    precedente BOOLEAN DEFAULT TRUE,
    fecha_ingestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ponente VARCHAR(100),
    votos VARCHAR(100),
    decisiones TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_jurisprudencia_materia ON public.jurisprudencia_constitucional(materia);
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_fecha ON public.jurisprudencia_constitucional(fecha_sentencia);

-- =====================================================
-- 4. Debates Legislativos (vectorizados)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.debates_legislativos (
    id SERIAL PRIMARY KEY,
    id_sesion VARCHAR(50),
    fecha_sesion DATE,
    tipo_sesion VARCHAR(50),
    proyecto_ley_id INT,
    intervenciones JSONB,
    votaciones JSONB,
    acuerdos JSONB,
    embedding vector(2048),
    resumen TEXT,
    fecha_ingestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debates_fecha ON public.debates_legislativos(fecha_sesion);
CREATE INDEX IF NOT EXISTS idx_debates_proyecto ON public.debates_legislativos(proyecto_ley_id);

-- =====================================================
-- 5. Historial de Decisiones de Agentes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.historial_decisiones_agentes (
    id SERIAL PRIMARY KEY,
    id_proyecto INT,
    nombre_agente VARCHAR(100),
    decision TEXT,
    justificacion TEXT,
    contexto JSONB,
    embedding vector(2048),
    fecha_decision TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decisiones_proyecto ON public.historial_decisiones_agentes(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_decisiones_agente ON public.historial_decisiones_agentes(nombre_agente);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha ON public.historial_decisiones_agentes(fecha_decision);
