"""
Herramientas de Búsqueda y Verificación Constitucional (LangChain Tools)
========================================================================
Conectadas a la base de datos PostgreSQL Neon (tabla public.articulos_constitucion)
para uso del Agente Fiscal Constitucional con cotejo textual estricto.
"""
import re
from typing import List, Dict, Any
from langchain_core.tools import tool
from sma_unified.db.neon_postgres import obtener_articulos_constitucion, buscar_articulos_constitucion_exacto


@tool("buscar_articulos_constitucion")
def tool_buscar_articulos_constitucion(consulta: str) -> str:
    """
    BUSCADOR CONSTITUCIONAL POR TÉRMINOS CLAVE EN LA CPE DE BOLIVIA.

    Args:
        consulta (str): Término(s) de búsqueda (ej: 'educación', 'salud', 'recursos naturales', 'derechos fundamentales').

    Returns:
        str: Listado estructurado de los artículos más relevantes de la Constitución Política del Estado.
    """
    try:
        articulos = obtener_articulos_constitucion(texto_query=consulta, limit=10)
        if not articulos:
            return (
                "NO SE ENCONTRARON ARTÍCULOS CONSTITUCIONALES RELACIONADOS.\n"
                "Sugerencia: Reformule la consulta con términos más específicos o use 'obtener_articulo_por_numero'."
            )

        # Deduplicar por número de artículo
        vistos = set()
        articulos_unicos = []
        for a in articulos:
            num_str = str(a.get("numero", "")).strip()
            if num_str and num_str not in vistos:
                vistos.add(num_str)
                articulos_unicos.append(a)

        resultado = [
            "=" * 80,
            "CONSTITUCIÓN POLÍTICA DEL ESTADO — RESULTADOS DE BÚSQUEDA",
            f"Consulta: '{consulta}' | Coincidencias únicas: {len(articulos_unicos)}",
            "=" * 80,
            "",
        ]

        for idx, a in enumerate(articulos_unicos, 1):
            num = a.get("numero", "S/N")
            tit = a.get("titulo", "Sin título")
            cap = a.get("capitulo", "")
            sec = a.get("seccion", "")
            txt = a.get("texto", "").strip()

            bloque = [
                f"[RESULTADO {idx}] Art. {num} — {tit}",
                f"   Ubicación: Capítulo: {cap} | Sección: {sec}" if cap else "",
                "   --- TEXTO DEL ARTÍCULO ---",
                f"   {txt}",
                "   --- FIN DEL ARTÍCULO ---",
                "",
            ]
            resultado.extend([line for line in bloque if line != ""])

        return "\n".join(resultado)

    except Exception as e:
        return f"ERROR en búsqueda constitucional: {str(e)}"


@tool("obtener_articulo_por_numero")
def tool_obtener_articulo_por_numero(numero_articulo: str) -> str:
    """
    OBTENEDOR EXACTO DE ARTÍCULO CONSTITUCIONAL POR NÚMERO.

    Args:
        numero_articulo (str): Número del artículo (ej: 'Art. 18', '14', '75').

    Returns:
        str: Texto ÍNTEGRO y VIGENTE del artículo constitucional oficial.
    """
    try:
        numero_limpio = re.sub(r"^(Art\.?|Artículo|Articulo)\s*", "", str(numero_articulo).strip(), flags=re.IGNORECASE).strip()
        art = buscar_articulos_constitucion_exacto(numero_limpio)

        if not art:
            return f"ARTÍCULO CONSTITUCIONAL NO ENCONTRADO: '{numero_articulo}'. Verifique el número."

        resultado = [
            "=" * 80,
            "CONSTITUCIÓN POLÍTICA DEL ESTADO — ARTÍCULO OFICIAL VERIFICADO",
            "=" * 80,
            f"NÚMERO: Art. {art.get('numero', numero_limpio)}",
            f"TÍTULO: {art.get('titulo', 'Sin título')}",
            f"CAPÍTULO: {art.get('capitulo', 'N/A')}",
            f"SECCIÓN: {art.get('seccion', 'N/A')}",
            "",
            "=" * 80,
            "TEXTO ÍNTEGRO:",
            "=" * 80,
            art.get("texto", ""),
            "=" * 80,
        ]
        return "\n".join(resultado)

    except Exception as e:
        return f"ERROR al obtener artículo: {str(e)}"


@tool("comparar_texto_constitucional")
def tool_comparar_texto_constitucional(proyecto_texto: str, articulo_constitucion: str) -> str:
    """
    COMPARADOR FORENSE DE TEXTOS CONSTITUCIONALES.
    Compara el texto de un artículo del proyecto contra el artículo constitucional para detectar si está A FAVOR (respaldo/garantía) o EN CONTRA (colisión/violación).
    """
    try:
        proy_limpio = re.sub(r"\s+", " ", proyecto_texto).strip().lower()
        const_limpio = re.sub(r"\s+", " ", articulo_constitucion).strip().lower()

        frases_prohibidas = ["no podra", "queda prohibido", "se prohibe", "no se permite", "esta vedado", "no corresponde", "no tendra efecto", "se sancionara"]
        frases_obligatorias = ["debera", "tiene la obligacion", "es deber", "debe cumplir", "sera responsabilidad", "queda establecido", "se garantiza", "el estado garantiza", "se reconoce", "derecho a"]

        proh_proy = any(f in proy_limpio for f in frases_prohibidas)
        obli_proy = any(f in proy_limpio for f in frases_obligatorias)
        proh_const = any(f in const_limpio for f in frases_prohibidas)
        obli_const = any(f in const_limpio for f in frases_obligatorias)

        contradiccion = False
        a_favor = False
        razones = []

        if proh_const and obli_proy:
            contradiccion = True
            razones.append("EN CONTRA: La Constitución PROHÍBE lo que el proyecto pretende PERMITIR u OBLIGAR.")
        elif obli_const and proh_proy:
            contradiccion = True
            razones.append("EN CONTRA: La Constitución OBLIGA/GARANTIZA un derecho que el proyecto RESTRINGE o PROHÍBE.")
        elif obli_const and obli_proy:
            a_favor = True
            razones.append("A FAVOR: El proyecto desarrolla y garantiza el mandato u obligación de la Constitución.")

        veredicto = "CONTRADICCIÓN (EN CONTRA)" if contradiccion else ("RESPALDO (A FAVOR)" if a_favor else "SIN CONFLITO DIRECTO")

        return (
            "VEREDICTO COMPARATIVO:\n"
            f"ESTADO: {veredicto}\n"
            + ("\n".join(razones) if razones else "En concordancia o sin tensión aparente.")
        )
    except Exception as e:
        return f"ERROR en comparación: {str(e)}"

