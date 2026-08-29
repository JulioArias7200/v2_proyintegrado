"""
parser_normativa.py
====================
Parsea documentos normativos bolivianos (Constitución, leyes, decretos) que
siguen la jerarquía: PARTE > TÍTULO > CAPÍTULO > (SECCIÓN) > Artículo N.

Extrae cada artículo como unidad atómica junto con su contexto jerárquico.
Usado por `cargar_normativa.py` (raíz del proyecto) para poblar el corpus
vigente que consulta el Agente de Consistencia Normativa
(`sma_unified/agents/consistencia_normativa.py`).
"""

import re
from typing import List, Dict, Any, Optional

# --- Patrones jerárquicos -------------------------------------------------

PATRON_PARTE = re.compile(r"^\s*(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA)\s+PARTE\s*$", re.IGNORECASE)
PATRON_TITULO = re.compile(r"^\s*T[ÍI]TULO\s+([IVXLC]+|[0-9]+)\s*$", re.IGNORECASE)
PATRON_CAPITULO = re.compile(r"^\s*CAP[ÍI]TULO\s+(PRIMERO|SEGUNDO|TERCERO|CUARTO|[IVXLC]+|[0-9]+)\s*$", re.IGNORECASE)
PATRON_SECCION = re.compile(r"^\s*SECCI[ÓO]N\s+([IVXLC]+|[0-9]+)\s*$", re.IGNORECASE)

# Reconoce dos estilos de artículo:
#   1) "Artículo 1."                              (CPE: número solo, cuerpo en párrafo aparte)
#   2) "ARTÍCULO 1.- (OBJETO). Texto del cuerpo..." (leyes ordinarias: título entre paréntesis
#                                                     y el cuerpo empieza en la misma línea)
PATRON_ARTICULO = re.compile(
    r"^\s*Art[íi]culo\s+([0-9]+(?:\s*(?:bis|ter))?)\s*[°ºo]?\s*\.?\s*-?\s*"
    r"(?:\(([^)]+)\)\s*\.?\s*)?"
    r"(.*)$",
    re.IGNORECASE,
)


def extraer_texto_pdf(ruta_pdf: str) -> str:
    """Extrae el texto plano de un PDF, línea por línea, preservando saltos."""
    import fitz  # PyMuPDF
    doc = fitz.open(ruta_pdf)
    lineas = []
    for pagina in doc:
        texto = pagina.get_text("text")
        lineas.extend(texto.split("\n"))
    doc.close()
    return "\n".join(lineas)


def parsear_articulos(texto: str) -> List[Dict[str, Any]]:
    """
    Recorre el texto línea por línea, actualiza el contexto jerárquico
    (parte/título/capítulo/sección) y agrupa el contenido bajo cada artículo.
    """
    articulos: List[Dict[str, Any]] = []
    contexto = {"parte": None, "titulo": None, "capitulo": None, "seccion": None}

    articulo_actual: Optional[str] = None
    titulo_articulo_actual: Optional[str] = None
    buffer_texto: List[str] = []

    def cerrar_articulo():
        if articulo_actual is not None:
            texto_final = " ".join(t for t in buffer_texto if t).strip()
            texto_final = re.sub(r"\s+", " ", texto_final)
            if texto_final:
                articulos.append({
                    "numero_articulo": articulo_actual,
                    "titulo_articulo": titulo_articulo_actual,
                    "texto": texto_final,
                    **contexto,
                })

    for linea_cruda in texto.split("\n"):
        linea = linea_cruda.strip()
        if not linea:
            continue

        if PATRON_PARTE.match(linea):
            cerrar_articulo()
            articulo_actual, titulo_articulo_actual, buffer_texto = None, None, []
            contexto["parte"] = linea
            contexto["titulo"] = contexto["capitulo"] = contexto["seccion"] = None
            continue

        if PATRON_TITULO.match(linea):
            cerrar_articulo()
            articulo_actual, titulo_articulo_actual, buffer_texto = None, None, []
            contexto["titulo"] = linea
            contexto["capitulo"] = contexto["seccion"] = None
            continue

        if PATRON_CAPITULO.match(linea):
            cerrar_articulo()
            articulo_actual, titulo_articulo_actual, buffer_texto = None, None, []
            contexto["capitulo"] = linea
            contexto["seccion"] = None
            continue

        if PATRON_SECCION.match(linea):
            cerrar_articulo()
            articulo_actual, titulo_articulo_actual, buffer_texto = None, None, []
            contexto["seccion"] = linea
            continue

        m_articulo = PATRON_ARTICULO.match(linea)
        if m_articulo:
            cerrar_articulo()
            articulo_actual = m_articulo.group(1).strip()
            titulo_articulo_actual = (m_articulo.group(2) or "").strip() or None
            resto_linea = (m_articulo.group(3) or "").strip()
            buffer_texto = [resto_linea] if resto_linea else []
            continue

        if articulo_actual is not None:
            # Filtra artefactos de UI/anotaciones típicos de PDFs con marcas de edición
            if re.fullmatch(r"[\W_]{1,6}", linea):
                continue
            buffer_texto.append(linea)

    cerrar_articulo()
    return articulos
