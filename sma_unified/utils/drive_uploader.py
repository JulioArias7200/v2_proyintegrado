"""
drive_uploader.py — Integración con Google Drive via OAuth2
Sube archivos PDF de proyectos de ley a Google Drive y retorna enlace público.
"""
import os
import io
from typing import Optional, Dict, Any
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

GOOGLE_OAUTH_CLIENT_SECRETS = os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS", "client_secrets.json")
GOOGLE_DRIVE_TOKEN_FILE = os.getenv("GOOGLE_DRIVE_TOKEN_FILE", "token.json")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")

SCOPES = ["https://www.googleapis.com/auth/drive.file"]

try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    GDRIVE_AVAILABLE = True
except ImportError:
    GDRIVE_AVAILABLE = False
    logger.warning("Librerías de Google Drive no instaladas. Opcional para subida a la nube.")

_drive_service = None


def _get_credentials() -> Optional["Credentials"]:
    """Obtiene credenciales OAuth2 válidas desde token.json o client_secrets.json."""
    if not GDRIVE_AVAILABLE:
        return None

    creds = None
    token_path = GOOGLE_DRIVE_TOKEN_FILE

    if os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            logger.warning(f"Error cargando token.json: {e}")

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(token_path, "w") as token_file:
                    token_file.write(creds.to_json())
                logger.info("Token de Google Drive renovado automáticamente.")
            except Exception as e:
                logger.warning(f"Error al renovar token de Drive: {e}")
                creds = None

        if not creds and os.path.exists(GOOGLE_OAUTH_CLIENT_SECRETS):
            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    GOOGLE_OAUTH_CLIENT_SECRETS, SCOPES
                )
                creds = flow.run_local_server(port=0, open_browser=False)
                with open(token_path, "w") as token_file:
                    token_file.write(creds.to_json())
            except Exception as e:
                logger.warning(f"No se pudo completar flujo OAuth2 de Drive: {e}")
                return None

    return creds


def _get_drive_service():
    global _drive_service
    if _drive_service is not None:
        return _drive_service

    creds = _get_credentials()
    if not creds:
        return None

    _drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _drive_service


def _get_or_create_folder(service, folder_name: str = "Expedientes Legislativos - Archivo Digital") -> str:
    if GOOGLE_DRIVE_FOLDER_ID:
        return GOOGLE_DRIVE_FOLDER_ID

    query = (
        f"name='{folder_name}' "
        "and mimeType='application/vnd.google-apps.folder' "
        "and trashed=false"
    )
    results = service.files().list(q=query, fields="files(id, name)").execute()
    existing = results.get("files", [])

    if existing:
        return existing[0]["id"]

    file_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder"
    }
    folder = service.files().create(body=file_metadata, fields="id").execute()
    return folder.get("id")


def upload_pdf_to_drive(
    file_bytes: bytes,
    filename: str,
    make_public: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Sube un archivo PDF a Google Drive.
    Returns dict con 'file_id', 'web_view_link', 'web_content_link' o None.
    """
    if not GDRIVE_AVAILABLE:
        return None

    try:
        service = _get_drive_service()
        if not service:
            return None

        folder_id = _get_or_create_folder(service)
        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype="application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream",
            resumable=True
        )

        file_metadata = {
            "name": filename,
            "parents": [folder_id] if folder_id else []
        }

        created = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, name, webViewLink, webContentLink"
        ).execute()

        file_id = created.get("id")
        web_view_link = created.get("webViewLink", "")
        web_content_link = created.get("webContentLink", "")

        if make_public and file_id:
            try:
                service.permissions().create(
                    fileId=file_id,
                    body={"type": "anyone", "role": "reader"},
                    fields="id"
                ).execute()
            except Exception as pe:
                logger.warning(f"No se pudo hacer público el archivo en Drive: {pe}")

        logger.info(f"✅ Archivo subido a Google Drive: {filename} (ID: {file_id})")
        return {
            "file_id": file_id,
            "web_view_link": web_view_link,
            "web_content_link": web_content_link,
        }
    except Exception as e:
        logger.warning(f"Error subiendo a Google Drive: {e}")
        return None
