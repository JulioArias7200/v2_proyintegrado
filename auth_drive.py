"""
auth_drive.py — Autorización interactiva de Google Drive OAuth2
Ejecuta este script para abrir el navegador, autorizar tu cuenta de Google y generar 'token.json'.

Uso:
    python auth_drive.py
o en este proyecto:
    .\\venv\\Scripts\\python.exe auth_drive.py
"""
import sys
import os
from pathlib import Path

# Soporte UTF-8 para consola de Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sma_unified.utils.drive_uploader import (
    autorizar_interactivamente,
    verificar_conexion_drive,
    resolver_carpeta_destino,
    _get_drive_service,
    CARPETA_PROYECTOS_INICIALES,
    CARPETA_REPORTES,
    CARPETA_LEYES,
    GOOGLE_DRIVE_FOLDER_ID
)

def main():
    print("=" * 65)
    print("  ASAMBLEA LEGISLATIVA PLURINACIONAL — INTEGRACIÓN GOOGLE DRIVE")
    print("=" * 65)
    print(f"Carpeta Raíz Drive (FOLDER_ID):    {GOOGLE_DRIVE_FOLDER_ID}")
    print(f"Subcarpeta Proyectos Iniciales:    {CARPETA_PROYECTOS_INICIALES}")
    print(f"Subcarpeta Reportes / Dictámenes:  {CARPETA_REPORTES}")
    print(f"Subcarpeta Leyes Editadas:        {CARPETA_LEYES}")
    print("-" * 65)
    
    estado_previo = verificar_conexion_drive()
    print(f"Estado inicial: {estado_previo.get('mensaje')}")
    
    if estado_previo.get("autenticado"):
        print(f"✅ Ya estás autenticado como: {estado_previo.get('usuario_email')}")
    else:
        print("Iniciando navegador para autorización de Google...")
        exito = autorizar_interactivamente()
        if not exito:
            print("❌ No se pudo completar la autorización.")
            sys.exit(1)
        print("✅ Autorización completada y token.json generado!")

    # Verificar carpetas en Drive
    print("-" * 65)
    print("Verificando carpetas en Google Drive...")
    try:
        service = _get_drive_service()
        if service:
            id_ini = resolver_carpeta_destino(service, categoria="proyectos_iniciales")
            print(f"  📁 Subcarpeta Proyectos Iniciales ID: {id_ini}")
            id_rep = resolver_carpeta_destino(service, categoria="reportes")
            print(f"  📁 Subcarpeta Reportes ID:            {id_rep}")
            id_ley = resolver_carpeta_destino(service, categoria="leyes_editadas")
            print(f"  📁 Subcarpeta Leyes Editadas ID:      {id_ley}")
            print("\n🎉 ¡Google Drive está 100% configurado para Proyectos Iniciales, Reportes y Leyes Editadas!")
    except Exception as e:
        print(f"⚠️ Nota al verificar carpetas: {e}")

if __name__ == "__main__":
    main()
