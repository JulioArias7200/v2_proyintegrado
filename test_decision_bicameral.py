"""Valida el método real de decisión sin dependencias ni servicios externos."""
import ast
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import unittest


fuente = ast.parse(Path('sma_unified/db/neon_client.py').read_text(encoding='utf-8'))
clase = next(n for n in fuente.body if isinstance(n, ast.ClassDef) and n.name == 'NeonDBClient')
metodo = next(n for n in clase.body if isinstance(n, ast.FunctionDef) and n.name == 'registrar_decision_bicameral')
metodo.body = [n for n in metodo.body if not isinstance(n, (ast.Import, ast.ImportFrom))]


class DecisionTests(unittest.TestCase):
    def preparar(self, observaciones=True):
        espacio = {
            'load_control_aprobacion': lambda: {'roles_permitidos': ['Diputado']},
            'evaluar_bicameral': lambda *args: {
                'puede_aprobar': not observaciones,
                'verificaciones_normativas': [{'requisito': 'Insumos', 'estado': 'NO_VERIFICABLE'}]
                if observaciones else [{'requisito': 'Insumos', 'estado': 'CUMPLE'}],
            }, 'datetime': datetime, 'timezone': timezone,
        }
        exec(compile(ast.Module(body=[metodo], type_ignores=[]), '<decision real>', 'exec'), espacio)
        class DB:
            registrar = espacio['registrar_decision_bicameral']
            @contextmanager
            def _proyecto_bloqueado(self, _):
                yield None, {}
            def _ultimo_registro(self, _, proyecto, tipo):
                if tipo == 'REVISION_BICAMERAL':
                    return {'id': 1, 'hallazgos': {'ciclo_bicameral': {
                        'version_revision': 'v', 'acta_secretario': {}, 'expediente_consolidado': {},
                        'version_original': {}, 'version_retornada': {}, 'hash_texto_sancionado': 'hash',
                    }}}
            def _validar_revision_vigente(self, *args):
                return {'insumos_vigentes': True}
            def _insertar_registro(self, _, proyecto, tipo, decision, origen):
                self.guardado = decision
            def _estado_revision(self, *args):
                pass
        return DB()

    def decidir(self, db, rol='Diputado', confirmado=True):
        return db.registrar(1, 1, 'v', 'APROBAR', 'Decisión del revisor',
                            {'rol': rol, 'usuario_id': 2, 'nombre_completo': 'Revisor'}, confirmado)

    def test_aprobar_con_observaciones_conserva_evidencia(self):
        db = self.preparar()
        resultado = self.decidir(db)
        self.assertEqual(resultado['accion'], 'APROBAR')
        self.assertTrue(resultado['aprobado_con_observaciones'])
        self.assertEqual(db.guardado['observaciones_al_decidir'][0]['estado'], 'NO_VERIFICABLE')

    def test_aprobar_sin_observaciones(self):
        resultado = self.decidir(self.preparar(False))
        self.assertFalse(resultado['aprobado_con_observaciones'])
        self.assertEqual(resultado['observaciones_al_decidir'], [])

    def test_mantiene_rol_y_confirmacion(self):
        with self.assertRaises(PermissionError):
            self.decidir(self.preparar(), rol='Ciudadano')
        with self.assertRaises(ValueError):
            self.decidir(self.preparar(), confirmado=False)


if __name__ == '__main__':
    unittest.main()
