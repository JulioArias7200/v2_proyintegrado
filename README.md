# 🏛️ SMA Congreso — Sistema Multi-Agente de Auditado y Registro Legislativo

Sistema Multi-Agente inteligente diseñado para la **recepción, clasificación, auditoría constitucional y verificación de consistencia normativa** de proyectos de ley y documentos oficiales del Congreso de Bolivia.

El sistema combina modelos de lenguaje de última generación (**NVIDIA NIM API**), búsqueda vectorial semántica (**pgvector en PostgreSQL Neon**), un bus de mensajería asíncrono (**MongoDB Atlas**), y una interfaz moderna en **React + Vite**.

---

## 📐 Arquitectura del Sistema

El pipeline procesa cada expediente en dos fases secuenciales con un **punto de control humano de confirmación (Pausable/Confirmable)**:

```mermaid
flowchart TD
    A[📄 Entrada: PDF / Documento de Ley] --> B[Fase 1: Agente Distribuidor]
    B --> C{🛑 Punto de Control Humano\nConfirmar o Ajustar Categoría}
    C -->|Aprobado| D[Fase 2: Ejecución de Agentes de Nivel 2]
    
    D -->|Proyectos de Ley| E[Agente Registro Legislativo]
    D -->|Peticiones / Reclamos| F[Agente Atención Ciudadana]
    D -->|Oficios / Cartas| G[Agente Gestión Correspondencia]

    E --> H[Agente Comisión Legislativa\nAsignación automática de comisión]
    E --> I[Agente Verificador Constitucional\nCotejo contra CPE 2009 con LLM]
    E --> J[Agente Consistencia Normativa\nEmbedding + pgvector + Parallel LLM]

    H --> K[(PostgreSQL Neon\nRegistro Relacional + pgvector)]
    I --> K
    J --> K
    
    H --> L[(MongoDB Atlas\nBus de Eventos SMA + Snapshots)]
    I --> L
    J --> L
```

---

## 🤖 Catálogo de Agentes Inteligentes

| Agente | Nivel | Función Principal | Tecnología / Modelo |
|---|---|---|---|
| **`Agente_Distribuidor`** | Nivel 1 | Clasifica el documento en: Registro Legislativo, Atención Ciudadana o Correspondencia. | LLM NVIDIA NIM |
| **`Agente_Comision_Legislativa`** | Nivel 2 | Determina la comisión parlamentaria competente (Justicia Plural, Economía, Derechos Humanos, etc.). | LLM NVIDIA NIM + Neon PostgreSQL |
| **`Agente_Verificador_Constitucional`** | Nivel 2 | Audita el proyecto contra la Constitución Política del Estado (CPE 2009), clasificando hallazgos en `A_FAVOR`, `EN_CONTRA` o `NEUTRAL`. | Embedding NVIDIA + Postgres Vector + LLM (Temp 0.0) |
| **`Agente_Consistencia_Normativa`** | Nivel 2 | Coteja el proyecto contra el corpus de leyes vigentes (Códigos, Leyes Sectoriales, Decretos) para detectar derogaciones tácitas y conflictos de especialidad. | Búsqueda Semántica pgvector + LLM Multihilo Paralelo |
| **`Agente_Atencion_Ciudadana`** | Nivel 2 | Clasifica solicitudes y peticiones de la población asignando prioridad y área responsable. | LLM NIM |
| **`Agente_Gestion_Correspondencia`** | Nivel 2 | Procesa notas oficiales, cartas e informes identificando remitente, urgencia y unidad de destino. | LLM NIM |

---

## ⚡ Rendimiento y Optimizaciones Clave

- **Auditoría Paralela Multihilo (`ThreadPoolExecutor`)**: La verificación normativa y constitucional clasifica los candidatos candidateados en paralelo (5 hilos concurrentes), reduciendo el tiempo de análisis de **4 minutos a 15 segundos (aceleración 10x)**.
- **Deduplicación Estricta de Normas**: Filtra artículos constitucionales o normativos por identificador único para prevenir duplicaciones en el reporte final.
- **Auto-Reparación de JSON Truncados (`_reparar_json_truncado`)**: Algoritmo heurístico que auto-cierra cadenas y llaves recortadas por la ventana de tokens, evitando caídas en fallbacks.
- **Análisis Objetivo Fáctico (Temperatura 0.0)**: Evaluaciones constitucionales estrictamente fundamentadas en el texto expreso normativo sin alucinaciones.

---

## 💾 Persistencia Dual

1. **PostgreSQL (Neon DB + Extension `pgvector`)**:
   - `public.articulos_constitucion`: Corpus constitucional vectorizado.
   - `normativa.articulos`: Corpus de leyes y decretos vigentes con embeddings HNSW de 2048 dimensiones.
   - `sistema.proyecto_ley`, `sistema.observaciones_constitucionales`, `normativa.analisis_consistencia`.
2. **MongoDB Atlas**:
   - Bus de mensajes y estados del SMA (`agent_messages`).
   - Expedientes consolidados y trazabilidad de eventos.

---

## 📁 Estructura del Proyecto

```
.
├── server.py                   # API Backend REST principal (FastAPI + Uvicorn)
├── cargar_normativa.py        # CLI para ingesta e indización de PDFs de leyes en pgvector
├── upload_server.py           # Servidor independiente de carga y procesamiento de documentos
├── test_sma.py                # Script de prueba de conexiones (Mongo, Neon, NVIDIA NIM)
├── requirements.txt           # Dependencias de Python
├── .env.example               # Plantilla de variables de entorno
├── scratch/                   # Scripts de prueba y depuración
├── frontend/                  # Aplicación Frontend React 19 + Vite
│   ├── src/
│   │   ├── components/        # Componentes UI de la interfaz
│   │   ├── main.jsx           # Punto de entrada React
│   │   └── index.css          # Estilos globales y tokens
│   └── package.json
└── sma_unified/               # Paquete principal del SMA
    ├── agents/
    │   ├── pipeline.py                # Orquestador del pipeline en 2 fases
    │   ├── llm_client.py              # Cliente resiliente de NVIDIA NIM + Parser JSON
    │   ├── verificador_constitucional.py # Agente de auditoría CPE 2009
    │   ├── consistencia_normativa.py  # Agente de consistencia del ordenamiento vigente
    │   ├── tools_constitucional.py    # Herramientas LangChain de búsqueda y cotejo
    │   ├── distribuidor.py            # Agente clasificador Nivel 1
    │   └── comision.py                # Agente de asignación de comisiones
    ├── db/
    │   ├── neon_postgres.py           # Consultas relacionales y pgvector en Neon
    │   └── mongo_atlas.py             # Bus de eventos SMA y Snapshots en MongoDB
    └── config.py                      # Configuración central (.env, settings)
```

---

## 🛠️ Requisitos Previos

- **Python 3.11+**
- **Node.js 18+** & npm
- Cuenta y API Key de **NVIDIA NIM**
- Base de datos **PostgreSQL Neon** (con extensión `vector` habilitada)
- Clúster en **MongoDB Atlas**

---

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio y configurar el entorno Python

```bash
# Clonar el proyecto
git clone <URL_DEL_REPOSISTORIO>
cd proy_integrado

# Crear y activar entorno virtual
python -m venv venv

# En Windows:
.\venv\Scripts\activate

# En Linux/macOS:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y completa tus credenciales:

```bash
cp .env.example .env
```

Variables principales en `.env`:

```ini
# LLM & Embeddings (NVIDIA NIM)
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL_NVIDIA=nvidia/llama-3.1-nemotron-70b-instruct
LLM_MODEL_CONSISTENCIA=nvidia/llama-3.1-nemotron-70b-instruct
NVIDIA_EMBED_MODEL=nvidia/nemotron-3-embed-1b
NVIDIA_EMBED_DIM=2048

# MongoDB Atlas
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/sma_congreso
MONGO_DB=sma_congreso

# PostgreSQL Neon (con pgvector)
NEON_DATABASE_URL=postgresql://usuario:password@ep-host.neon.tech/neondb?sslmode=require
```

### 3. Instalar dependencias del Frontend

```bash
cd frontend
npm install
cd ..
```

---

## 📥 Ingesta del Corpus Normativo (Requisito para Consistencia Normativa)

Para poblar la base de datos de leyes vigentes contra las cuales se auditarán los proyectos:

```bash
# Cargar la Constitución Política del Estado
python cargar_normativa.py --pdf datos/cpe.pdf --nombre "Constitución Política del Estado" --tipo Constitucion --jerarquia 1

# Cargar un Código o Ley Sectorial
python cargar_normativa.py --pdf datos/codigo_penal.pdf --nombre "Código Penal Boliviano" --tipo Codigo --jerarquia 2
```

---

## 🖥️ Ejecución de la Aplicación

### 1. Verificar conexiones de servicios

```bash
python test_sma.py
```

### 2. Iniciar el Backend (FastAPI)

```bash
.\venv\Scripts\uvicorn.exe server:app --host 127.0.0.1 --port 8085 --reload
```
* API activa en: `http://127.0.0.1:8085`
* Documentación Swagger: `http://127.0.0.1:8085/docs`

### 3. Iniciar el Frontend (React + Vite)

En otra terminal:

```bash
cd frontend
npm run dev
```
* Aplicación web lista en: `http://localhost:5173`

---

## 🔄 Flujo de Auditoría Legislativa

1. **Carga del Expediente:** Se sube el archivo (PDF/DOCX/Texto) desde la plataforma.
2. **Fase 1 (Clasificación):** El `Agente_Distribuidor` clasifica el documento y propone la ruta.
3. **Punto de Control Humano (🛑 Pause/Confirm):** El operador aprueba o corrige la clasificación sugerida.
4. **Fase 2 (Auditoría Paralela Nivel 2):**
   - Asignación de Comisión Parlamentaria.
   - Auditoría Constitucional contra la CPE 2009.
   - Análisis de Consistencia contra el corpus legal vigente.
5. **Emisión de Dictamen:** Generación automatizada de reportes con contradicciones, artículos respaldados, derogas tácitas y nivel de riesgo normativo.

---

## 📄 Licencia

Desarrollado para el análisis y auditoría legislativa del Congreso. Reservados todos los derechos.