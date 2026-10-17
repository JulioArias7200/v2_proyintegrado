"""
drive_uploader.py — Integración con Google Drive via OAuth2
Sube exclusivamente:
1. Reportes y Dictámenes Formales emitidos por el Sistema Multi-Agente (Concentrador / Emisor).
2. Leyes Sancionadas y ya Editadas (publicadas en Gaceta Oficial).
NOTA: Los archivos subidos por el usuario en Mesa de Partes se mantienen en almacenamiento local
      y NO se suben a Google Drive ("NO PARA LOS DE SUBIDA").
"""
import os
import io
from pathlib import Path
from typing import Optional, Dict, Any
from loguru import logger
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

GOOGLE_OAUTH_CLIENT_SECRETS = os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS", "client_secrets.json")
GOOGLE_DRIVE_TOKEN_FILE = os.getenv("GOOGLE_DRIVE_TOKEN_FILE", "token.json")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "1bJc0BO9IlzIm3zPeJV2t0ICrp1yTK7C4")

# Nombres de subcarpetas en Google Drive para organización formal
CARPETA_PROYECTOS_INICIALES = "Proyectos de Ley de Entrada (Mesa de Partes)"
CARPETA_REPORTES = "Reportes y Dictamenes Legislativos"
CARPETA_LEYES = "Leyes Editadas y Promulgadas (Gaceta Oficial)"

# Scopes con soporte para creación y administración en carpetas compartidas
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive"
]

try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    GDRIVE_AVAILABLE = True
except ImportError:
    GDRIVE_AVAILABLE = False
    logger.warning("Librerías de Google Drive no instaladas en este entorno Python.")

_drive_service = None


def _resolve_path(path_str: str) -> Path:
    p = Path(path_str)
    if not p.is_absolute():
        p = BASE_DIR / p
    return p


def _get_credentials(interactive: bool = False) -> Optional["Credentials"]:
    """
    Obtiene credenciales OAuth2 válidas desde token.json o client_secrets.json.
    Si interactive=False y token.json no existe, no congela el servidor; retorna None.
    """
    if not GDRIVE_AVAILABLE:
        return None

    creds = None
    token_path = _resolve_path(GOOGLE_DRIVE_TOKEN_FILE)
    secrets_path = _resolve_path(GOOGLE_OAUTH_CLIENT_SECRETS)

    # 1. Intentar cargar token existente
    if token_path.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        except Exception as e:
            logger.warning(f"Error cargando token.json ({token_path}): {e}")

    # 2. Refrescar token expirado si cuenta con refresh_token
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(token_path, "w", encoding="utf-8") as tf:
                tf.write(creds.to_json())
            logger.info("✅ Token de Google Drive renovado automáticamente.")
        except Exception as e:
            logger.warning(f"Error al renovar token de Drive: {e}")
            creds = None

    # 3. Si no hay credenciales y es interactivo (ej. CLI o script de auth), abrir flujo en navegador
    if not creds or not creds.valid:
        if interactive and secrets_path.exists():
            try:
                logger.info(f"Iniciando flujo interactivo OAuth2 con {secrets_path}...")
                flow = InstalledAppFlow.from_client_secrets_file(str(secrets_path), SCOPES)
                creds = flow.run_local_server(port=0, open_browser=True)
                with open(token_path, "w", encoding="utf-8") as tf:
                    tf.write(creds.to_json())
                logger.info(f"✅ Token de Google Drive guardado exitosamente en: {token_path}")
            except Exception as e:
                logger.warning(f"No se pudo completar flujo interactivo OAuth2 de Drive: {e}")
                return None
        elif not creds and not token_path.exists():
            logger.info(
                f"[Google Drive] token.json no encontrado ({token_path}). "
                "Para autorizar la subida a Drive, ejecute en la terminal: python auth_drive.py"
            )
            return None

    return creds if (creds and creds.valid) else None


def autorizar_interactivamente() -> bool:
    """Ejecuta el flujo interactivo de OAuth2 abriendo el navegador."""
    creds = _get_credentials(interactive=True)
    return bool(creds and creds.valid)


def _get_drive_service():
    global _drive_service
    if _drive_service is not None:
        return _drive_service

    creds = _get_credentials(interactive=False)
    if not creds:
        return None

    _drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _drive_service


def _get_or_create_subfolder(service, folder_name: str, parent_id: Optional[str] = None) -> str:
    """
    Busca o crea una subcarpeta con `folder_name` dentro de `parent_id`.
    Si parent_id no se proporciona, usa GOOGLE_DRIVE_FOLDER_ID si está definido.
    """
    parent = parent_id or GOOGLE_DRIVE_FOLDER_ID or ""

    # Normalizar comillas simples en el nombre para la consulta
    nombre_seguro = folder_name.replace("'", "\\'")

    if parent:
        query = (
            f"name='{nombre_seguro}' and "
            "mimeType='application/vnd.google-apps.folder' and "
            f"'{parent}' in parents and "
            "trashed=false"
        )
    else:
        query = (
            f"name='{nombre_seguro}' and "
            "mimeType='application/vnd.google-apps.folder' and "
            "trashed=false"
        )

    try:
        results = service.files().list(
            q=query,
            fields="files(id, name)",
            spaces="drive",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        existing = results.get("files", [])
        if existing:
            return existing[0]["id"]
    except Exception as e:
        logger.warning(f"Error consultando subcarpeta '{folder_name}' en Drive: {e}")

    # Si no existe, crear la carpeta
    file_metadata: Dict[str, Any] = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent:
        file_metadata["parents"] = [parent]

    try:
        folder = service.files().create(
            body=file_metadata,
            fields="id, name",
            supportsAllDrives=True
        ).execute()
        folder_id = folder.get("id")
        logger.info(f"📁 Subcarpeta creada en Drive: '{folder_name}' (ID: {folder_id}, Padre: {parent})")
        return folder_id
    except Exception as e:
        logger.warning(f"Error creando subcarpeta '{folder_name}' en Drive: {e}")
        # En caso de error al crear subcarpeta, fallback al padre o raíz
        return parent or ""


def resolver_carpeta_destino(
    service,
    categoria: str = "reportes",
    subcarpeta: Optional[str] = None
) -> str:
    """
    Resuelve el ID de carpeta en Drive según la categoría solicitada:
    - 'reportes': Subcarpeta 'Reportes y Dictamenes Legislativos'
    - 'leyes_editadas': Subcarpeta 'Leyes Editadas y Promulgadas (Gaceta Oficial)'
    - Si se especifica `subcarpeta` (ej. EXP-0104 o Ley_1548), crea una subcarpeta específica dentro de la categoría.
    """
    # 1. Carpeta de categoría principal
    if categoria == "leyes_editadas":
        cat_folder_name = CARPETA_LEYES
    elif categoria in ("proyectos_iniciales", "proyecto_inicial", "entradas"):
        cat_folder_name = CARPETA_PROYECTOS_INICIALES
    else:
        cat_folder_name = CARPETA_REPORTES

    parent_cat_id = _get_or_create_subfolder(
        service,
        folder_name=cat_folder_name,
        parent_id=GOOGLE_DRIVE_FOLDER_ID or None
    )

    # 2. Si se solicita una subcarpeta interna (ej. por expediente o por ley)
    if subcarpeta:
        sub_id = _get_or_create_subfolder(
            service,
            folder_name=subcarpeta,
            parent_id=parent_cat_id
        )
        return sub_id or parent_cat_id

    return parent_cat_id or GOOGLE_DRIVE_FOLDER_ID or ""


def upload_pdf_to_drive(
    file_bytes: bytes,
    filename: str,
    categoria: str = "reportes",   # "reportes" | "leyes_editadas" | "proyectos_iniciales"
    subcarpeta: Optional[str] = None,
    make_public: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Sube un documento oficial (Proyecto Inicial, Reporte/Dictamen o Ley Editada) a Google Drive.
    """
    if not GDRIVE_AVAILABLE:
        return None

    try:
        service = _get_drive_service()
        if not service:
            return None

        # Resolver la carpeta destino según categoría
        target_folder_id = resolver_carpeta_destino(service, categoria=categoria, subcarpeta=subcarpeta)

        # Detectar MIME type
        ext = Path(filename).suffix.lower()
        if ext == ".pdf":
            mimetype = "application/pdf"
        elif ext in (".docx", ".doc"):
            mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ext == ".txt":
            mimetype = "text/plain; charset=utf-8"
        else:
            mimetype = "application/octet-stream"

        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype=mimetype,
            resumable=True
        )

        file_metadata: Dict[str, Any] = {
            "name": filename,
            "description": f"Documento oficial del Sistema Multi-Agente ALP — Categoría: {categoria}"
        }
        if target_folder_id:
            file_metadata["parents"] = [target_folder_id]

        created = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, name, webViewLink, webContentLink, parents",
            supportsAllDrives=True
        ).execute()

        file_id = created.get("id")
        web_view_link = created.get("webViewLink", "")
        web_content_link = created.get("webContentLink", "")

        if make_public and file_id:
            try:
                service.permissions().create(
                    fileId=file_id,
                    body={"type": "anyone", "role": "reader"},
                    fields="id",
                    supportsAllDrives=True
                ).execute()
            except Exception as pe:
                logger.warning(f"No se pudo asignar permiso público en Drive: {pe}")

        logger.info(
            f"✅ [Google Drive] Archivo subido con éxito: '{filename}' | "
            f"ID: {file_id} | Carpeta: {target_folder_id} | Categoría: {categoria}"
        )
        return {
            "file_id": file_id,
            "web_view_link": web_view_link,
            "web_content_link": web_content_link,
            "folder_id": target_folder_id,
            "categoria": categoria,
            "filename": filename
        }
    except Exception as e:
        logger.warning(f"Error subiendo '{filename}' a Google Drive: {e}")
        return None


def verificar_conexion_drive() -> Dict[str, Any]:
    """
    Diagnostica y retorna el estado de la integración con Google Drive:
    - Disponibilidad de librerías
    - Existencia de client_secrets.json y token.json
    - Validez de la autenticación
    - Identificación de carpetas configuradas
    """
    token_path = _resolve_path(GOOGLE_DRIVE_TOKEN_FILE)
    secrets_path = _resolve_path(GOOGLE_OAUTH_CLIENT_SECRETS)

    estado = {
        "librerias_instaladas": GDRIVE_AVAILABLE,
        "secrets_file_existe": secrets_path.exists(),
        "token_file_existe": token_path.exists(),
        "folder_id_configurado": GOOGLE_DRIVE_FOLDER_ID,
        "autenticado": False,
        "usuario_email": None,
        "carpetas": {
            "proyectos_iniciales": CARPETA_PROYECTOS_INICIALES,
            "reportes": CARPETA_REPORTES,
            "leyes": CARPETA_LEYES,
        },
        "mensaje": ""
    }

    if not GDRIVE_AVAILABLE:
        estado["mensaje"] = "Librerías google-api-python-client no instaladas."
        return estado

    if not secrets_path.exists():
        estado["mensaje"] = f"Archivo de credenciales no encontrado en: {secrets_path}"
        return estado

    service = _get_drive_service()
    if not service:
        if not token_path.exists():
            estado["mensaje"] = "Pendiente de autorización. Ejecute 'python auth_drive.py' para autenticar."
        else:
            estado["mensaje"] = "Token inválido o expirado. Ejecute 'python auth_drive.py'."
        return estado

    try:
        about = service.about().get(fields="user, storageQuota").execute()
        user_info = about.get("user", {})
        estado["autenticado"] = True
        estado["usuario_email"] = user_info.get("emailAddress")
        estado["mensaje"] = f"Conexión activa con Google Drive ({estado['usuario_email']})"
    except Exception as e:
        estado["mensaje"] = f"Error al verificar servicio de Drive: {e}"

    return estado
