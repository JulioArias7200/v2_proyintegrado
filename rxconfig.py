import os
from pathlib import Path

import reflex as rx

# ────────────────────────────────────────────────────────────────────────────
# Evita que 'reflex run' construya node_modules dentro de esta carpeta cuando
# el proyecto vive dentro de una carpeta sincronizada con Google Drive (o
# OneDrive/Dropbox). El cliente de sincronización bloquea archivos binarios
# (.node) justo cuando npm los mueve, lo que provoca errores EBUSY.
#
# Con REFLEX_WEB_WORKDIR, la carpeta ".web" (que contiene node_modules, la
# parte pesada y volátil del build de frontend) se construye fuera del
# proyecto, en el perfil del usuario, donde ningún cliente de nube la toca.
# El código Python del proyecto (este repo) se sigue respaldando en Drive
# con total normalidad; solo se reubica el build de frontend.
#
# Si ya definiste REFLEX_WEB_WORKDIR manualmente en tu entorno, ese valor
# tiene prioridad (setdefault no lo sobreescribe).
# ────────────────────────────────────────────────────────────────────────────
os.environ.setdefault(
    "REFLEX_WEB_WORKDIR",
    str(Path.home() / ".reflex_builds" / "proy_integrado" / ".web"),
)

config = rx.Config(
    app_name="sma_unified",
    db_url=None,          # Usamos MongoDB Atlas, no SQLite
    backend_port=8010,
    frontend_port=3000,
    tailwind=None,
)