📋 PLAN DE IMPLEMENTACIÓN SISTEMA MULTI-AGENTE SMA CONGRESO v2.0

Documento completo de implementación para mejorar el sistema existente con eliminación de tablas, frontend moderno multi-agente y 6 nuevos agentes avanzados.

📌 ÍNDICE
Resumen Ejecutivo
Fase 1: Limpieza de Base de Datos
Fase 2: Rediseño del Frontend
Fase 3: Arquitectura de Agentes Avanzados
Fase 4: Configuración YAML CrewAI
Fase 5: Infraestructura Neon + Cosmos
Cronograma y Entregables
🎯 RESUMEN EJECUTIVO
Objetivos
Objetivo	Descripción	Prioridad
Eliminar redundancias DB	Remover Clasificacion_Agente, Clasificacion_Comision, Solicitudes_Documentos	🔴 CRÍTICA
Frontend multi-documento	Permitir múltiples uploads y peticiones simultáneas	🔴 CRÍTICA
Historial de interacciones	Pestañas/tabs para retroceder y ver pasos del proceso	🟡 ALTA
UI de agentes visual	Iconos, logos y avatar de agentes en interfaz	🟡 ALTA
6 nuevos agentes	Concentrador, Secretario, Bicameral, Veto, Publicación, Constitución Fondo	🟡 ALTA
CrewAI + YAML	Orquestación flexible sin hardcoding de prompts	🟢 MEDIA
Stack Tecnológico
yaml
Backend:
  Framework: FastAPI 0.104+
  Orquestación: CrewAI 0.3.0
  LLM: NVIDIA NIM API (Llama 3.1 Nemotron 70B)
  Embeddings: NVIDIA Embeddings (2048 dims)

Database:
  Transaccional: PostgreSQL Neon + pgvector
  Eventos: MongoDB Cosmos DB (compatible Atlas)
  Cache: Redis (opcional, para sessiones)

Frontend:
  Framework: React 19 + Vite
  Componentes: Shadcn/UI + TailwindCSS
  Gestión estado: Zustand/Redux Toolkit
  Iconos: Lucide React

DevOps:
  Containerización: Docker + Docker Compose
  Despliegue: Vercel (Frontend) / Railway/Render (Backend)

<a id="fase-1-limpieza-de-base-de-datos"></a>

🗄️ FASE 1: LIMPIEZA Y REESTRUCTURACIÓN DE BASE DE DATOS
1.1 Tablas a Eliminar
sql
-- ⛔ ESTAS TABLAS SERÁN ELIMINADAS
DROP TABLE IF EXISTS public.Clasificacion_Agente CASCADE;
DROP TABLE IF EXISTS public.Clasificacion_Comision CASCADE;
DROP TABLE IF EXISTS public.Solicitudes_Documentos CASCADE;

-- Razón: La lógica se centraliza en sistema.proyecto_ley
-- y sistema.bitacora_proceso
1.2 Nuevo Esquema Unificado
sql
-- =====================================================
-- ESQUEMA: sistema (Lógica Transaccional Principal)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS sistema AUTHORIZATION postgres;

-- 1. TABLA MAESTRO: Proyecto de Ley / Expediente
CREATE TABLE sistema.proyecto_ley (
    id SERIAL PRIMARY KEY,
    id_expediente VARCHAR(50) UNIQUE NOT NULL,
    
    -- Clasificación (antes en Clasificacion_Agente)
    tipo_documento VARCHAR(30) NOT NULL 
        CHECK (tipo_documento IN ('Proyecto_Ley', 'Peticion_Ciudadana', 'Oficio', 'Otro')),
    
    -- Comisión asignada (antes en Clasificacion_Comision)
    id_comision INT REFERENCES sistema.comision(id),
    
    -- Contenido
    titulo_proyecto VARCHAR(500) NOT NULL,
    descripcion_corta TEXT,
    contenido_completo BYTEA,
    contenido_texto TEXT,
    
    -- Estados del workflow
    estado_actual VARCHAR(50) NOT NULL
        CHECK (estado_actual IN (
            'INGRESADO',
            'CLASIFICADO',
            'DISTRIBUIDO_NIVEL1',
            'PENDIENTE_CONFIRMACION',
            'EN_AUDITORIA_NIVEL2',
            'AUDITORIA_COMPLETADA',
            'EN_CONCENTRACION',
            'EN_DEBATE_POLITICO',
            'EN_CONFERENCIA_BICAMERAL',
            'EN_EVALUACION_VETO',
            'PROMULGADO',
            'VETADO_TOTAL',
            'VETADO_PARCIAL',
            'RECHAZADO'
        )),
    
    -- Trazabilidad
    fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_ingreso VARCHAR(100),
    usuario_ultima_modificacion VARCHAR(100),
    
    -- Links a agentes
    agente_distribuidor_decision JSONB,  -- Decisión del Agente Distribuidor
    confirmacion_humana BOOLEAN DEFAULT FALSE,
    fecha_confirmacion_humana TIMESTAMP,
    usuario_confirmacion VARCHAR(100),
    
    -- Número de expediente legislativo (asignado post-sanción)
    numero_ley VARCHAR(20),
    fecha_promulgacion DATE,
    
    INDEX idx_expediente (id_expediente),
    INDEX idx_estado (estado_actual),
    INDEX idx_comision (id_comision)
);

-- 2. OBSERVACIONES CONSOLIDADAS (antes dispersas en múltiples tablas)
CREATE TABLE sistema.observaciones_unificadas (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    
    -- Tipo de observación
    tipo_observacion VARCHAR(50) NOT NULL
        CHECK (tipo_observacion IN (
            'CONSTITUCIONAL',
            'CONSISTENCIA_NORMATIVA',
            'CONCENTRACION_FINAL',
            'ACTA_DEBATE',
            'BICAMERAL',
            'EVALUACION_VETO',
            'PUBLICACION_OFICIAL'
        )),
    
    -- Agente que genera la observación
    agente_generador VARCHAR(100) NOT NULL,
    
    -- Contenido estructurado
    hallazgos JSONB NOT NULL,  -- Array de hallazgos con estructura uniforme
    artículos_afectados JSONB,
    riesgo_normativo VARCHAR(20) CHECK (riesgo_normativo IN ('BAJO', 'MEDIO', 'ALTO', 'CRÍTICO')),
    recomendacion TEXT,
    
    -- Trazabilidad
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    versión INT DEFAULT 1,
    estado_revision VARCHAR(30) DEFAULT 'PENDIENTE',  -- PENDIENTE, PROCESADA, INTEGRADA
    
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_tipo (tipo_observacion),
    INDEX idx_agente (agente_generador)
);

-- 3. BITÁCORA DE PROCESOS (Auditoría completa)
CREATE TABLE sistema.bitacora_proceso (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    
    evento VARCHAR(100) NOT NULL,
    detalle JSONB,
    agente_responsable VARCHAR(100),
    usuario_responsable VARCHAR(100),
    
    estado_previo VARCHAR(50),
    estado_nuevo VARCHAR(50),
    
    timestamp_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_timestamp (timestamp_evento),
    INDEX idx_evento (evento)
);

-- 4. COMISIONES (Referencial)
CREATE TABLE sistema.comision (
    id SERIAL PRIMARY KEY,
    nombre_comision VARCHAR(200) UNIQUE NOT NULL,
    acronimo VARCHAR(10),
    descripcion TEXT,
    presidente VARCHAR(100),
    email_contacto VARCHAR(100),
    
    INDEX idx_nombre (nombre_comision)
);

-- 5. AGENTES DISPONIBLES (Nuevo: Para gestionar agentes dinámicamente)
CREATE TABLE sistema.agentes_registrados (
    id SERIAL PRIMARY KEY,
    nombre_agente VARCHAR(100) UNIQUE NOT NULL,
    tipo_agente VARCHAR(50) NOT NULL
        CHECK (tipo_agente IN (
            'DISTRIBUIDOR',
            'NIVEL_2',
            'CONCENTRADOR',
            'SECRETARIO',
            'BICAMERAL',
            'VETO',
            'PUBLICACION'
        )),
    
    descripcion TEXT,
    logo_url VARCHAR(500),
    estado_operativo BOOLEAN DEFAULT TRUE,
    url_endpoint VARCHAR(255),
    
    -- Capacidades JSON
    capabilities JSONB,  -- {"análisis": true, "síntesis": true, ...}
    
    INDEX idx_tipo (tipo_agente),
    INDEX idx_estado (estado_operativo)
);

-- 6. PASOS DE PROCESO (Para historial visual en frontend)
CREATE TABLE sistema.pasos_proceso (
    id SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES sistema.proyecto_ley(id) ON DELETE CASCADE,
    
    num_paso INT NOT NULL,
    nombre_paso VARCHAR(200) NOT NULL,
    agente_responsable VARCHAR(100) REFERENCES sistema.agentes_registrados(nombre_agente),
    
    estado_paso VARCHAR(30)
        CHECK (estado_paso IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'ERROR')),
    
    resultado JSONB,
    timestamp_inicio TIMESTAMP,
    timestamp_fin TIMESTAMP,
    duracion_segundos INT,
    
    INDEX idx_proyecto_paso (id_proyecto, num_paso),
    INDEX idx_estado (estado_paso)
);

-- =====================================================
-- ESQUEMA: public (Corpus RAG - Solo Lectura/Ingesta)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS public;

-- Artículos Constitucionales (vectorizados)
CREATE TABLE IF NOT EXISTS public.articulos_constitucion (
    id SERIAL PRIMARY KEY,
    articulo_numero VARCHAR(10),
    titulo VARCHAR(300),
    contenido TEXT NOT NULL,
    embedding vector(2048),  -- Embedding NVIDIA 2048 dims
    fuente_documento VARCHAR(100) DEFAULT 'CPE_2009',
    fecha_ingestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_articulo (articulo_numero),
    INDEX idx_embedding ON public.articulos_constitucion USING ivfflat(embedding vector_cosine_ops)
);

-- Normativas vigentes (vectorizadas)
CREATE TABLE IF NOT EXISTS public.normativas_vigentes (
    id SERIAL PRIMARY KEY,
    titulo_norma VARCHAR(300) NOT NULL,
    tipo_norma VARCHAR(50)
        CHECK (tipo_norma IN ('Codigo', 'Ley', 'Decreto', 'Instruccion')),
    numero_norma VARCHAR(50),
    contenido TEXT NOT NULL,
    embedding vector(2048),
    jerarquia_normativa INT CHECK (jerarquia_normativa BETWEEN 1 AND 5),
    fecha_vigencia DATE,
    fecha_derogacion DATE,
    fecha_ingestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_titulo (titulo_norma),
    INDEX idx_tipo (tipo_norma),
    INDEX idx_embedding ON public.normativas_vigentes USING ivfflat(embedding vector_cosine_ops)
);

-- Jurisprudencia Constitucional
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
    
    INDEX idx_materia (materia),
    INDEX idx_fecha (fecha_sentencia)
);
1.3 Script de Migración
bash
# migrations/001_eliminar_redundancias.sql

-- Crear respaldo de datos antes de eliminar
CREATE TABLE IF NOT EXISTS backup.clasificacion_agente_respaldo AS 
SELECT * FROM public.Clasificacion_Agente;

CREATE TABLE IF NOT EXISTS backup.clasificacion_comision_respaldo AS 
SELECT * FROM public.Clasificacion_Comision;

-- Migrar datos relevantes a schema sistema
INSERT INTO sistema.proyecto_ley 
    (id_expediente, tipo_documento, usuario_ingreso, fecha_ingreso)
SELECT DISTINCT 
    CONCAT('MIGRADO_', id),
    tipo_documento,
    'admin_migracion',
    CURRENT_TIMESTAMP
FROM backup.clasificacion_agente_respaldo
WHERE id NOT IN (SELECT id FROM sistema.proyecto_ley);

-- Eliminar tablas redundantes
DROP TABLE IF EXISTS public.Clasificacion_Agente CASCADE;
DROP TABLE IF EXISTS public.Clasificacion_Comision CASCADE;
DROP TABLE IF EXISTS public.Solicitudes_Documentos CASCADE;

-- Crear índices faltantes
CREATE INDEX idx_proyecto_ley_estado 
ON sistema.proyecto_ley(estado_actual);

CREATE INDEX idx_observaciones_proyecto 
ON sistema.observaciones_unificadas(id_proyecto);

<a id="fase-2-rediseño-del-frontend"></a>

🎨 FASE 2: REDISEÑO DEL FRONTEND
2.1 Nueva Estructura de Componentes React
bash
# Estructura mejorada de carpetas
frontend/src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx                 # Encabezado con logo + navegación
│   │   ├── Sidebar.jsx                # Sidebar con lista de documentos activos
│   │   └── TabNavigation.jsx          # Tabs de documentos abiertos
│   │
│   ├── upload/
│   │   ├── DocumentUpload.jsx         # Área drag-drop múltiple
│   │   ├── UploadProgress.jsx         # Progreso de carga paralela
│   │   └── DocumentPreview.jsx        # Vista previa del documento
│   │
│   ├── agents/
│   │   ├── AgentCard.jsx              # Card de agente con logo/avatar
│   │   ├── AgentAvatar.jsx            # Avatar personalizable por agente
│   │   ├── AgentTimeline.jsx          # Timeline de ejecución
│   │   └── AgentMessage.jsx           # Mensaje/comunicación del agente
│   │
│   ├── process/
│   │   ├── ProcessSteps.jsx           # Steps visual del proceso
│   │   ├── StepDetail.jsx             # Detalle de cada paso
│   │   ├── StepHistory.jsx            # Historial expandible
│   │   └── BacktrackControl.jsx       # Botones retroceso/avance
│   │
│   ├── observations/
│   │   ├── ObservationsList.jsx       # Lista de observaciones
│   │   ├── ObservationCard.jsx        # Card individual
│   │   ├── ObservationFilter.jsx      # Filtros por tipo/agente
│   │   └── RiskIndicator.jsx          # Indicador de riesgo
│   │
│   └── common/
│       ├── Icon.jsx                   # Wrapper de Lucide Icons
│       ├── Button.jsx                 # Botones custom
│       └── Modal.jsx                  # Modales reutilizables
│
├── hooks/
│   ├── useDocuments.js                # Hook para gestión de documentos
│   ├── useAgentStatus.js              # Hook para estado de agentes
│   ├── useProcessHistory.js           # Hook para historial
│   └── useWebSocket.js                # Hook para updates en tiempo real
│
├── stores/
│   ├── documentStore.js               # Zustand store documentos
│   ├── processStore.js                # Zustand store proceso
│   ├── agentStore.js                  # Zustand store agentes
│   └── notificationStore.js           # Zustand store notificaciones
│
├── pages/
│   ├── Dashboard.jsx                  # Dashboard principal
│   ├── ProjectDetail.jsx              # Detalle de proyecto
│   ├── Reports.jsx                    # Reportes y análisis
│   └── AgentManagement.jsx            # Gestión de agentes
│
├── api/
│   ├── client.js                      # Cliente axios configurado
│   ├── projectService.js              # Servicios proyectos
│   ├── agentService.js                # Servicios agentes
│   └── processService.js              # Servicios proceso
│
├── utils/
│   ├── constants.js                   # Constantes de la app
│   ├── agentConfig.js                 # Config dinámicas de agentes
│   └── formatters.js                  # Funciones de formato
│
├── styles/
│   ├── variables.css                  # Variables CSS (colores, fuentes)
│   ├── components.css                 # Estilos componentes
│   └── layout.css                     # Estilos de layout
│
└── App.jsx                            # Componente raíz
2.2 Componentes Clave Rediseñados
A) Gestor de Múltiples Documentos (Tabs)
jsx
// components/layout/TabNavigation.jsx
import React from 'react';
import { useDocuments } from '../../hooks/useDocuments';
import { X, Plus } from 'lucide-react';

export const TabNavigation = () => {
  const { openDocuments, activeDocId, switchDocument, closeDocument } = useDocuments();

  return (
    <div className="flex items-center gap-2 bg-gray-50 border-b border-gray-200 px-4 py-2 overflow-x-auto">
      {openDocuments.map((doc) => (
        <div
          key={doc.id}
          onClick={() => switchDocument(doc.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-t cursor-pointer transition-all ${
            activeDocId === doc.id
              ? 'bg-white border-t-2 border-blue-500 text-blue-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span className="text-sm font-medium truncate max-w-[150px]">
            {doc.titulo_proyecto}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeDocument(doc.id);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      
      <button className="p-2 rounded hover:bg-gray-200">
        <Plus size={18} />
      </button>
    </div>
  );
};
B) Componente de Agente con Avatar Dinámico
jsx
// components/agents/AgentCard.jsx
import React from 'react';
import { useAgentStatus } from '../../hooks/useAgentStatus';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

export const AgentCard = ({ agente }) => {
  const { status } = useAgentStatus(agente.nombre_agente);

  const getStatusIcon = () => {
    switch (status?.estado) {
      case 'COMPLETADO':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'EN_PROGRESO':
        return <Zap className="text-yellow-500 animate-pulse" size={20} />;
      case 'ERROR':
        return <AlertCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all">
      {/* Logo/Avatar del Agente */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
          {agente.logo_url ? (
            <img src={agente.logo_url} alt={agente.nombre_agente} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-lg">
              {agente.nombre_agente.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{agente.nombre_agente}</h4>
          <p className="text-xs text-gray-500">{agente.tipo_agente}</p>
        </div>

        {getStatusIcon()}
      </div>

      {/* Descripción y Estado */}
      <p className="text-sm text-gray-600 mb-2">{agente.descripcion}</p>

      {/* Progress bar si está en progreso */}
      {status?.estado === 'EN_PROGRESO' && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${status.progreso || 0}%` }}
          />
        </div>
      )}

      {/* Resultado si está completado */}
      {status?.resultado && (
        <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-gray-700">
          <strong>Resultado:</strong> {status.resultado}
        </div>
      )}
    </div>
  );
};
C) Timeline de Pasos con Retroceso
jsx
// components/process/ProcessSteps.jsx
import React from 'react';
import { useProcessHistory } from '../../hooks/useProcessHistory';
import { ChevronUp, ChevronDown, Play } from 'lucide-react';

export const ProcessSteps = ({ idProyecto }) => {
  const { pasos, currentStep, expandedStep, expandStep, retroceder, avanzar } = 
    useProcessHistory(idProyecto);

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Historial de Proceso</h3>

      <div className="space-y-2">
        {pasos.map((paso, index) => (
          <div key={paso.id} className="border border-gray-200 rounded-lg overflow-hidden">
            
            {/* Encabezado del paso */}
            <button
              onClick={() => expandStep(paso.id)}
              className={`w-full px-4 py-3 flex items-center justify-between 
                ${paso.estado_paso === 'COMPLETADO' ? 'bg-green-50' : 'bg-gray-50'}
                hover:bg-gray-100 transition-colors`}
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                {/* Icono de estado */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
                  ${paso.estado_paso === 'COMPLETADO' ? 'bg-green-500' :
                    paso.estado_paso === 'EN_PROGRESO' ? 'bg-blue-500' :
                    paso.estado_paso === 'ERROR' ? 'bg-red-500' :
                    'bg-gray-300'}`}>
                  {index + 1}
                </div>

                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{paso.nombre_paso}</h4>
                  <p className="text-xs text-gray-500">Agente: {paso.agente_responsable}</p>
                </div>
              </div>

              {/* Botón expandir */}
              {expandedStep === paso.id ? (
                <ChevronUp className="text-gray-400" />
              ) : (
                <ChevronDown className="text-gray-400" />
              )}
            </button>

            {/* Contenido expandido */}
            {expandedStep === paso.id && (
              <div className="px-4 py-3 border-t border-gray-200 bg-white">
                <div className="space-y-2 mb-3">
                  <p><strong>Estado:</strong> {paso.estado_paso}</p>
                  <p><strong>Inicio:</strong> {new Date(paso.timestamp_inicio).toLocaleString()}</p>
                  {paso.timestamp_fin && (
                    <p><strong>Finalización:</strong> {new Date(paso.timestamp_fin).toLocaleString()}</p>
                  )}
                  {paso.duracion_segundos && (
                    <p><strong>Duración:</strong> {paso.duracion_segundos}s</p>
                  )}
                </div>

                {paso.resultado && (
                  <div className="bg-blue-50 p-2 rounded text-sm">
                    <strong>Resultado:</strong>
                    <pre className="mt-1 text-xs overflow-auto">
                      {JSON.stringify(paso.resultado, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Controles de retroceso */}
                {paso.estado_paso === 'COMPLETADO' && currentStep > index && (
                  <button
                    onClick={() => retroceder(paso.id)}
                    className="mt-3 flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-sm"
                  >
                    ↶ Retroceder a este paso
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
D) Listado de Observaciones con Filtros
jsx
// components/observations/ObservationsList.jsx
import React, { useState } from 'react';
import { useProcessHistory } from '../../hooks/useProcessHistory';
import { AlertTriangle, Info, CheckCircle, Filter } from 'lucide-react';

export const ObservationsList = ({ idProyecto }) => {
  const { observaciones } = useProcessHistory(idProyecto);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  const observacionesFiltradas = filtroTipo === 'TODOS'
    ? observaciones
    : observaciones.filter(o => o.tipo_observacion === filtroTipo);

  const riesgoColors = {
    CRÍTICO: 'bg-red-100 border-red-300 text-red-900',
    ALTO: 'bg-orange-100 border-orange-300 text-orange-900',
    MEDIO: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    BAJO: 'bg-green-100 border-green-300 text-green-900'
  };

  return (
    <div className="max-w-3xl">
      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <Filter size={18} className="text-gray-600" />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="TODOS">Todos los tipos</option>
          <option value="CONSTITUCIONAL">Constitucional</option>
          <option value="CONSISTENCIA_NORMATIVA">Consistencia</option>
          <option value="CONCENTRACION_FINAL">Concentración</option>
          <option value="ACTA_DEBATE">Debate</option>
        </select>
      </div>

      {/* Observaciones */}
      <div className="space-y-3">
        {observacionesFiltradas.map((obs) => (
          <div
            key={obs.id}
            className={`border-l-4 p-4 rounded ${
              obs.riesgo_normativo ? riesgoColors[obs.riesgo_normativo] : 'bg-blue-50 border-blue-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {obs.riesgo_normativo === 'CRÍTICO' && <AlertTriangle size={20} className="flex-shrink-0 mt-1" />}
              {obs.riesgo_normativo === 'ALTO' && <AlertTriangle size={20} className="flex-shrink-0 mt-1" />}
              {obs.riesgo_normativo === 'BAJO' && <CheckCircle size={20} className="flex-shrink-0 mt-1" />}
              {!obs.riesgo_normativo && <Info size={20} className="flex-shrink-0 mt-1" />}

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{obs.tipo_observacion}</h4>
                  <span className="text-xs font-medium px-2 py-1 bg-white rounded">
                    {obs.agente_generador}
                  </span>
                </div>

                <p className="text-sm mb-2">{obs.recomendacion}</p>

                {obs.artículos_afectados?.length > 0 && (
                  <p className="text-xs text-gray-600">
                    <strong>Artículos:</strong> {obs.artículos_afectados.join(', ')}
                  </p>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  {new Date(obs.fecha_generacion).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
2.3 Configuración TailwindCSS + Temas
js
// tailwind.config.js
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Colores por tipo de agente
        agente: {
          distribuidor: '#3B82F6',      // Azul
          constitucional: '#8B5CF6',    // Púrpura
          consistencia: '#EC4899',      // Rosa
          concentrador: '#10B981',      // Verde
          secretario: '#F59E0B',        // Ámbar
          bicameral: '#06B6D4',         // Cyan
          veto: '#EF4444',              // Rojo
          publicacion: '#6366F1',       // Índigo
        }
      }
    }
  },
  plugins: []
};
css
/* src/styles/variables.css */
:root {
  /* Agentes */
  --color-agente-distribuidor: #3B82F6;
  --color-agente-constitucional: #8B5CF6;
  --color-agente-consistencia: #EC4899;
  --color-agente-concentrador: #10B981;
  --color-agente-secretario: #F59E0B;
  --color-agente-bicameral: #06B6D4;
  --color-agente-veto: #EF4444;
  --color-agente-publicacion: #6366F1;

  /* Riesgos */
  --color-riesgo-critico: #DC2626;
  --color-riesgo-alto: #EA580C;
  --color-riesgo-medio: #EAB308;
  --color-riesgo-bajo: #16A34A;

  /* Estados */
  --color-estado-pendiente: #9CA3AF;
  --color-estado-progreso: #3B82F6;
  --color-estado-completado: #10B981;
  --color-estado-error: #EF4444;
}
2.4 Hook para Gestión de Documentos Multi-Upload
js
// src/hooks/useDocuments.js
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const useDocumentStore = create((set) => ({
  openDocuments: [],
  activeDocId: null,

  addDocument: (file) => set((state) => {
    const newDoc = {
      id: uuidv4(),
      titulo_proyecto: file.name,
      contenido_raw: file,
      estado: 'CARGANDO',
      fecha_carga: new Date(),
      progreso: 0
    };
    return {
      openDocuments: [...state.openDocuments, newDoc],
      activeDocId: newDoc.id
    };
  }),

  updateDocumentProgress: (docId, progreso) => set((state) => ({
    openDocuments: state.openDocuments.map(doc =>
      doc.id === docId ? { ...doc, progreso } : doc
    )
  })),

  switchDocument: (docId) => set({ activeDocId: docId }),

  closeDocument: (docId) => set((state) => ({
    openDocuments: state.openDocuments.filter(d => d.id !== docId),
    activeDocId: state.openDocuments.length > 1 && state.activeDocId === docId
      ? state.openDocuments.find(d => d.id !== docId)?.id
      : state.activeDocId
  }))
}));

export const useDocuments = () => {
  const { openDocuments, activeDocId, addDocument, updateDocumentProgress, switchDocument, closeDocument } =
    useDocumentStore();
  const activeDocument = openDocuments.find(d => d.id === activeDocId);

  return {
    openDocuments,
    activeDocId,
    activeDocument,
    addDocument,
    updateDocumentProgress,
    switchDocument,
    closeDocument
  };
};

<a id="fase-3-arquitectura-de-agentes-avanzados"></a>

🤖 FASE 3: ARQUITECTURA DE AGENTES AVANZADOS
3.1 Mapa de Agentes (8 Total)
┌─────────────────────────────────────────────────────────────────┐
│                    NIVEL 1: ENTRADA Y CLASIFICACIÓN              │
├─────────────────────────────────────────────────────────────────┤
│  Agente Distribuidor                                            │
│  └─> Clasifica: Proyecto Ley / Petición / Oficio               │
│  └─> Punto de Control Humano (Confirmar/Ajustar)               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                NIVEL 2A: AUDITORÍA Y ANÁLISIS PARALELO           │
├─────────────────────────────────────────────────────────────────┤
│ • Agente Comisión Legislativa                                   │
│ • Agente Verificador Constitucional                             │
│ • Agente Consistencia Normativa                                 │
│   └─> Todos ejecutan en paralelo (ThreadPoolExecutor)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            NIVEL 2B-3: TRAMITACIÓN LEGISLATIVA AVANZADA          │
├─────────────────────────────────────────────────────────────────┤
│ • Agente Concentrador y Emisor de Proyecto                      │
│   └─> Integra observaciones de múltiples agentes               │
│   └─> Genera expediente consolidado                             │
│                                                                  │
│ • Agente Secretario de Cámara (Actas)                          │
│   └─> Registro estructura de debates                            │
│   └─> Captura votaciones y acuerdos                            │
│                                                                  │
│ • Agente Comisión de Constitución (Fondo)                      │
│   └─> Análisis de constitucionalidad sustantiva                │
│   └─> Hermenéutica y precedentes                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                NIVEL 4: EVALUACIÓN BICAMERAL                     │
├─────────────────────────────────────────────────────────────────┤
│ • Agente Comunicación Bicameral                                 │
│   └─> Gestiona ciclo entre cámaras                             │
│   └─> Detecta modificaciones                                   │
│   └─> Activa revisión o conferencia bicameral                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               NIVEL 5: DECISIÓN EJECUTIVA FINAL                  │
├─────────────────────────────────────────────────────────────────┤
│ • Agente Veto y Promulgación (Prometheus)                      │
│   └─> Evaluación estratégica multicriterio                     │
│   └─> Promulga / Veto Total / Veto Parcial                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 NIVEL 6: PUBLICACIÓN Y VIGENCIA                  │
├─────────────────────────────────────────────────────────────────┤
│ • Agente Publicación Oficial                                    │
│   └─> Asigna número de ley                                     │
│   └─> Formatea para boletín oficial                            │
│   └─> Integra a base normativa                                 │
└─────────────────────────────────────────────────────────────────┘
3.2 Fichas de Agentes Nuevos
AGENTE 1: CONCENTRADOR Y EMISOR DE PROYECTO
Propiedad	Valor
Nombre	Agente Concentrador y Emisor de Proyecto
Tipo	NIVEL_2_SINTESIS
Rol Principal	Integrar observaciones de múltiples agentes sin alterar sentido original
Razonamiento	Chain of Thought (CoT) para síntesis fidedigna
Input	Reportes de Constitucional, Consistencia, Comisión Legislativa
Output	Expediente consolidado con trazabilidad de origen
Logo Color	Verde (
#10B981)
Capabilities	síntesis, integración, trazabilidad, eliminación de redundancias

Prompt Base:

Eres el Agente Concentrador de un sistema legislativo multi-agente.
Tu tarea es INTEGRAR observaciones de múltiples agentes (Constitucional, Consistencia, Comisión)
en un único cuerpo coherente SIN ALTERAR EL SENTIDO ORIGINAL.

IMPORTANTE:
1. Cada observación debe ser rastreable a su origen (quién la emitió y por qué)
2. Elimina redundancias pero preserva puntos diferentes
3. Mantén el tono objetivo de cada reporte
4. Crea un expediente "dictaminado" listo para la siguiente etapa

Genere JSON con estructura:
{
  "expediente_consolidado": {
    "resumen_ejecutivo": "...",
    "observaciones_integradas": [
      {
        "tipo": "CONSTITUCIONAL",
        "agente_origen": "Verificador Constitucional",
        "contenido": "...",
        "riesgo": "ALTO"
      }
    ],
    "estado_siguiente": "LISTO_PARA_DEBATE"
  }
}
AGENTE 2: SECRETARIO DE CÁMARA (ACTAS)
Propiedad	Valor
Nombre	Agente Secretario de Cámara (Actas)
Tipo	NIVEL_3_REGISTRO
Rol Principal	Registro estructurado paso a paso del debate legislativo
Razonamiento	CoT para capturar secuencia sin alucinaciones
Input	Transcripciones de debate, votaciones, acuerdos
Output	Actas estructuradas con intervenciones, votaciones, acuerdos
Logo Color	Ámbar (
#F59E0B)
Capabilities	registro, desglose, verificación cruzada, acta formal

Prompt Base:

Eres el Secretario de Cámara responsable de registrar el debate legislativo.
Tu rol es DESGLOZAR el debate en secuencia temporal, capturando:
1. Intervenciones de legisladores (quién, cuándo, qué dijo)
2. Votaciones nominales (sí/no/abstención)
3. Acuerdos y decisiones adoptadas
4. Moción y resoluciones

MÉTODO: Chain of Thought paso a paso. Verifica cada evento cruzando fuentes.

Genere JSON con estructura:
{
  "acta_debate": {
    "fecha": "2025-03-15",
    "sesion_numero": 12,
    "intervenciones": [
      {
        "orden": 1,
        "legislador": "Diputado X",
        "partido": "PPD",
        "contenido": "...",
        "timestamp": "14:30"
      }
    ],
    "votaciones": [
      {
        "artículo": 5,
        "votacion": "APROBADO",
        "favor": 65,
        "contra": 30,
        "abstenciones": 5
      }
    ]
  }
}
AGENTE 3: COMUNICACIÓN BICAMERAL
Propiedad	Valor
Nombre	Agente Comunicación entre Cámaras (Bicameral)
Tipo	NIVEL_4_COORDINACION
Rol Principal	Gestiona ciclo entre cámaras, detecta modificaciones
Razonamiento	Reglas predefinidas de ida y vuelta
Input	Proyecto de una cámara, cambios detectados
Output	Decisión de envío a otra cámara o conferencia
Logo Color	Cyan (
#06B6D4)
Capabilities	comparación, detección de cambios, reglas bicamerales, coordinación

Prompt Base:

Eres el Agente de Comunicación Bicameral. Gestionas el flujo de proyectos entre cámaras.

REGLAS:
1. Si el proyecto regresa SIN CAMBIOS → Sanción inmediata
2. Si hay cambios MAYORES → Conferencia Bicameral
3. Si hay cambios MENORES → Aprovación automática de la otra cámara

Tu tarea:
1. Comparar versión original vs. versión retornada
2. Clasificar cambios como MAYORES o MENORES
3. Decidir ruta: SANCION_DIRECTA o CONFERENCIA_BICAMERAL

Genere JSON:
{
  "ciclo_bicameral": {
    "proyecto_id": "...",
    "version_original": {...},
    "version_retornada": {...},
    "cambios_detectados": [...],
    "clasificacion_cambios": "MAYORES|MENORES",
    "ruta_siguiente": "SANCION_DIRECTA|CONFERENCIA_BICAMERAL"
  }
}
AGENTE 4: VETO Y PROMULGACIÓN (PROMETHEUS)
Propiedad	Valor
Nombre	Agente Veto y Promulgación (Prometheus)
Tipo	NIVEL_5_DECISIÓN_EJECUTIVA
Rol Principal	Evaluación estratégica multicriterio: promulga, veto total o parcial
Razonamiento	Razonamiento estratégico multidimensional (política, legalidad, fiscalidad)
Input	Proyecto sancionado, alertas presupuestarias, dictámenes
Output	Orden de promulgación o veto (total/parcial)
Logo Color	Rojo (
#EF4444)
Capabilities	análisis multicriterio, simulación de escenarios, decisión estratégica

Prompt Base:

Eres el Agente Veto y Promulgación (Prometheus).
Eres el TOMADOR DE DECISIONES ESTRATÉGICO FINAL del sistema legislativo.

Tu evaluación multicriterio:
1. VIABILIDAD POLÍTICA: ¿Estoy en posición de promulgar sin riesgo político?
2. LEGALIDAD CONSTITUCIONAL: ¿Es compatible con la CPE 2009?
3. FACTIBILIDAD TÉCNICA: ¿Se puede ejecutar administrativamente?
4. SOSTENIBILIDAD FISCAL: ¿Hay presupuesto? ¿Hay alertas?

SALIDAS POSIBLES:
- PROMULGAR: Aprobación completa
- VETAR_TOTAL: Rechazo absoluto (retorna a cámaras)
- VETAR_PARCIAL: Observaciones a artículos específicos

Genere JSON:
{
  "evaluacion_veto": {
    "proyecto_id": "...",
    "decision": "PROMULGAR|VETAR_TOTAL|VETAR_PARCIAL",
    "criterios": {
      "viabilidad_politica": {score: 8, razon: "..."},
      "legalidad_constitucional": {score: 9, razon: "..."},
      "factibilidad_tecnica": {score: 7, razon: "..."},
      "sostenibilidad_fiscal": {score: 6, razon: "..."}
    },
    "score_final": 7.5,
    "observaciones_parciales": ["Art. 5 modificar redacción", ...],
    "justificacion": "..."
  }
}
AGENTE 5: PUBLICACIÓN OFICIAL
Propiedad	Valor
Nombre	Agente Publicación Oficial
Tipo	NIVEL_6_REGISTRO_NORMATIVO
Rol Principal	Asigna número de ley, vigencia, formatea boletín oficial
Razonamiento	Determinista (algoritmo de secuencial)
Input	Ley promulgada, fecha de promulgación
Output	Ley publicada con número y fecha de vigencia
Logo Color	Índigo (
#6366F1)
Capabilities	numeración, formateo, publicación, registro normativo

Prompt Base:

Eres el Agente de Publicación Oficial.
Tu tarea es DETERMINISTA: asignar número de ley secuencial e integrar a la base normativa.

PROCEDIMIENTO:
1. Obtén el último número de ley registrado
2. Asigna número secuencial siguiente
3. Establece fecha de vigencia (generalmente día siguiente de publicación)
4. Formatea para Boletín Oficial
5. Integra a tabla sistema.normativas_vigentes

Genere JSON:
{
  "publicacion_oficial": {
    "proyecto_id": "...",
    "numero_ley": "Ley No. 1472",
    "titulo": "...",
    "fecha_promulgacion": "2025-03-20",
    "fecha_vigencia": "2025-03-21",
    "boletin_oficial": "BOL-2025-03-20-001",
    "estado": "PUBLICADA"
  }
}
AGENTE 6: COMISIÓN DE CONSTITUCIÓN (FONDO)
Propiedad	Valor
Nombre	Agente Comisión de Constitución (Fondo)
Tipo	NIVEL_2_AUDITORÍA_ESPECIALIZADA
Rol Principal	Análisis de constitucionalidad sustantiva (hermenéutica + precedentes)
Razonamiento	Razonamiento analógico y principialista (Case-Based Reasoning)
Input	Proyecto de ley, jurisprudencia actualizada
Output	Dictamen de fondo con fundamentación jurídica
Logo Color	Púrpura (
#8B5CF6)
Capabilities	interpretación constitucional, análisis de precedentes, hermenéutica jurídica

Prompt Base:

Eres el Agente de Comisión de Constitución (Fondo).
Tu rol es ANÁLISIS HERMENÉUTICO del proyecto contra la Constitución Política del Estado.

NO buscas errores binarios (forma), sino VIABILIDAD DE FONDO.

METODOLOGÍA:
1. Análisis Analógico: Busca precedentes similares en jurisprudencia
2. Interpretación Constitucional: Contrasta artículos contra principios CPE
3. Ponderación de Derechos: Si hay conflicto de derechos, analiza jerarquía
4. Generación de Dictamen: Documento formal argumentado

Bases de Conocimiento disponibles:
- Constitución Política del Estado 2009
- Jurisprudencia del Tribunal Constitucional
- Precedentes legislativos históricos

Genere JSON:
{
  "dictamen_fondo": {
    "proyecto_id": "...",
    "viabilidad_fondo": "VIABLE|VIABLE_CON_OBSERVACIONES|NO_VIABLE",
    "analisis_hermeneutico": {
      "principios_aplicables": ["Jerarquía normativa", ...],
      "precedentes_relevantes": ["Sentencia TC 1234/2022", ...],
      "conflictos_derechos": []
    },
    "recomendaciones": "...",
    "riesgo_constitucional": "BAJO|MEDIO|ALTO"
  }
}
3.3 Estructura de Datos de Agentes en BD
sql
-- Registrar agentes en sistema.agentes_registrados
INSERT INTO sistema.agentes_registrados 
(nombre_agente, tipo_agente, descripcion, logo_url, estado_operativo, capabilities)
VALUES
  (
    'Concentrador y Emisor',
    'CONCENTRADOR',
    'Integra observaciones de múltiples agentes en expediente consolidado',
    'https://assets.sma-congreso.bo/agentes/concentrador.png',
    true,
    '{"sintesis": true, "integracion": true, "trazabilidad": true}'::jsonb
  ),
  (
    'Secretario de Cámara',
    'SECRETARIO',
    'Registro estructurado de debates, votaciones y acuerdos',
    'https://assets.sma-congreso.bo/agentes/secretario.png',
    true,
    '{"registro": true, "desglose": true, "verificacion_cruzada": true}'::jsonb
  ),
  (
    'Comunicación Bicameral',
    'BICAMERAL',
    'Gestiona ciclo entre cámaras y detecta modificaciones',
    'https://assets.sma-congreso.bo/agentes/bicameral.png',
    true,
    '{"comparacion": true, "reglas_bicamerales": true, "coordinacion": true}'::jsonb
  ),
  (
    'Veto y Promulgación',
    'VETO',
    'Evaluación estratégica multicriterio: promulga, veto total o parcial',
    'https://assets.sma-congreso.bo/agentes/veto.png',
    true,
    '{"analisis_multicriterio": true, "simulacion_escenarios": true, "decision_ejecutiva": true}'::jsonb
  ),
  (
    'Publicación Oficial',
    'PUBLICACION',
    'Asigna número de ley y publica en boletín oficial',
    'https://assets.sma-congreso.bo/agentes/publicacion.png',
    true,
    '{"numeracion": true, "formateo": true, "publicacion": true}'::jsonb
  ),
  (
    'Comisión Constitución (Fondo)',
    'FONDO',
    'Análisis hermenéutico de constitucionalidad sustantiva',
    'https://assets.sma-congreso.bo/agentes/constitucion-fondo.png',
    true,
    '{"hermeneutica": true, "precedentes": true, "ponderacion_derechos": true}'::jsonb
  );

<a id="fase-4-configuración-yaml-crewai"></a>

⚙️ FASE 4: CONFIGURACIÓN YAML CREWAI
4.1 Estructura de Archivos YAML
backend/sma_unified/config/
├── agents.yaml                 # Definición de agentes
├── tasks.yaml                  # Definición de tareas
├── tools.yaml                  # Herramientas disponibles
├── prompts/                    # Prompts por agente (opsional, referenciados desde YAML)
│   ├── concentrador.md
│   ├── secretario.md
│   ├── bicameral.md
│   ├── veto.md
│   ├── publicacion.md
│   └── constitucion_fondo.md
└── workflows.yaml              # Flujos de orquestación
4.2 Archivo config/agents.yaml
yaml
# agents.yaml
# Definición declarativa de todos los agentes del SMA

agentes:
  # ========== NIVEL 1: ENTRADA ==========
  
  Distribuidor:
    rol: "Clasificador de Documentos Legislativos"
    objetivo: >
      Clasificar documento ingresado en categoría correcta:
      (Proyecto de Ley, Petición Ciudadana, Oficio Externo, Otro)
    descripcion_agente: >
      Eres un experto en clasificación legislativa. Debes analizar rápidamente
      el documento y determinar su tipo con alta confianza. Tu salida será
      revisada por un humano en un punto de control.
    
    nombre_agente: "Agente Distribuidor"
    tipo: "NIVEL_1"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.3  # Bajo: clasificación objetiva
    max_tokens: 1000
    
    logo_url: "https://assets.sma-congreso.bo/agentes/distribuidor.png"
    color: "#3B82F6"  # Azul
    
  # ========== NIVEL 2: AUDITORÍA PARALELA ==========
  
  Verificador_Constitucional:
    rol: "Auditor de Constitucionalidad"
    objetivo: >
      Auditar proyecto de ley contra la Constitución Política del Estado 2009.
      Clasificar hallazgos en: A_FAVOR, EN_CONTRA, NEUTRAL
    descripcion_agente: >
      Eres un experto constitucionalista. Tu rol es buscar incompatibilidades
      entre el proyecto y la CPE 2009. Usa busqueda vectorial en la base de
      conocimiento de artículos constitucionales. Mantén temperatura 0.0 para
      hallazgos objetivos.
    
    nombre_agente: "Verificador Constitucional"
    tipo: "NIVEL_2"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.0  # Crítica: análisis objetivo
    max_tokens: 2000
    
    tools: ["search_constitucion", "retrieve_jurisprudencia"]
    logo_url: "https://assets.sma-congreso.bo/agentes/constitucional.png"
    color: "#8B5CF6"  # Púrpura
    
  Consistencia_Normativa:
    rol: "Auditor de Consistencia Normativa"
    objetivo: >
      Cotejar proyecto contra corpus de leyes vigentes.
      Detectar derogaciones tácitas, conflictos de especialidad,
      redundancias y contradicciones.
    descripcion_agente: >
      Eres experto en ordenamiento jurídico. Tu tarea es búsqueda semántica
      en la base de normativas vigentes. Usa pgvector + embeddings NVIDIA
      para encontrar normas potencialmente conflictivas.
      Reporta cada conflicto con artículos específicos.
    
    nombre_agente: "Consistencia Normativa"
    tipo: "NIVEL_2"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.0
    max_tokens: 2500
    
    tools: ["search_normativas_vectorial", "retrieve_leyes_codigo"]
    logo_url: "https://assets.sma-congreso.bo/agentes/consistencia.png"
    color: "#EC4899"  # Rosa
    
  Comision_Legislativa:
    rol: "Asignador de Comisión Parlamentaria"
    objetivo: >
      Determinar comisión parlamentaria competente para análisis del proyecto.
      Seleccionar entre: Justicia Plural, Economía, Derechos Humanos,
      Educación, Salud, Obras Públicas, etc.
    descripcion_agente: >
      Eres experto en estructura legislativa. Analiza el proyecto y asigna
      la comisión temática más adecuada. Considera pluralidad de perspectivas.
    
    nombre_agente: "Comisión Legislativa"
    tipo: "NIVEL_2"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.2
    max_tokens: 800
    
    logo_url: "https://assets.sma-congreso.bo/agentes/comision.png"
    color: "#10B981"  # Verde
    
  # ========== NIVEL 2-3: SÍNTESIS Y DEBATE ==========
  
  Concentrador:
    rol: "Integrador de Observaciones Multi-Agente"
    objetivo: >
      Consolidar observaciones de Constitucional, Consistencia y Comisión
      en un único expediente coherente, manteniendo trazabilidad del origen.
      Eliminar redundancias, preservar diversidad de análisis.
    descripcion_agente: >
      Eres el nexo central del sistema. Tu tarea es síntesis fidedigna paso a paso.
      Aplica Chain of Thought. Lee reportes de múltiples agentes y genera
      expediente unificado donde cada observación es rastreable.
    
    nombre_agente: "Concentrador y Emisor"
    tipo: "NIVEL_3"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.1
    max_tokens: 3000
    
    allow_delegation: false  # No delega a otros agentes
    logo_url: "https://assets.sma-congreso.bo/agentes/concentrador.png"
    color: "#10B981"  # Verde
    
  Secretario_Camara:
    rol: "Registrador de Debates Legislativos"
    objetivo: >
      Capturar estructura paso a paso del debate parlamentario.
      Registrar intervenciones, votaciones, acuerdos, mociones.
    descripcion_agente: >
      Eres el Secretario de la Cámara. Tu rol es desglose temporal y verificación
      cruzada del debate. Usa CoT para cada evento. Evita alucinaciones.
    
    nombre_agente: "Secretario de Cámara"
    tipo: "NIVEL_3"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.0
    max_tokens: 2000
    
    logo_url: "https://assets.sma-congreso.bo/agentes/secretario.png"
    color: "#F59E0B"  # Ámbar
    
  Constitucion_Fondo:
    rol: "Analista Hermenéutico Constitucional"
    objetivo: >
      Realizar análisis de constitucionalidad sustantiva (no formal).
      Aplicar hermenéutica jurídica, precedentes, ponderación de derechos.
    descripcion_agente: >
      Eres experto jurídico en hermenéutica constitucional. Busca precedentes
      en jurisprudencia del TC. Aplica razonamiento analógico.
      Tu análisis es más profundo que el Verificador: buscas viabilidad de FONDO.
    
    nombre_agente: "Comisión Constitución (Fondo)"
    tipo: "NIVEL_2"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.2
    max_tokens: 2500
    
    tools: ["retrieve_jurisprudencia_tc", "search_constitucion_precedentes"]
    logo_url: "https://assets.sma-congreso.bo/agentes/constitucion-fondo.png"
    color: "#8B5CF6"  # Púrpura
    
  # ========== NIVEL 4: TRAMITACIÓN BICAMERAL ==========
  
  Bicameral:
    rol: "Coordinador de Trámite Bicameral"
    objetivo: >
      Gestionar flujo de proyecto entre cámaras.
      Detectar modificaciones, aplicar reglas de retorno.
      Decidir entre: Sanción directa o Conferencia bicameral.
    descripcion_agente: >
      Eres experto en procedimientos legislativos bicamerales.
      Compara versiones original vs. retornada.
      Clasifica cambios: MAYORES (conferencia) o MENORES (aprobación automática).
    
    nombre_agente: "Comunicación Bicameral"
    tipo: "NIVEL_4"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.1
    max_tokens: 1500
    
    logo_url: "https://assets.sma-congreso.bo/agentes/bicameral.png"
    color: "#06B6D4"  # Cyan
    
  # ========== NIVEL 5: DECISIÓN EJECUTIVA ==========
  
  Veto_Promulgacion:
    rol: "Tomador de Decisiones Estratégicas Finales"
    objetivo: >
      Evaluar proyecto sancionado bajo criterios multicriterio:
      Viabilidad política, Legalidad constitucional, Factibilidad técnica, Sostenibilidad fiscal.
      Decidir: PROMULGAR, VETAR_TOTAL, VETAR_PARCIAL.
    descripcion_agente: >
      Eres el Prometheus del sistema: el evaluador estratégico final.
      Consideras múltiples dimensiones simultáneamente.
      Tu decisión es inapelable en el contexto del sistema.
    
    nombre_agente: "Veto y Promulgación"
    tipo: "NIVEL_5"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.3  # Posibilita creatividad estratégica
    max_tokens: 2000
    
    allow_delegation: false
    logo_url: "https://assets.sma-congreso.bo/agentes/veto.png"
    color: "#EF4444"  # Rojo
    
  # ========== NIVEL 6: PUBLICACIÓN OFICIAL ==========
  
  Publicacion_Oficial:
    rol: "Publicador de Leyes en Boletín Oficial"
    objetivo: >
      Asignar número de ley secuencial, establecer fecha de vigencia,
      formatar para boletín oficial, integrar a base normativa.
    descripcion_agente: >
      Tu procedimiento es determinista. Obtén último número, suma 1,
      asigna vigencia (día siguiente a publicación), registra en BD.
      No hay lugar a interpretación.
    
    nombre_agente: "Publicación Oficial"
    tipo: "NIVEL_6"
    modelo_llm: "nvidia/llama-3.1-nemotron-70b-instruct"
    temperatura: 0.0  # Determinista
    max_tokens: 800
    
    allow_delegation: false
    logo_url: "https://assets.sma-congreso.bo/agentes/publicacion.png"
    color: "#6366F1"  # Índigo
4.3 Archivo config/tasks.yaml
yaml
# tasks.yaml
# Definición de tareas ejecutables por agentes

tareas:
  # ========== NIVEL 1 ==========
  
  Clasificar_Documento:
    descripcion: >
      Clasificar el documento ingresado determinando su tipo
    agente: "Distribuidor"
    expected_output: >
      JSON con tipo_documento determinado y confianza en decisión.
      Formato:
      {
        "tipo_documento": "Proyecto_Ley|Peticion|Oficio|Otro",
        "confianza": 0.95,
        "justificacion": "..."
      }
    herramientas: []
    
  # ========== NIVEL 2 PARALELO ==========
  
  Auditar_Constitucionalidad:
    descripcion: >
      Auditar proyecto contra Constitución Política del Estado 2009
    agente: "Verificador_Constitucional"
    expected_output: >
      JSON con hallazgos constitucionales clasificados
    herramientas:
      - name: "search_constitucion"
        description: "Busca artículos constitucionales relevantes"
      - name: "retrieve_jurisprudencia"
        description: "Recupera jurisprudencia relacionada"
    input_ejemplo: |
      Proyecto: "Ley de Reforma al Código Tributario"
      Analizar compatibilidad con CPE 2009 Art. 7, 9, 14
    
  Analizar_Consistencia:
    descripcion: >
      Verificar consistencia normativa contra leyes vigentes
    agente: "Consistencia_Normativa"
    expected_output: >
      JSON con conflictos normativosdetectados
    herramientas:
      - name: "search_normativas_vectorial"
        description: "Búsqueda semántica en pgvector"
      - name: "retrieve_leyes_codigo"
        description: "Recupera códigos y leyes específicas"
    
  Asignar_Comision:
    descripcion: >
      Determinar comisión parlamentaria competente
    agente: "Comision_Legislativa"
    expected_output: >
      JSON con comisión asignada y justificación
    herramientas: []
    
  # ========== NIVEL 2-3 ==========
  
  Concentrar_Observaciones:
    descripcion: >
      Integrar observaciones de múltiples agentes en expediente consolidado
    agente: "Concentrador"
    expected_output: >
      JSON con expediente consolidado y trazabilidad de origen
    herramientas: []
    depends_on:
      - "Auditar_Constitucionalidad"
      - "Analizar_Consistencia"
      - "Asignar_Comision"
    
  Registrar_Debate:
    descripcion: >
      Capturar estructura del debate legislativo
    agente: "Secretario_Camara"
    expected_output: >
      JSON con acta estructurada (intervenciones, votaciones, acuerdos)
    herramientas: []
    
  Analizar_Fondo_Constitucional:
    descripcion: >
      Análisis hermenéutico de constitucionalidad sustantiva
    agente: "Constitucion_Fondo"
    expected_output: >
      JSON con dictamen de fondo y precedentes
    herramientas:
      - name: "retrieve_jurisprudencia_tc"
        description: "Recupera sentencias del Tribunal Constitucional"
    
  # ========== NIVEL 4 ==========
  
  Gestionar_Bicameral:
    descripcion: >
      Gestionar trámite bicameral y detectar modificaciones
    agente: "Bicameral"
    expected_output: >
      JSON con decisión: SANCION_DIRECTA o CONFERENCIA_BICAMERAL
    herramientas: []
    
  # ========== NIVEL 5 ==========
  
  Evaluar_Veto_Promulgacion:
    descripcion: >
      Evaluación estratégica multicriterio: promulgar, vetar total o parcial
    agente: "Veto_Promulgacion"
    expected_output: >
      JSON con decisión y criterios ponderados
    herramientas: []
    depends_on:
      - "Gestionar_Bicameral"
    
  # ========== NIVEL 6 ==========
  
  Publicar_Ley_Oficial:
    descripcion: >
      Asignar número de ley y publicar en boletín oficial
    agente: "Publicacion_Oficial"
    expected_output: >
      JSON con número de ley asignado y vigencia
    herramientas: []
    depends_on:
      - "Evaluar_Veto_Promulgacion"
4.4 Archivo config/workflows.yaml
yaml
# workflows.yaml
# Definición de flujos de orquestación

workflows:
  
  Pipeline_Auditoria_Legislativa:
    nombre: "Pipeline de Auditoría Legislativa Completo"
    descripcion: "Flujo completo desde ingreso hasta publicación oficial"
    
    etapas:
      
      Etapa_1_Clasificacion:
        nombre: "Clasificación y Control Humano"
        tareas:
          - Clasificar_Documento
        punto_control: true
        descripcion: "El operador confirma o ajusta la clasificación automática"
      
      Etapa_2_Auditoria_Paralela:
        nombre: "Auditoría en Paralelo (15 seg)"
        tareas:
          - Auditar_Constitucionalidad
          - Analizar_Consistencia
          - Asignar_Comision
        paralelo: true
        timeout_segundos: 60
      
      Etapa_3_Sintesis:
        nombre: "Síntesis Consolidada"
        tareas:
          - Concentrar_Observaciones
        dependencias:
          - Etapa_2_Auditoria_Paralela
      
      Etapa_4_Debate:
        nombre: "Debate Legislativo (Humano)"
        tareas:
          - Registrar_Debate
          - Analizar_Fondo_Constitucional
        punto_control: true
        descripcion: "Debate en cámaras, registro de intervenciones y votaciones"
      
      Etapa_5_Bicameral:
        nombre: "Trámite Bicameral"
        tareas:
          - Gestionar_Bicameral
        punto_control: false
      
      Etapa_6_Veto:
        nombre: "Evaluación de Veto/Promulgación"
        tareas:
          - Evaluar_Veto_Promulgacion
      
      Etapa_7_Publicacion:
        nombre: "Publicación Oficial"
        tareas:
          - Publicar_Ley_Oficial
        punto_control: false
    
    tiempo_estimado_minutos: 120
    critico: true
    
  Pipeline_Auditoria_Simple:
    nombre: "Auditoría Simplificada (sin debate)"
    descripcion: "Para proyectos de bajo riesgo o Peticiones"
    
    etapas:
      
      Etapa_1_Clasificacion:
        nombre: "Clasificación"
        tareas:
          - Clasificar_Documento
        punto_control: true
      
      Etapa_2_Auditoria:
        nombre: "Auditoría Rápida"
        tareas:
          - Auditar_Constitucionalidad
          - Analizar_Consistencia
        paralelo: true
        timeout_segundos: 30
      
      Etapa_3_Informe:
        nombre: "Generación de Informe"
        tareas:
          - Concentrar_Observaciones
        punto_control: true
    
    tiempo_estimado_minutos: 15
    critico: false
4.5 Archivo backend/server.py (Orquestación CrewAI)
python
# backend/server.py (Fragmento relevante para CrewAI)

from crewai import Agent, Task, Crew
from crewai_tools import tool
import yaml
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

# ========== CARGAR CONFIGURACIÓN YAML ==========

def cargar_config_yaml(ruta_yaml):
    """Cargar configuración de agentes y tareas desde YAML"""
    with open(ruta_yaml, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

config_agents = cargar_config_yaml('sma_unified/config/agents.yaml')
config_tasks = cargar_config_yaml('sma_unified/config/tasks.yaml')
config_workflows = cargar_config_yaml('sma_unified/config/workflows.yaml')

# ========== FACTORY DE AGENTES ==========

def crear_agente_desde_yaml(nombre_agente, config):
    """
    Factory dinámico que crea agentes CrewAI desde YAML.
    """
    agente_config = config['agentes'][nombre_agente]
    
    agent = Agent(
        role=agente_config['rol'],
        goal=agente_config['objetivo'],
        backstory=agente_config['descripcion_agente'],
        
        # LLM
        llm_model_name=agente_config['modelo_llm'],
        llm_provider="openai",  # O NVIDIA si está soportado
        temperature=agente_config['temperatura'],
        max_tokens=agente_config.get('max_tokens', 2000),
        
        # Herramientas
        tools=agente_config.get('tools', []),
        
        # Verbose
        verbose=True,
        allow_delegation=agente_config.get('allow_delegation', True)
    )
    
    return agent

# ========== FACTORY DE TAREAS ==========

def crear_tarea_desde_yaml(nombre_tarea, config, agente):
    """
    Factory dinámico que crea tareas CrewAI desde YAML.
    """
    tarea_config = config['tareas'][nombre_tarea]
    
    task = Task(
        description=tarea_config['descripcion'],
        agent=agente,
        expected_output=tarea_config['expected_output'],
        
        # Herramientas específicas
        tools=[],  # Instanciar desde config si es necesario
        
        verbose=True
    )
    
    return task

# ========== ORQUESTADOR DE WORKFLOW ==========

class OrquestadorSMA:
    def __init__(self, config_agents, config_tasks, config_workflows):
        self.config_agents = config_agents
        self.config_tasks = config_tasks
        self.config_workflows = config_workflows
        
        # Cache de agentes creados
        self.agentes_cache = {}
        self.crews_cache = {}
    
    def ejecutar_workflow(self, nombre_workflow, inputs_proyecto):
        """
        Ejecutar un workflow completo basado en YAML.
        """
        workflow = self.config_workflows['workflows'][nombre_workflow]
        
        print(f"\n🚀 Iniciando workflow: {workflow['nombre']}")
        
        # Ejecutar etapas secuencialmente
        resultados_etapas = {}
        for nombre_etapa, config_etapa in workflow['etapas'].items():
            
            print(f"\n  📍 Etapa: {config_etapa['nombre']}")
            
            # Crear agentes y tareas de esta etapa
            agentes_etapa = []
            tareas_etapa = []
            
            for nombre_tarea in config_etapa['tareas']:
                nombre_agente = self.config_tasks['tareas'][nombre_tarea]['agente']
                
                # Crear o recuperar agente del cache
                if nombre_agente not in self.agentes_cache:
                    self.agentes_cache[nombre_agente] = crear_agente_desde_yaml(
                        nombre_agente, self.config_agents
                    )
                
                agente = self.agentes_cache[nombre_agente]
                tarea = crear_tarea_desde_yaml(nombre_tarea, self.config_tasks, agente)
                
                agentes_etapa.append(agente)
                tareas_etapa.append(tarea)
            
            # Crear Crew para esta etapa
            crew = Crew(
                agents=agentes_etapa,
                tasks=tareas_etapa,
                verbose=True,
                process=CrewProcess.hierarchical if len(agentes_etapa) > 1 else CrewProcess.sequential
            )
            
            # Ejecutar Crew
            resultado_etapa = crew.kickoff(inputs=inputs_proyecto)
            resultados_etapas[nombre_etapa] = resultado_etapa
            
            # Si hay punto de control, pausar
            if config_etapa.get('punto_control', False):
                print(f"\n  ⛔ Punto de Control: {config_etapa.get('descripcion', '')}")
                print(f"     Esperando confirmación humana...")
                # En producción, esto estaría integrado con WebSocket/Queue
        
        return resultados_etapas

# ========== ENDPOINTS FASTAPI ==========

orquestador = OrquestadorSMA(config_agents, config_tasks, config_workflows)

@app.post("/api/proyectos/{id_proyecto}/ejecutar-workflow")
async def ejecutar_workflow(id_proyecto: str, workflow_name: str = "Pipeline_Auditoria_Legislativa"):
    """Ejecutar un workflow para un proyecto"""
    try:
        # Obtener proyecto de BD
        proyecto = await obtener_proyecto(id_proyecto)
        
        inputs = {
            "id_proyecto": id_proyecto,
            "titulo": proyecto.titulo_proyecto,
            "contenido": proyecto.contenido_texto
        }
        
        resultados = orquestador.ejecutar_workflow(workflow_name, inputs)
        
        # Guardar resultados en BD
        await guardar_resultados_workflow(id_proyecto, resultados)
        
        return {
            "status": "success",
            "resultados": resultados
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agentes")
async def listar_agentes():
    """Listar agentes disponibles"""
    return {
        "agentes": [
            {
                "nombre": name,
                "rol": config['rol'],
                "tipo": config['tipo'],
                "color": config['color'],
                "logo_url": config.get('logo_url')
            }
            for name, config in config_agents['agentes'].items()
        ]
    }

@app.get("/api/workflows")
async def listar_workflows():
    """Listar workflows disponibles"""
    return {
        "workflows": [
            {
                "nombre": name,
                "descripcion": config['descripcion'],
                "tiempo_estimado_minutos": config.get('tiempo_estimado_minutos'),
                "critico": config.get('critico', False),
                "etapas": list(config['etapas'].keys())
            }
            for name, config in config_workflows['workflows'].items()
        ]
    }

<a id="fase-5-infraestructura-neon--cosmos"></a>

🗄️ FASE 5: INFRAESTRUCTURA NEON + COSMOS DB
5.1 Setup PostgreSQL Neon con pgvector
A) Crear Proyecto en Neon
bash
# 1. Ir a https://console.neon.tech
# 2. Crear nuevo proyecto
# 3. Copiar CONNECTION STRING

NEON_CONNECTION_URL="postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"
B) Habilitar Extensión pgvector
sql
-- Conectar a Neon y ejecutar:

-- Crear extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar
SELECT extname FROM pg_extension WHERE extname = 'vector';
-- Debe devolver: vector

-- Crear índices IVFFLAT para búsqueda vectorial rápida
CREATE INDEX ix_articulos_embedding ON public.articulos_constitucion 
  USING ivfflat(embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX ix_normativas_embedding ON public.normativas_vigentes 
  USING ivfflat(embedding vector_cosine_ops) 
  WITH (lists = 200);

CREATE INDEX ix_jurisprudencia_embedding ON public.jurisprudencia_constitucional 
  USING ivfflat(embedding vector_cosine_ops) 
  WITH (lists = 50);
C) Script de Configuración Python
python
# backend/sma_unified/db/neon_setup.py

import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv

load_dotenv()

NEON_URL = os.getenv("NEON_DATABASE_URL")

def conectar_neon():
    """Conectar a PostgreSQL Neon"""
    conn = psycopg2.connect(NEON_URL)
    return conn

def habilitar_pgvector(conn):
    """Habilitar extensión pgvector"""
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        print("✅ pgvector habilitado")

def crear_esquema_sistema(conn):
    """Crear esquema sistema con todas las tablas"""
    with conn.cursor() as cur:
        # Leer y ejecutar script SQL
        with open('migrations/001_schema_sistema.sql', 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        cur.execute(sql_script)
        conn.commit()
        print("✅ Esquema sistema creado")

def crear_esquema_public(conn):
    """Crear esquema public para RAG"""
    with conn.cursor() as cur:
        with open('migrations/002_schema_public_rag.sql', 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        cur.execute(sql_script)
        conn.commit()
        print("✅ Esquema public creado")

def crear_indices_vectoriales(conn):
    """Crear índices IVFFLAT para búsqueda vectorial"""
    with conn.cursor() as cur:
        # Índice artículos constitucionales
        cur.execute("""
            CREATE INDEX IF NOT EXISTS ix_articulos_embedding 
            ON public.articulos_constitucion 
            USING ivfflat(embedding vector_cosine_ops) 
            WITH (lists = 100);
        """)
        
        # Índice normativas
        cur.execute("""
            CREATE INDEX IF NOT EXISTS ix_normativas_embedding 
            ON public.normativas_vigentes 
            USING ivfflat(embedding vector_cosine_ops) 
            WITH (lists = 200);
        """)
        
        # Índice jurisprudencia
        cur.execute("""
            CREATE INDEX IF NOT EXISTS ix_jurisprudencia_embedding 
            ON public.jurisprudencia_constitucional 
            USING ivfflat(embedding vector_cosine_ops) 
            WITH (lists = 50);
        """)
        
        conn.commit()
        print("✅ Índices vectoriales creados")

def setup_neon_completo():
    """Setup completo de Neon"""
    print("\n🚀 Iniciando setup de PostgreSQL Neon...\n")
    
    conn = conectar_neon()
    
    try:
        habilitar_pgvector(conn)
        crear_esquema_sistema(conn)
        crear_esquema_public(conn)
        crear_indices_vectoriales(conn)
        
        print("\n✅ Setup de Neon completado exitosamente")
    
    except Exception as e:
        print(f"\n❌ Error en setup: {e}")
        conn.rollback()
    
    finally:
        conn.close()

if __name__ == "__main__":
    setup_neon_completo()
5.2 Setup Azure Cosmos DB (Alternativa MongoDB)
A) Crear Cuenta Cosmos en Azure
bash
# Instalar CLI de Azure
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login
az login

# Crear grupo de recursos
az group create --name sma-congreso --location eastus

# Crear cuenta Cosmos DB (compatible MongoDB)
az cosmosdb create \
  --name sma-congreso-mongo \
  --resource-group sma-congreso \
  --kind MongoDB \
  --capabilities EnableServerless \
  --default-consistency-level Session
B) Obtener Connection String
bash
# Obtener connection string
az cosmosdb keys list \
  --name sma-congreso-mongo \
  --resource-group sma-congreso \
  --type connection-strings

# Copiar: mongodb+srv://...
C) Configurar en Python
python
# backend/sma_unified/db/cosmos_setup.py

from pymongo import MongoClient
from pymongo.errors import OperationFailure
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")  # mongodb+srv://... de Cosmos
MONGO_DB = os.getenv("MONGO_DB", "sma_congreso")

def conectar_cosmos():
    """Conectar a Azure Cosmos DB"""
    client = MongoClient(MONGO_URI)
    return client

def crear_colecciones(db):
    """Crear colecciones (equivalentes a tablas)"""
    
    colecciones = {
        "agent_messages": {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["id_proyecto", "agente", "mensaje", "timestamp"],
                    "properties": {
                        "id_proyecto": {"bsonType": "string"},
                        "agente": {"bsonType": "string"},
                        "mensaje": {"bsonType": "object"},
                        "timestamp": {"bsonType": "date"},
                        "estado": {"bsonType": "string"}
                    }
                }
            },
            "indexes": [
                [("id_proyecto", 1), ("timestamp", -1)],
                [("agente", 1)],
                [("timestamp", 1)]
            ]
        },
        
        "proceso_snapshots": {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["id_proyecto", "snapshot_data", "created_at"],
                    "properties": {
                        "id_proyecto": {"bsonType": "string"},
                        "snapshot_data": {"bsonType": "object"},
                        "created_at": {"bsonType": "date"}
                    }
                }
            },
            "indexes": [
                [("id_proyecto", 1), ("created_at", -1)]
            ]
        },
        
        "event_log": {
            "validator": None,  # Sin validación estricta
            "indexes": [
                [("proyecto_id", 1), ("event_timestamp", -1)],
                [("event_type", 1)]
            ]
        }
    }
    
    for collection_name, config in colecciones.items():
        try:
            # Crear colección
            if collection_name not in db.list_collection_names():
                if config['validator']:
                    db.create_collection(
                        collection_name,
                        validator=config['validator']
                    )
                else:
                    db.create_collection(collection_name)
                print(f"✅ Colección {collection_name} creada")
            
            # Crear índices
            collection = db[collection_name]
            for index_spec in config['indexes']:
                collection.create_index(index_spec)
            
            print(f"✅ Índices de {collection_name} creados")
        
        except Exception as e:
            print(f"❌ Error en {collection_name}: {e}")

def setup_cosmos_completo():
    """Setup completo de Cosmos DB"""
    print("\n🚀 Iniciando setup de Azure Cosmos DB...\n")
    
    client = conectar_cosmos()
    db = client[MONGO_DB]
    
    try:
        crear_colecciones(db)
        print("\n✅ Setup de Cosmos DB completado exitosamente")
    
    except Exception as e:
        print(f"\n❌ Error en setup: {e}")
    
    finally:
        client.close()

if __name__ == "__main__":
    setup_cosmos_completo()
5.3 Archivo .env Completo
bash
# .env

# ========== POSTGRESQL NEON ==========
NEON_DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/neondb?sslmode=require

# ========== MONGODB / COSMOS DB ==========
MONGO_URI=mongodb+srv://user:password@sma-congreso-mongo.mongo.cosmos.azure.com/?ssl=true
MONGO_DB=sma_congreso

# ========== NVIDIA NIM API ==========
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Modelos
LLM_MODEL_NVIDIA=nvidia/llama-3.1-nemotron-70b-instruct
LLM_MODEL_CONSISTENCIA=nvidia/llama-3.1-nemotron-70b-instruct
NVIDIA_EMBED_MODEL=nvidia/nemotron-3-embed-1b
NVIDIA_EMBED_DIM=2048

# ========== CREWAI ==========
CREWAI_CACHE_DIR=./cache/crew

# ========== FASTAPI ==========
API_HOST=127.0.0.1
API_PORT=8085
API_RELOAD=true

# ========== FRONTEND ==========
VITE_API_URL=http://127.0.0.1:8085
VITE_WS_URL=ws://127.0.0.1:8085/ws

# ========== LOGGING ==========
LOG_LEVEL=INFO
LOG_FILE=./logs/sma.log
5.4 Docker Compose (Opcional pero Recomendado)
yaml
# docker-compose.yml

version: '3.8'

services:
  # Backend FastAPI
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8085:8085"
    environment:
      - NEON_DATABASE_URL=${NEON_DATABASE_URL}
      - MONGO_URI=${MONGO_URI}
      - NVIDIA_API_KEY=${NVIDIA_API_KEY}
    volumes:
      - ./backend:/app/backend
      - ./logs:/app/logs
    command: uvicorn server:app --host 0.0.0.0 --port 8085 --reload
    networks:
      - sma-network
  
  # Frontend React
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8085
      - VITE_WS_URL=ws://localhost:8085/ws
    volumes:
      - ./frontend/src:/app/src
    command: npm run dev
    networks:
      - sma-network
  
  # Redis (para cache y sessions, opcional)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - sma-network

networks:
  sma-network:
    driver: bridge
dockerfile
# Dockerfile.backend

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ /app/backend/
COPY sma_unified/ /app/sma_unified/

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8085"]
dockerfile
# frontend/Dockerfile.frontend

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
5.5 Script de Inicialización Completa
bash
#!/bin/bash
# scripts/setup-infraestructura.sh

set -e

echo "🚀 Iniciando setup completo de infraestructura..."

# ========== POSTGRESQL NEON ==========
echo -e "\n📍 Configurando PostgreSQL Neon..."
python backend/sma_unified/db/neon_setup.py

# ========== COSMOS DB ==========
echo -e "\n📍 Configurando Azure Cosmos DB..."
python backend/sma_unified/db/cosmos_setup.py

# ========== CARGAR CORPUS NORMATIVO ==========
echo -e "\n📍 Cargando corpus constitucional..."
python backend/cargar_normativa.py --pdf datos/cpe_2009.pdf \
  --nombre "Constitución Política del Estado 2009" \
  --tipo Constitucion \
  --jerarquia 1

echo -e "\n📍 Cargando leyes vigentes..."
python backend/cargar_normativa.py --pdf datos/codigo_penal.pdf \
  --nombre "Código Penal Boliviano" \
  --tipo Codigo \
  --jerarquia 2

# ========== INSTALAR DEPENDENCIAS PYTHON ==========
echo -e "\n📍 Instalando dependencias Python..."
pip install -r requirements.txt

# ========== BUILD FRONTEND ==========
echo -e "\n📍 Instalando dependencias Frontend..."
cd frontend && npm install && cd ..

echo -e "\n✅ Setup de infraestructura completado exitosamente"
echo -e "\n📝 Próximos pasos:"
echo "   1. Iniciar backend: uvicorn server:app --reload"
echo "   2. Iniciar frontend: cd frontend && npm run dev"
echo "   3. Acceder a: http://localhost:5173"
📅 CRONOGRAMA Y ENTREGABLES

<a id="cronograma-y-entregables"></a>

Fase 1: Limpieza de BD (1-2 semanas)
Semana	Tarea	Entregable
1	Script de eliminación de tablas redundantes	migrations/001_eliminar_redundancias.sql
1	Creación de nuevo esquema unificado sistema	migrations/002_schema_sistema.sql
1-2	Migración de datos históricos	Backup + datos migrados en sistema.*
2	Testing de integridad de datos	Report de validación
Fase 2: Frontend Rediseñado (2-3 semanas)
Semana	Tarea	Entregable
1	Estructuración de carpetas React + componentes base	frontend/src/components/
1-2	Componentes de multi-documento y tabs	TabNavigation.jsx, DocumentUpload.jsx
2	Componentes de agentes con avatares	AgentCard.jsx, AgentAvatar.jsx
2-3	Timeline/historial con retroceso	ProcessSteps.jsx, StepHistory.jsx
3	Integración con API y WebSocket	Conexión real a backend
3	Temas CSS y variables	variables.css, tailwind.config.js
Fase 3: Agentes Avanzados (2 semanas)
Semana	Tarea	Entregable
1	Implement Concentrador + Secretario	agents/concentrador.py, agents/secretario.py
1	Implement Bicameral + Veto	agents/bicameral.py, agents/veto_promulgacion.py
2	Implement Publicación + Constitución Fondo	agents/publicacion.py, agents/constitucion_fondo.py
2	Testing de agentes independientes	Test suite creada
Fase 4: Configuración YAML CrewAI (1-2 semanas)
Semana	Tarea	Entregable
1	Creación de agents.yaml con 8 agentes	config/agents.yaml
1	Creación de tasks.yaml con 12 tareas	config/tasks.yaml
1-2	Creación de workflows.yaml con 2 flujos	config/workflows.yaml
2	Integración CrewAI en server.py	Orquestador funcional
Fase 5: Infraestructura Neon + Cosmos (1 semana)
Semana	Tarea	Entregable
1	Setup Neon + pgvector	Scripts de configuración
1	Setup Cosmos DB	Scripts de configuración
1	Docker Compose + containerización	docker-compose.yml + Dockerfiles
1	Scripts de inicialización	setup-infraestructura.sh
Timeline Total
SEMANA 1    |████████████| Limpieza BD + Inicio Frontend + 2 Agentes
SEMANA 2    |████████████| Frontend tabs + 2 Agentes más + YAML setup
SEMANA 3    |████████████| Frontend completo + Agentes finales + Infra
SEMANA 4    |████████████| Testing, documentación, ajustes finales

TOTAL: 4 semanas
📚 DOCUMENTACIÓN GENERADA

Los siguientes documentos serán generados durante la implementación:

ARQUITECTURA_v2.md - Diagrama actualizado de componentes y flujos
AGENTES_REFERENCIA.md - Especificación detallada de cada agente
CREWAI_GUIA_OPERATIVA.md - Cómo agregar/modificar agentes
BD_MIGRACION.md - Paso a paso de migración de datos
FRONTEND_COMPONENTES.md - Catálogo de componentes React
INFRAESTRUCTURA_SETUP.md - Guía de configuración Neon + Cosmos
API_ENDPOINTS.md - Documentación de todos los endpoints REST
✅ CHECKLIST DE VALIDACIÓN

Antes de declarar completada cada fase:

Fase 1 (BD)
 Tablas redundantes eliminadas exitosamente
 Datos migrados sin pérdida
 Índices creados y funcionan
 Backups realizados
Fase 2 (Frontend)
 Tabs de múltiples documentos funcionales
 Componentes de agentes con avatares renderizando
 Timeline con retroceso navegable
 Conexión WebSocket establecida
 Responsive en mobile
Fase 3 (Agentes)
 6 agentes nuevos implementados
 Cada agente pasa tests unitarios
 Salidas en formato JSON validado
Fase 4 (YAML)
 agents.yaml parsea correctamente
 tasks.yaml referencia agentes válidos
 workflows.yaml ejecuta sin errores
 Orquestador CrewAI funciona
Fase 5 (Infra)
 Neon conecta y pgvector funciona
 Cosmos DB colecciones creadas
 Docker compose levanta servicios
 Setup script automatizado completo
🎯 CONCLUSION

Este plan proporciona una hoja de ruta clara y ejecutable para transformar el SMA Congreso en un sistema robusto, escalable y visualmente intuitivo.

Los 6 nuevos agentes añaden capacidades de síntesis, debate, coordinación bicameral y decisión ejecutiva que elevan el sistema de auditoría a una plataforma de gestión legislativa completa.

La configuración YAML + CrewAI permite iteración rápida sin tocar código fuente, mientras que Neon + Cosmos DB garantizan disponibilidad y escalabilidad.

¡Listo para implementar! 🚀