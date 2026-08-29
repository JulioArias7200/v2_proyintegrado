"""
Página: Base Legal / Ingesta de Normativa
==========================================
Permite subir códigos, leyes, decretos, resoluciones (Código Penal, Código
de Minería, etc.) para que queden disponibles en public.articulos_constitucion,
con búsqueda por palabra clave y semántica (RAG), consumibles por el
Agente de Interacción Ciudadana y el Agente de Verificación Constitucional.
"""
import reflex as rx
from sma_unified.state import State, DocumentoNormativoItem

TIPOS_DOCUMENTO_OPCIONES = ["Constitución", "Código", "Ley", "Decreto", "Resolución", "Proyecto de Ley"]
ETIQUETAS_TIPO = {
    "constitucion": "Constitución",
    "codigo": "Código",
    "ley": "Ley",
    "decreto": "Decreto",
    "resolucion": "Resolución",
    "proyecto_ley": "Proyecto de Ley",
}


def tarjeta_ingesta() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.box(
                    rx.icon("book_open_check", size=24, color="#059669"),
                    padding="10px",
                    background="#f0fdf4",
                    border_radius="10px",
                    border="1px solid #d1fae5",
                ),
                rx.vstack(
                    rx.heading("Ingesta de Normativa Legal", size="4", weight="bold", color="#0f172a"),
                    rx.text(
                        "Suba códigos, leyes o decretos completos (Código Penal, Código de Minería, "
                        "Código de Comercio, etc.) para ampliar la base legal consultable.",
                        size="2", color="#6b7280",
                    ),
                    spacing="0", align="start",
                ),
                gap="12px", align="center", width="100%",
            ),
            rx.divider(border_color="#d1fae5"),

            rx.grid(
                rx.vstack(
                    rx.text("Nombre del documento:", size="1", color="#059669", weight="bold"),
                    rx.input(
                        placeholder="Ej. Código Penal, Código de Minería, Ley N° 535",
                        value=State.normativa_documento_nombre,
                        on_change=State.set_normativa_documento_nombre,
                        size="2", variant="surface", color_scheme="green", width="100%",
                    ),
                    spacing="1", align="start", width="100%",
                ),
                rx.vstack(
                    rx.text("Tipo de documento:", size="1", color="#059669", weight="bold"),
                    rx.select(
                        TIPOS_DOCUMENTO_OPCIONES,
                        value=State.normativa_tipo_documento,
                        on_change=State.set_normativa_tipo_documento,
                        size="2", color_scheme="green", width="100%",
                    ),
                    spacing="1", align="start", width="100%",
                ),
                rx.vstack(
                    rx.text("N° de norma (opcional):", size="1", color="#059669", weight="bold"),
                    rx.input(
                        placeholder="Ej. Ley N° 1768",
                        value=State.normativa_numero_norma,
                        on_change=State.set_normativa_numero_norma,
                        size="2", variant="surface", color_scheme="green", width="100%",
                    ),
                    spacing="1", align="start", width="100%",
                ),
                columns="3", gap="14px", width="100%",
            ),

            rx.upload(
                rx.vstack(
                    rx.icon("cloud_upload", size=32, color="#059669"),
                    rx.text("Arrastra el PDF/DOCX del código o ley, o haz clic para seleccionarlo", size="2", color="#374151", weight="medium"),
                    rx.text("Acepta .pdf, .docx y .txt", size="1", color="#6b7280"),
                    align="center", spacing="1",
                ),
                id="normativa_uploader",
                border="2px dashed #a7f3d0",
                padding="24px",
                border_radius="14px",
                background="#f8fffe",
                _hover={"border_color": "#059669", "background": "#f0fdf4"},
                cursor="pointer",
                width="100%",
                accept={
                    "application/pdf": [".pdf"],
                    "text/plain": [".txt"],
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                },
                max_files=1,
                on_drop=State.handle_upload_normativa(rx.upload_files(upload_id="normativa_uploader")),
            ),

            rx.cond(
                State.normativa_is_file_loaded,
                rx.hstack(
                    rx.icon("file_check_2", size=16, color="#059669"),
                    rx.text("Archivo listo: ", size="1", color="#374151"),
                    rx.text(State.normativa_upload_filename, size="1", color="#059669", weight="bold"),
                    gap="4px", align="center",
                ),
            ),

            rx.cond(
                State.normativa_is_processing,
                rx.hstack(
                    rx.spinner(size="2", color="#059669"),
                    rx.text(State.normativa_process_step, size="2", color="#059669", weight="medium"),
                    gap="8px",
                ),
            ),

            rx.cond(
                State.normativa_resultado_texto != "",
                rx.box(
                    rx.text(State.normativa_resultado_texto, size="2", line_height="1.6", white_space="pre-wrap",
                            color=rx.cond(State.normativa_resultado_ok, "#065f46", "#92400e")),
                    padding="12px 16px",
                    background=rx.cond(State.normativa_resultado_ok, "#f0fdf4", "#fffbeb"),
                    border_left=rx.cond(State.normativa_resultado_ok, "3px solid #059669", "3px solid #d97706"),
                    border_radius="8px",
                    width="100%",
                ),
            ),

            rx.hstack(
                rx.button(
                    rx.cond(
                        State.normativa_is_processing,
                        rx.hstack(rx.spinner(size="1"), rx.text("Procesando..."), gap="6px"),
                        rx.hstack(rx.icon("database_zap", size=15), rx.text("Procesar e Ingestar"), gap="6px"),
                    ),
                    on_click=State.ingestar_documento_normativo,
                    is_disabled=State.normativa_is_processing | ~State.normativa_is_file_loaded,
                    color_scheme="green",
                    size="2",
                    cursor="pointer",
                    style={"background": "linear-gradient(135deg, #059669 0%, #10b981 100%)", "color": "#ffffff", "font_weight": "bold"},
                ),
                rx.button(
                    rx.hstack(rx.icon("rotate_ccw", size=14), rx.text("Limpiar"), gap="6px"),
                    on_click=State.clear_normativa_upload,
                    variant="soft",
                    color_scheme="gray",
                    size="2",
                    cursor="pointer",
                ),
                gap="10px",
            ),

            spacing="4", width="100%",
        ),
        padding="22px 26px",
        background="#ffffff",
        border="1px solid #d1fae5",
        border_radius="16px",
        box_shadow="0 2px 10px rgba(5, 150, 105, 0.08)",
        width="100%",
    )


def fila_documento(doc: DocumentoNormativoItem) -> rx.Component:
    return rx.hstack(
        rx.icon("file_text", size=16, color="#059669"),
        rx.vstack(
            rx.text(doc.documento, size="2", weight="bold", color="#0f172a"),
            rx.hstack(
                rx.badge(doc.tipo_documento, color_scheme="green", size="1", variant="surface"),
                rx.cond(doc.numero_norma != "", rx.text(doc.numero_norma, size="1", color="#6b7280")),
                gap="6px", align="center",
            ),
            spacing="0", align="start",
        ),
        rx.spacer(),
        rx.vstack(
            rx.badge(doc.num_articulos.to_string() + " artículos", color_scheme="teal", size="1", variant="soft"),
            rx.text(doc.ultima_actualizacion, size="1", color="#9ca3af"),
            spacing="0", align="end",
        ),
        align="center",
        width="100%",
        padding="12px 16px",
        background="#fafffe",
        border="1px solid #e2f5ea",
        border_radius="10px",
    )


def tarjeta_base_legal() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.heading("Base Legal Cargada", size="4", weight="bold", color="#0f172a"),
                rx.spacer(),
                rx.button(
                    rx.icon("refresh_cw", size=14),
                    on_click=State.cargar_documentos_normativos,
                    variant="ghost",
                    color_scheme="green",
                    size="1",
                    cursor="pointer",
                ),
                width="100%", align="center",
            ),
            rx.cond(
                State.normativa_documentos.length() > 0,
                rx.vstack(
                    rx.foreach(State.normativa_documentos, fila_documento),
                    spacing="2", width="100%",
                ),
                rx.text(
                    "Todavía no hay cuerpos normativos cargados aparte de la base inicial. "
                    "Suba un código o ley arriba para empezar.",
                    size="2", color="#6b7280",
                ),
            ),
            spacing="3", width="100%",
        ),
        padding="20px 24px",
        background="#ffffff",
        border="1px solid #d1fae5",
        border_radius="16px",
        box_shadow="0 2px 10px rgba(5, 150, 105, 0.08)",
        width="100%",
    )


def normativa_page() -> rx.Component:
    return rx.vstack(
        tarjeta_ingesta(),
        tarjeta_base_legal(),
        spacing="5",
        width="100%",
    )
