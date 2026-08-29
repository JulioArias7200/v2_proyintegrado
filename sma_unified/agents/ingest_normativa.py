"""
Ingesta de Normativa Legal (Códigos, Leyes, Decretos, Resoluciones, etc.)
==========================================================================
Mejora del `ingest.py` original: en vez de una tabla separada con
credenciales de BD propias (`articulos_legales` + variables DB_* sueltas),
guarda todo en `public.articulos_normativos` — una tabla propia, aparte de
`public.articulos_constitucion` (que sigue siendo solo la Constitución,
sin tocar su esquema) — usando la misma conexión Neon que ya usa el resto
del sistema. 100% invocable desde un evento de Reflex, sin Flask.

Pipeline:
  1. El LLM (una sola vez por documento) infiere el patrón de artículos y
     jerarquía a partir de una muestra del texto (agents/llm_perfil_normativa.py).
  2. Con ese patrón, se parsea el documento completo con regex puro
     (rápido, sin costo de LLM por artículo).
  3. Se detectan artículos derogados (y, si el texto lo indica, con qué
     norma y fecha).
  4. Se generan embeddings NVIDIA en lotes y se hace upsert idempotente en
     `public.articulos_normativos` (evita duplicados vía hash de contenido).
"""
import hashlib
import re
import unicodedata
from datetime import date
from typing import Any, Callable, Dict, List, Optional, Tuple

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("ingest_normativa")

from sma_unified.agents.embeddings_nvidia import generar_embeddings
from sma_unified.agents.llm_perfil_normativa import generar_perfil
from sma_unified.db.neon_postgres import insertar_o_actualizar_articulo_normativo

TIPOS_DOCUMENTO_VALIDOS = {"constitucion", "codigo", "ley", "decreto", "resolucion", "proyecto_ley"}
BATCH_SIZE_EMBEDDINGS = 24


# ── 1. Normalización de texto ─────────────────────────────────────────────

def normalizar_texto(texto: str) -> str:
    texto = unicodedata.normalize("NFKC", texto)
    texto = re.sub(r'(\w)-\n(\w)', r'\1\2', texto)   # palabras cortadas al final de línea
    texto = re.sub(r'\n{2,}', '\n', texto)
    texto = re.sub(r'[ \t]{2,}', ' ', texto)
    return texto


# ── 2. Parsing parametrizado por perfil (jerarquía + artículos) ───────────

def _compilar_patrones_jerarquia(jerarquia: dict) -> dict:
    patrones = {}
    for nivel, regex in (jerarquia or {}).items():
        if regex:
            try:
                patrones[nivel] = re.compile(regex, re.IGNORECASE | re.MULTILINE)
            except re.error as e:
                logger.warning(f"Regex de jerarquía inválida para nivel '{nivel}': {e}")
    return patrones


def dividir_en_lineas_marcadas(texto: str, perfil: dict) -> List[Dict[str, Any]]:
    """Recorre el texto línea por línea, siguiendo el perfil (regex de jerarquía
    e inicio de artículo) detectado por el LLM, y arma la lista de artículos.

    Usa `articulo_inicio` (el patrón completo que el LLM infirió para reconocer
    dónde arranca un artículo en ESTE documento en particular) como criterio
    principal, y `articulo_num` solo para extraer el número dentro de esa línea.
    Antes se ignoraba `articulo_inicio` y se validaba contra una lista fija de
    prefijos ("artículo", "art."), lo que hacía fallar la detección en cualquier
    documento cuyo formato no calzara exactamente con esa lista (p. ej. "Art. 1o.-").
    """
    lineas = texto.split('\n')

    patrones_jerarquia = _compilar_patrones_jerarquia(perfil.get("jerarquia"))

    try:
        p_inicio_art = re.compile(perfil["articulo_inicio"], re.IGNORECASE)
        p_num_art = re.compile(perfil["articulo_num"], re.IGNORECASE)
    except re.error as e:
        logger.warning(f"Regex de artículo inválida en el perfil del LLM: {e}")
        return []

    niveles_actuales = {nivel: None for nivel in patrones_jerarquia}

    articulos: List[Dict[str, Any]] = []
    buffer_actual: List[str] = []
    articulo_num_actual: Optional[str] = None

    def cerrar_articulo():
        if articulo_num_actual is not None and buffer_actual:
            contenido = '\n'.join(buffer_actual).strip()
            if contenido:
                m_titulo = re.search(r'\(([^)]{2,80})\)', contenido[:200])
                titulo_articulo = m_titulo.group(1).strip() if m_titulo else None
                articulos.append({
                    "articulo": articulo_num_actual.strip(),
                    "titulo_articulo": titulo_articulo,
                    "libro": niveles_actuales.get("libro"),
                    "titulo": niveles_actuales.get("titulo"),
                    "capitulo": niveles_actuales.get("capitulo") or niveles_actuales.get("seccion"),
                    "texto": contenido,
                })

    for linea in lineas:
        l = linea.strip()
        if not l:
            continue

        matcheo_jerarquia = False
        for nivel, patron in patrones_jerarquia.items():
            if patron.match(l):
                niveles_actuales[nivel] = l
                matcheo_jerarquia = True
                break
        if matcheo_jerarquia:
            continue

        if p_inicio_art.match(l):
            m_num = p_num_art.search(l)
            if m_num:
                cerrar_articulo()
                articulo_num_actual = m_num.group(1)
                buffer_actual = [linea]
                continue

        if articulo_num_actual is not None:
            buffer_actual.append(linea)

    cerrar_articulo()
    return articulos


# --- Parseo genérico de respaldo (sin LLM) --------------------------------
# Se usa cuando el perfil inferido por el LLM no logra detectar ningún
# artículo (regex mal inferida, timeout, formato atípico, etc.). Cubre los
# formatos más comunes de la normativa boliviana: "Artículo 1.-", "ARTÍCULO 1°",
# "Art. 1°.-", y también las variantes con ordinal pegado al número que usan
# códigos antiguos como el Civil ("Art. 1o.-", "Art 2do.-").

PATRON_JERARQUIA_GENERICA = {
    "libro": re.compile(r"^\s*LIBRO\s+(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|[IVXLC]+|[0-9]+)\s*$", re.IGNORECASE),
    "parte": re.compile(r"^\s*(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA)\s+PARTE\s*$", re.IGNORECASE),
    "titulo": re.compile(r"^\s*T[ÍI]TULO\s+([IVXLC]+|[0-9]+)\s*$", re.IGNORECASE),
    "capitulo": re.compile(r"^\s*CAP[ÍI]TULO\s+(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|[IVXLC]+|[0-9]+)\s*$", re.IGNORECASE),
    "seccion": re.compile(r"^\s*SECCI[ÓO]N\s+([IVXLC]+|[0-9]+)\s*$", re.IGNORECASE),
}

# Grupo "num": número del artículo. Grupo "titulo": epígrafe entre paréntesis
# si existe. Grupo "resto": lo que sigue en la misma línea (cuerpo del artículo).
PATRON_ARTICULO_GENERICO = re.compile(
    r"^\s*Art(?:[íi]culo)?\.?\s+"
    r"(?P<num>[0-9]+)(?:\s*(?:bis|ter|quater))?"
    r"\s*(?:°|º|ª|o|ro|do|to|mo|va|na)?\.?\s*-?\s*"
    r"(?:\((?P<titulo>[^)]{2,100})\)\s*\.?\s*)?"
    r"(?P<resto>.*)$",
    re.IGNORECASE,
)


def _parseo_generico_fallback(texto: str) -> List[Dict[str, Any]]:
    """Parseo determinístico (sin LLM) que reconoce los formatos más comunes de
    artículos en normativa boliviana. Se usa cuando el perfil del LLM no detecta
    ningún artículo, para que la ingesta no dependa por completo del LLM."""
    lineas = texto.split("\n")
    niveles_actuales = {nivel: None for nivel in PATRON_JERARQUIA_GENERICA}

    articulos: List[Dict[str, Any]] = []
    buffer_texto: List[str] = []
    articulo_actual: Optional[str] = None
    titulo_articulo_actual: Optional[str] = None

    def cerrar_articulo():
        if articulo_actual is not None:
            contenido = " ".join(t for t in buffer_texto if t).strip()
            contenido = re.sub(r"\s+", " ", contenido)
            if contenido:
                articulos.append({
                    "articulo": articulo_actual,
                    "titulo_articulo": titulo_articulo_actual,
                    "libro": niveles_actuales.get("libro"),
                    "titulo": niveles_actuales.get("titulo") or niveles_actuales.get("parte"),
                    "capitulo": niveles_actuales.get("capitulo") or niveles_actuales.get("seccion"),
                    "texto": contenido,
                })

    orden_jerarquia = ["libro", "parte", "titulo", "capitulo", "seccion"]

    for linea_cruda in lineas:
        l = linea_cruda.strip()
        if not l:
            continue

        matcheo_jerarquia = False
        for nivel in orden_jerarquia:
            if PATRON_JERARQUIA_GENERICA[nivel].match(l):
                cerrar_articulo()
                articulo_actual, titulo_articulo_actual, buffer_texto = None, None, []
                niveles_actuales[nivel] = l
                # Limpia los niveles inferiores al que acaba de cambiar
                for inferior in orden_jerarquia[orden_jerarquia.index(nivel) + 1:]:
                    niveles_actuales[inferior] = None
                matcheo_jerarquia = True
                break
        if matcheo_jerarquia:
            continue

        m_art = PATRON_ARTICULO_GENERICO.match(l)
        if m_art:
            cerrar_articulo()
            articulo_actual = m_art.group("num")
            titulo_articulo_actual = (m_art.group("titulo") or "").strip() or None
            resto = (m_art.group("resto") or "").strip()
            buffer_texto = [resto] if resto else []
            continue

        if articulo_actual is not None:
            # Filtra artefactos típicos de PDFs (números de página sueltos, guiones, etc.)
            if re.fullmatch(r"[\W_]{1,6}", l):
                continue
            buffer_texto.append(l)

    cerrar_articulo()
    return articulos


# Reconoce variantes de derogación: (Derogado), (Derogado por Ley N° 1234 de 15/03/2020), etc.
PATRON_DEROGACION = re.compile(
    r'\(Derogad[oa]s?'
    r'(?:\s*por\s+(?P<norma>Ley\s*N[º°.]?\s*\d+[\w\-]*|Decreto\s*Supremo\s*N[º°.]?\s*\d+[\w\-]*'
    r'|Resoluci[oó]n\s*(?:Suprema|Ministerial)?\s*N[º°.]?\s*\d+[\w\-]*))?'
    r'(?:[,\s]*de[l]?\s*(?P<fecha>\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}))?'
    r'\)',
    re.IGNORECASE,
)


def _parsear_fecha(fecha_texto: Optional[str]) -> Optional[date]:
    if not fecha_texto:
        return None
    partes = re.split(r'[/\-]', fecha_texto)
    if len(partes) != 3:
        return None
    try:
        dia, mes, anio = (int(p) for p in partes)
        if anio < 100:
            anio += 2000 if anio < 70 else 1900
        return date(anio, mes, dia)
    except (ValueError, TypeError):
        return None


def filtrar_derogados(articulos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Marca cada artículo como derogado/vigente sin excluir nada (eso lo decide el llamador)."""
    for art in articulos:
        m = PATRON_DEROGACION.search(art["texto"])
        art["derogado"] = bool(m)
        art["norma_derogatoria"] = m.group("norma") if m and m.group("norma") else None
        art["fecha_derogacion"] = _parsear_fecha(m.group("fecha")) if m else None
    return articulos


def perfil_es_confiable(articulos: List[Dict[str, Any]], umbral_huecos: float = 0.05) -> Tuple[bool, List[int]]:
    """Heurística de calidad: si detectamos Art. 1, 2, 4, 5 (falta el 3) hay 'huecos' —
    señal de que el parseo se saltó artículos por un patrón mal detectado."""
    numeros = []
    for a in articulos:
        m = re.match(r'(\d+)', a["articulo"])
        if m:
            numeros.append(int(m.group(1)))
    if not numeros:
        return False, []

    numeros_ordenados = sorted(set(numeros))
    rango = list(range(numeros_ordenados[0], numeros_ordenados[-1] + 1))
    huecos = [n for n in rango if n not in numeros_ordenados]
    proporcion_huecos = len(huecos) / len(rango) if rango else 1.0
    return proporcion_huecos <= umbral_huecos, huecos


# ── 3. Orquestación: perfil (LLM) → parseo (regex) → embeddings → upsert ──

def ingestar_texto_normativo(
    texto: str,
    documento: str,
    tipo_documento: str = "ley",
    numero_norma: Optional[str] = None,
    progress_cb: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """
    Procesa el texto completo de un cuerpo normativo (Código Penal, Código
    de Minería, una ley, un decreto, etc.) y lo guarda en
    public.articulos_normativos, listo para búsqueda por palabras clave
    y búsqueda semántica (RAG) del Agente de Interacción Ciudadana y del
    Agente de Verificación Constitucional.

    Devuelve un resumen: {total_detectados, nuevos, actualizados,
    sin_cambios, errores, derogados, confiable, huecos}.
    """
    def _avisar(msg: str):
        if progress_cb:
            try:
                progress_cb(msg)
            except Exception:
                pass
        logger.info(msg)

    if tipo_documento not in TIPOS_DOCUMENTO_VALIDOS:
        tipo_documento = "ley"

    texto = normalizar_texto(texto)

    _avisar(f"Analizando el formato de '{documento}' con IA (detección de patrón de artículos)...")
    try:
        perfil = generar_perfil(texto, documento)
    except Exception as e:
        logger.warning(f"No se pudo generar el perfil con IA para '{documento}': {e}")
        perfil = None

    _avisar("Dividiendo el documento en artículos y jerarquía (libro/título/capítulo)...")
    articulos = dividir_en_lineas_marcadas(texto, perfil) if perfil else []

    if not articulos:
        # El perfil inferido por el LLM no encontró nada (o no se pudo generar):
        # se intenta con el parseo genérico de respaldo antes de rendirse.
        _avisar("El patrón detectado por IA no encontró artículos; probando parseo genérico de respaldo...")
        articulos = _parseo_generico_fallback(texto)

    articulos = filtrar_derogados(articulos)

    if not articulos:
        return {
            "total_detectados": 0, "nuevos": 0, "actualizados": 0, "sin_cambios": 0,
            "errores": 0, "derogados": 0, "confiable": False, "huecos": [],
            "mensaje": "No se detectaron artículos. Revise que el documento tenga un formato reconocible "
                       "(ej. 'Artículo 1.-', 'Art. 1°', etc.).",
        }

    confiable, huecos = perfil_es_confiable(articulos)
    num_derogados = sum(1 for a in articulos if a.get("derogado"))
    _avisar(
        f"Se detectaron {len(articulos)} artículos ({num_derogados} marcados como derogados en el texto)."
        + ("" if confiable else f" Aviso: se detectaron posibles huecos de numeración: {huecos[:15]}")
    )

    contadores = {"nuevos": 0, "actualizados": 0, "sin_cambios": 0, "errores": 0}

    _avisar(f"Generando embeddings NVIDIA para {len(articulos)} artículos (en lotes)...")
    for i in range(0, len(articulos), BATCH_SIZE_EMBEDDINGS):
        lote = articulos[i:i + BATCH_SIZE_EMBEDDINGS]
        textos = [a["texto"] for a in lote]
        try:
            embeddings = generar_embeddings(textos, input_type="passage")
        except Exception as e:
            logger.warning(f"Fallo generando embeddings para el lote {i}-{i+len(lote)}: {e}")
            embeddings = [None] * len(lote)

        for art, emb in zip(lote, embeddings):
            capitulo_txt = " — ".join(
                p for p in [art.get("libro"), art.get("titulo"), art.get("capitulo")] if p
            ) or None
            contenido_hash = hashlib.sha256(art["texto"].encode("utf-8")).hexdigest()
            derogado = art.get("derogado", False)
            estado = "derogado" if derogado else ("en_tramite" if tipo_documento == "proyecto_ley" else "vigente")

            resultado = insertar_o_actualizar_articulo_normativo(
                documento=documento,
                articulo_numero=art["articulo"],
                contenido=art["texto"],
                contenido_hash=contenido_hash,
                tipo_documento=tipo_documento,
                numero_norma=numero_norma,
                articulo_titulo=art.get("titulo_articulo"),
                capitulo=capitulo_txt,
                seccion=None,
                embedding=emb,
                estado=estado,
                fecha_derogacion=art.get("fecha_derogacion"),
                norma_derogatoria=art.get("norma_derogatoria"),
            )
            contadores[{"nuevo": "nuevos", "actualizado": "actualizados",
                        "sin_cambios": "sin_cambios", "error": "errores"}.get(resultado, "errores")] += 1

        _avisar(f"Guardados {min(i + BATCH_SIZE_EMBEDDINGS, len(articulos))}/{len(articulos)} artículos...")

    return {
        "total_detectados": len(articulos),
        "derogados": num_derogados,
        "confiable": confiable,
        "huecos": huecos[:15],
        **contadores,
    }
