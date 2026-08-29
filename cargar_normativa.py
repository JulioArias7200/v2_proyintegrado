"""
cargar_normativa.py
====================
Carga una norma vigente (Constitución, ley, decreto, resolución) en el
corpus que consulta el Agente de Consistencia Normativa
(`sma_unified/agents/consistencia_normativa.py`): parsea el PDF en artículos,
genera el embedding de cada uno (API de NVIDIA) y los inserta en
`normativa.articulos` (Neon + pgvector).

Uso:
    python cargar_normativa.py --pdf ley_general_trabajo.pdf \
        --nombre "Ley General del Trabajo" --tipo Ley --jerarquia 2

    # Constitución:
    python cargar_normativa.py --pdf cpe.pdf --nombre "Constitución Política del Estado" \
        --tipo Constitucion --jerarquia 1

Requiere las mismas variables de entorno que el resto del SMA (.env en la
raíz del proyecto): NVIDIA_API_KEY, NVIDIA_EMBED_MODEL, NEON_DATABASE_URL.
"""

import argparse
import time

from sma_unified.config import settings
from sma_unified.utils.parser_normativa import extraer_texto_pdf, parsear_articulos
from sma_unified.db.neon_postgres import (
    obtener_o_crear_norma_consistencia,
    articulo_normativa_existe,
    insertar_articulo_normativa,
)

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("cargar_normativa")

NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1"


def generar_embedding(texto: str) -> list:
    import requests
    resp = requests.post(
        f"{NVIDIA_API_BASE}/embeddings",
        headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"},
        json={"input": [texto], "model": settings.NVIDIA_EMBED_MODEL, "input_type": "passage"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]


def cargar_pdf(pdf: str, nombre: str, tipo: str, jerarquia: int):
    texto = extraer_texto_pdf(pdf)
    articulos = parsear_articulos(texto)

    if not articulos:
        raise SystemExit(
            "No se detectó ningún artículo en el PDF. Revisa que el texto siga "
            "el patrón 'Artículo N.' o 'ARTÍCULO N.- (TÍTULO).' — si el PDF es "
            "escaneado (imagen), primero hace falta pasarlo por OCR."
        )

    norma_id = obtener_o_crear_norma_consistencia(
        nombre=nombre, tipo_norma=tipo, jerarquia=jerarquia, fuente_archivo=pdf,
    )
    if norma_id is None:
        raise SystemExit(
            "No se pudo crear/obtener la norma en Neon. Verifica NEON_DATABASE_URL "
            "y que la extensión 'vector' (pgvector) esté disponible en esa base."
        )

    total = len(articulos)
    print(f"Norma: {nombre} (id={norma_id})")
    print(f"Cargando {total} artículos...")

    for i, art in enumerate(articulos, start=1):
        if articulo_normativa_existe(norma_id, art["numero_articulo"]):
            print(f"  [{i}/{total}] Art. {art['numero_articulo']} ya existe, se omite")
            continue

        embedding = generar_embedding(art["texto"])
        articulo_id = insertar_articulo_normativa(
            norma_id=norma_id,
            numero_articulo=art["numero_articulo"],
            texto=art["texto"],
            embedding=embedding,
            titulo_articulo=art.get("titulo_articulo"),
            parte=art.get("parte"),
            titulo=art.get("titulo"),
            capitulo=art.get("capitulo"),
            seccion=art.get("seccion"),
        )
        if articulo_id:
            print(f"  [{i}/{total}] Art. {art['numero_articulo']} cargado (id={articulo_id})")
        else:
            print(f"  [{i}/{total}] Art. {art['numero_articulo']} — ERROR al insertar, revisa logs")

        time.sleep(0.1)  # pausa breve para no saturar la API de embeddings

    print("Carga completa.")


def main():
    ap = argparse.ArgumentParser(
        description="Carga una norma vigente (PDF) al corpus del Agente de Consistencia Normativa"
    )
    ap.add_argument("--pdf", required=True, help="Ruta al PDF de la norma vigente")
    ap.add_argument("--nombre", required=True, help="Nombre de la norma, ej. 'Ley General del Trabajo'")
    ap.add_argument("--tipo", required=True, help="Tipo de norma: Constitucion | Ley | Decreto | Resolucion")
    ap.add_argument("--jerarquia", type=int, required=True, help="1=Constitución, 2=Ley, 3=Decreto, 4=Resolución")
    args = ap.parse_args()

    cargar_pdf(args.pdf, args.nombre, args.tipo, args.jerarquia)


if __name__ == "__main__":
    main()
