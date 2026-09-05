# sma_unified/db/neon_client.py

import psycopg2
from psycopg2.extras import RealDictCursor, Json
from psycopg2.pool import SimpleConnectionPool
from typing import Dict, Any, Optional, List
import os
from dotenv import load_dotenv
import json

load_dotenv()

class NeonDBClient:
    """Cliente para PostgreSQL Neon con pool de conexiones y soporte pgvector"""
    
    def __init__(self, min_conn: int = 1, max_conn: int = 10):
        self.database_url = os.getenv("NEON_DATABASE_URL")
        self.pool = None
        self._crear_pool(min_conn, max_conn)
    
    def _crear_pool(self, min_conn: int, max_conn: int):
        """Crear pool de conexiones"""
        try:
            self.pool = SimpleConnectionPool(
                min_conn,
                max_conn,
                self.database_url
            )
        except Exception as e:
            print(f"Error creando pool Neon: {e}")
            raise
    
    def get_connection(self):
        """Obtener conexión del pool"""
        return self.pool.getconn()
    
    def return_connection(self, conn):
        """Devolver conexión al pool"""
        self.pool.putconn(conn)
    
    def ejecutar_query(self, query: str, params: tuple = None, fetch: bool = True) -> List[Dict]:
        """Ejecutar query y retornar resultados como diccionarios"""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                if fetch:
                    return [dict(r) for r in cur.fetchall()]
                conn.commit()
                return []
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                self.return_connection(conn)
    
    def ejecutar_transaccion(self, queries: List[tuple]) -> List[List[Dict]]:
        """Ejecutar múltiples queries en una sola transacción atómica"""
        conn = None
        resultados = []
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                for query, params in queries:
                    cur.execute(query, params)
                    if cur.description:
                        resultados.append([dict(r) for r in cur.fetchall()])
                    else:
                        resultados.append([])
                conn.commit()
            return resultados
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                self.return_connection(conn)
    
    def insertar_proyecto(self, data: Dict) -> int:
        """Insertar un nuevo proyecto de ley"""
        query = """
            INSERT INTO sistema.proyecto_ley (
                id_expediente, numero_expediente, tipo_documento, titulo_proyecto, titulo,
                descripcion_corta, contenido_texto, texto_completo, estado_actual,
                usuario_ingreso, agente_distribuidor_decision
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id_proyecto
        """
        exp_id = data.get('id_expediente') or f"EXP-{int(os.times().elapsed * 1000)}"
        titulo = data.get('titulo_proyecto') or data.get('titulo', 'Sin título')
        texto = data.get('contenido_texto') or data.get('texto', '')
        params = (
            exp_id,
            exp_id,
            data.get('tipo_documento', 'Proyecto_Ley'),
            titulo,
            titulo,
            data.get('descripcion_corta', ''),
            texto,
            texto,
            data.get('estado_actual', 'INGRESADO'),
            data.get('usuario_ingreso', 'system'),
            Json(data.get('agente_distribuidor_decision', {}))
        )
        result = self.ejecutar_query(query, params)
        return result[0]['id_proyecto'] if result else None
    
    def actualizar_estado_proyecto(self, id_proyecto: int, nuevo_estado: str, 
                                   agente_responsable: str = None) -> bool:
        """Actualizar estado de un proyecto en sistema.proyecto_ley"""
        query = """
            UPDATE sistema.proyecto_ley 
            SET estado_actual = %s,
                estado_tramite = %s,
                fecha_ultima_modificacion = CURRENT_TIMESTAMP,
                usuario_ultima_modificacion = %s
            WHERE id_proyecto = %s
        """
        params = (nuevo_estado, nuevo_estado, agente_responsable or 'system', id_proyecto)
        self.ejecutar_query(query, params, fetch=False)
        return True
    
    def insertar_observacion(self, id_proyecto: int, tipo_obs: str, agente: str, 
                             hallazgos: Dict, riesgo: str = 'MEDIO', 
                             articulos_afectados: List = None, recomendacion: str = "") -> int:
        """Registrar una observación generada por un agente"""
        query = """
            INSERT INTO sistema.observaciones_unificadas (
                id_proyecto, tipo_observacion, agente_generador, hallazgos,
                articulos_afectados, riesgo_normativo, recomendacion
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        params = (
            id_proyecto,
            tipo_obs,
            agente,
            Json(hallazgos or {}),
            Json(articulos_afectados or []),
            riesgo,
            recomendacion
        )
        result = self.ejecutar_query(query, params)
        return result[0]['id'] if result else None

    def registrar_bitacora(self, id_proyecto: int, evento: str, detalle: Dict = None,
                           agente: str = None, usuario: str = "system",
                           estado_previo: str = None, estado_nuevo: str = None) -> int:
        """Registrar un evento en la bitácora transaccional"""
        query = """
            INSERT INTO sistema.bitacora_proceso (
                id_proyecto, evento, detalle, agente_responsable, usuario_responsable,
                estado_previo, estado_nuevo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id_bitacora
        """
        params = (
            id_proyecto,
            evento,
            Json(detalle or {}),
            agente,
            usuario,
            estado_previo,
            estado_nuevo
        )
        result = self.ejecutar_query(query, params)
        return result[0]['id_bitacora'] if result else None

    def registrar_paso(self, id_proyecto: int, num_paso: int, nombre_paso: str,
                        agente: str, estado: str = 'COMPLETADO', resultado: Dict = None,
                        duracion_s: int = 0) -> int:
        """Registrar ejecución de un paso del proceso"""
        query = """
            INSERT INTO sistema.pasos_proceso (
                id_proyecto, num_paso, nombre_paso, agente_responsable, estado_paso,
                resultado, duracion_segundos, timestamp_inicio, timestamp_fin
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
        """
        params = (
            id_proyecto,
            num_paso,
            nombre_paso,
            agente,
            estado,
            Json(resultado or {}),
            duracion_s
        )
        result = self.ejecutar_query(query, params)
        return result[0]['id'] if result else None

    def registrar_ejecucion_agente(self, id_proyecto: int, nombre_agente: str,
                                   input_data: Dict, output_data: Dict,
                                   estado: str = 'EXITO', tiempo_ms: int = 0) -> int:
        """Registrar métricas y resultados de ejecución de un agente"""
        query = """
            INSERT INTO sistema.ejecuciones_agente (
                id_proyecto, nombre_agente, input_data, output_data, estado, tiempo_ejecucion_ms
            ) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        params = (
            id_proyecto,
            nombre_agente,
            Json(input_data or {}),
            Json(output_data or {}),
            estado,
            tiempo_ms
        )
        result = self.ejecutar_query(query, params)
        return result[0]['id'] if result else None

    def close(self):
        """Cerrar pool de conexiones"""
        if self.pool:
            self.pool.closeall()

_neon_client_instance = None

def get_neon_client() -> NeonDBClient:
    global _neon_client_instance
    if _neon_client_instance is None:
        _neon_client_instance = NeonDBClient()
    return _neon_client_instance
