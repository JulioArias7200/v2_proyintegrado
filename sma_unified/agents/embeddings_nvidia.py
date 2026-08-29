"""
Generación de embeddings usando la API de NVIDIA (NIM), vía el endpoint
OpenAI-compatible /v1/embeddings. Reutiliza `sma_unified.config.settings`
(las mismas credenciales NVIDIA que ya usa el resto del sistema).

Modelo: settings.NVIDIA_EMBED_MODEL (por defecto nvidia/nemotron-3-embed-1b)
  - Dimensión del vector: settings.NVIDIA_EMBED_DIM (por defecto 2048)
  - Ventana de contexto: 32768 tokens

input_type:
  - "passage" → indexar/insertar artículos
  - "query"   → preguntar/buscar (usado por el chat del Agente de Interacción Ciudadana)
"""
import time
from typing import List, Optional

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    OpenAI = None

import requests
from sma_unified.config import settings

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("sma_embeddings")

BATCH_SIZE = 16
MAX_CHARS = 120_000  # ~32768 tokens * 3.5 chars/token (español), con margen

_client = None


def _get_client():
    global _client
    if _client is None and HAS_OPENAI:
        _client = OpenAI(base_url=settings.NVIDIA_BASE_URL, api_key=settings.NVIDIA_API_KEY)
    return _client


def _truncar_texto(texto: str) -> str:
    if len(texto) > MAX_CHARS:
        return texto[:MAX_CHARS]
    return texto


def _embed_una_llamada(textos: List[str], input_type: str) -> List[List[float]]:
    textos_truncados = [_truncar_texto(t) for t in textos]
    client = _get_client()
    if client is not None:
        resp = client.embeddings.create(
            input=textos_truncados,
            model=settings.NVIDIA_EMBED_MODEL,
            encoding_format="float",
            extra_body={"input_type": input_type, "truncate": "NONE"},
        )
        return [d.embedding for d in resp.data]

    # Fallback vía HTTP directo con requests
    url = f"{settings.NVIDIA_BASE_URL.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "input": textos_truncados,
        "model": settings.NVIDIA_EMBED_MODEL,
        "encoding_format": "float",
        "input_type": input_type,
        "truncate": "NONE",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=60)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    return [d["embedding"] for d in data]


def generar_embeddings(
    textos, input_type: str = "passage", batch_size: int = BATCH_SIZE, reintentos: int = 3
) -> List[List[float]]:
    """Genera embeddings para una lista de textos, en lotes, con reintentos."""
    if isinstance(textos, str):
        textos = [textos]

    resultados: List[List[float]] = []
    for i in range(0, len(textos), batch_size):
        lote = textos[i:i + batch_size]
        ultimo_error = None
        for intento in range(reintentos):
            try:
                resultados.extend(_embed_una_llamada(lote, input_type))
                ultimo_error = None
                time.sleep(0.3)
                break
            except Exception as e:
                ultimo_error = e
                logger.warning(f"[Embeddings NVIDIA] Intento {intento + 1}/{reintentos} falló: {e}")
                time.sleep(1.5 * (intento + 1))
        if ultimo_error is not None:
            raise ultimo_error
    return resultados


def embeber_pregunta(pregunta: str) -> List[float]:
    """Embedding de una sola consulta (input_type='query')."""
    return generar_embeddings([pregunta], input_type="query")[0]
