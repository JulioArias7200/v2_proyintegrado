"""Regresiones de la revisión humana. No llama modelos ni escribe bases externas.

Ejecutar: python -m unittest test_control_legislativo -v
"""
import ast
import copy
import importlib
import secrets
import sys
import threading
import time
import types
import unittest
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Optional, Literal
from unittest.mock import Mock, patch

from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

# Los __init__ del proyecto arrancan Reflex e importan todos los proveedores.
# Aislar ese arranque permite probar los módulos reales sin conectar servicios.
_paquetes = {}
for _nombre, _carpeta in (("sma_unified", "sma_unified"), ("sma_unified.agents", "sma_unified/agents"), ("sma_unified.db", "sma_unified/db")):
    _paquete = types.ModuleType(_nombre)
    _paquete.__path__ = [str(Path(__file__).resolve().parent / _carpeta)]
    _paquetes[_nombre] = _paquete
_aislamiento = patch.dict(sys.modules, _paquetes)
_aislamiento.start()

from sma_unified.agents.control_legislativo import validar_acta, evaluar_bicameral, huella, articulos_del_texto
from sma_unified.db.neon_client import NeonDBClient


def tearDownModule():
    _aislamiento.stop()

TEXTO = "Artículo 1. Objeto.\nSe aplica conforme al art. 163 CPE.\nArtículo 2. Alcance."
USUARIO = {"usuario_id": 7, "nombre_completo": "Revisor de prueba", "rol": "Senador", "activo": True}


def acta(camara="DIPUTADOS", texto=TEXTO):
    presentes, favor = (100, 60) if camara == "DIPUTADOS" else (30, 20)
    votos = {"favor": favor, "contra": presentes - favor, "abstenciones": 0}
    return {"tipo_procedimiento": "LEY_ORDINARIA", "camara": camara, "fecha": "2026-10-01", "sesion_numero": "14",
            "referencia_acta": "ACTA-" + camara, "texto_aprobado": texto,
            "quorum_legal": {"presentes": presentes}, "votacion_en_grande": votos,
            "votacion_en_detalle": [{**votos, "articulo": n} for n in articulos_del_texto(texto)],
            "intervenciones": [{"legislador": "A", "contenido": "Conservar cita literal."}],
            "mociones": [{"tipo": "ORDEN", "resultado": "APROBADA"}]}


def expediente():
    return {"estado": "CONSOLIDADO_COMPLETADO", "resumen_ejecutivo": "Informes revisados",
            "nivel_riesgo_general": "BAJO", "insumos_no_validos": [], "observaciones_pendientes": [],
            "informes_factibilidad": [{"agente_origen": "Presupuesto", "estado": "EVALUADO",
                                      "viabilidad": "SOSTENIBLE", "contenido": "Informe fiscal documental"}]}


class MemoriaNeon(NeonDBClient):
    """Ejecuta los métodos transaccionales reales sobre un cursor con almacenamiento local."""
    def __init__(self):
        self.proyecto = {"id_proyecto": 4, "texto": TEXTO, "estado_actual": "INGRESADO"}
        self.registros = []
        self.commits = self.rollbacks = self.devueltas = 0
        self.fallar_estado = False

    def get_connection(self):
        self.snapshot = copy.deepcopy((self.proyecto, self.registros))
        return self

    def return_connection(self, conn):
        self.devueltas += 1

    def cursor(self, **kwargs):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1
        self.proyecto, self.registros = self.snapshot

    def execute(self, query, params):
        if query.startswith("SELECT id_proyecto"):
            self.row = copy.deepcopy(self.proyecto) if params[0] == 4 else None
        elif query.startswith("SELECT id, hallazgos"):
            filas = [r for r in self.registros if r["tipo"] == params[1]]
            self.row = copy.deepcopy(filas[-1]) if filas else None
        elif query.startswith("INSERT INTO sistema.observaciones_unificadas"):
            self.row = {"id": len(self.registros) + 1}
            self.registros.append({**self.row, "tipo": params[1], "hallazgos": copy.deepcopy(params[3].adapted)})
        elif query.startswith("UPDATE sistema.proyecto_ley"):
            if self.fallar_estado:
                raise RuntimeError("Falla de persistencia simulada")
            self.proyecto["estado_actual"] = params[0]
            self.rowcount = 1
        else:
            raise AssertionError("Consulta inesperada: " + query)

    def fetchone(self):
        return self.row

    def preparar_revision(self):
        self.guardar_insumo_legislativo(4, "ACTA_DEBATE", {"acta_debate": acta()}, "Secretario", "EN_TRAMITE_BICAMERAL")
        self.guardar_insumo_legislativo(4, "EXPEDIENTE_CONSOLIDADO", {"expediente_consolidado": expediente()}, "Concentrador", "LISTO_PARA_DEBATE")
        anteriores = self.obtener_antecedentes_bicamerales(4)
        ciclo = evaluar_bicameral(acta(), expediente(), {"texto": TEXTO}, {"texto": TEXTO, "acta_revision": acta("SENADORES")})
        ciclo.update({**{k: anteriores[k] for k in ("referencias_insumos", "hash_documento")},
                      "version_original": {"texto": TEXTO}, "version_retornada": {"texto": TEXTO, "acta_revision": acta("SENADORES")}})
        ciclo["version_revision"] = huella(ciclo)
        resultado = {"ciclo_bicameral": ciclo}
        identificador = self.guardar_revision_bicameral(4, resultado)
        ciclo["id_revision"] = identificador
        return ciclo

    def decidir(self, ciclo, accion="APROBAR", motivo="", usuario=None):
        return self.registrar_decision_bicameral(4, ciclo["id_revision"], ciclo["version_revision"], accion, motivo, usuario or USUARIO, True)


@contextmanager
def modulo_agente(nombre):
    # Aislar proveedores; el código del agente y del control se ejecuta sin sustitución.
    crew = types.ModuleType("crewai")
    crew.Task = Mock
    base = types.ModuleType("sma_unified.agents.base_agent")
    base.get_base_agent = Mock()
    base.BaseAgenteLegislativo = Mock
    llm = types.ModuleType("sma_unified.agents.llm_client")
    llm.chat_completion_resiliente = Mock(side_effect=RuntimeError("Modelo no disponible"))
    llm.extraer_json_de_llm = Mock()
    mongo = types.ModuleType("sma_unified.db.cosmos_client")
    mongo.registrar_traza_legislativa = Mock()
    mongo.CosmosDBClient = Mock
    mock_notificador = types.ModuleType("sma_unified.agents.notificador_comision")
    mock_notificador.notificar_miembros_comision = Mock(return_value={"exito": True})
    mock_openai = types.ModuleType("openai")
    mock_openai.OpenAI = Mock(side_effect=RuntimeError("OpenAI no disponible"))
    nombre_completo = "sma_unified.agents." + nombre
    with patch.dict(sys.modules, {"crewai": crew, "openai": mock_openai, "sma_unified.agents.base_agent": base,
                                  "sma_unified.agents.llm_client": llm, "sma_unified.db.cosmos_client": mongo,
                                  "sma_unified.agents.notificador_comision": mock_notificador}):
        anterior = sys.modules.pop(nombre_completo, None)
        try:
            yield importlib.import_module(nombre_completo), llm
        finally:
            sys.modules.pop(nombre_completo, None)
            if anterior:
                sys.modules[nombre_completo] = anterior


class ActasTest(unittest.TestCase):
    def test_conserva_texto_intervenciones_y_computa_ambas_camaras(self):
        for camara in ("DIPUTADOS", "SENADORES"):
            original = acta(camara)
            resultado = validar_acta(original)
            self.assertEqual(resultado["resultado_final"], "APROBADO_EN_GRANDE_Y_DETALLE")
            self.assertEqual(resultado["intervenciones"], original["intervenciones"])
            self.assertEqual(resultado["texto_aprobado"], TEXTO)
            self.assertNotIn("faltantes", original)

    def test_sin_evidencia_no_inventa_votos(self):
        resultado = validar_acta({})
        self.assertEqual(resultado["resultado_final"], "PENDIENTE_DATOS")
        self.assertNotIn("favor", resultado["votacion_en_grande"])

    def test_no_cuenta_referencias_normativas_como_articulos(self):
        self.assertEqual(articulos_del_texto(TEXTO), ["1", "2"])
        self.assertEqual(articulos_del_texto(TEXTO + "\nArtículo 163 de la CPE establece el procedimiento."), ["1", "2"])

    def test_conteos_y_quorum_invalidos_bloquean(self):
        for numero in (-1, True, "muchos", "²", 101):
            registro = acta()
            registro["votacion_en_grande"]["favor"] = numero
            self.assertEqual(validar_acta(registro)["resultado_final"], "PENDIENTE_DATOS")
        registro = acta()
        registro["quorum_legal"]["presentes"] = 65
        self.assertEqual(validar_acta(registro)["resultado_final"], "PENDIENTE_DATOS")

    def test_no_acepta_total_declarado_inconsistente(self):
        registro = acta()
        registro["votacion_en_grande"]["total_votantes"] = 99
        self.assertEqual(validar_acta(registro)["resultado_final"], "PENDIENTE_DATOS")

    def test_mayoria_se_calcula_con_presentes(self):
        registro = acta()
        registro["votacion_en_grande"] = {"favor": 50, "contra": 50, "abstenciones": 0}
        self.assertEqual(validar_acta(registro)["resultado_final"], "RECHAZADO_EN_ORIGEN")

    def test_detalle_incompleto_o_duplicado_bloquea(self):
        registro = acta()
        registro["votacion_en_detalle"].pop()
        self.assertEqual(validar_acta(registro)["resultado_final"], "PENDIENTE_DATOS")
        registro = acta()
        registro["votacion_en_detalle"].append(registro["votacion_en_detalle"][0])
        self.assertEqual(validar_acta(registro)["resultado_final"], "PENDIENTE_DATOS")

    def test_reforma_constitucional_no_se_aprueba_como_ordinaria(self):
        registro = acta()
        registro["tipo_procedimiento"] = "REFORMA_CONSTITUCIONAL"
        self.assertEqual(validar_acta(registro)["resultado_final"], "PENDIENTE_DATOS")
        self.assertEqual(validar_acta(registro)["votacion_en_grande"]["resultado"], "NO_VERIFICABLE")


class BicameralTest(unittest.TestCase):
    def evaluar(self, revisora=None, exp=None):
        return evaluar_bicameral(acta(), exp or expediente(), {"texto": TEXTO}, revisora or {"texto": TEXTO, "acta_revision": acta("SENADORES")})

    def test_mismo_texto_sin_acta_revisora_no_presume_aprobacion(self):
        self.assertFalse(self.evaluar({"texto": TEXTO})["puede_aprobar"])

    def test_camaras_iguales_bloquean(self):
        self.assertFalse(self.evaluar({"texto": TEXTO, "acta_revision": acta()})["puede_aprobar"])

    def test_enmienda_incluso_menor_exige_aceptacion(self):
        texto = TEXTO.replace("Objeto.", "Objeto de la ley.")
        version = {"texto": texto, "acta_revision": acta("SENADORES", texto)}
        self.assertFalse(self.evaluar(version)["puede_aprobar"])
        version["acta_aceptacion_enmiendas"] = acta("DIPUTADOS", texto)
        self.assertTrue(self.evaluar(version)["puede_aprobar"])

    def test_insumo_pendiente_o_factibilidad_insuficiente_bloquean(self):
        exp = expediente()
        exp["observaciones_pendientes"] = [{"cita_original": "Pendiente"}]
        self.assertFalse(self.evaluar(exp=exp)["puede_aprobar"])
        exp = expediente()
        exp["informes_factibilidad"][0]["viabilidad"] = "INSOSTENIBLE"
        self.assertFalse(self.evaluar(exp=exp)["puede_aprobar"])

    def test_versiones_mal_formadas_se_rechazan(self):
        with self.assertRaises(ValueError):
            self.evaluar({"texto": 1})


class PersistenciaTest(unittest.TestCase):
    def setUp(self):
        self.db = MemoriaNeon()
        self.ciclo = self.db.preparar_revision()

    def test_aprobacion_persistida_identifica_humano_y_es_idempotente(self):
        decision = self.db.decidir(self.ciclo)
        cantidad = len(self.db.registros)
        self.assertEqual(self.db.decidir(self.ciclo), decision)
        self.assertEqual(len(self.db.registros), cantidad)
        vigente = self.db.obtener_revision_bicameral(4)
        self.assertTrue(vigente["puede_continuar"])
        self.assertEqual(vigente["ciclo_bicameral"]["aprobacion_humana"]["usuario_id"], 7)
        self.assertTrue(decision["confirmacion_exigencias"])

    def test_usuario_sin_permiso_y_sin_confirmacion_no_aprueban(self):
        with self.assertRaises(PermissionError):
            self.db.decidir(self.ciclo, usuario={**USUARIO, "rol": "Ciudadano"})
        with self.assertRaises(ValueError):
            self.db.registrar_decision_bicameral(4, self.ciclo["id_revision"], self.ciclo["version_revision"], "APROBAR", "", USUARIO)

    def test_revision_exige_motivo_y_no_permite_continuar(self):
        with self.assertRaises(ValueError):
            self.db.decidir(self.ciclo, "MANDAR_A_REVISION")
        self.db.decidir(self.ciclo, "MANDAR_A_REVISION", "Falta documentación fiscal")
        with self.assertRaises(ValueError):
            self.db.obtener_aprobacion_bicameral(4)

    def test_cambiar_documento_o_acta_invalida_revision(self):
        self.db.proyecto["texto"] += "\nTexto nuevo"
        with self.assertRaises(ValueError):
            self.db.decidir(self.ciclo)
        self.db.proyecto["texto"] = TEXTO
        self.db.guardar_insumo_legislativo(4, "ACTA_DEBATE", {"acta_debate": acta()}, "Secretario", "PENDIENTE_REVISION")
        with self.assertRaises(ValueError):
            self.db.decidir(self.ciclo)

    def test_version_o_id_antiguo_no_aprueba(self):
        with self.assertRaises(ValueError):
            self.db.registrar_decision_bicameral(4, self.ciclo["id_revision"], "0" * 64, "APROBAR", "", USUARIO, True)
        nuevo = self.db.preparar_revision()
        with self.assertRaises(ValueError):
            self.db.decidir(self.ciclo)
        self.db.decidir(nuevo)

    def test_antecedentes_de_documento_anterior_no_aprueban_nueva_revision(self):
        self.db.proyecto["texto"] += "\nDocumento actualizado"
        antecedentes = self.db.obtener_antecedentes_bicamerales(4)
        self.assertFalse(antecedentes["insumos_vigentes"])
        ciclo = copy.deepcopy(self.ciclo)
        ciclo["hash_documento"] = antecedentes["hash_documento"]
        ciclo["id_revision"] = self.db.guardar_revision_bicameral(4, {"ciclo_bicameral": ciclo})
        with self.assertRaises(ValueError):
            self.db.decidir(ciclo)

    def test_backend_recalcula_no_confia_en_puede_aprobar(self):
        guardado = self.db.registros[-1]["hallazgos"]["ciclo_bicameral"]
        guardado["acta_secretario"]["votacion_en_grande"]["favor"] = 0
        guardado["puede_aprobar"] = True
        with self.assertRaises(ValueError):
            self.db.decidir(self.ciclo)

    def test_estado_y_decision_se_revierten_juntos_si_falla_bd(self):
        antes = copy.deepcopy(self.db.registros)
        self.db.fallar_estado = True
        with self.assertRaises(RuntimeError):
            self.db.decidir(self.ciclo)
        self.assertEqual(self.db.registros, antes)
        self.assertGreater(self.db.rollbacks, 0)
        self.assertEqual(self.db.proyecto["estado_actual"], "PENDIENTE_APROBACION_HUMANA")

    def test_publicacion_exige_promulgacion_vigente(self):
        with self.assertRaises(ValueError):
            self.db.obtener_promulgacion_verificada(4)
        self.db.decidir(self.ciclo)
        with self.assertRaises(ValueError):
            self.db.obtener_promulgacion_verificada(4)
        ev = {"evaluacion_veto": {"decision": "PROMULGAR", "referencia_decision": "DOCUMENTO-1",
                                  "estado_siguiente": "PROMULGADO_DOCUMENTADO"}}
        self.db.guardar_evaluacion_ejecutiva(4, self.ciclo, ev, USUARIO)
        dato, texto = self.db.obtener_promulgacion_verificada(4)
        self.assertEqual(dato["evaluacion_veto"]["decision"], "PROMULGAR")
        self.assertEqual(texto, TEXTO)
        self.db.proyecto["texto"] = "Otra versión"
        with self.assertRaises(ValueError):
            self.db.obtener_promulgacion_verificada(4)

    def test_nueva_revision_invalida_decision_ejecutiva(self):
        self.db.decidir(self.ciclo)
        ev = {"evaluacion_veto": {"decision": "PROMULGAR", "referencia_decision": "DOC",
                                  "estado_siguiente": "PROMULGADO_DOCUMENTADO"}}
        self.db.guardar_evaluacion_ejecutiva(4, self.ciclo, ev, USUARIO)
        nuevo = self.db.preparar_revision()
        self.db.decidir(nuevo)
        with self.assertRaises(ValueError):
            self.db.obtener_promulgacion_verificada(4)


class AgentesTest(unittest.TestCase):
    def test_bicameral_usa_antecedentes_persistidos_y_espera_al_humano(self):
        db = MemoriaNeon()
        db.preparar_revision()
        with modulo_agente("bicameral") as (modulo, _):
            with patch.object(modulo, "get_neon_client", return_value=db):
                resultado = modulo.AgenteBicameral().ejecutar(
                    {"texto": TEXTO}, {"texto": TEXTO, "acta_revision": acta("SENADORES")}, {"id": 4},
                    acta_secretario={"referencia_acta": "ACTA-FALSA"}, expediente={"estado": "FALSO"})
        self.assertEqual(resultado["estado_ejecucion"], "PENDIENTE_APROBACION_HUMANA")
        self.assertFalse(resultado["puede_continuar"])
        self.assertTrue(resultado["ciclo_bicameral"]["puede_aprobar"])
        self.assertEqual(resultado["ciclo_bicameral"]["acta_secretario"]["referencia_acta"], "ACTA-DIPUTADOS")
        with self.assertRaises(ValueError):
            db.obtener_aprobacion_bicameral(4)

    def test_concentrador_conserva_no_verificados_y_no_pierde_citas_distintas(self):
        with modulo_agente("concentrador") as (modulo, _):
            insumo = {"agente_origen": "A", "hallazgos": [
                {"articulo": 1, "cita_original": "  Cita A  ", "riesgo": "ALTO", "verificado": False},
                {"articulo": 1, "cita_original": "Cita B", "riesgo": "MEDIO", "verificado": True}]}
            db = MemoriaNeon()
            with patch.object(modulo, "get_neon_client", return_value=db):
                resultado = modulo.AgenteConcentrador().ejecutar([insumo], {"id": 4})
            exp = resultado["expediente_consolidado"]
            self.assertEqual(len(exp["observaciones_integradas"]), 2)
            self.assertEqual(exp["observaciones_integradas"][0]["cita_original"], "  Cita A  ")
            self.assertEqual(len(exp["observaciones_pendientes"]), 2)
            self.assertEqual(db.registros[-1]["tipo"], "EXPEDIENTE_CONSOLIDADO")

    def test_confianza_invalida_no_se_ignora_y_reportes_vacios_son_validos(self):
        with modulo_agente("concentrador") as (modulo, _):
            for valor in ("NaN", "error", True, .6, 2):
                self.assertFalse(modulo._validar_insumo({"agente_origen": "A", "hallazgos": [], "confianza": valor})[0])
            self.assertTrue(modulo._validar_insumo({"agente_origen": "A", "hallazgos": []})[0])

    def test_error_de_bd_no_se_reporta_como_exito(self):
        with modulo_agente("secretario") as (modulo, _):
            db = Mock()
            db.guardar_insumo_legislativo.side_effect = RuntimeError("No disponible")
            with patch.object(modulo, "get_neon_client", return_value=db):
                with self.assertRaises(RuntimeError):
                    modulo.AgenteSecretarioCamara().ejecutar(acta(), {"id": 4})

    def test_modelo_no_puede_promulgar_ni_hacerlo_por_fallback(self):
        with modulo_agente("veto_promulgacion") as (modulo, llm):
            db = Mock()
            db.obtener_aprobacion_bicameral.return_value = {"id_revision": 1}
            with patch.object(modulo, "get_neon_client", return_value=db):
                agente = modulo.AgenteVetoPromulgacion()
                self.assertEqual(agente.ejecutar({}, {"id": 4})["evaluacion_veto"]["decision"], "PENDIENTE_DECISION_HUMANA")
                llm.chat_completion_resiliente.side_effect = None
                llm.chat_completion_resiliente.return_value = ("respuesta", "modelo")
                llm.extraer_json_de_llm.return_value = {"evaluacion_veto": {"decision": "PROMULGAR", "recomendacion_tecnica": {"dictamen_sugerido": "RECOMIENDA_PROMULGAR"}}}
                self.assertEqual(agente.ejecutar({}, {"id": 4})["evaluacion_veto"]["decision"], "PENDIENTE_DECISION_HUMANA")
                with self.assertRaises(ValueError):
                    agente.ejecutar({"decision_operador": "NO PROMULGAR"}, {"id": 4}, USUARIO)


class ApiRevisionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Cargar solamente las rutas reales de revisión evita el DDL y proveedores del arranque global.
        nombres = {"crear_sesion_revision", "usuario_revision", "proyecto_revision", "DecisionBicameralRequest",
                   "consultar_sesion_revision", "cerrar_sesion_revision", "consultar_revision_bicameral", "decidir_bicameral"}
        arbol = ast.parse(Path("server.py").read_text(encoding="utf-8"))
        seleccion = ast.Module(body=[n for n in arbol.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in nombres], type_ignores=[])
        cls.entorno = dict(globals(), app=FastAPI(), _SESIONES={}, _SESIONES_LOCK=threading.Lock(), _SESION_TTL=28800)
        exec(compile(seleccion, "server.py", "exec"), cls.entorno)
        cls.client = TestClient(cls.entorno["app"])

    def setUp(self):
        self.db = MemoriaNeon()
        self.ciclo = self.db.preparar_revision()
        self.patcher = patch("sma_unified.db.neon_client.get_neon_client", return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.db.ejecutar_query = Mock(return_value=[USUARIO])
        self.token = self.entorno["crear_sesion_revision"](USUARIO)
        self.headers = {"Authorization": "Bearer " + self.token}
        self.payload = {"id_proyecto": 4, "id_revision": self.ciclo["id_revision"],
                        "version_revision": self.ciclo["version_revision"], "accion": "APROBAR",
                        "confirmacion_exigencias": True}

    def test_sin_token_o_token_falso_no_aprueba(self):
        for headers in ({}, {"Authorization": "Bearer falso"}):
            self.assertEqual(self.client.post("/api/pipeline/decision_bicameral", json=self.payload, headers=headers).status_code, 401)

    def test_rol_del_cliente_no_suplanta_identidad_servidor(self):
        self.db.ejecutar_query.return_value = [{**USUARIO, "rol": "Ciudadano"}]
        self.payload["usuario"] = USUARIO
        self.assertEqual(self.client.post("/api/pipeline/decision_bicameral", json=self.payload, headers=self.headers).status_code, 403)

    def test_api_aprueba_y_recupera_decision_persistida(self):
        respuesta = self.client.post("/api/pipeline/decision_bicameral", json=self.payload, headers=self.headers)
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        dato = self.client.get("/api/pipeline/revision_bicameral/4", headers=self.headers).json()["data"]
        self.assertTrue(dato["puede_continuar"])
        self.assertEqual(dato["ciclo_bicameral"]["aprobacion_humana"]["usuario_id"], 7)

    def test_no_confirmar_o_usar_accion_invalida_se_rechaza(self):
        self.payload["confirmacion_exigencias"] = False
        self.assertEqual(self.client.post("/api/pipeline/decision_bicameral", json=self.payload, headers=self.headers).status_code, 400)
        self.payload["accion"] = "SANCION_DIRECTA"
        self.assertEqual(self.client.post("/api/pipeline/decision_bicameral", json=self.payload, headers=self.headers).status_code, 422)

    def test_logout_y_vencimiento_invalidan_token(self):
        self.client.post("/api/auth/logout", headers=self.headers)
        self.assertEqual(self.client.get("/api/auth/session", headers=self.headers).status_code, 401)
        token = self.entorno["crear_sesion_revision"](USUARIO)
        self.entorno["_SESIONES"][token]["vence"] = 0
        self.assertEqual(self.client.get("/api/auth/session", headers={"Authorization": "Bearer " + token}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
