"""
Detección del formato/patrón de artículos de un documento legal boliviano,
usando el LLM (vía NVIDIA NIM) para inferir las expresiones regulares que
delimitan jerarquía (libro/título/capítulo/sección) e inicio de artículo.

El modelo NO extrae contenido: solo identifica los patrones a partir de una
muestra del texto. El parseo real del documento completo se hace luego con
regex puro en `ingest_normativa.py` (rápido, sin costo de LLM por artículo).
"""
import json
import re
from typing import Dict

from sma_unified.agents.llm_client import chat_completion_resiliente

PROMPT_PERFIL = """Analiza esta muestra de un documento legal boliviano y devuelve
SOLO un JSON (sin texto adicional, sin markdown, sin ```), con esta estructura:

{{
  "jerarquia": {{
    "libro": "<regex Python o null si no aplica>",
    "titulo": "<regex Python o null>",
    "capitulo": "<regex Python o null>",
    "seccion": "<regex Python o null, si el documento usa 'Sección' en vez de 'Capítulo'>"
  }},
  "articulo_inicio": "<regex que matchea el inicio de un artículo>",
  "articulo_num": "<regex con exactamente 1 grupo de captura para el número>",
  "prefijos_inicio": ["<palabras en minúscula con las que arranca la línea de un artículo>"]
}}

Reglas:
- Regex compatibles con el módulo `re` de Python, en español.
- Respeta mayúsculas, tildes y símbolos exactos que veas en el texto (°, º, guiones, etc).
- "articulo_num" debe tener un solo grupo de captura `(...)` para el número/identificador del artículo.
- No inventes campos ni jerarquía que no exista en la muestra.

MUESTRA:
{muestra}
"""


def _limpiar_json(texto: str) -> str:
    texto = texto.strip()
    texto = re.sub(r'^```(?:json)?\s*', '', texto)
    texto = re.sub(r'\s*```$', '', texto)
    return texto.strip()


def generar_perfil(texto_muestra: str, nombre_doc: str, chars_muestra: int = 6000) -> Dict:
    """Pide al LLM que infiera el patrón de artículos/jerarquía de `nombre_doc`."""
    contenido, _modelo = chat_completion_resiliente(
        messages=[{"role": "user", "content": PROMPT_PERFIL.format(muestra=texto_muestra[:chars_muestra])}],
        temperature=0,
        max_tokens=1500,
    )
    from sma_unified.agents.llm_client import extraer_json_de_llm

    try:
        perfil = extraer_json_de_llm(contenido)
    except Exception as e:
        raise ValueError(f"El LLM no devolvió JSON válido para '{nombre_doc}':\n{contenido}") from e

    if not perfil.get("articulo_inicio") or not perfil.get("articulo_num"):
        raise ValueError(f"Perfil incompleto detectado para '{nombre_doc}': {perfil}")

    perfil.setdefault("jerarquia", {})
    perfil.setdefault("prefijos_inicio", ["artículo", "articulo", "art."])
    perfil["nombre"] = nombre_doc
    return perfil
