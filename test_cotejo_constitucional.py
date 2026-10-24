"""Cotejos por lote, caché de éxitos y errores transitorios: sin llamadas externas."""
import json
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from sma_unified.agents import cotejo_constitucional as lotes
import test_auditoria_timeouts as auditoria
from test_auditoria_timeouts import cargar_funcion, cargar_agente


TEXTO='Se garantiza el acceso a los servicios de salud.'
ARTICULOS=[{'numero':str(i),'texto':f'La salud es un derecho fundamental. Texto {i}.'} for i in range(1,7)]


def respuesta(ids=range(6)):
    return {'cotejos':[{'id':str(i),'clasificacion':'A_FAVOR','severidad':'ninguna','verificado':True,
            'cita_proyecto':'acceso a los servicios de salud', 'cita_constitucional':'La salud es un derecho fundamental.',
            'fundamento':'El párrafo desarrolla el acceso reconocido en la fuente.',
            'recomendacion':'Conservar las garantías de acceso.'} for i in ids]}


class LoteTests(unittest.TestCase):
    def setUp(self):
        lotes._cache.clear()

    def test_seis_cotejos_con_una_llamada_y_reuso_sin_llamada_adicional(self):
        pedir=Mock(return_value=(json.dumps(respuesta()),'modelo'))
        primero=lotes.cotejar_lote(TEXTO,ARTICULOS,solicitar=pedir,parsear=json.loads)
        segundo=lotes.cotejar_lote(TEXTO,ARTICULOS,solicitar=pedir,parsear=json.loads)
        self.assertEqual(pedir.call_count,1)
        self.assertEqual(len(primero),6)
        self.assertTrue(all(r['verificado'] for _,r in primero))
        primero[0][1]['fundamento']='Alterado por consumidor'
        self.assertNotEqual(primero[0][1]['fundamento'],segundo[0][1]['fundamento'])

    def test_respuesta_parcial_reintenta_solo_los_faltantes(self):
        pedir=Mock(side_effect=[(json.dumps(respuesta(range(5))),'modelo'),(json.dumps(respuesta([0])),'modelo')])
        primero=lotes.cotejar_lote(TEXTO,ARTICULOS,solicitar=pedir,parsear=json.loads)
        self.assertTrue(primero[-1][1]['pendiente_revision'])
        segundo=lotes.cotejar_lote(TEXTO,ARTICULOS,solicitar=pedir,parsear=json.loads)
        self.assertTrue(all(r['verificado'] for _,r in segundo))
        prompt=pedir.call_args.kwargs['messages'][1]['content']
        candidatos=json.loads(prompt.split('CANDIDATOS CPE:\n')[1])
        self.assertEqual([a['numero'] for a in candidatos],['6'])

    def test_error_del_proveedor_no_se_guarda_en_cache(self):
        pedir=Mock(side_effect=TimeoutError('NVIDIA saturado'))
        for _ in range(2):
            resultado=lotes.cotejar_lote(TEXTO,ARTICULOS,solicitar=pedir,parsear=json.loads)
            self.assertTrue(all(r['pendiente_revision'] and not r['verificado'] for _,r in resultado))
        self.assertEqual(pedir.call_count,2)
        self.assertEqual(len(lotes._cache),0)

    def test_citas_inventadas_o_cotejos_duplicados_no_se_verifican(self):
        for problema in ('cita','duplicado'):
            with self.subTest(problema=problema):
                lotes._cache.clear()
                datos=respuesta()
                if problema=='cita':datos['cotejos'][0]['cita_constitucional']='Texto inventado'
                else:datos['cotejos'].append(datos['cotejos'][0])
                pedir=Mock(return_value=(json.dumps(datos),'modelo'))
                resultado=lotes.cotejar_lote(TEXTO,ARTICULOS,solicitar=pedir,parsear=json.loads)
                self.assertTrue(resultado[0][1]['pendiente_revision'])
                self.assertTrue(all(r['verificado'] for _,r in resultado[1:]))

    def test_cambio_en_documento_o_fuente_invalida_la_cache(self):
        pedir=Mock(return_value=(json.dumps(respuesta([0])),'modelo'))
        lotes.cotejar_lote(TEXTO,ARTICULOS[:1],solicitar=pedir,parsear=json.loads)
        lotes.cotejar_lote(TEXTO+' Nueva disposición.',ARTICULOS[:1],solicitar=pedir,parsear=json.loads)
        lotes.cotejar_lote(TEXTO,[{**ARTICULOS[0],'texto':ARTICULOS[0]['texto']+' Nueva versión.'}],solicitar=pedir,parsear=json.loads)
        self.assertEqual(pedir.call_count,3)

    def test_pendientes_tienen_confianza_cero_tambien_en_el_resumen(self):
        clase=cargar_agente('verificador_constitucional.py','VerificadorConstitucional',{})
        agente=clase()
        agente._extraer_unidades_proyecto=Mock(return_value=[{'articulo':'1','parrafo':'I','texto':TEXTO}])
        agente._analizar_unidad=Mock(return_value={'pendientes_revision':[{'articulo_constitucional':'18','motivo':'503'}]})
        resultado=agente.analizar(TEXTO,'sesion')
        self.assertEqual(resultado['estado'],'PENDIENTE_REVISION')
        self.assertEqual(resultado['confianza'],0)
        self.assertEqual(resultado['resumen_ejecutivo']['score_confianza'],0)
        self.assertFalse(resultado['analisis'][0]['verificado'])


class ProveedorTests(unittest.TestCase):
    def test_razonamiento_breve_solo_se_envia_a_modelos_compatibles(self):
        valido=Mock(status_code=200)
        valido.json.return_value={'choices':[{'message':{'content':'{}'}}]}
        post=Mock(return_value=valido)
        cliente=auditoria.AuditoriaTimeoutTests().cliente(post)
        cliente([],modelos=['openai/gpt-oss-20b'],razonamiento_breve=True)
        self.assertEqual(post.call_args.kwargs['json']['reasoning_effort'],'low')
        cliente([],modelos=['otro-modelo'],razonamiento_breve=True)
        self.assertNotIn('reasoning_effort',post.call_args.kwargs['json'])
        self.assertNotIn('razonamiento_breve',post.call_args.kwargs['json'])

    def test_saturacion_transitoria_respeta_retry_after_y_usa_otro_modelo(self):
        saturado=Mock(status_code=503,text='ResourceExhausted: limit reached',headers={'Retry-After':'45'})
        valido=Mock(status_code=200)
        valido.json.return_value={'choices':[{'message':{'content':'{}'}}]}
        post=Mock(side_effect=[saturado,valido,valido])
        cliente=auditoria.AuditoriaTimeoutTests().cliente(post)
        circuitos={}
        registrar=cargar_funcion('llm_client.py','_registrar_saturacion',{
            'time':time,'CIRCUIT_COOLDOWN_SECONDS':30,
            '_CIRCUIT_OPEN_UNTIL':circuitos,'_registrar_fallo_circuito':Mock(),'logger':Mock()})
        cliente.__globals__.update(_registrar_saturacion=registrar,
            _esta_circuito_abierto=lambda m:(circuitos.get(m,0)>time.time(),40))
        self.assertEqual(cliente([],modelos=['a','b']),('{}','b'))
        self.assertGreaterEqual(circuitos['a']-time.time(),44)
        self.assertNotIn('a',cliente.__globals__['_MODELOS_RETIRADOS'])
        self.assertEqual(cliente([],modelos=['a','b']),('{}','b'))
        self.assertEqual([c.kwargs['json']['model'] for c in post.call_args_list],['a','b','b'])

    def test_no_se_lanza_peticion_cuando_solo_quedan_milisegundos(self):
        post=Mock()
        cliente=auditoria.AuditoriaTimeoutTests().cliente(post)
        cliente.__globals__['_timeout_con_limite']=cargar_funcion('llm_client.py','_timeout_con_limite',{'time':time})
        with self.assertRaises(TimeoutError):cliente([],deadline_monotonic=time.monotonic()+.5)
        post.assert_not_called()

    def test_auditoria_excluye_omni_y_prioriza_respaldo_de_texto(self):
        from threading import BoundedSemaphore
        pedir=Mock(return_value=('{}','modelo'))
        funcion=cargar_funcion('llm_client.py','chat_completion_auditoria',{
            '_AUDITORIA_LLM_SLOTS':BoundedSemaphore(2), '_MODELOS_RETIRADOS':set(),
            'settings':SimpleNamespace(LLM_MODEL_CONSISTENCIA='nvidia/nemotron-3.5-lightning-30b-a3b',
                LLM_MODEL_CREW='nvidia/nemotron-3.5-lightning-30b-a3b',
                LLM_MODEL_NVIDIA='nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'),
            '_lista_modelos_razonamiento':lambda:['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning','nvidia/nemotron-3.5-lightning-30b-a3b'],
            'chat_completion_resiliente':pedir})
        funcion(messages=[])
        self.assertEqual(pedir.call_args.kwargs['modelos'],['nvidia/nemotron-3.5-lightning-30b-a3b'])


if __name__=='__main__':unittest.main()
