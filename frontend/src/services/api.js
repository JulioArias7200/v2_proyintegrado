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

export const api = {
  // Salud y KPIs
  getHealth: () => request('/health'),
  getDashboardStats: () => request('/dashboard/stats'),

  // Documentos y Pipeline
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload', {
      method: 'POST',
      body: formData,
    });
  },

  runPhase1: (data) =>
    request('/pipeline/phase1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  runAgentComision: (data) =>
    request('/pipeline/agent_comision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  runAgentConstitucional: (data) =>
    request('/pipeline/agent_constitucional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  runAgentConsistencia: (data) =>
    request('/pipeline/agent_consistencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  emitPdf: (data) =>
    request('/pipeline/emit_pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  runAgentNotificador: (data) =>
    request('/pipeline/agent_notificador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Expedientes y Auditoría
  getExpedientes: (limit = 50) => request(`/expedientes?limit=${limit}`),
  getExpedienteDetalle: (id) => request(`/expedientes/${id}`),

  // Comisiones y Miembros
  getComisiones: () => request('/comisiones'),
  getMiembrosComision: (id_comision) => request(`/comisiones/${id_comision}/miembros`),
  addMiembroComision: (id_comision, data) =>
    request(`/comisiones/${id_comision}/miembros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  removeMiembroComision: (id_miembro) =>
    request(`/comisiones/miembros/${id_miembro}`, { method: 'DELETE' }),


  // Consistencia Normativa
  getNormativa: (limit = 30) => request(`/normativa?limit=${limit}`),
  searchNormativa: (query, documento = null, umbral = 0.5, top_k = 8) =>
    request('/normativa/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documento, umbral, top_k }),
    }),

  // Atención Ciudadana y Correspondencia
  getCiudadana: (limit = 50) => request(`/ciudadana?limit=${limit}`),

  // Bus de Mensajes Inter-Agente (MongoDB)
  getMessages: (limit = 50, sesion_id = null) => {
    const q = sesion_id ? `?limit=${limit}&sesion_id=${sesion_id}` : `?limit=${limit}`;
    return request(`/messages${q}`);
  },
};
