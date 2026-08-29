"""
Muestreo Representativo de Texto para Prompts de LLM
======================================================
Los agentes (distribuidor, comisión, verificador constitucional, atención
ciudadana, correspondencia) enviaban a los LLMs un simple `texto[:N]` —
es decir, sólo el principio del documento. Para textos cortos (cartas,
oficios, peticiones) esto es suficiente, pero para leyes o anteproyectos
largos (30-40+ páginas, 100+ artículos, como una Ley de Inversiones) esos
primeros N caracteres normalmente sólo cubren la Exposición de Motivos y
los primeros 3-5 artículos, dejando el resto del articulado invisible
para la clasificación y, sobre todo, para la auditoría constitucional.

`muestrear_texto` arma en cambio un extracto representativo: cabecera +
varias porciones distribuidas a lo largo del documento + cierre, hasta un
presupuesto de caracteres. Funciona igual sin importar el formato de
origen (PDF, DOCX, TXT) porque opera sobre el texto ya extraído.
"""
from typing import List


def muestrear_texto(
    texto: str,
    limite_chars: int = 6000,
    num_muestras_intermedias: int = 4,
) -> str:
    """
    Devuelve un extracto representativo de `texto` de a lo sumo
    `limite_chars` caracteres.

    - Si el documento ya cabe completo dentro del límite, se devuelve tal cual.
    - Si no, se arma con: cabecera (25%) + N fragmentos distribuidos a lo
      largo del cuerpo del documento (50% del presupuesto, repartido en
      partes iguales) + cierre (25%) — cada fragmento se marca con
      "[...]" para que el LLM entienda que hay contenido omitido entre medio.
    """
    if not texto:
        return ""
    if len(texto) <= limite_chars:
        return texto

    presupuesto_cabecera = int(limite_chars * 0.25)
    presupuesto_cierre = int(limite_chars * 0.25)
    presupuesto_medio = limite_chars - presupuesto_cabecera - presupuesto_cierre

    cabecera = texto[:presupuesto_cabecera]
    cierre = texto[-presupuesto_cierre:]

    partes_medio: List[str] = []
    if num_muestras_intermedias > 0 and presupuesto_medio > 0:
        chars_por_muestra = max(200, presupuesto_medio // num_muestras_intermedias)
        inicio_zona = presupuesto_cabecera
        fin_zona = len(texto) - presupuesto_cierre
        rango_util = max(fin_zona - inicio_zona, 1)
        paso = rango_util // (num_muestras_intermedias + 1)
        for i in range(1, num_muestras_intermedias + 1):
            punto = inicio_zona + paso * i
            fragmento = texto[punto: punto + chars_por_muestra]
            if fragmento.strip():
                partes_medio.append(fragmento)

    separador = "\n\n[... contenido omitido ...]\n\n"
    return (
        cabecera.strip()
        + separador
        + separador.join(p.strip() for p in partes_medio)
        + separador
        + cierre.strip()
    )
