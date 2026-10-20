import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const require = createRequire(import.meta.url);
const archivo = new URL('../src/components/AuditResultsNav.jsx', import.meta.url);
let { code } = await transformWithOxc(await readFile(archivo, 'utf8'), fileURLToPath(archivo));
for (const nombre of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
  const destino = JSON.stringify(pathToFileURL(require.resolve(nombre)).href);
  code = code.replaceAll('"' + nombre + '"', destino).replaceAll("'" + nombre + "'", destino);
}
const { default: Nav } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const render = props => renderToStaticMarkup(React.createElement(Nav, props));
const disponible = render({ constitucional: { confianza: 90 }, consistencia: { hallazgos: [] } });
assert.equal((disponible.match(/<button/g) || []).length, 2);
assert.doesNotMatch(disponible, /disabled/);
const ausente = render({});
assert.equal((ausente.match(/disabled/g) || []).length, 2);
const pendiente = render({ selected: 'constitucional', constitucional: {
  estado: 'PENDIENTE_REVISION', pendientes_revision: [{ articulo_constitucional: '9', motivo: 'JSON incompleto' }],
} });
assert.match(pendiente, /JSON incompleto/);
assert.match(pendiente, /Artículo constitucional 9/);

const source = await readFile(new URL('../src/pages/MesaPartes.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const handleSelectAgent = ');
const end = source.indexOf('\n  };', start) + 5;
const estados = [], paneles = [];
const contexto = {
  readOnly: true, inspectedAgentId: 'consistencia',
  getAgentResultData: () => ({ hallazgos: [] }),
  setDetailPanelAgent: p => paneles.push(p), updateActiveSession: p => estados.push(p),
};
const seleccionar = Function(...Object.keys(contexto), `${source.slice(start, end)}; return handleSelectAgent;`)(...Object.values(contexto));
seleccionar({ id: 'consistencia' });
seleccionar({ id: 'constitucional' });
assert.deepEqual(estados, [{ inspectedAgentId: 'consistencia' }, { inspectedAgentId: 'constitucional' }]);
assert.deepEqual(paneles, [null, null]);
console.log('Resultados de auditorías: accesos disponibles, pendientes visibles y navegación sin panel superpuesto OK');

const statusFile = new URL('../src/components/CaseProcessingStatus.jsx', import.meta.url);
let { code: statusCode } = await transformWithOxc(await readFile(statusFile, 'utf8'), fileURLToPath(statusFile));
for (const nombre of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
  const destino = JSON.stringify(pathToFileURL(require.resolve(nombre)).href);
  statusCode = statusCode.replaceAll('"' + nombre + '"', destino).replaceAll("'" + nombre + "'", destino);
}
const { default: Status } = await import('data:text/javascript;base64,' + Buffer.from(statusCode).toString('base64'));
const renderStatus = caso => renderToStaticMarkup(React.createElement(Status, { caso }));
const base = { tipoPresentacion: 'iniciativa', pipelineStep: 11 };
assert.match(renderStatus(base), /Reanudar auditorías/);
const activo = renderStatus({ ...base, _sharedProcessing: true, agentesEnProceso: ['constitucional', 'consistencia'] });
assert.equal((activo.match(/En proceso/g) || []).length, 2);
assert.doesNotMatch(activo, /<button/);
const terminado = renderStatus({ ...base, dictamenData: { estado: 'COMPLETADO' }, consistenciaData: { estado: 'COMPLETADO' } });
assert.equal((terminado.match(/Resultado guardado/g) || []).length, 2);
assert.doesNotMatch(terminado, /<button/);
assert.match(renderStatus({ ...base, consistenciaData: { estado: 'PENDIENTE_REVISION' } }), /cotejos pendientes/);
assert.doesNotMatch(renderStatus({ ...base, pipelineStep: 12 }), /<button/);
console.log('Estado de ejecución: ambas auditorías activas, resultados guardados y recuperación de casos detenidos OK');
