"""Pruebas de despacho con proveedores simulados; no envían correos."""
from datetime import datetime
import time
import unittest
from unittest.mock import Mock
from test_auditoria_timeouts import cargar_funcion


class NotificacionTests(unittest.TestCase):
    def preparar(self, envio, destinatarios=True):
        enviar = Mock(return_value=envio)
        funcion = cargar_funcion('notificador_camara_opuesta.py', 'notificar_camara_opuesta', {
            '_CAMARA_OPUESTA': {'Diputado': 'Senador', 'Senador': 'Diputado'},
            'obtener_usuarios_por_rol': Mock(return_value=[{'correo_electronico': 'senado@example.invalid'}]
                                           if destinatarios else []),
            'publicar_mensaje': Mock(return_value='tarea'), 'marcar_en_proceso': Mock(),
            'marcar_completado': Mock(), 'marcar_error': Mock(),
            '_generar_html_confirmacion': Mock(return_value='<p>Prueba</p>'),
            'enviar_correo_hibrido': enviar, 'get_db': Mock(),
            'time': time, 'datetime': datetime, 'logger': Mock(),
        })
        return funcion, enviar

    def test_registro_local_no_equivale_a_correo_enviado(self):
        funcion, _ = self.preparar({'enviado': True, 'metodo': 'despacho_institucional_registrado'})
        with self.assertRaisesRegex(RuntimeError, 'no fue enviado'):
            funcion('Diputado', 'Proyecto')

    def test_envio_real_registra_camara_opuesta_y_adjuntos(self):
        funcion, enviar = self.preparar({'enviado': True, 'metodo': 'gmail_smtp'})
        resultado = funcion('Diputado', 'Proyecto', pdf_proyecto_filename='proyecto.pdf',
                            pdf_informe_filename='dictamen.pdf')
        self.assertEqual(resultado['status'], 'notificado')
        self.assertEqual(resultado['camara_destino'], 'Senador')
        self.assertEqual(enviar.call_args.kwargs['pdf_filenames'], ['proyecto.pdf', 'dictamen.pdf'])

    def test_sin_destinatarios_no_reporta_envio(self):
        funcion, enviar = self.preparar({}, False)
        self.assertEqual(funcion('Diputado', 'Proyecto')['status'], 'sin_destinatarios')
        enviar.assert_not_called()


if __name__ == '__main__':
    unittest.main()
