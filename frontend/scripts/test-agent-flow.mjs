import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../src/components/HorizontalAgentFlow.jsx', import.meta.url), 'utf8');
const array = flow.match(/export const AGENTS_DEFINITION = (\[[\s\S]*?\n\]);/)[1]
  .replace(/workflowIcon: \w+/g, 'workflowIcon: null');
const agents = Function(`return ${array}`)();
const completed = step => agents.filter(a => step >= a.doneAtStep).map(a => a.id);
assert.deepEqual(completed(6), ['distribuidor', 'comision', 'constitucional', 'consistencia']);
assert.deepEqual(completed(11), [...completed(6), 'concentrador']);
for (const [step, id] of [[12, 'secretario'], [13, 'bicameral'], [14, 'veto_promulgacion'], [15, 'publicacion']]) {
  assert.equal(completed(step).at(-1), id);
  assert.equal(completed(step).length, completed(step - 1).length + 1);
}

const source = readFileSync(new URL('../src/pages/MesaPartes.jsx', import.meta.url), 'utf8');
function handler(name, context) {
  const start = source.indexOf(`  const ${name} = async `);
  const end = source.indexOf('\n  };', start) + 5;
  const fn = source.slice(start, end).trim();
  context = { readOnly: false, ...context };
  return Function(...Object.keys(context), `${fn}; return ${name};`)(...Object.values(context));
}
for (const scenario of ['missing', 'pending', 'failure', 'success']) {
  const updates = [];
  let calls = 0;
  await handler('handlePublicacion', {
    isProcessing: false, pipelineStep: scenario === 'missing' ? 6 : 14,
    vetoPromulgacionData: scenario === 'missing' ? null : { evaluacion_veto: { decision: scenario === 'pending' ? 'PENDIENTE_DECISION_HUMANA' : 'PROMULGAR' } },
    fase1Data: { id_proyecto: 1 }, buildProyectoInfo: () => ({ id: 1 }), appendLog: () => {},
    updateActiveSession: value => updates.push(value),
    api: { runAgentPublicacion: async () => {
      calls++;
      if (scenario === 'failure') throw new Error('API no disponible');
      return { success: true, data: { publicacion_oficial: { numero_ley: 'prueba' } } };
    } },
  })();
  if (scenario === 'missing' || scenario === 'pending') assert.equal(calls, 0);
  if (scenario !== 'success') assert.ok(updates.every(u => u.pipelineStep !== 15));
  if (scenario === 'failure') assert.equal(updates.at(-1).errorMessage, 'API no disponible');
  if (scenario === 'success') assert.equal(updates.at(-1).pipelineStep, 15);
}
console.log('Flujo de nueve agentes y bloqueo de publicación: OK');

for (const approved of [false, true]) {
  const updates = [];
  let calls = 0;
  await handler('handleVetoPromulgacion', {
    isProcessing: false, fase1Data: { id_proyecto: 1 },
    bicameralData: { ciclo_bicameral: { aprobacion_humana: approved ? { accion: 'APROBAR' } : null } },
    concentradorData: {}, buildProyectoInfo: () => ({ id: 1 }), appendLog: () => {},
    updateActiveSession: value => updates.push(value),
    api: { runAgentVetoPromulgacion: async () => {
      calls++;
      return { success: true, data: { evaluacion_veto: { decision: 'PENDIENTE_DECISION_HUMANA' } } };
    } },
  })();
  assert.equal(calls, approved ? 1 : 0);
  if (approved) assert.equal(updates.at(-1).pipelineStep, 14);
}
assert.ok(source.includes('onDecision={handleResolverBicameral}'));
assert.ok(source.includes('onRegistrar={handleRegistrarDecisionEjecutiva}'));
assert.ok(source.includes('texto_documento: documentText'));
console.log('Revision humana -> Veto -> decision documentada -> Publicacion: OK');

for (const accion of ['APROBAR', 'MANDAR_A_REVISION']) {
  let envios = 0;
  await handler('handleResolverBicameral', {
    isProcessing: false, fase1Data: { id_proyecto: 1 },
    bicameralData: { ciclo_bicameral: { id_revision: 7, version_revision: 'v' } },
    confirmacionBicameralData: null,
    updateActiveSession: () => {}, appendLog: () => {},
    handleConfirmarAprobacionBicameral: async () => { envios++; },
    api: {
      decidirBicameral: async () => ({ success: true }),
      getRevisionBicameral: async () => ({ success: true, data: { ciclo_bicameral: { aprobacion_humana: { accion } } } }),
    },
  })(accion, 'motivo', true);
  assert.equal(envios, accion === 'APROBAR' ? 1 : 0);
}
console.log('Aprobacion bicameral llama al envio; devolucion no envia: OK');
