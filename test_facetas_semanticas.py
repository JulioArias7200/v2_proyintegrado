"""Regresiones del RAG vectorial y selección múltiple. No usa servicios externos."""
import json
import hashlib
import sys
import unittest
from contextlib import contextmanager
from types import ModuleType
from unittest.mock import Mock, patch, MagicMock

from sma_unified.agents import facetas_semanticas as sem


TEXTO='Los planos requieren firma del responsable. La historia clínica debe mantenerse confidencial.'
FUENTES=[
    {'id':1,'profesion':'Arquitectura','titulo':'Ley 1373','archivo':'arquitecto.pdf','pagina':2,
     'contenido':'Referencia arquitectónica','similitud':.3,'evidencia_documento':TEXTO},
    {'id':2,'profesion':'Medicina','titulo':'DS 28562','archivo':'medicos.pdf','pagina':5,
     'contenido':'Referencia clínica','similitud':.4,'evidencia_documento':TEXTO},
]


@contextmanager
def modelo(respuesta):
    llm=ModuleType('sma_unified.agents.llm_client')
    llm.chat_completion_resiliente=Mock(return_value=(json.dumps(respuesta),'prueba'))
    llm.chat_completion_auditoria=llm.chat_completion_resiliente
    llm.extraer_json_de_llm=json.loads
    with patch.dict(sys.modules,{llm.__name__:llm}):
        yield llm


class SemanticaTests(unittest.TestCase):
    def test_migracion_reutiliza_vectores_del_mismo_modelo_y_texto(self):
        texto=sem.texto_indice({'profesion':'Medicina','titulo':'Norma','contenido':'Contenido'})
        huella=hashlib.sha256(texto.encode()).hexdigest()
        actual=(1,'Medicina','Norma','Contenido','modelo',2,huella,True)
        viejo=(2,'Medicina','Norma','Contenido','otro-modelo',2,huella,True)
        cursor=Mock();cursor.fetchall.return_value=[actual,viejo]
        conn=Mock();conn.cursor.return_value=MagicMock();conn.cursor.return_value.__enter__.return_value=cursor
        with patch.object(sem.corpus,'asegurar_tabla'),patch.object(sem.corpus,'_conexion',return_value=conn), \
                patch.object(sem,'parametros',return_value=('modelo',2)),patch.object(sem,'_embeber',return_value=[[1,0]]) as embed:
            res=sem.vectorizar_pendientes()
            self.assertEqual(res['vectorizados'],1)
            embed.assert_called_once_with([texto],'passage')
            actualizaciones=[c for c in cursor.execute.call_args_list if c.args[0].lstrip().startswith('UPDATE')]
            self.assertEqual(actualizaciones[0].args[1][-1],2)
            cursor.fetchall.return_value=[actual,(2,*actual[1:])]
            self.assertEqual(sem.vectorizar_pendientes()['vectorizados'],0)
            self.assertEqual(embed.call_count,1)

    def test_migracion_rechaza_dimensiones_erroneas_antes_de_guardar(self):
        cursor=Mock();cursor.fetchall.return_value=[(1,'Medicina','Norma','Texto',None,None,None,False)]
        conn=Mock();conn.cursor.return_value=MagicMock();conn.cursor.return_value.__enter__.return_value=cursor
        with patch.object(sem.corpus,'asegurar_tabla'),patch.object(sem.corpus,'_conexion',return_value=conn), \
                patch.object(sem,'parametros',return_value=('modelo',2)),patch.object(sem,'_embeber',return_value=[[1]]):
            with self.assertRaisesRegex(ValueError,'Embedding inválido'):
                sem.vectorizar_pendientes()
        self.assertFalse(any(c.args[0].lstrip().startswith('UPDATE') for c in cursor.execute.call_args_list))

    def test_busqueda_global_sin_nombres_de_profesion(self):
        cursor=Mock()
        cursor.fetchone.return_value=(130,0)
        cursor.fetchall.return_value=[tuple(FUENTES[1][k] for k in ('id','profesion','titulo','archivo','pagina','contenido','similitud'))]
        conn=Mock(); conn.cursor.return_value=MagicMock()
        conn.cursor.return_value.__enter__.return_value=cursor
        consulta='Quiero acceder a mi historia clínica sin que sea divulgada.'
        with patch.object(sem.corpus,'asegurar_tabla'),patch.object(sem.corpus,'_conexion',return_value=conn), \
                patch.object(sem,'parametros',return_value=('modelo',2)),patch.object(sem,'_embeber',return_value=[[1,0]]) as embed:
            fuentes=sem.buscar_semantico(consulta)
        self.assertEqual(fuentes[0]['profesion'],'Medicina')
        embed.assert_called_once_with([consulta],'query')
        sql,params=cursor.execute.call_args.args
        self.assertIn('<=>',sql)
        self.assertNotIn('ts_rank',sql)
        self.assertNotIn('profesion=ANY',sql)
        self.assertNotIn(consulta,sql)

    def test_indice_incompleto_no_declara_no_aplica(self):
        cursor=Mock(); cursor.fetchone.return_value=(130,4)
        conn=Mock(); conn.cursor.return_value=MagicMock()
        conn.cursor.return_value.__enter__.return_value=cursor
        with patch.object(sem.corpus,'asegurar_tabla'),patch.object(sem.corpus,'_conexion',return_value=conn), \
                patch.object(sem,'parametros',return_value=('modelo',2)),patch.object(sem,'_embeber') as embed:
            with self.assertRaisesRegex(ValueError,'incompleto'):
                sem.buscar_semantico('Documento')
        embed.assert_not_called()

    def test_selector_varias_facetas_con_evidencia_real(self):
        respuesta={'facetas':[
            {'profesion':'Arquitectura','motivo':'Planos','evidencia':'Los planos requieren firma del responsable.','confianza':.9},
            {'profesion':'Medicina','motivo':'Confidencialidad','evidencia':'La historia clínica debe mantenerse confidencial.','confianza':.9},
        ]}
        with modelo(respuesta),patch.object(sem,'_candidatos',return_value=(FUENTES,[TEXTO],False)),patch.object(sem,'parametros',return_value=('embed',2048)):
            plan=sem.seleccionar_facetas(TEXTO)
        self.assertEqual([f['profesion'] for f in plan['facetas']],['Arquitectura','Medicina'])
        self.assertEqual([f['id'] for f in plan['fuentes']],[1,2])

    def test_selector_no_acepta_profesion_inventada_ni_evidencia_falsa(self):
        for p,e in [('Notariado',TEXTO),('Medicina','Una oración que no aparece')]:
            with self.subTest(profesion=p),modelo({'facetas':[{'profesion':p,'evidencia':e,'confianza':.9}]}), \
                    patch.object(sem,'_candidatos',return_value=(FUENTES,[TEXTO],False)):
                with self.assertRaises(ValueError):
                    sem.seleccionar_facetas(TEXTO)

    def test_selector_descarta_coincidencias_superficiales(self):
        with modelo({'facetas':[]}),patch.object(sem,'_candidatos',return_value=(FUENTES,['Becas de idiomas'],False)), \
                patch.object(sem,'parametros',return_value=('embed',2048)):
            self.assertEqual(sem.seleccionar_facetas('Becas de idiomas')['estado'],'NO_APLICA')

    def test_ejecuta_cada_faceta_con_sus_fuentes_y_referencias(self):
        plan={'estado':'PLANIFICADO','facetas':[{'profesion':'Arquitectura'},{'profesion':'Medicina'}],
              'fuentes':FUENTES,'modelo_embedding':'embed','modelo_selector':'router','cobertura_parcial':False}
        chat=ModuleType('sma_unified.agents.multiagente_ciudadano')
        chat._publicar_mongo=Mock(return_value=None);chat._cerrar_mongo=Mock()
        with modelo({}) as llm,patch.dict(sys.modules,{chat.__name__:chat}),patch.object(sem,'seleccionar_facetas',return_value=plan):
            llm.chat_completion_resiliente.return_value=('Aporte profesional','modelo')
            res=sem.analizar_multifaceta(TEXTO)
        self.assertEqual(len(res['facetas']),2)
        self.assertEqual(res['estado'],'COMPLETADO')
        self.assertEqual(llm.chat_completion_resiliente.call_count,2)
        prompts=[c.kwargs['messages'] for c in llm.chat_completion_resiliente.call_args_list]
        arquitectura=next(p for p in prompts if 'faceta de Arquitectura' in p[0]['content'])
        medicina=next(p for p in prompts if 'faceta de Medicina' in p[0]['content'])
        self.assertIn('[R1]',arquitectura[1]['content']);self.assertNotIn('Referencia clínica',arquitectura[1]['content'])
        self.assertIn('[R2]',medicina[1]['content']);self.assertNotIn('Referencia arquitectónica',medicina[1]['content'])

    def test_error_de_una_faceta_conserva_los_aportes_y_marca_pendiente(self):
        plan={'estado':'PLANIFICADO','facetas':[{'profesion':'Arquitectura'},{'profesion':'Medicina'}],
              'fuentes':FUENTES,'modelo_embedding':'embed','modelo_selector':'router','cobertura_parcial':False}
        chat=ModuleType('sma_unified.agents.multiagente_ciudadano')
        chat._publicar_mongo=Mock(return_value=None);chat._cerrar_mongo=Mock()
        with modelo({}) as llm,patch.dict(sys.modules,{chat.__name__:chat}),patch.object(sem,'seleccionar_facetas',return_value=plan):
            def responder(**kwargs):
                if 'faceta de Medicina' in kwargs['messages'][0]['content']:raise RuntimeError('Tiempo agotado')
                return 'Aporte de Arquitectura','modelo'
            llm.chat_completion_resiliente.side_effect=responder
            res=sem.analizar_multifaceta(TEXTO)
        self.assertEqual(res['estado'],'PENDIENTE_REVISION')
        self.assertIn('Aporte de Arquitectura',res['informe'])
        self.assertEqual([f['estado'] for f in res['facetas']],['COMPLETADO','PENDIENTE_REVISION'])

    def test_validacion_vectores_y_cobertura_de_documentos_largos(self):
        for v in ([1], [float('nan'),1], [0,0]):
            with self.assertRaises(ValueError):sem.literal(v,2)
        texto='INICIO ' + ' '.join('bloque'+str(i) for i in range(40000)) + ' FINAL'
        bloques,parcial=sem._bloques(texto)
        self.assertTrue(parcial);self.assertEqual(len(bloques),64)
        self.assertTrue(bloques[0].startswith('INICIO'));self.assertTrue(bloques[-1].endswith('FINAL'))


if __name__=='__main__':unittest.main()
