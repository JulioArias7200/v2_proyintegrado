"""
Script de Ejecución de Migración 004
Aplica DDL en PostgreSQL Neon y asegura índices en MongoDB Atlas.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Asegurar codificación utf-8 en salida estándar
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from sma_unified.db.neon_postgres import get_conn
from sma_unified.db.mongo_atlas import get_db

def ejecutar_migracion():
    print("=" * 70)
    print("EJECUTANDO MIGRACION 004: CIRCUITO BICAMERAL Y EJECUTIVO")
    print("=" * 70)

    # 1. PostgreSQL Neon
    sql_path = BASE_DIR / "migrations" / "004_mejoras_circuito_bicameral_ejecutivo.sql"
    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("\n1. Conectando a PostgreSQL Neon...")
    conn = get_conn()
    with conn.cursor() as cur:
        print("   Ejecutando sentencias DDL...")
        cur.execute(sql_content)
        conn.commit()
        print("   [OK] DDL ejecutado y confirmado (COMMIT exitoso).")

        # Verificación de columnas en sistema.proyecto_ley
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'sistema' AND table_name = 'proyecto_ley'
              AND column_name IN (
                'estado_bicameral', 'camara_origen', 'camara_revisora',
                'votos_origen', 'votos_revisora', 'informe_asesor_presidencial',
                'pliego_veto', 'decreto_promulgacion_ref'
              )
            ORDER BY column_name;
        """)
        cols = cur.fetchall()
        print("\n   Columnas verificadas en 'sistema.proyecto_ley':")
        for col, dtype in cols:
            print(f"     * {col} ({dtype})")

        # Verificación de tabla sistema.trazabilidad_devoluciones
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'sistema' AND table_name = 'trazabilidad_devoluciones'
            ORDER BY ordinal_position;
        """)
        cols_dev = cur.fetchall()
        print("\n   Tabla 'sistema.trazabilidad_devoluciones' verificada:")
        for col, dtype in cols_dev:
            print(f"     * {col} ({dtype})")

    # 2. MongoDB Atlas
    print("\n2. Conectando a MongoDB Atlas...")
    try:
        db = get_db()
        idx_res = db["actas_detalladas"].create_index(
            [("id_proyecto", 1), ("camara", 1)],
            name="idx_proyecto_camara"
        )
        print(f"   [OK] Indice en coleccion 'actas_detalladas' creado/verificado: {idx_res}")

        idx_msgs = db["agent_messages"].create_index(
            [("sesion_id", 1), ("tipo_tarea", 1)],
            name="idx_sesion_tipo_tarea"
        )
        print(f"   [OK] Indice en coleccion 'agent_messages' verificado: {idx_msgs}")
    except Exception as e_mongo:
        print(f"   [AVISO] Advertencia MongoDB Atlas: {e_mongo}")

    print("\n" + "=" * 70)
    print("MIGRACION 004 COMPLETADA EXITOSAMENTE EN AMBAS BASES DE DATOS")
    print("=" * 70)

if __name__ == "__main__":
    ejecutar_migracion()
