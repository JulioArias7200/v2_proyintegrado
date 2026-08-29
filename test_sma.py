"""
Script de prueba de la conexión MongoDB Atlas, PostgreSQL Neon, LLM y pipeline completo.
Ejecutar: python test_sma.py
"""
import sys
import os

# Configurar encoding UTF-8 para consola de Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

print("=" * 60)
print("SMA CONGRESO — Test de Integracion")
print("=" * 60)

# Test 1: MongoDB Atlas
print("\n[1/4] Probando conexion MongoDB Atlas...")
try:
    from sma_unified.db.mongo_atlas import ping_mongo, obtener_kpis_mongo, obtener_kpis_constitucionales_mongo
    ok = ping_mongo()
    if ok:
        print("    [OK] MongoDB Atlas conectado correctamente")
        kpis = obtener_kpis_mongo()
        print(f"    [KPIs] Mensajes totales: {kpis.get('total_mensajes', 0)}")
        kpis_const = obtener_kpis_constitucionales_mongo()
        print(f"    [KPIs] Observaciones constitucionales: {kpis_const.get('total', 0)}")
    else:
        print("    [ERROR] Sin conexion - revisa MONGO_URI en .env")
except Exception as e:
    print(f"    [ERROR] {e}")

# Test 2: PostgreSQL Neon
print("\n[2/4] Probando conexion PostgreSQL Neon...")
try:
    from sma_unified.db.neon_postgres import ping_neon, obtener_comisiones_activas, obtener_stats_constitucionales
    ok_neon = ping_neon()
    if ok_neon:
        print("    [OK] PostgreSQL Neon conectado correctamente")
        comisiones = obtener_comisiones_activas()
        print(f"    [Comisiones activas]: {len(comisiones)} comisiones registradas")
        stats_neon = obtener_stats_constitucionales()
        print(f"    [Stats]: {stats_neon}")
    else:
        print("    [WARN] PostgreSQL Neon no conectado (revisa NEON_DATABASE_URL)")
except Exception as e:
    print(f"    [WARN] Neon: {e}")

# Test 3: Configuracion LLM
print("\n[3/4] Verificando configuracion LLM NVIDIA...")
try:
    from sma_unified.config import settings
    key = settings.NVIDIA_API_KEY
    if key and ("nvapi-" in key or len(key) > 20):
        print(f"    [OK] NVIDIA API Key configurada: {key[:12]}...")
        print(f"    [Modelo] CrewAI: {settings.LLM_MODEL_CREW}")
    else:
        print("    [WARN] NVIDIA_API_KEY no configurada o invalida")
except Exception as e:
    print(f"    [ERROR] {e}")

# Test 4: Pipeline
print("\n[4/4] Verificando imports del pipeline...")
try:
    from sma_unified.agents.pipeline import ejecutar_pipeline
    from sma_unified.agents.distribuidor import clasificar_documento
    from sma_unified.agents.comision import procesar_legislativo
    from sma_unified.agents.ciudadana import procesar_atencion_ciudadana
    from sma_unified.agents.correspondencia import procesar_correspondencia
    print("    [OK] Todos los modulos del pipeline importados correctamente")
    print("    [Agentes disponibles]:")
    print("       * Agente_Distribuidor (Nivel 1 - Clasificacion)")
    print("       * Agente_Comision_Legislativa (Nivel 2 - Comision + Verificacion)")
    print("       * Agente_Verificador_Constitucional (integrado en Comision)")
    print("       * Agente_Atencion_Ciudadana")
    print("       * Agente_Gestion_Correspondencia")
except Exception as e:
    print(f"    [ERROR] Importando pipeline: {e}")

print("\n" + "=" * 60)
print("Para iniciar la aplicacion completa ejecuta:")
print("  reflex run")
print("=" * 60)

