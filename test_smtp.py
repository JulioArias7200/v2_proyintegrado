"""Regresiones SMTP sin conexiones ni correos reales."""
import smtplib
import ssl
from types import SimpleNamespace
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from unittest.mock import Mock
import unittest
from test_auditoria_timeouts import cargar_funcion


class SMTPTests(unittest.TestCase):
    def cargar(self, conexiones):
        fabrica = Mock(side_effect=conexiones)
        funcion = cargar_funcion('notificador_comision.py', 'enviar_correo_gmail_smtp', {
            'os': SimpleNamespace(getenv=lambda key, default=None: {
                'GMAIL_USER': 'prueba@example.invalid', 'GMAIL_APP_PASSWORD': 'prueba',
            }.get(key, default)),
            'smtplib': SimpleNamespace(SMTP=fabrica, SMTP_SSL=fabrica,
                SMTPServerDisconnected=smtplib.SMTPServerDisconnected,
                SMTPAuthenticationError=smtplib.SMTPAuthenticationError),
            'ssl': ssl,
            'MIMEMultipart': MIMEMultipart, 'MIMEText': MIMEText, 'MIMEApplication': MIMEApplication,
            '_resolver_ruta_adjunto': Mock(return_value=None), 'logger': Mock(),
        })
        return funcion, fabrica

    def conexion(self):
        server = Mock()
        server.sendmail.return_value = {}
        return server

    def test_quit_desconectado_no_oculta_envio_aceptado(self):
        server = self.conexion()
        server.quit.side_effect = smtplib.SMTPServerDisconnected('please run connect() first')
        enviar, _ = self.cargar([server])
        resultado = enviar('Asunto', ['destino@example.invalid'], '<p>Prueba</p>')
        self.assertTrue(resultado['enviado'])
        self.assertEqual(resultado['total_enviados'], 1)

    def test_conexion_nueva_para_cada_destinatario(self):
        a, b = self.conexion(), self.conexion()
        enviar, fabrica = self.cargar([a, b])
        resultado = enviar('Asunto', ['uno@example.invalid', 'dos@example.invalid'], 'Texto')
        self.assertEqual(resultado['total_enviados'], 2)
        self.assertEqual(fabrica.call_count, 2)
        self.assertEqual(a.sendmail.call_count, 1)
        self.assertEqual(b.sendmail.call_count, 1)

    def test_reconecta_si_falla_antes_de_enviar(self):
        a, b = self.conexion(), self.conexion()
        a.login.side_effect = smtplib.SMTPServerDisconnected('Server not connected')
        enviar, fabrica = self.cargar([a, b])
        self.assertTrue(enviar('Asunto', ['uno@example.invalid'], 'Texto')['enviado'])
        self.assertEqual(fabrica.call_count, 2)
        a.sendmail.assert_not_called()
        b.sendmail.assert_called_once()
        self.assertEqual(fabrica.call_args_list[0].args[1], 465)
        self.assertEqual(fabrica.call_args_list[1].args[1], 587)
        b.starttls.assert_called_once()

    def test_error_autenticacion_no_prueba_otro_transporte(self):
        server = self.conexion()
        server.login.side_effect = smtplib.SMTPAuthenticationError(535, b'Credenciales invalidas')
        enviar, fabrica = self.cargar([server])
        resultado = enviar('Asunto', ['uno@example.invalid'], 'Texto')
        self.assertFalse(resultado['enviado'])
        self.assertIn('autenticar puerto 465', resultado['error'])
        self.assertEqual(fabrica.call_count, 1)

    def test_no_reintenta_envio_ambiguo(self):
        server = self.conexion()
        server.sendmail.side_effect = smtplib.SMTPServerDisconnected('Conexion cerrada durante DATA')
        enviar, fabrica = self.cargar([server])
        resultado = enviar('Asunto', ['uno@example.invalid'], 'Texto')
        self.assertFalse(resultado['enviado'])
        self.assertIn('Conexion cerrada', resultado['error'])
        self.assertEqual(fabrica.call_count, 1)

    def test_sin_proveedores_no_simula_exito(self):
        funcion = cargar_funcion('notificador_comision.py', 'enviar_correo_hibrido', {
            'os': SimpleNamespace(getenv=lambda key, default=None: default),
            'SENDGRID_AVAILABLE': False,
        })
        self.assertFalse(funcion('Asunto', ['uno@example.invalid'], 'Texto')['enviado'])


if __name__ == '__main__':
    unittest.main()
