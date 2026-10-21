"""Carga PDF profesionales en Neon. Admite nuevas profesiones sin cambiar código."""
import argparse
import json
from pathlib import Path

from sma_unified.agents.reglamentos_profesionales import PREDETERMINADOS, cargar_pdf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--carpeta", type=Path, default=Path(__file__).parent / "Documeno")
    parser.add_argument("--archivo", type=Path, help="PDF de una profesión nueva o existente")
    parser.add_argument("--profesion")
    parser.add_argument("--titulo")
    parser.add_argument("--alias", action="append", default=[], help="Palabra o frase de detección; repetible")
    parser.add_argument("--solo", nargs="+", choices=list(PREDETERMINADOS), help="Limitar la carga inicial")
    parser.add_argument("--solo-embeddings", action="store_true", help="Vectorizar los fragmentos existentes sin releer los PDF")
    args = parser.parse_args()
    if args.solo_embeddings:
        from sma_unified.agents.facetas_semanticas import vectorizar_pendientes
        print(json.dumps(vectorizar_pendientes(), ensure_ascii=False))
        return
    if args.archivo:
        if not args.profesion or not args.titulo:
            parser.error("--archivo requiere --profesion y --titulo")
        cargas = [(args.archivo, args.profesion, args.titulo, args.alias)]
    else:
        cargas = [(args.carpeta / nombre, *datos) for nombre, datos in PREDETERMINADOS.items()
                  if not args.solo or nombre in args.solo]
    faltantes = [str(ruta) for ruta, *_ in cargas if not ruta.is_file()]
    if faltantes:
        parser.error(f"Faltan PDF: {faltantes}")
    for datos in cargas:
        print(json.dumps(cargar_pdf(*datos), ensure_ascii=False))
    from sma_unified.agents.facetas_semanticas import vectorizar_pendientes
    print(json.dumps(vectorizar_pendientes(), ensure_ascii=False))
    from sma_unified.agents.multiagente_ciudadano import sincronizar_profesiones
    sincronizar_profesiones()
    print("Facetas profesionales sincronizadas en Neon.")


if __name__ == "__main__":
    main()
