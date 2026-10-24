from dotenv import load_dotenv
load_dotenv()
import sys, json, os
sys.path.insert(0, '.')

from sma_unified.db.neon_postgres import obtener_comisiones_con_descripcion
from openai import OpenAI
from sma_unified.agents.llm_client import extraer_json_de_llm

comisiones_data = obtener_comisiones_con_descripcion()
print(f"Comisiones cargadas desde BD: {len(comisiones_data)}")
for c in comisiones_data:
    print(f"  ID {c['id_comision']} | {c['nombre_comision']}")
    print(f"    -> {c['descripcion'][:80]}")

texto_prueba = "Proyecto de Ley de Regulacion de Energias Renovables Solar y Eolica para Bolivia"

lineas_catalogo = []
for c in comisiones_data:
    linea = (
        f"  - ID {c['id_comision']} | {c['nombre_comision']}\n"
        f"    Nombre: {c['nombre']}\n"
        f"    Descripcion: {c['descripcion']}\n"
        f"    Palabras clave: {', '.join(c.get('palabras_clave', []))}"
    )
    lineas_catalogo.append(linea)

catalogo_str = "\n".join(lineas_catalogo)
nombres_lista = "\n".join([f"  {i+1}. {c['nombre_comision']} -- {c['nombre']}" for i, c in enumerate(comisiones_data)])

system_p = (
    "Eres el Asignador Oficial de Comisiones de la Asamblea Legislativa Plurinacional de Bolivia. "
    "Tu funcion es determinar que comision parlamentaria es competente para tramitar el proyecto de ley. "
    "DEBES elegir EXACTAMENTE una comision del catalogo, copiando su nombre_comision literalmente. "
    "Responde UNICAMENTE con JSON valido, sin texto adicional."
)

user_p = f"""CATALOGO DE COMISIONES (desde base de datos):
{catalogo_str}

TEXTO DEL PROYECTO A ANALIZAR: {texto_prueba}

Elige SOLO de esta lista (copia nombre_comision exacto):
{nombres_lista}

Responde con JSON:
{{
  "comision_principal": "<nombre_comision exacto de la lista>",
  "id_comision": 0,
  "prioridad": "Alta",
  "resumen": "Resumen del proyecto en 1-2 frases",
  "justificacion": "Razon de la asignacion a esta comision"
}}"""

print()
print("--- Llamando al modelo configurado en NVIDIA NIM ---")
client = OpenAI(
    base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("NVIDIA_API_KEY", ""),
    timeout=30.0
)

try:
    completion = client.chat.completions.create(
        model=os.getenv("LLM_MODEL_CREW", "nvidia/nemotron-3.5-lightning-30b-a3b"),
        messages=[{"role": "system", "content": system_p}, {"role": "user", "content": user_p}],
        temperature=0.1,
        top_p=0.95,
        max_tokens=1500,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        stream=False
    )
    msg = completion.choices[0].message
    raw = msg.content or getattr(msg, "reasoning_content", "") or ""
    print("Respuesta raw LLM:", raw[:400])
    data = extraer_json_de_llm(raw)
    print()
    print("COMISION ASIGNADA:", data.get("comision_principal"))
    print("ID:", data.get("id_comision"))
    print("PRIORIDAD:", data.get("prioridad"))
    print("RESUMEN:", data.get("resumen"))
    print("JUSTIFICACION:", data.get("justificacion"))
except Exception as e:
    print("ERROR LLM:", e)
