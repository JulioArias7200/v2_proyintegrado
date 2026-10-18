// Comprueba las pantallas con datos de prueba; no consulta la API.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const require = createRequire(import.meta.url);
const archivo = new URL('../src/components/RevisionLegislativa.jsx', import.meta.url);
const fuente = (await readFile(archivo, 'utf8')).replace("import './RevisionLegislativa.css';", '');
let { code } = await transformWithOxc(fuente, fileURLToPath(archivo));
for (const nombre of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
  const destino = JSON.stringify(pathToFileURL(require.resolve(nombre)).href);
  code = code.replaceAll('"' + nombre + '"', destino).replaceAll("'" + nombre + "'", destino);
}
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const render = (componente, props) => renderToStaticMarkup(React.createElement(componente, props));
const usuario = { rol: 'Senador' };
const ciclo = {
  id_revision: 1, puede_aprobar: true, control_aprobacion: { roles_permitidos: ['Senador', 'Diputado'] },
  acta_secretario: {}, acta_revisora: {}, expediente_consolidado: {},
  verificaciones_normativas: [{ requisito: 'Acta Revisora', estado: 'CUMPLE', evidencia: 'ACTA-25', fundamento: 'CPE art. 163' }],
};
const botones = texto => [...texto.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map(m => ({ atributos: m[1], texto: m[2] }));
const boton = (html, nombre) => botones(html).find(b => b.texto === nombre);

const pendiente = render(mod.RevisionBicameralPanel, { ciclo, usuario });
assert.match(pendiente, /ACTA-25/);
assert.match(pendiente, /No se recibieron informes de factibilidad/);
assert.match(boton(pendiente, 'Aprobar').atributos, /disabled/);
assert.match(boton(pendiente, 'Mandar a revisión').atributos, /disabled/);
assert.match(boton(pendiente, 'Continuar: Veto y Promulgación').atributos, /disabled/);

const ciudadano = render(mod.RevisionBicameralPanel, { ciclo, usuario: { rol: 'Ciudadano' } });
assert.match(ciudadano, /Su rol no tiene permiso/);
assert.match(boton(ciudadano, 'Aprobar').atributos, /disabled/);

const aprobado = render(mod.RevisionBicameralPanel, {
  ciclo: { ...ciclo, aprobacion_humana: { accion: 'APROBAR', estado: 'APROBADO_REVISION_HUMANA', nombre_usuario: 'Revisor', fecha: '2026-10-01' } }, usuario,
});
assert.doesNotMatch(boton(aprobado, 'Continuar: Veto y Promulgación').atributos, /disabled/);
assert.equal(boton(aprobado, 'Aprobar'), undefined);

const ejecutivo = render(mod.DecisionEjecutivaPanel, {
  evaluacion: { decision: 'PENDIENTE_DECISION_HUMANA', opciones_operador_humano: [] }, usuario,
});
assert.match(boton(ejecutivo, 'Continuar: Publicación Oficial').atributos, /disabled/);
assert.match(boton(ejecutivo, 'Registrar decisión documentada').atributos, /disabled/);

const sesion = render(mod.ActaSesionForm, { titulo: 'Origen', valor: {}, onChange: () => {} });
assert.match(sesion, /Referencia del acta/);
assert.match(sesion, /Votación en detalle/);
assert.doesNotMatch(sesion, /value="87"/);
// Simula la casilla marcada para verificar que las observaciones no bloquean Aprobar.
let { code: codigoConfirmado } = await transformWithOxc(
  fuente.replaceAll('const [confirmado, setConfirmado] = useState(false);',
                   'const [confirmado, setConfirmado] = useState(true);'), fileURLToPath(archivo));
for (const nombre of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
  const destino = JSON.stringify(pathToFileURL(require.resolve(nombre)).href);
  codigoConfirmado = codigoConfirmado.replaceAll('"' + nombre + '"', destino).replaceAll("'" + nombre + "'", destino);
}
const moduloConfirmado = await import('data:text/javascript;base64,' + Buffer.from(codigoConfirmado).toString('base64'));
const conObservaciones = render(moduloConfirmado.RevisionBicameralPanel, {
  ciclo: { ...ciclo, puede_aprobar: false }, usuario,
});
assert.doesNotMatch(boton(conObservaciones, 'Aprobar').atributos, /disabled/);
assert.match(conObservaciones, /observaciones quedarán registradas/);
console.log('6 escenarios de interfaz verificados.');
