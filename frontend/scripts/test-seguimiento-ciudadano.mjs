import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apiSoloLectura } from '../src/services/apiSoloLectura.js';

let lecturas = 0, escrituras = 0;
const api = apiSoloLectura({
  getCasosCompartidos: async () => { lecturas++; return { data: [] }; },
  guardarCasoCompartido: async () => { escrituras++; },
  runAgentSecretario: async () => { escrituras++; },
  confirmarAprobacionBicameral: async () => { escrituras++; },
});
await api.getCasosCompartidos();
for (const nombre of ['guardarCasoCompartido', 'runAgentSecretario', 'confirmarAprobacionBicameral']) {
  await assert.rejects(api[nombre](), /Vista de seguimiento/);
}
assert.equal(lecturas, 1);
assert.equal(escrituras, 0);

const source = readFileSync(new URL('../src/pages/MesaPartes.jsx', import.meta.url), 'utf8');
for (const name of ['handleIniciarFase1', 'handleConcentrador', 'handleResolverBicameral',
  'handlePublicacion', 'handleConfirmarAprobacionBicameral', 'handleRegistrarDecisionEjecutiva']) {
  const start = source.indexOf(`  const ${name} = async `);
  const end = source.indexOf('\n  };', start) + 5;
  const fn = Function('readOnly', `${source.slice(start, end)}; return ${name};`)(true);
  // Cualquier dependencia de ejecución sería un ReferenceError si el guard no detuviera la acción.
  await fn();
}
const hook = readFileSync(new URL('../src/hooks/useCasosCompartidos.js', import.meta.url), 'utf8');
assert.match(hook, /if \(readOnly \|\| !ready/);
assert.match(hook, /readOnly \? 3000 : 15000/);
console.log('Seguimiento ciudadano: consultas permitidas, acciones bloqueadas y actualización automática OK');

const formulario = readFileSync(new URL('../src/components/PresentacionCiudadana.jsx', import.meta.url), 'utf8');
const inicio = formulario.indexOf('  const enviar = async e => {');
const fin = formulario.indexOf('\n  };', inicio) + 5;
let abierto, evento;
const nada = () => {};
const entorno = {
  api: { presentarCasoCiudadano: async () => ({ data: { id: 'caso-nuevo' } }) },
  titulo: 'Iniciativa', texto: 'Texto ciudadano', tipo: 'iniciativa', destino: 'Senadores', archivo: '',
  setOcupado: nada, setError: nada, setMensaje: nada, setCasos: nada,
  setTitulo: nada, setTexto: nada, setArchivo: nada,
  onVerCaso: id => { abierto = id; },
  window: { dispatchEvent: e => { evento = e; } },
  CustomEvent: class { constructor(nombre, opciones) { this.type = nombre; this.detail = opciones.detail; } },
};
await Function(...Object.keys(entorno), `${formulario.slice(inicio, fin)}; return enviar;`)(...Object.values(entorno))({ preventDefault: nada });
assert.equal(abierto, 'caso-nuevo');
assert.equal(evento.type, 'caso-ciudadano-presentado');
assert.equal(evento.detail.casoId, 'caso-nuevo');
console.log('Presentar iniciativa abre automáticamente su progreso: OK');
