"""
Herramientas de Búsqueda y Verificación Constitucional (LangChain Tools)
========================================================================
Conectadas a la base de datos PostgreSQL Neon (tabla sistema.articulos_constitucion)
para uso del Agente Fiscal Constitucional con cotejo textual estricto.
"""
import re
import unicodedata
from typing import List, Dict, Any
from langchain_core.tools import tool
from sma_unified.db.neon_postgres import obtener_articulos_constitucion, buscar_articulos_constitucion_exacto


# ── Utilidades internas de normalización ─────────────────────────────────────

_MAX_CHARS_TEXTO = 6000  # techo defensivo para respuestas del tool

def _quitar_acentos(texto: str) -> str:
    """Elimina diacríticos para comparación robusta (á→a, ñ→n, ü→u)."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _normalizar(texto: str) -> str:
    """Minúsculas, sin acentos, espacios colapsados, sin puntuación ruidosa."""
    if not texto:
        return ""
    t = _quitar_acentos(str(texto)).lower()
    t = re.sub(r"[\r\n\t]+", " ", t)
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _limpiar_numero_articulo(numero_articulo: str) -> str:
    """
    Acepta variantes: 'Art. 18', 'artículo 18', 'ART 18', '18', 'Artículo 18 bis'.
    Devuelve el número limpio ('18', '18 bis') o el original sin prefijos.
    """
    if numero_articulo is None:
        return ""
    s = str(numero_articulo).strip()
    # Quitar prefijos Art./Artículo/Articulo/ART (con o sin punto)
    s = re.sub(r"^(art[ií]culo|art)\s*\.?\s*", "", s, flags=re.IGNORECASE).strip()
    # Normalizar espacios internos (ej. "18  bis" → "18 bis")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _truncar(texto: str, limite: int = _MAX_CHARS_TEXTO) -> str:
    if not texto:
        return ""
    texto = str(texto)
    return texto if len(texto) <= limite else texto[:limite] + "\n…[texto truncado]"


def _deduplicar_articulos(articulos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplica por número. Si falta número, usa hash del texto como clave secundaria.
    Preserva el orden de aparición.
    """
    vistos = set()
    unicos: List[Dict[str, Any]] = []
    for a in articulos or []:
        num = str(a.get("numero", "")).strip()
        if num:
            clave = f"num::{num}"
        else:
            texto = _normalizar(a.get("texto", ""))[:200]
            clave = f"txt::{hash(texto)}"
        if clave in vistos:
            continue
        vistos.add(clave)
        unicos.append(a)
    return unicos


# ── Tool 1: búsqueda por términos clave ──────────────────────────────────────

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
        consulta_limpia = (consulta or "").strip()
        if not consulta_limpia:
            return (
                "CONSULTA VACÍA.\n"
                "Indique términos concretos (ej: 'educación', 'salud', 'recursos naturales')."
            )

        articulos = obtener_articulos_constitucion(texto_query=consulta_limpia, limit=10)

        # Fallback semántico si no hay coincidencias directas
        if not articulos:
            articulos = obtener_articulos_constitucion(
                texto_query="derechos garantias principios estado bolivia",
                limit=10,
            )

        if not articulos:
            return (
                "NO SE ENCONTRARON ARTÍCULOS CONSTITUCIONALES RELACIONADOS.\n"
                "Sugerencia: Reformule la consulta con términos más específicos o use 'obtener_articulo_por_numero'."
            )

        articulos_unicos = _deduplicar_articulos(articulos)

        resultado = [
            "=" * 80,
            "CONSTITUCIÓN POLÍTICA DEL ESTADO — RESULTADOS DE BÚSQUEDA",
            f"Consulta: '{consulta_limpia}' | Coincidencias únicas: {len(articulos_unicos)}",
            "=" * 80,
            "",
        ]

        for idx, a in enumerate(articulos_unicos, 1):
            num = a.get("numero", "S/N")
            tit = a.get("titulo", "Sin título") or "Sin título"
            cap = a.get("capitulo", "") or ""
            sec = a.get("seccion", "") or ""
            txt = _truncar((a.get("texto", "") or "").strip())

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


# ── Tool 2: obtención exacta por número ──────────────────────────────────────

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
        numero_limpio = _limpiar_numero_articulo(numero_articulo)
        if not numero_limpio:
            return (
                f"NÚMERO DE ARTÍCULO INVÁLIDO: '{numero_articulo}'.\n"
                "Ejemplos válidos: '18', 'Art. 18', 'Artículo 18'."
            )

        art = buscar_articulos_constitucion_exacto(numero_limpio)

        if not art:
            return (
                f"ARTÍCULO CONSTITUCIONAL NO ENCONTRADO: '{numero_articulo}'.\n"
                "Verifique el número (rango válido: 1 a 411 en la CPE de Bolivia)."
            )

        resultado = [
            "=" * 80,
            "CONSTITUCIÓN POLÍTICA DEL ESTADO — ARTÍCULO OFICIAL VERIFICADO",
            "=" * 80,
            f"NÚMERO: Art. {art.get('numero', numero_limpio)}",
            f"TÍTULO: {art.get('titulo', 'Sin título') or 'Sin título'}",
            f"CAPÍTULO: {art.get('capitulo', 'N/A') or 'N/A'}",
            f"SECCIÓN: {art.get('seccion', 'N/A') or 'N/A'}",
            "",
            "=" * 80,
            "TEXTO ÍNTEGRO:",
            "=" * 80,
            _truncar(art.get("texto", "") or ""),
            "=" * 80,
        ]
        return "\n".join(resultado)

    except Exception as e:
        return f"ERROR al obtener artículo: {str(e)}"


# ── Tool 3: comparador forense (sin LLM, puramente determinista) ─────────────

# Patrones con tolerancia a tildes y variantes morfológicas.
# Se aplican sobre texto YA normalizado (minúsculas, sin acentos, sin puntuación).
_PATRONES_PROHIBIDOS = [
    r"\bno\s+poder?a\b",
    r"\bno\s+podr[áa]\b",
    r"\bqueda\s+prohibid[oa]\b",
    r"\bse\s+prohibe\b",
    r"\bse\s+proh[íi]be\b",
    r"\bno\s+se\s+permit[e]?\b",
    r"\best[áa]\s+vedad[oa]\b",
    r"\bno\s+corresponde\b",
    r"\bno\s+tendr[áa]\s+efecto\b",
    r"\bse\s+sancionar[áa]\b",
    r"\bprohibid[oa]\b",
    r"\bprohibir[áa]?\b",
]

_PATRONES_OBLIGATORIOS = [
    r"\bdeber[áa]\b",
    r"\bdebe\s+cumplir\b",
    r"\btiene\s+la\s+obligaci[óo]n\b",
    r"\bes\s+deber\b",
    r"\bser[áa]\s+responsabilidad\b",
    r"\bqueda\s+establecid[oa]\b",
    r"\bse\s+garantiza\b",
    r"\bel\s+estado\s+garantiza\b",
    r"\bse\s+reconoce\b",
    r"\bderecho\s+a\b",
    r"\bgarantiza\b",
    r"\breconoce\b",
]

_RE_PROHIBIDOS = re.compile("|".join(_PATRONES_PROHIBIDOS))
_RE_OBLIGATORIOS = re.compile("|".join(_PATRONES_OBLIGATORIOS))


def _detectar_prohibicion(texto_norm: str) -> bool:
    return bool(_RE_PROHIBIDOS.search(texto_norm or ""))


def _detectar_obligacion(texto_norm: str) -> bool:
    return bool(_RE_OBLIGATORIOS.search(texto_norm or ""))


@tool("comparar_texto_constitucional")
def tool_comparar_texto_constitucional(proyecto_texto: str, articulo_constitucion: str) -> str:
    """
    COMPARADOR FORENSE DE TEXTOS CONSTITUCIONALES.
    Compara el texto de un artículo del proyecto contra el artículo constitucional para detectar si está A FAVOR (respaldo/garantía) o EN CONTRA (colisión/violación).
    """
    try:
        if not proyecto_texto or not articulo_constitucion:
            return (
                "COMPARACIÓN IMPOSIBLE: faltan textos.\n"
                "Debe proporcionar 'proyecto_texto' y 'articulo_constitucion'."
            )

        proy_norm = _normalizar(proyecto_texto)
        const_norm = _normalizar(articulo_constitucion)

        proh_proy = _detectar_prohibicion(proy_norm)
        obli_proy = _detectar_obligacion(proy_norm)
        proh_const = _detectar_prohibicion(const_norm)
        obli_const = _detectar_obligacion(const_norm)

        contradiccion = False
        a_favor = False
        razones: List[str] = []

        if proh_const and obli_proy:
            contradiccion = True
            razones.append(
                "EN CONTRA: La Constitución PROHÍBE lo que el proyecto pretende PERMITIR u OBLIGAR."
            )
        elif obli_const and proh_proy:
            contradiccion = True
            razones.append(
                "EN CONTRA: La Constitución OBLIGA/GARANTIZA un derecho que el proyecto RESTRINGE o PROHÍBE."
            )
        elif obli_const and obli_proy:
            a_favor = True
            razones.append(
                "A FAVOR: El proyecto desarrolla y garantiza el mandato u obligación de la Constitución."
            )
        elif proh_const and proh_proy:
            # Ambas prohíben → alineación prohibitiva, no colisión
            a_favor = True
            razones.append(
                "A FAVOR: El proyecto reproduce la prohibición constitucional (alineación normativa)."
            )

        veredicto = (
            "CONTRADICCIÓN (EN CONTRA)" if contradiccion
            else "RESPALDO (A FAVOR)" if a_favor
            else "SIN CONFLITO DIRECTO"
        )

        # Diagnóstico breve de señales detectadas (útil para trazabilidad)
        senales = (
            f"Señales — Proyecto: prohibición={proh_proy}, obligación={obli_proy} | "
            f"Constitución: prohibición={proh_const}, obligación={obli_const}"
        )

        return (
            "VEREDICTO COMPARATIVO:\n"
            f"ESTADO: {veredicto}\n"
            + ("\n".join(razones) if razones else "En concordancia o sin tensión aparente.")
            + "\n" + senales
        )
    except Exception as e:
        return f"ERROR en comparación: {str(e)}"