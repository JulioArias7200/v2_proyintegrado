"""
Configuración unificada del Sistema Multi-Agente (SMA) Congreso.
Carga variables de entorno desde .env y provee settings tipados.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Carga .env ─────────────────────────────────────────────────────────────
def _load_env(env_path: Path):
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v

_load_env(BASE_DIR / ".env")

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=str(BASE_DIR / ".env"),
            env_file_encoding="utf-8",
            extra="ignore",
        )

        # ── LLM ────────────────────────────────────────────────────────────
        NVIDIA_API_KEY: str = Field(default="")
        NVIDIA_BASE_URL: str = Field(default="https://integrate.api.nvidia.com/v1")
        LLM_MODEL_CREW: str = Field(default="nvidia/nemotron-3-super-120b-a12b")
        LLM_MODEL_NVIDIA: str = Field(default="nvidia/nemotron-3-super-120b-a12b")

        # ── Agente de Consistencia Normativa (embeddings + pgvector) ────────
        NVIDIA_EMBED_MODEL: str = Field(default="nvidia/nemotron-3-embed-1b")
        NVIDIA_EMBED_DIM: int = Field(default=2048)
        LLM_MODEL_CONSISTENCIA: str = Field(default="nvidia/nemotron-3-super-120b-a12b")
        UMBRAL_CONSISTENCIA: float = Field(default=0.55)
        TOP_K_CONSISTENCIA: int = Field(default=8)

        # ── MongoDB Atlas ──────────────────────────────────────────────────
        MONGO_URI: str = Field(default="")
        MONGO_DB: str = Field(default="sma_congreso")

        # ── PostgreSQL Neon ────────────────────────────────────────────────
        NEON_DATABASE_URL: str = Field(default="")

        # ── Google Drive ───────────────────────────────────────────────────
        GOOGLE_OAUTH_CLIENT_SECRETS: str = Field(default="client_secrets.json")
        GOOGLE_DRIVE_TOKEN_FILE: str = Field(default="token.json")
        GOOGLE_DRIVE_FOLDER_ID: str = Field(default="")

        # ── Sistema ────────────────────────────────────────────────────────
        AGENTE_VERSION: str = Field(default="2.0.0")
        MAX_REINTENTOS: int = Field(default=3)
        TIMEOUT_LLM_SEG: int = Field(default=120)

        @property
        def uploads_dir(self) -> Path:
            d = BASE_DIR / "data" / "uploads"
            d.mkdir(parents=True, exist_ok=True)
            return d

    settings = Settings()

except Exception:
    class SettingsFallback:
        def __init__(self):
            self.NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
            self.NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
            self.LLM_MODEL_CREW = os.getenv("LLM_MODEL_CREW", "nvidia/nemotron-3-super-120b-a12b")
            self.LLM_MODEL_NVIDIA = os.getenv("LLM_MODEL_NVIDIA", "nvidia/nemotron-3-super-120b-a12b")
            self.NVIDIA_EMBED_MODEL = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/nemotron-3-embed-1b")
            self.NVIDIA_EMBED_DIM = int(os.getenv("NVIDIA_EMBED_DIM", "2048"))
            self.LLM_MODEL_CONSISTENCIA = os.getenv("LLM_MODEL_CONSISTENCIA", "nvidia/nemotron-3-super-120b-a12b")
            self.UMBRAL_CONSISTENCIA = float(os.getenv("UMBRAL_CONSISTENCIA", "0.55"))
            self.TOP_K_CONSISTENCIA = int(os.getenv("TOP_K_CONSISTENCIA", "8"))
            self.MONGO_URI = os.getenv("MONGO_URI", "")
            self.MONGO_DB = os.getenv("MONGO_DB", "sma_congreso")
            self.NEON_DATABASE_URL = os.getenv("NEON_DATABASE_URL", "")
            self.GOOGLE_OAUTH_CLIENT_SECRETS = os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS", "client_secrets.json")
            self.GOOGLE_DRIVE_TOKEN_FILE = os.getenv("GOOGLE_DRIVE_TOKEN_FILE", "token.json")
            self.GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
            self.AGENTE_VERSION = os.getenv("AGENTE_VERSION", "2.0.0")
            self.MAX_REINTENTOS = int(os.getenv("MAX_REINTENTOS", "3"))
            self.TIMEOUT_LLM_SEG = int(os.getenv("TIMEOUT_LLM_SEG", "120"))

        @property
        def uploads_dir(self) -> Path:
            d = BASE_DIR / "data" / "uploads"
            d.mkdir(parents=True, exist_ok=True)
            return d

    settings = SettingsFallback()

# ── Nombres de Agentes (constantes) ───────────────────────────────────────
AGENTE_USUARIO = "Usuario"
AGENTE_DISTRIBUIDOR = "Agente_Distribuidor"
AGENTE_COMISION = "Agente_Comision_Legislativa"
AGENTE_VERIFICADOR = "Agente_Verificador_Constitucional"
AGENTE_ATENCION_CIUDADANA = "Agente_Atencion_Ciudadana"
AGENTE_CORRESPONDENCIA = "Agente_Gestion_Correspondencia"
AGENTE_CONSISTENCIA = "Agente_Consistencia_Normativa"

# ── Relaciones válidas del Agente de Consistencia Normativa ───────────────
TIPOS_RELACION_CONSISTENCIA = {
    "contradiccion", "repeticion", "vacio_llenado", "complementario", "sin_relacion"
}

# ── Categorías de clasificación ───────────────────────────────────────────
CATEGORIAS_VALIDAS = {
    "AGENTE_REGISTRO_LEGISLATIVO",
    "AGENTE_ATENCION_CIUDADANA",
    "AGENTE_GESTION_CORRESPONDENCIA",
}


# ── Cargadores de configuración YAML (CrewAI) ──────────────────────────────
def load_agents_yaml() -> dict:
    """Carga las definiciones de agentes desde config/agents.yaml."""
    import yaml
    yaml_path = Path(__file__).resolve().parent / "config" / "agents.yaml"
    if yaml_path.exists():
        with open(yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def load_tasks_yaml() -> dict:
    """Carga las definiciones de tareas desde config/tasks.yaml."""
    import yaml
    yaml_path = Path(__file__).resolve().parent / "config" / "tasks.yaml"
    if yaml_path.exists():
        with open(yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}
