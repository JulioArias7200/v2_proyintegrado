"""HTTP real de presentación, recuperación y resultados; proveedores externos simulados."""
import ast
import copy
import sys
import time
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Literal, Optional
from unittest.mock import Mock, patch

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from test_casos_compartidos import ColeccionMemoria, store


class CursorMemoria:
    def __init__(self, docs):
        self.docs = copy.deepcopy(list(docs))
    def sort(self, *args):
        return self
    def skip(self, n):
        self.docs = self.docs[n:]
        return self
    def limit(self, n):
        return self.docs[:n]


class PresentacionHttpTests(unittest.TestCase):
    def setUp(self):
        self.col = ColeccionMemoria()
        self.col.find = lambda filtro: CursorMemoria(self.col.docs.values())
        self.usuario = {'usuario_id': 12, 'rol': 'Ciudadano', 'nombre_completo': 'Autor'}
        env = dict(globals(), app=FastAPI(), usuario_revision=lambda: self.usuario, logger=Mock(),
            run_phase1_classification=Mock(return_value={'data': {'sesion_id': 'sesion',
                'task_id_inicial': 'inicio', 'task_id_distribuidor': 'distribuidor',
                'categoria': 'AGENTE_REGISTRO_LEGISLATIVO'}}),
            _resolve_id_proyecto=Mock(return_value=123),
            run_agent_comision=Mock(return_value={'data': {'comision_principal': 'Comisión'}}),
            run_agent_constitucional=Mock(return_value={'data': {'estado': 'COMPLETADO', 'observaciones': ['CPE']}}),
            run_agent_consistencia=Mock(return_value={'data': {'estado': 'COMPLETADO', 'observaciones': ['Normas']}}),
            run_agent_concentrador=Mock(return_value={'data': {'expediente_consolidado': {'resumen_ejecutivo': 'Resumen'}}}))
        nombres = {'Phase1Request', 'Phase2Request', 'ConcentradorRequest', 'PresentacionCiudadanaRequest',
            '_procesar_caso_ciudadano', 'presentar_caso_ciudadano', 'reanudar_caso_ciudadano', 'listar_casos_compartidos'}
        arbol = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        nodos = [n for n in arbol.body if getattr(n, 'name', None) in nombres]
        exec(compile(ast.Module(body=nodos, type_ignores=[]), 'server.py', 'exec'), env)
        self.env = env
        self.client = TestClient(env['app'])
        for p in (patch.object(store, 'coleccion', return_value=self.col),
                  patch.dict(sys.modules, {'sma_unified.db.casos_compartidos': store})):
            p.start()
            self.addCleanup(p.stop)

    def presentar(self):
        return self.client.post('/api/ciudadana/presentaciones', json={
            'titulo': 'Iniciativa de prueba', 'texto': 'Artículo 1. Objeto de esta iniciativa ciudadana.',
            'tipo': 'iniciativa', 'camara_destino': 'Senadores'})

    def test_presentar_ejecuta_ambas_auditorias_y_expone_resultados(self):
        respuesta = self.presentar()
        self.assertEqual(respuesta.status_code, 202, respuesta.text)
        for agente in ('comision', 'constitucional', 'consistencia', 'concentrador'):
            self.env['run_agent_' + agente].assert_called_once()
        casos = self.client.get('/api/casos').json()['data']
        self.assertEqual(len(casos), 1)
        caso = casos[0]
        self.assertEqual(caso['pipelineStep'], 11)
        self.assertFalse(caso['_sharedProcessing'])
        self.assertEqual(caso['dictamenData']['observaciones'], ['CPE'])
        self.assertEqual(caso['consistenciaData']['observaciones'], ['Normas'])
        self.assertEqual(caso['estadoCompartido'], 'PENDIENTE_SEGUIMIENTO_LEGISLADOR')
        self.assertFalse(self.env['run_agent_concentrador'].call_args.args[0].notificar)

    def test_reanudar_conserva_expediente_y_no_repite_distribuidor(self):
        caso_id = self.presentar().json()['data']['id']
        self.col.docs[caso_id]['snapshot'].update(title='X', dictamenData=None, consistenciaData=None)
        respuesta = self.client.post(f'/api/ciudadana/presentaciones/{caso_id}/reanudar')
        self.assertEqual(respuesta.status_code, 202, respuesta.text)
        self.env['run_phase1_classification'].assert_called_once()
        self.assertEqual(self.env['run_agent_constitucional'].call_count, 2)
        self.assertEqual(self.env['run_agent_consistencia'].call_count, 2)
        self.assertEqual(len(self.col.docs), 1)
        self.assertEqual(self.col.docs[caso_id]['snapshot']['fase1Data']['id_proyecto'], 123)
        self.assertFalse(self.col.docs[caso_id]['processing'])

    def test_reanudar_rechaza_otro_ciudadano_y_ejecucion_doble(self):
        caso_id = self.presentar().json()['data']['id']
        self.usuario['usuario_id'] = 99
        self.assertEqual(self.client.post(f'/api/ciudadana/presentaciones/{caso_id}/reanudar').status_code, 403)
        self.usuario['usuario_id'] = 12
        self.col.docs[caso_id]['processing'] = True
        self.assertEqual(self.client.post(f'/api/ciudadana/presentaciones/{caso_id}/reanudar').status_code, 409)
        self.env['run_agent_constitucional'].assert_called_once()

    def test_error_auditoria_se_expone_como_pendiente(self):
        self.env['run_agent_consistencia'].side_effect = RuntimeError('Proveedor sin conexión')
        self.assertEqual(self.presentar().status_code, 202)
        caso = self.client.get('/api/casos').json()['data'][0]
        self.assertEqual(caso['consistenciaData']['estado'], 'PENDIENTE_REVISION')
        self.assertEqual(caso['dictamenData']['estado'], 'COMPLETADO')
        self.assertIn('Proveedor sin conexión', caso['consistenciaData']['error'])
        self.assertEqual(caso['estadoCompartido'], 'PENDIENTE_SEGUIMIENTO_LEGISLADOR_CON_OBSERVACIONES')


if __name__ == '__main__':
    unittest.main()
