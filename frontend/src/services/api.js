/**
 * Cliente de API REST para SMA Congreso (FastAPI Backend)
 */

const API_BASE_URL = 'http://127.0.0.1:8085/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorDetail = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch (e) {}
      throw new Error(errorDetail);
    }

    return await response.json();
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

// CHAT CONVERSACIONAL POR AGENTE — retornan { success: false, error } en vez de lanzar
export async function sendChatMessage({ sesionId = null, agente, mensaje, datosContexto = null, confirmar = false }) {
  try {
    return await request('/chat/mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sesion_id: sesionId,
        agente,
        mensaje,
        datos_contexto: datosContexto,
        confirmar,
      }),
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendChatAudio({ audioBlob, agente, sesionId = null, datosContexto = null }) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio_chat.wav');
    formData.append('agente', agente);
    if (sesionId) formData.append('sesion_id', sesionId);
    if (datosContexto) formData.append('datos_contexto', JSON.stringify(datosContexto));
    return await request('/chat/audio', { method: 'POST', body: formData });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getChatHistory(sesionId) {
  try {
    return await request(`/chat/historial/${sesionId}`);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function confirmarChatAccion(sesionId) {
  try {
    return await request('/chat/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesion_id: sesionId }),
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export const api = {
  getHealth: () => request('/health'),
  getDashboardStats: () => request('/dashboard/stats'),

  login: (correo_electronico, contrasena) =>
    request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo_electronico, contrasena }),
    }),

  register: (data) =>
    request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  confirmarAprobacionBicameral: (data) =>
    request('/pipeline/confirmar_aprobacion_bicameral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload', { method: 'POST', body: formData });
  },

  runPhase1: (data) =>
    request('/pipeline/phase1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentComision: (data) =>
    request('/pipeline/agent_comision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentConstitucional: (data) =>
    request('/pipeline/agent_constitucional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentConsistencia: (data) =>
    request('/pipeline/agent_consistencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  emitPdf: (data) =>
    request('/pipeline/emit_pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentNotificador: (data) =>
    request('/pipeline/agent_notificador', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  // AGENTES CREWAI YAML — FLUJO LEGISLATIVO EXTENDIDO
  runAgentConstitucionFondo: (data) =>
    request('/pipeline/agent_constitucion_fondo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentConcentrador: (data) =>
    request('/pipeline/agent_concentrador', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentSecretario: (data) =>
    request('/pipeline/agent_secretario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentBicameral: (data) =>
    request('/pipeline/agent_bicameral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentVetoPromulgacion: (data) =>
    request('/pipeline/agent_veto_promulgacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  runAgentPublicacion: (data) =>
    request('/pipeline/agent_publicacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  getTextoConsolidado: (idProyecto) => request(`/proyectos/${idProyecto}/texto-consolidado`),
  generarPdfGaceta: (idProyecto) => request(`/proyectos/${idProyecto}/generar-pdf-gaceta`, { method: 'POST' }),

  runPipelineCompleto: (data) =>
    request('/pipeline/pipeline_completo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

  getExpedientes: (limit = 50) => request(`/expedientes?limit=${limit}`),
  getExpedienteDetalle: (id) => request(`/expedientes/${id}`),
  getComisiones: () => request('/comisiones'),
  getMiembrosComision: (id_comision) => request(`/comisiones/${id_comision}/miembros`),
  addMiembroComision: (id_comision, data) =>
    request(`/comisiones/${id_comision}/miembros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  removeMiembroComision: (id_miembro) =>
    request(`/comisiones/miembros/${id_miembro}`, { method: 'DELETE' }),
  getNormativa: (limit = 30) => request(`/normativa?limit=${limit}`),
  searchNormativa: (query, documento = null, umbral = 0.5, top_k = 8) =>
    request('/normativa/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, documento, umbral, top_k }) }),
  getCiudadana: (limit = 50) => request(`/ciudadana?limit=${limit}`),

  // AGENTE MULTI-FACETA CIUDADANO (routing automático de prompts)
  getAgentesCiudadanos: (soloActivos = false) =>
    request(`/ciudadana/agentes?solo_activos=${soloActivos}`),
  crearAgenteCiudadano: (data) =>
    request('/ciudadana/agentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  actualizarAgenteCiudadano: (id, data) =>
    request(`/ciudadana/agentes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  eliminarAgenteCiudadano: (id) =>
    request(`/ciudadana/agentes/${id}`, { method: 'DELETE' }),
  chatCiudadano: ({ mensaje, sesionId = null, agenteId = null, casoTexto = null, casoNombre = null, usarEspecialista = false, dictamen = null }) =>
    request('/ciudadana/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje,
        sesion_id: sesionId,
        agente_id: agenteId,
        caso_texto: casoTexto,
        caso_nombre: casoNombre,
        usar_especialista: usarEspecialista,
        dictamen,
      }),
    }),
  dictamenEspecialista: ({ casoTexto, casoNombre = null, materia = null, sesionId = null }) =>
    request('/ciudadana/especialista/dictamen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caso_texto: casoTexto, caso_nombre: casoNombre, materia, sesion_id: sesionId }),
    }),
  getMessages: (limit = 50, sesion_id = null) => {
    const q = sesion_id ? `?limit=${limit}&sesion_id=${sesion_id}` : `?limit=${limit}`;
    return request(`/messages${q}`);
  },

  // MÓDULO DE VOZ MULTIMODAL (STT / TTS / COMANDOS)
  vozEstado: () => request('/voz/estado'),
  vozLeer: (data) =>
    request('/voz/leer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  vozComando: (data) =>
    request('/voz/comando', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  vozComandosAgente: (agente) => request(`/voz/comandos/${agente}`),

  // MÉTODOS GENÉRICOS DE ACCESO A API (CON NORMALIZACIÓN DE PREFIJO /api)
  post: (endpoint, data) => {
    const cleanEndpoint = endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : endpoint.startsWith('/api')
      ? endpoint.slice(4)
      : endpoint;
    return request(cleanEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  get: (endpoint) => {
    const cleanEndpoint = endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : endpoint.startsWith('/api')
      ? endpoint.slice(4)
      : endpoint;
    return request(cleanEndpoint);
  },

  // MENSAJE OFICIAL AL PRESIDENTE DEL SENADO (CREWAI + TOKEN GOOGLE)
  redactarMensajeSenado: (data) =>
    request('/pipeline/mensaje_presidente_senado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, solo_redactar: true }),
    }),

  enviarMensajeSenado: (data) =>
    request('/pipeline/mensaje_presidente_senado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, solo_redactar: false }),
    }),

  // CHAT CONVERSACIONAL POR AGENTE
  sendChatMessage,
  sendChatAudio,
  getChatHistory,
  confirmarChatAccion,
};