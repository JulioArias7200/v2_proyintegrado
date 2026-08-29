"""
Servidor de Carga de Documentos (FastAPI)
==========================================
Completamente independiente de Reflex.
- GET  /           -> Formulario HTML simple para subir PDF
- POST /upload     -> Guarda el PDF, extrae texto con Docling, guarda en MongoDB
- GET  /status     -> Estado del ultimo procesamiento (JSON)
- GET  /docs       -> Swagger UI

Ejecutar:  python upload_server.py
Puerto:    http://localhost:8010
"""
import os
import sys
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path

# Asegura que el paquete sma_unified este en el path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Carga .env
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="SMA Congreso — Carga de Documentos", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = BASE_DIR / "uploaded_files"
UPLOAD_DIR.mkdir(exist_ok=True)

# Estado en memoria del ultimo procesamiento
_ultimo_estado: dict = {}


# ── Formulario HTML ─────────────────────────────────────────────────────────
HTML_FORM = """
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SMA Congreso — Mesa de Partes Digital</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #062e26 0%, #093c32 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(6, 78, 59, 0.4);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 20px;
    padding: 40px;
    max-width: 560px;
    width: 100%;
    backdrop-filter: blur(12px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }
  h1 {
    color: #34d399;
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .subtitle { color: #a7f3d0; font-size: 0.9rem; margin-bottom: 30px; }
  .drop-zone {
    border: 2px dashed #10b981;
    border-radius: 14px;
    padding: 40px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(6, 34, 28, 0.5);
    margin-bottom: 20px;
  }
  .drop-zone:hover { border-color: #34d399; background: rgba(6, 34, 28, 0.8); }
  .drop-zone svg { color: #34d399; margin-bottom: 12px; }
  .drop-zone p { color: #f0fdf4; font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
  .drop-zone small { color: #a7f3d0; font-size: 0.8rem; }
  #file-name {
    color: #6ee7b7; font-size: 0.85rem;
    margin: 10px 0; min-height: 20px; text-align: center;
  }
  button {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #059669, #10b981);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
    box-shadow: 0 4px 20px rgba(16,185,129,0.4);
  }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  #status {
    margin-top: 20px;
    padding: 14px;
    border-radius: 10px;
    font-size: 0.85rem;
    display: none;
  }
  .status-ok   { background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #34d399; }
  .status-err  { background: rgba(239,68,68,0.15);  border: 1px solid #ef4444; color: #fca5a5; }
  .status-wait { background: rgba(245,158,11,0.15); border: 1px solid #f59e0b; color: #fde68a; }
  input[type=file] { display: none; }
  .progress { height: 4px; background: rgba(16,185,129,0.2); border-radius: 4px; margin-top: 12px; display: none; }
  .progress-bar { height: 100%; background: #10b981; border-radius: 4px; animation: indeterminate 1.5s infinite; }
  @keyframes indeterminate { 0%{width:0%;margin-left:0} 50%{width:60%;margin-left:20%} 100%{width:0%;margin-left:100%} }
</style>
</head>
<body>
<div class="card">
  <h1>🏛️ Mesa de Partes Digital</h1>
  <p class="subtitle">Cámara de Senadores — Estado Plurinacional de Bolivia</p>

  <form id="uploadForm" enctype="multipart/form-data">
    <div class="drop-zone" onclick="document.getElementById('fileInput').click()"
         ondragover="event.preventDefault()" ondrop="onDrop(event)">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
      </svg>
      <p>Arrastra tu documento o haz clic para seleccionar</p>
      <small>PDF · DOCX · TXT — máximo 50 MB</small>
    </div>
    <input type="file" id="fileInput" name="file" accept=".pdf,.docx,.txt"
           onchange="onFileSelect(this)">
    <div id="file-name">Ningún archivo seleccionado</div>
    <button type="submit" id="btnSubir" disabled>📤 Subir y Procesar Documento</button>
    <div class="progress" id="progress"><div class="progress-bar"></div></div>
  </form>

  <div id="status"></div>
</div>

<script>
function onDrop(e) {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f) { document.getElementById('fileInput').files = e.dataTransfer.files; onFileSelect(document.getElementById('fileInput')); }
}
function onFileSelect(input) {
  const f = input.files[0];
  if (!f) return;
  document.getElementById('file-name').textContent = '📄 ' + f.name + '  (' + (f.size/1024).toFixed(0) + ' KB)';
  document.getElementById('btnSubir').disabled = false;
}
document.getElementById('uploadForm').onsubmit = async function(e) {
  e.preventDefault();
  const formData = new FormData(this);
  const btn = document.getElementById('btnSubir');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');

  btn.disabled = true;
  btn.textContent = '⏳ Procesando...';
  progress.style.display = 'block';
  status.style.display = 'block';
  status.className = 'status-wait';
  status.textContent = 'Subiendo y procesando el documento con Docling...';

  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    progress.style.display = 'none';
    if (res.ok) {
      status.className = 'status-ok';
      status.innerHTML = `<strong>✅ Documento procesado correctamente</strong><br>
        📄 Archivo: ${data.filename}<br>
        📖 Páginas: ${data.num_paginas} | 📝 Palabras: ${data.palabras}<br>
        🔧 Motor: ${data.motor}<br>
        💾 Guardado en MongoDB: ${data.guardado_mongo ? 'Sí' : 'No'}<br>
        🆔 doc_id: <code>${data.doc_id || 'N/A'}</code><br><br>
        <em>Vista previa del texto:</em><br>
        <pre style="max-height:200px;overflow:auto;font-size:0.75rem;margin-top:8px;background:rgba(0,0,0,0.3);padding:10px;border-radius:6px">${(data.texto_preview||'').replace(/</g,'&lt;')}</pre>`;
      btn.textContent = '📤 Subir otro documento';
    } else {
      status.className = 'status-err';
      status.innerHTML = `<strong>❌ Error:</strong> ${data.detail || data.error || 'Error desconocido'}`;
      btn.textContent = '📤 Subir y Procesar Documento';
    }
  } catch (err) {
    progress.style.display = 'none';
    status.className = 'status-err';
    status.textContent = '❌ Error de red: ' + err.message;
    btn.textContent = '📤 Subir y Procesar Documento';
  }
  btn.disabled = false;
};
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index():
    """Formulario HTML de carga de documentos."""
    return HTML_FORM


@app.post("/upload")
async def upload_documento(file: UploadFile = File(...)):
    """
    Recibe el archivo, lo guarda, extrae texto con Docling y guarda en MongoDB.
    """
    global _ultimo_estado

    # Validar extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".pdf", ".docx", ".doc", ".txt", ".md"}:
        raise HTTPException(400, detail=f"Formato no soportado: {ext}. Usa PDF, DOCX o TXT.")

    # Leer bytes
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(400, detail="El archivo está vacío.")
    if len(file_bytes) > 50 * 1024 * 1024:
        raise HTTPException(400, detail="El archivo supera el límite de 50 MB.")

    filename = file.filename or f"documento_{uuid.uuid4().hex[:8]}{ext}"
    file_path = str(UPLOAD_DIR / filename)

    # Guardar en disco
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Procesar con Docling + guardar en MongoDB
    sesion_id = str(uuid.uuid4())
    try:
        from sma_unified.utils.docling_processor import procesar_y_guardar
        texto, meta = procesar_y_guardar(file_path, filename, file_bytes, sesion_id)
        guardado_mongo = True
    except Exception as e:
        # Fallback: solo pdfplumber sin MongoDB
        guardado_mongo = False
        try:
            from sma_unified.utils.doc_extractor import extraer_texto_archivo
            texto, meta = extraer_texto_archivo(filename, file_bytes)
            meta["error_mongo"] = str(e)
        except Exception as e2:
            raise HTTPException(500, detail=f"No se pudo procesar el archivo: {e2}")

    resultado = {
        "ok": True,
        "filename": filename,
        "file_path": file_path,
        "sesion_id": sesion_id,
        "doc_id": meta.get("doc_id"),
        "motor": meta.get("motor", "desconocido"),
        "num_paginas": meta.get("num_paginas", 0),
        "palabras": meta.get("palabras", 0),
        "caracteres": meta.get("caracteres", 0),
        "guardado_mongo": guardado_mongo,
        "texto_preview": texto[:500] if texto else "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _ultimo_estado = resultado
    return JSONResponse(resultado)


@app.get("/status")
async def status():
    """Retorna el estado del último procesamiento."""
    return JSONResponse(_ultimo_estado or {"ok": False, "message": "Sin procesar aún."})


if __name__ == "__main__":
    print("\n" + "="*55)
    print("  SMA Congreso — Servidor de Carga de Documentos")
    print("  http://localhost:8010")
    print("="*55 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8010, reload=False)
