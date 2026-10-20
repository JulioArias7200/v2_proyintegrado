"""Persistencia, concurrencia y entrega ciudadana sin servicios externos."""
import ast
import copy
import importlib.util
from pathlib import Path
from datetime import datetime, timezone
from types import SimpleNamespace, ModuleType
from unittest.mock import Mock, patch
import unittest
import sys
import time
from test_auditoria_timeouts import cargar_funcion

spec = importlib.util.spec_from_file_location('casos_store_test', 'sma_unified/db/casos_compartidos.py')
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)


class ColeccionMemoria:
    def __init__(self):
        self.docs = {}
    def find_one(self, filtro):
        return copy.deepcopy(self.docs.get(filtro['_id']))
    def insert_one(self, doc):
        self.docs[doc['_id']] = copy.deepcopy(doc)
    def update_one(self, filtro, cambio):
        doc = self.docs[filtro['_id']]
        doc.update(copy.deepcopy(cambio.get('$set', {})))
        for k, v in cambio.get('$inc', {}).items():
            doc[k] += v
    def find_one_and_update(self, filtro, cambio, **kwargs):
        doc = self.docs.get(filtro['_id'])
        if not doc or doc['version'] != filtro['version'] or doc.get('processing'):
            return None
        self.update_one(filtro, cambio)
        return self.find_one(filtro)


class CasosTests(unittest.TestCase):
    def setUp(self):
        self.col = ColeccionMemoria()
        self.patcher = patch.object(store, 'coleccion', return_value=self.col)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.diputado = {'usuario_id': 1, 'rol': 'Diputado', 'nombre_completo': 'Revisor'}

    def test_otro_equipo_recupera_mismo_estado_y_version(self):
        guardado = store.guardar('caso', {'documentText': 'Texto', 'pipelineStep': 11}, 0, self.diputado)
        otro_equipo = store.publico(self.col.find_one({'_id': 'caso'}))
        self.assertEqual(guardado, otro_equipo)
        self.assertEqual(otro_equipo['pipelineStep'], 11)

    def test_version_antigua_no_sobreescribe_cambio(self):
        store.guardar('caso', {'pipelineStep': 11}, 0, self.diputado)
        store.guardar('caso', {'pipelineStep': 12}, 1, self.diputado)
        with self.assertRaises(ValueError):
            store.guardar('caso', {'pipelineStep': 11}, 1, self.diputado)
        self.assertEqual(self.col.docs['caso']['snapshot']['pipelineStep'], 12)

    def test_ciudadano_no_avanza_y_operador_no_pasa_concentrador(self):
        with self.assertRaises(PermissionError):
            store.guardar('caso', {'pipelineStep': 12}, 0, {'rol': 'Ciudadano'})
        with self.assertRaises(PermissionError):
            store.guardar('caso', {'pipelineStep': 12}, 0, {'rol': 'Operador_Mesa_Partes'})
        for rol in ('Senador', 'Diputado'):
            store.validar_edicion({'rol': rol}, {'pipelineStep': 15})

    def procesar(self, tipo, pendiente=False, categoria='AGENTE_ATENCION_CIUDADANA'):
        self.col.insert_one({'_id': 'caso', 'snapshot': {'documentText': 'Texto ciudadano'},
                             'version': 1, 'processing': True})
        arbol = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        funcion = next(n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name == '_procesar_caso_ciudadano')
        fase = {'sesion_id': 'sesion', 'task_id_inicial': 'a', 'task_id_distribuidor': 'b',
                'categoria': categoria}
        cpe = {'estado': 'PENDIENTE_REVISION' if pendiente else 'COMPLETADO'}
        concentrar = Mock(return_value={'data': {'expediente_consolidado': {'resumen_ejecutivo': 'Resumen'}}})
        clases = lambda **kwargs: SimpleNamespace(**kwargs)
        espacio = {'datetime': datetime, 'timezone': timezone, 'time': time, 'logger': Mock(),
            'Phase1Request': clases, 'Phase2Request': clases, 'ConcentradorRequest': clases,
            '_resolve_id_proyecto': Mock(return_value=123),
            'run_phase1_classification': Mock(return_value={'data': fase}),
            'run_agent_comision': Mock(return_value={'data': {'comision_principal': 'Comisión'}}),
            'run_agent_constitucional': Mock(return_value={'data': cpe}),
            'run_agent_consistencia': Mock(return_value={'data': {'estado': 'COMPLETADO'}}),
            'run_agent_concentrador': concentrar}
        modulo = ModuleType('sma_unified.db.casos_compartidos')
        modulo.coleccion = lambda: self.col
        exec(compile(ast.Module(body=[funcion], type_ignores=[]), '<worker real>', 'exec'), espacio)
        with patch.dict(sys.modules, {'sma_unified.db.casos_compartidos': modulo}):
            espacio['_procesar_caso_ciudadano']('caso', SimpleNamespace(texto='Texto ciudadano', titulo='Titulo',
                nombre_archivo=None, tipo=tipo, camara_destino='Senadores'), self.diputado)
        return self.col.docs['caso'], espacio

    def test_iniciativa_se_detiene_en_concentrador(self):
        doc, env = self.procesar('iniciativa')
        self.assertEqual(doc['snapshot']['pipelineStep'], 11)
        self.assertEqual(doc['estado'], 'PENDIENTE_SEGUIMIENTO_LEGISLADOR')
        self.assertFalse(doc['processing'])
        self.assertFalse(env['run_agent_concentrador'].call_args.args[0].notificar)

    def test_consulta_no_se_trata_como_ley(self):
        doc, env = self.procesar('consulta')
        env['run_agent_constitucional'].assert_not_called()
        self.assertEqual(doc['snapshot']['pipelineStep'], 11)

    def test_consulta_clasificada_como_proyecto_ejecuta_ambas_auditorias(self):
        doc, env = self.procesar('consulta', categoria='AGENTE_REGISTRO_LEGISLATIVO')
        env['run_agent_comision'].assert_called_once()
        env['run_agent_constitucional'].assert_called_once()
        env['run_agent_consistencia'].assert_called_once()
        self.assertEqual(doc['snapshot']['tipoProcesamiento'], 'iniciativa')
        self.assertEqual(doc['snapshot']['pipelineStep'], 11)
        self.assertEqual(doc['snapshot']['agentesEnProceso'], [])

    def test_auditoria_pendiente_se_concentra_sin_validarla(self):
        doc, env = self.procesar('iniciativa', True)
        self.assertEqual(doc['snapshot']['pipelineStep'], 11)
        self.assertEqual(doc['estado'], 'PENDIENTE_SEGUIMIENTO_LEGISLADOR_CON_OBSERVACIONES')
        self.assertFalse(doc['processing'])
        self.assertTrue(doc['snapshot']['concentradorData']['evaluacion_incompleta'])
        self.assertEqual(env['run_agent_concentrador'].call_args.args[0].datos_constitucionales['estado'], 'PENDIENTE_REVISION')

    def test_rutas_finales_exigen_legislador_en_servidor(self):
        arbol = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        for name in ('run_agent_secretario_endpoint', 'run_agent_bicameral_endpoint',
                     'run_agent_veto_promulgacion_endpoint', 'run_agent_publicacion_endpoint'):
            nodo = next(n for n in arbol.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
            self.assertTrue(any('Depends(legislador_revision)' == ast.unparse(d) for d in nodo.args.defaults), name)

    def test_concentrador_no_asigna_confianza_a_insumos_pendientes(self):
        agente = Mock()
        funcion = cargar_funcion('concentrador.py', 'ejecutar_concentrador_emisor_notificador', {
            'AgenteConcentrador': Mock(return_value=agente),
        })
        funcion('sesion', 123, datos_constitucionales={'estado': 'PENDIENTE_REVISION', 'confianza': 98},
                datos_consistencia={'estado': 'PENDIENTE_REVISION', 'pendientes_revision': [{'motivo': 'Error LLM'}]},
                notificar=False)
        insumos = agente.ejecutar.call_args.args[0]
        self.assertTrue(all(i['confianza'] == 0 and i['estado'] == 'PENDIENTE_REVISION' for i in insumos))
        self.assertEqual(insumos[1]['pendientes_revision'][0]['motivo'], 'Error LLM')


if __name__ == '__main__':
    unittest.main()
