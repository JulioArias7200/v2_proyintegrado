"""Pruebas aisladas de red: no requieren credenciales ni escriben en la BD."""
import ast
import json
import re
from pathlib import Path
import time
import typing
import unittest
from threading import BoundedSemaphore, Lock
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock


def cargar_funcion(archivo, nombre, entorno):
    fuente = Path('sma_unified/agents', archivo).read_text(encoding='utf-8')
    nodo = next(n for n in ast.parse(fuente).body
                if isinstance(n, ast.FunctionDef) and n.name == nombre)
    espacio = {**vars(typing), '_AUDIT_DEADLINE':SimpleNamespace(get=lambda: None), **entorno}
    exec(compile(ast.Module(body=[nodo], type_ignores=[]), archivo, 'exec'), espacio)
    return espacio[nombre]


def cargar_agente(archivo, nombre, entorno):
    arbol = ast.parse(Path('sma_unified/agents', archivo).read_text(encoding='utf-8'))
    nodos = [n for n in arbol.body if isinstance(n, (ast.Assign, ast.AnnAssign, ast.ClassDef))]
    espacio = {**vars(typing), 'logger':Mock(), 're':re, 'ANALISIS_NEON_LOCK':Lock(),
               'map_con_contexto_auditoria':lambda executor, fn, elementos: list(executor.map(fn, elementos)),
               'extraer_json_de_llm':json.loads, **entorno}
    exec(compile(ast.Module(body=nodos, type_ignores=[]), archivo, 'exec'), espacio)
    return espacio[nombre]


class AuditoriaTimeoutTests(unittest.TestCase):
    def cliente(self, post):
        return cargar_funcion('llm_client.py', 'chat_completion_resiliente', {
            'requests': SimpleNamespace(post=post, exceptions=SimpleNamespace(
                Timeout=TimeoutError, RequestException=ConnectionError)),
            'settings': SimpleNamespace(NVIDIA_API_KEY='prueba'),
            'NVIDIA_API_BASE': 'https://example.invalid',
            '_lista_modelos_razonamiento': lambda: ['a', 'b', 'c', 'd'],
            '_esta_circuito_abierto': lambda _: (False, 0),
            '_registrar_fallo_circuito': Mock(),
            '_registrar_exito_circuito': Mock(),
            '_registrar_metrica_latencia': Mock(),
            '_parece_modelo_no_disponible': lambda *_: False,
            'logger': Mock(), 'time': time, '_MODELOS_RETIRADOS': set(),
        })

    def test_timeout_no_recorre_todos_los_modelos(self):
        post = Mock(side_effect=TimeoutError('servicio lento'))
        with self.assertRaises(RuntimeError):
            self.cliente(post)([], timeout=(5, 30), max_model_attempts=2)
        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args.kwargs['timeout'], (5, 30))
        self.assertNotIn('max_model_attempts', post.call_args.kwargs['json'])

    def test_respaldo_puede_completar(self):
        respuesta = Mock(status_code=200)
        respuesta.json.return_value = {'choices': [{'message': {'content': '{}'}}]}
        post = Mock(side_effect=[TimeoutError(), respuesta])
        self.assertEqual(self.cliente(post)([], max_model_attempts=2), ('{}', 'b'))

    def test_circuitos_abiertos_no_consumen_intentos(self):
        respuesta = Mock(status_code=200)
        respuesta.json.return_value = {'choices': [{'message': {'content': '{}'}}]}
        post = Mock(return_value=respuesta)
        cliente = self.cliente(post)
        cliente.__globals__['_esta_circuito_abierto'] = lambda modelo: (modelo in {'a', 'b'}, 20)
        self.assertEqual(cliente([], max_model_attempts=2), ('{}', 'c'))
        self.assertEqual(post.call_count, 1)

    def test_http_410_excluye_modelo_en_llamadas_posteriores(self):
        retirado = Mock(status_code=410, text='modelo retirado')
        respuesta = Mock(status_code=200)
        respuesta.json.return_value = {'choices': [{'message': {'content': '{}'}}]}
        post = Mock(side_effect=[retirado, respuesta, respuesta])
        cliente = self.cliente(post)
        cliente.__globals__['_parece_modelo_no_disponible'] = lambda codigo, _: codigo == 410
        self.assertEqual(cliente([], modelos=['a', 'b']), ('{}', 'b'))
        self.assertIn('a', cliente.__globals__['_MODELOS_RETIRADOS'])
        self.assertEqual(cliente([], modelos=['a', 'b']), ('{}', 'b'))
        self.assertEqual([c.kwargs['json']['model'] for c in post.call_args_list], ['a', 'b', 'b'])

    def test_sdk_no_duplica_reintentos(self):
        constructor = Mock()
        funcion = cargar_funcion('embeddings_nvidia.py', '_get_client', {
            '_client': None, 'HAS_OPENAI': True, 'OpenAI': constructor,
            'settings': SimpleNamespace(NVIDIA_BASE_URL='prueba', NVIDIA_API_KEY='prueba'),
        })
        funcion()
        self.assertEqual(constructor.call_args.kwargs['max_retries'], 0)
        self.assertEqual(constructor.call_args.kwargs['timeout'], 30.0)

    def test_auditorias_comparten_limite_y_priorizan_respaldo(self):
        activos = 0
        maximo = 0
        lock = Lock()
        def responder(**kwargs):
            nonlocal activos, maximo
            self.assertEqual(kwargs['modelos'][0], 'openai/gpt-oss-20b')
            self.assertNotIn('z-ai/glm-5.2', kwargs['modelos'])
            self.assertEqual(kwargs['timeout'], (30, 60))
            with lock:
                activos += 1
                maximo = max(maximo, activos)
            time.sleep(0.01)
            with lock:
                activos -= 1
            return '{}', 'prueba'
        funcion = cargar_funcion('llm_client.py', 'chat_completion_auditoria', {
            '_AUDITORIA_LLM_SLOTS': BoundedSemaphore(2),
            '_lista_modelos_razonamiento': lambda: ['respaldo', 'z-ai/glm-5.2', 'openai/gpt-oss-20b'],
            '_MODELOS_RETIRADOS': {'z-ai/glm-5.2'},
            'chat_completion_resiliente': responder,
        })
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: funcion(messages=[]), range(12)))
        self.assertLessEqual(maximo, 2)

    def test_consistencia_fallida_no_persiste_hallazgo(self):
        guardar = Mock()
        clase = cargar_agente('consistencia_normativa.py', 'AgenteConsistenciaNormativa', {
            'settings': SimpleNamespace(LLM_MODEL_CONSISTENCIA='prueba'),
            'chat_completion_auditoria': Mock(side_effect=TimeoutError('proveedor lento')),
            'buscar_articulos_normativos_semantico': Mock(return_value=[
                {'documento': 'Ley', 'numero': '1', 'texto': 'texto', 'similitud': 0.99}]),
            'guardar_analisis_consistencia': guardar,
        })
        agente = clase()
        agente._embed = Mock(return_value=[0.1])
        resultados = agente.analizar_articulo('proyecto')
        self.assertEqual(resultados[0]['estado'], 'PENDIENTE_REVISION')
        self.assertFalse(resultados[0]['verificado'])
        self.assertFalse(resultados[0]['derogacion_tacita'])
        guardar.assert_not_called()

    def test_constitucional_fallido_no_declara_validez(self):
        clase = cargar_agente('verificador_constitucional.py', 'VerificadorConstitucional', {
            'chat_completion_auditoria': Mock(side_effect=TimeoutError('proveedor lento')),
        })
        agente = clase()
        agente._recuperar_articulos_cpe = Mock(return_value=[{'numero': '1', 'texto': 'CPE'}])
        resultado = agente.analizar('proyecto', 'sesion')
        self.assertEqual(resultado['estado'], 'PENDIENTE_REVISION')
        self.assertFalse(resultado['valido'])
        self.assertEqual(resultado['confianza'], 0)
        self.assertEqual(resultado['total_pendientes'], 1)
        self.assertEqual(resultado['contradicciones'], [])
        self.assertEqual(resultado['articulos_a_favor'], [])

    def test_consistencia_parcial_no_genera_correcciones(self):
        guardar = Mock()
        clase = cargar_agente('consistencia_normativa.py', 'AgenteConsistenciaNormativa', {})
        agente = Mock()
        agente.analizar_documento.return_value = [
            {'verificado': True, 'tipo_relacion': 'contradiccion', 'riesgo': 'alto'},
            {'verificado': False, 'tipo_relacion': 'pendiente_revision'},
        ]
        agente.generar_resumen = clase.generar_resumen
        funcion = cargar_funcion('consistencia_normativa.py', 'verificar_consistencia_normativa', {
            'AGENTE_COMISION': 'comision', 'AGENTE_CONSISTENCIA': 'consistencia',
            'AgenteConsistenciaNormativa': Mock(return_value=agente),
            'publicar_mensaje': Mock(return_value='tarea'),
            'marcar_en_proceso': Mock(), 'marcar_error': Mock(), 'marcar_completado': Mock(),
            'guardar_correccion_proyecto': guardar,
            'guardar_reporte_consistencia_mongo': Mock(),
            'obtener_email_autor_proyecto': Mock(), 'time': time, 'logger': Mock(),
        })
        resultado = funcion('proyecto', 'sesion', id_proyecto=1)
        self.assertEqual(resultado['estado'], 'PENDIENTE_REVISION')
        self.assertEqual(resultado['total_hallazgos'], 1)
        self.assertEqual(resultado['total_pendientes'], 1)
        self.assertEqual(resultado['nivel_riesgo_global'], 'DESCONOCIDO')
        guardar.assert_not_called()

    def test_deepcheck_fallido_no_inventa_clasificacion(self):
        clase = cargar_agente('verificador_constitucional.py', 'VerificadorConstitucional', {
            'chat_completion_auditoria': Mock(side_effect=TimeoutError('proveedor lento')),
        })
        resultado = clase()._verificar_profundo_cpe('proyecto', {'numero': '1', 'texto': 'CPE'})
        self.assertEqual(resultado['clasificacion'], 'PENDIENTE_REVISION')
        self.assertFalse(resultado['verificado'])

    def test_criba_reintenta_solo_respuesta_json_invalida(self):
        llamada = Mock(side_effect=[('Texto sin JSON', 'modelo'),
                                   ('{"c":"NEUTRAL","s":"ninguna","ok":true}', 'modelo')])
        clase = cargar_agente('verificador_constitucional.py', 'VerificadorConstitucional', {
            'chat_completion_auditoria': llamada, 'extraer_json_de_llm': json.loads,
        })
        resultado = clase()._cribar_relacion_cpe('proyecto', {'numero': '9', 'texto': 'CPE'})
        self.assertTrue(resultado['verificado'])
        self.assertNotIn('pendiente_revision', resultado)
        self.assertEqual(llamada.call_count, 2)
        self.assertEqual(llamada.call_args.kwargs['response_format'], {'type': 'json_object'})
        self.assertGreater(llamada.call_args_list[1].kwargs['max_tokens'],
                           llamada.call_args_list[0].kwargs['max_tokens'])

    def test_criba_dos_respuestas_invalidas_quedan_pendientes(self):
        llamada = Mock(return_value=('{}', 'modelo'))
        clase = cargar_agente('verificador_constitucional.py', 'VerificadorConstitucional', {
            'chat_completion_auditoria': llamada, 'extraer_json_de_llm': json.loads,
        })
        resultado = clase()._cribar_relacion_cpe('proyecto', {'numero': '11', 'texto': 'CPE'})
        self.assertTrue(resultado['pendiente_revision'])
        self.assertFalse(resultado['verificado'])
        self.assertEqual(llamada.call_count, 2)

    def test_auditoria_no_usa_razonamiento_como_respuesta_final(self):
        respuesta = Mock(status_code=200)
        respuesta.json.return_value = {'choices': [{'finish_reason': 'length',
            'message': {'content': '', 'reasoning_content': 'razonamiento incompleto'}}]}
        post = Mock(return_value=respuesta)
        with self.assertRaisesRegex(RuntimeError, 'respuesta final'):
            self.cliente(post)([], require_final_content=True)
        self.assertNotIn('require_final_content', post.call_args.kwargs['json'])


if __name__ == '__main__':
    unittest.main()
