"""Pruebas sin red de recuperación, citas y participación en el flujo."""
import ast
import sys
import time
import typing
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import Mock, patch

from sma_unified.agents import reglamentos_profesionales as corpus
from sma_unified.agents import facetas_semanticas as sem


DOCUMENTOS = [dict(profesion=p, alias=a, titulo=t, archivo=f)
              for f, (p, t, a) in corpus.PREDETERMINADOS.items()]
FUENTE = {"id": 7, "profesion": "Medicina", "titulo": "DS 28562",
          "archivo": "medicos.pdf", "pagina": 3, "contenido": "Artículo de prueba del ejercicio médico."}


class CorpusTests(unittest.TestCase):
    def test_detecta_tildes_frases_y_limites_sin_activar_todo(self):
        self.assertEqual(corpus.detectar_profesiones('MÉDICOS y policías', DOCUMENTOS),
                         ['Medicina', 'Seguridad ciudadana'])
        self.assertEqual(corpus.detectar_profesiones('sistema económico y metropolitano', DOCUMENTOS), [])
        self.assertEqual(corpus.detectar_profesiones('Planos de construcción', DOCUMENTOS), ['Arquitectura'])

    def test_nueva_profesion_sin_cambiar_detector(self):
        docs = [{"profesion": "Ingeniería", "alias": ['ingeniero civil', 'ingenieros civiles']}]
        self.assertEqual(corpus.detectar_profesiones('Solicito registro de ingenieros civiles', docs), ['Ingeniería'])
        self.assertEqual(corpus.detectar_profesiones('ingeniero civilizado', docs), [])

    def test_pdf_largo_incluye_mencion_profesional_al_final(self):
        texto = 'Texto general del proyecto. ' * 2000 + 'Los médicos deben registrar su especialidad.'
        resumen = corpus.extracto_relevante(texto, DOCUMENTOS)
        self.assertIn('registrar su especialidad', resumen)
        self.assertLessEqual(len(resumen), 18000)

    def test_chat_recibe_documento_y_citas_y_devuelve_logo_jpg(self):
        arbol = ast.parse(Path('sma_unified/agents/multiagente_ciudadano.py').read_text(encoding='utf-8'))
        funcion = next(n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name == 'responder_ciudadano')
        agente = {'id':'salud', 'nombre':'Salud', 'logo':'emoji antiguo', 'system_prompt':'Orientación en salud',
                  'temperature':.2, 'max_tokens':1024, 'top_p':1}
        llm = Mock(return_value=('Respuesta fundamentada [R1]', 'modelo'))
        ambiente = dict(vars(typing), time=time, logger=Mock(),
            listar_agentes=Mock(return_value=[agente]), elegir_agente=Mock(return_value=agente),
            _publicar_mongo=Mock(return_value='traza'), _cerrar_mongo=Mock(),
            recuperar=Mock(return_value=[FUENTE]), contexto_fuentes=corpus.contexto_fuentes,
            fuentes_publicas=corpus.fuentes_publicas, INSTRUCCION_PROFESIONAL=corpus.INSTRUCCION_PROFESIONAL,
            LOGO=corpus.LOGO, chat_completion_resiliente=llm)
        exec(compile(ast.Module(body=[funcion], type_ignores=[]), '<chat real>', 'exec'), ambiente)
        analisis = {'estado':'COMPLETADO','informe':'Respuesta profesional [R1]',
                    'profesiones':['Medicina'],'facetas':[{'profesion':'Medicina'}],
                    'fuentes':corpus.fuentes_publicas([FUENTE]),'modelo_selector':'modelo'}
        with patch.object(sem,'analizar_multifaceta',return_value=analisis) as ejecutar:
            res = ambiente['responder_ciudadano']('¿Qué requisitos hay para médicos?', caso_texto='Documento médico')
        self.assertEqual(res['fuentes'][0]['pagina'], 3)
        self.assertTrue(res['agente_logo'].endswith('.jpg'))
        self.assertEqual(res['facetas'],analisis['facetas'])
        ejecutar.assert_called_once()
        self.assertEqual(ejecutar.call_args.args[0],'Documento médico')
        llm.assert_not_called()

    def test_fragmentos_conservan_texto_y_pagina_no_vacia(self):
        texto = ' '.join(f'palabra{i}' for i in range(900))
        bloques = list(corpus.fragmentar(texto))
        self.assertGreater(len(bloques), 2)
        self.assertTrue(all(len(b) <= 1600 for b in bloques))
        self.assertTrue(set(texto.split()).issubset(set(' '.join(bloques).split())))
        self.assertEqual(list(corpus.fragmentar(' \x00  ')), [])

    def test_consulta_parametrizada_y_balanceada_por_profesion(self):
        cursor = Mock()
        cursor.fetchall.return_value = [tuple(FUENTE[k] for k in ('id','profesion','titulo','archivo','pagina','contenido'))]
        conn = Mock()
        conn.cursor.return_value.__enter__ = Mock(return_value=cursor)
        conn.cursor.return_value.__exit__ = Mock()
        with patch.object(corpus, 'catalogo', return_value=DOCUMENTOS), patch.object(corpus, '_conexion', return_value=conn):
            fuentes = corpus.recuperar_lexico("médicos y policía '; DROP TABLE x; --")
        sql, params = cursor.execute.call_args.args
        self.assertNotIn('DROP TABLE x', sql)
        self.assertIn('PARTITION BY profesion', sql)
        self.assertEqual(params[2], ['Medicina', 'Seguridad ciudadana'])
        self.assertEqual(fuentes[0]['pagina'], 3)
        self.assertEqual(corpus.fuentes_publicas(fuentes)[0]['referencia'], 'R1')
        self.assertNotIn('contenido', corpus.fuentes_publicas(fuentes)[0])

    def test_sin_relacion_no_invoca_modelos(self):
        with patch.object(sem, 'seleccionar_facetas', return_value={'estado':'NO_APLICA','facetas':[],'fuentes':[]}), patch.object(corpus, 'recuperar') as recuperar:
            res = corpus.analizar_documento('Solicitud de luminarias para mi calle')
        self.assertEqual(res['estado'], 'NO_APLICA')
        recuperar.assert_not_called()

    def test_falla_de_bd_o_corpus_vacio_queda_pendiente(self):
        for resultado in ([], RuntimeError('BD no disponible')):
            with self.subTest(resultado=resultado):
                kwargs = {'side_effect': resultado} if isinstance(resultado, Exception) else {'return_value': resultado}
                with patch.object(sem, 'seleccionar_facetas', side_effect=RuntimeError('Corpus no disponible')):
                    self.assertEqual(corpus.analizar_documento('médicos')['estado'], 'PENDIENTE_REVISION')

    def test_informe_trazado_con_fuentes_sin_afirmar_verificacion(self):
        llm = ModuleType('sma_unified.agents.llm_client')
        llm.chat_completion_resiliente = Mock(return_value=('Fundamento [R1]', 'modelo-prueba'))
        llm.chat_completion_auditoria = llm.chat_completion_resiliente
        chat = ModuleType('sma_unified.agents.multiagente_ciudadano')
        chat._publicar_mongo = Mock(return_value='tarea')
        chat._cerrar_mongo = Mock()
        plan={'estado':'PLANIFICADO','facetas':[{'profesion':'Medicina','motivo':'Prueba'}],
              'fuentes':[{**FUENTE,'evidencia_documento':'Proyecto relativo al ejercicio de médicos'}],
              'modelo_selector':'modelo','modelo_embedding':'embed','cobertura_parcial':False}
        with patch.dict(sys.modules, {llm.__name__: llm, chat.__name__: chat}), \
                patch.object(sem, 'seleccionar_facetas', return_value=plan):
            res = corpus.analizar_documento('Proyecto relativo al ejercicio de médicos', sesion_id='s')
        self.assertEqual(res['estado'], 'COMPLETADO')
        self.assertEqual(res['fuentes'][0]['pagina'], 3)
        self.assertIn('NO_VERIFICADA', res['caracter'])
        chat._cerrar_mongo.assert_called_once()
        mensajes = llm.chat_completion_resiliente.call_args.kwargs['messages']
        self.assertIn('[R1]', mensajes[1]['content'])
        self.assertIn(FUENTE['contenido'], mensajes[1]['content'])

    def test_concentrador_integra_informe_en_sintesis_pdf_y_expediente(self):
        arbol = ast.parse(Path('sma_unified/agents/concentrador.py').read_text(encoding='utf-8'))
        clase = next(n for n in arbol.body if isinstance(n, ast.ClassDef) and n.name == 'AgenteConcentrador')
        sintetizar = Mock(return_value={'resumen_ejecutivo': 'Síntesis'})
        pdf = Mock(return_value={'filename': ''})
        ambiente = dict(vars(typing), time=time, logger=Mock(),
            _validar_insumo=lambda _: (True, 'OK'),
            _extraer_observaciones_de_insumo=lambda *args, **kwargs: [],
            _fusionar_redundancias=lambda _: ([], []),
            _calcular_riesgo_global=lambda _: 'BAJO',
            _analizar_con_pensamiento_ampliado_llm=sintetizar,
            generar_pdf_informe_concentrador=pdf,
            _persistir_en_mongo=Mock(), get_db=Mock())
        exec(compile(ast.Module(body=[clase], type_ignores=[]), '<Concentrador real>', 'exec'), ambiente)
        informe = {'estado': 'COMPLETADO', 'informe': 'Revisar requisitos [R1]', 'fuentes': []}
        with patch.object(corpus, 'analizar_documento', return_value=informe) as analizar:
            res = ambiente['AgenteConcentrador']().ejecutar(
                [{'agente_origen': 'Consistencia', 'hallazgos': []}],
                {'titulo': 'Médicos', 'texto_proyecto': 'Texto íntegro', 'notificar_comision': False})
        analizar.assert_called_once_with('Texto íntegro', titulo='Médicos', sesion_id=None)
        self.assertEqual(res['informe_profesional'], informe)
        self.assertEqual(res['expediente_consolidado']['informe_profesional'], informe)
        self.assertEqual(pdf.call_args.kwargs['informe_profesional'], informe)
        self.assertEqual(sintetizar.call_args.kwargs['proyecto_info']['informe_profesional'], informe)
        self.assertEqual(res['expediente_consolidado']['nivel_riesgo_general'], 'BAJO')


if __name__ == '__main__':
    unittest.main()
