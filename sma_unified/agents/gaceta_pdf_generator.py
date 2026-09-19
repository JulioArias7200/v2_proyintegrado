"""
Generador Oficial de Leyes en la Gaceta Oficial del Estado Plurinacional de Bolivia
===================================================================================
Genera el documento final sancionado, corregido y promulgado en formato PDF con
estándares fidedignos de la Gaceta Oficial del Estado:
  - Franja tricolor oficial del Estado Plurinacional (Rojo, Amarillo, Verde).
  - Escudo y membrete oficial de la Gaceta Oficial de Bolivia.
  - Asignación de Número Oficial correlativo de Ley.
  - Fórmula solemne de promulgación constitucional (Art. 164 CPE).
  - Texto completo corregido y armonizado (integrando todas las enmiendas aplicadas).
  - Cierre protocolar: remisión, firma y registro con hash criptográfico SHA-256.
"""

import os
import time
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from fpdf import FPDF

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("gaceta_pdf_generator")


def _clean_str(text: str) -> str:
    """Limpia caracteres especiales para compatibilidad latin-1 en FPDF."""
    if not text:
        return ""
    replacements = {
        '—': '-', '–': '-', '“': '"', '”': '"', '’': "'", '‘': "'", '•': '*',
        'á': 'á', 'é': 'é', 'í': 'í', 'ó': 'ó', 'ú': 'ú', 'ñ': 'ñ',
        'Á': 'Á', 'É': 'É', 'Í': 'Í', 'Ó': 'Ó', 'Ú': 'Ú', 'Ñ': 'Ñ',
        'ü': 'ü', 'Ü': 'Ü', '«': '"', '»': '"', '…': '...', 'º': 'o', 'ª': 'a',
    }
    for orig, repl in replacements.items():
        text = text.replace(orig, repl)
    return text.encode('latin-1', 'replace').decode('latin-1')


class GacetaOficialPDF(FPDF):
    def __init__(self, numero_ley: str = "1548", edicion: str = "EDICIÓN OFICIAL"):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.numero_ley = numero_ley
        self.edicion = edicion
        self.set_margins(16, 16, 16)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        # Franja Tricolor Superior del Estado Plurinacional
        w_band = self.w / 3.0
        self.set_fill_color(192, 57, 43)   # Rojo (#C0392B)
        self.rect(0, 0, w_band, 5, 'F')
        self.set_fill_color(241, 196, 15)  # Amarillo (#F1C40F)
        self.rect(w_band, 0, w_band, 5, 'F')
        self.set_fill_color(13, 92, 58)    # Verde (#0D5C3A)
        self.rect(w_band * 2, 0, w_band, 5, 'F')

        self.set_y(9)
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(60, 60, 60)
        self.cell(self.epw, 4, 'ESTADO PLURINACIONAL DE BOLIVIA', 0, 1, 'C')

        self.set_font('Helvetica', 'B', 13)
        self.set_text_color(13, 92, 58)
        self.cell(self.epw, 5.5, 'GACETA OFICIAL DE BOLIVIA', 0, 1, 'C')

        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(100, 100, 100)
        self.cell(self.epw, 3.5, _clean_str(f'{self.edicion}  |  REGISTRO OFICIAL DE LEYES Y NORMAS'), 0, 1, 'C')

        self.set_draw_color(13, 92, 58)
        self.set_line_width(0.7)
        self.line(self.l_margin, 28, self.w - self.r_margin, 28)
        self.set_y(32)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(180, 180, 180)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.h - 15, self.w - self.r_margin, self.h - 15)
        self.set_font('Helvetica', '', 7.5)
        self.set_text_color(120, 120, 120)
        self.cell(self.epw / 2, 8, _clean_str(f'Gaceta Oficial de Bolivia - Ley N° {self.numero_ley}'), 0, 0, 'L')
        self.cell(self.epw / 2, 8, _clean_str(f'Página {self.page_no()}'), 0, 0, 'R')


def generar_pdf_ley_gaceta(
    id_proyecto: int,
    titulo_proyecto: str,
    numero_ley: int,
    texto_consolidado: str,
    fecha_promulgacion: Optional[str] = None,
    fecha_vigencia: Optional[str] = None,
    boletin_id: Optional[str] = None,
    correcciones_aplicadas: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Genera el PDF formal de la Ley publicada en la Gaceta Oficial del Estado Plurinacional.
    Guarda el archivo en uploaded_files/informes/ y retorna los metadatos oficiales.
    """
    correcciones_aplicadas = correcciones_aplicadas or []
    fecha_prom = fecha_promulgacion or datetime.now().strftime("%Y-%m-%d")
    fecha_vig = fecha_vigencia or datetime.now().strftime("%Y-%m-%d")
    num_ley_str = str(numero_ley)
    bol_str = boletin_id or f"GAC-{datetime.now().year}-{numero_ley:04d}"

    # Directorio de salida
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    output_dir = os.path.join(base_dir, "uploaded_files", "informes")
    os.makedirs(output_dir, exist_ok=True)

    filename = f"Ley_{numero_ley}_Gaceta_Oficial.pdf"
    file_path = os.path.join(output_dir, filename)

    pdf = GacetaOficialPDF(numero_ley=num_ley_str, edicion=f"EDICIÓN {bol_str}")
    pdf.add_page()
    epw = pdf.epw

    # 1. ENCABEZADO DE LA LEY
    pdf.set_font('Helvetica', 'B', 18)
    pdf.set_text_color(13, 92, 58)
    pdf.cell(epw, 9, _clean_str(f'LEY N° {num_ley_str}'), 0, 1, 'C')

    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(192, 57, 43)
    pdf.cell(epw, 6, _clean_str(f'LEY DE {fecha_prom.upper()}'), 0, 1, 'C')

    pdf.ln(3)

    # Título oficial de la Ley
    pdf.set_font('Helvetica', 'B', 12)
    pdf.set_text_color(20, 20, 20)
    pdf.multi_cell(epw, 5.5, _clean_str(titulo_proyecto.upper()), 0, 'C')

    pdf.ln(4)

    # 2. FÓRMULA SOLEMNE DE PROMULGACIÓN
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(226, 232, 240)
    pdf.set_font('Helvetica', 'B', 9.5)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(
        epw, 5,
        _clean_str(
            "POR CUANTO, LA ASAMBLEA LEGISLATIVA PLURINACIONAL,\n"
            "HA SANCIONADO LA SIGUIENTE LEY:"
        ),
        0, 'C'
    )
    pdf.ln(4)

    # 3. RECUADRO DE CONSTANCIA DE AUDITORÍA Y OBSERVACIONES CONSOLIDADAS
    if correcciones_aplicadas:
        pdf.set_fill_color(235, 248, 255)
        pdf.set_draw_color(43, 108, 176)
        pdf.set_line_width(0.4)
        pdf.rect(pdf.l_margin, pdf.get_y(), epw, 14, 'DF')
        
        pdf.set_xy(pdf.l_margin + 3, pdf.get_y() + 2)
        pdf.set_font('Helvetica', 'B', 8.5)
        pdf.set_text_color(43, 108, 176)
        pdf.cell(epw - 6, 4, _clean_str(f'TEXTO CORREGIDO Y CONSOLIDADO — {len(correcciones_aplicadas)} ENMIENDAS/OBSERVACIONES APLICADAS'), 0, 1, 'L')
        
        pdf.set_x(pdf.l_margin + 3)
        pdf.set_font('Helvetica', 'I', 7.5)
        pdf.set_text_color(74, 85, 104)
        pdf.cell(epw - 6, 4, _clean_str('El presente texto normativo incorpora todas las modificaciones aprobadas por las Comisiones y el Pleno.'), 0, 1, 'L')
        pdf.ln(6)

    # 4. CUERPO DE LA LEY
    pdf.set_font('Helvetica', '', 9.5)
    pdf.set_text_color(20, 20, 20)

    # Formatear el texto de la ley por párrafos
    lineas = texto_consolidado.split('\n')
    for linea in lineas:
        linea_str = linea.strip()
        if not linea_str:
            pdf.ln(2.5)
            continue

        # Detección de encabezados de artículos o capítulos
        if linea_str.upper().startswith(('ARTÍCULO', 'ARTICULO', 'CAPÍTULO', 'CAPITULO', 'DISPOSICIÓN', 'DISPOSICION', 'TÍTULO', 'TITULO')):
            pdf.ln(2)
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(13, 92, 58)
            pdf.multi_cell(epw, 5, _clean_str(linea_str), 0, 'J')
            pdf.set_font('Helvetica', '', 9.5)
            pdf.set_text_color(20, 20, 20)
        else:
            pdf.multi_cell(epw, 4.8, _clean_str(linea_str), 0, 'J')

    pdf.ln(6)

    # 5. FÓRMULA DE CIERRE, SANCIONATORIA Y PROMULGATORIA (ART. 164 CPE)
    pdf.set_font('Helvetica', 'I', 9)
    pdf.set_text_color(40, 40, 40)
    cierre_parlamentario = (
        "Remítase al Órgano Ejecutivo para fines constitucionales.\n\n"
        "Es dada en la Sala de Sesiones de la Asamblea Legislativa Plurinacional, "
        f"a los días del mes de {datetime.now().strftime('%B de %Y')}."
    )
    pdf.multi_cell(epw, 4.8, _clean_str(cierre_parlamentario), 0, 'J')

    pdf.ln(6)

    # Fórmula de Promulgación Presidencial
    pdf.set_font('Helvetica', 'B', 9.5)
    pdf.set_text_color(13, 92, 58)
    pdf.multi_cell(
        epw, 5,
        _clean_str(
            "POR TANTO, la promulgo para que se tenga y cumpla como Ley del Estado Plurinacional de Bolivia.\n"
            f"Casa Grande del Pueblo de la ciudad de La Paz, a fecha de su publicación oficial."
        ),
        0, 'C'
    )

    pdf.ln(8)

    # Firmas protocolares simbólicas
    pdf.set_draw_color(160, 160, 160)
    pdf.set_line_width(0.3)
    y_firmas = pdf.get_y()
    
    # Firma 1: Presidencia del Estado Plurinacional
    pdf.line(pdf.l_margin + 10, y_firmas + 12, pdf.l_margin + 75, y_firmas + 12)
    pdf.set_xy(pdf.l_margin + 10, y_firmas + 13)
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(65, 3.5, _clean_str('ÓRGANO EJECUTIVO'), 0, 1, 'C')
    pdf.set_x(pdf.l_margin + 10)
    pdf.set_font('Helvetica', '', 7)
    pdf.cell(65, 3, _clean_str('Presidente Constitucional del Estado'), 0, 1, 'C')

    # Firma 2: Presidencia de la ALP
    pdf.line(pdf.w - pdf.r_margin - 75, y_firmas + 12, pdf.w - pdf.r_margin - 10, y_firmas + 12)
    pdf.set_xy(pdf.w - pdf.r_margin - 75, y_firmas + 13)
    pdf.set_font('Helvetica', 'B', 8)
    pdf.cell(65, 3.5, _clean_str('ASAMBLEA LEGISLATIVA PLURINACIONAL'), 0, 1, 'C')
    pdf.set_x(pdf.w - pdf.r_margin - 75)
    pdf.set_font('Helvetica', '', 7)
    pdf.cell(65, 3, _clean_str('Presidente de la Asamblea Legislativa'), 0, 1, 'C')

    pdf.ln(16)

    # 6. REGISTRO OFICIAL Y SELLO DIGITAL
    hash_cert = hashlib.sha256(texto_consolidado.encode('utf-8')).hexdigest()
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(203, 213, 225)
    pdf.rect(pdf.l_margin, pdf.get_y(), epw, 16, 'DF')

    pdf.set_xy(pdf.l_margin + 3, pdf.get_y() + 2)
    pdf.set_font('Helvetica', 'B', 7.5)
    pdf.set_text_color(13, 92, 58)
    pdf.cell(epw - 6, 3.5, _clean_str(f'DIRECCIÓN GENERAL DE LA GACETA OFICIAL — REGISTRO N° {bol_str}'), 0, 1, 'L')

    pdf.set_x(pdf.l_margin + 3)
    pdf.set_font('Helvetica', '', 7)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(epw - 6, 3.5, _clean_str(f'Fecha de Publicación: {fecha_prom}  |  Entrada en Vigencia: {fecha_vig}'), 0, 1, 'L')

    pdf.set_x(pdf.l_margin + 3)
    pdf.set_font('Helvetica', 'I', 6.5)
    pdf.cell(epw - 6, 3, _clean_str(f'Firma Digital e Integridad SHA-256: {hash_cert}'), 0, 1, 'L')

    # Guardar archivo
    pdf.output(file_path)
    logger.info(f"✅ [Gaceta PDF] Generado exitosamente: {file_path}")

    return {
        "success": True,
        "filename": filename,
        "url_descarga": f"http://127.0.0.1:8085/uploaded_files/informes/{filename}",
        "numero_ley": numero_ley,
        "numero_ley_str": f"Ley N° {numero_ley}",
        "boletin_oficial": bol_str,
        "fecha_promulgacion": fecha_prom,
        "fecha_vigencia": fecha_vig,
        "hash_integridad": hash_cert,
        "total_enmiendas_aplicadas": len(correcciones_aplicadas)
    }
