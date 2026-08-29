"""
Página del Agente de Interacción Ciudadana
=========================================
El Agente de Interacción Ciudadana actúa como una persona real del Senado:
- Recibe datos del ciudadano (nombre, motivo, modo de recepción)
- Responde de forma natural usando LLM (licenciada María Helena Choque)
- Permite adjuntar el documento PDF una vez registrado
- Muestra el contenido del documento en una ventana emergente modal
- Es completamente independiente del resto de agentes
"""
import reflex as rx
from sma_unified.state import State


def _modal_visor_documento_ciudadana() -> rx.Component:
    """Ventana emergente que muestra el texto completo del documento PDF adjunto."""
    return rx.dialog.root(
        rx.dialog.content(
            rx.dialog.title(
                rx.hstack(
                    rx.box(
                        rx.icon("scroll_text", size=20, color="#ffffff"),
                        padding="8px",
                        background="linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
                        border_radius="8px",
                    ),
                    rx.vstack(
                        rx.heading("Proyecto de Ley / Documento Adjunto", size="4", color="#ffffff"),
                        rx.text(State.upload_filename, size="1", color="#99f6e4"),
                        align="start",
                        spacing="0",
                    ),
                    spacing="3",
                    align="center",
                    width="100%",
                )
            ),
            rx.dialog.description(
                rx.vstack(
                    rx.hstack(
                        rx.badge(State.extracted_pages.to_string() + " páginas", color_scheme="teal", size="1"),
                        rx.badge(State.extracted_words.to_string() + " palabras", color_scheme="green", size="1"),
                        rx.badge(State.upload_filesize, color_scheme="gray", size="1"),
                        spacing="2",
                    ),
                    rx.box(
                        rx.text(
                            State.upload_text,
                            color="#e2e8f0",
                            font_size="0.875rem",
                            line_height="1.8",
                            white_space="pre-wrap",
                        ),
                        padding="20px",
                        background="rgba(6, 34, 28, 0.98)",
                        border_radius="12px",
                        border="1px solid rgba(20, 184, 166, 0.3)",
                        max_height="60vh",
                        overflow_y="auto",
                        width="100%",
                    ),
                    spacing="3",
                    width="100%",
                    padding_y="10px",
                )
            ),
            rx.hstack(
                rx.spacer(),
                rx.button(
                    rx.hstack(rx.icon("x", size=16), rx.text("Cerrar"), gap="6px"),
                    on_click=State.close_text_modal,
                    variant="soft",
                    color_scheme="gray",
                    cursor="pointer",
                ),
                width="100%",
            ),
            background="#0a2a20",
            border="1px solid #14b8a6",
            max_width="820px",
            width="90vw",
        ),
        open=State.is_text_modal_open,
    )


def _zona_carga_pdf_ciudadana() -> rx.Component:
    """Zona independiente de carga PDF para el Agente de Interacción Ciudadana."""
    return rx.vstack(
        rx.box(
            rx.vstack(
                rx.hstack(
                    rx.icon("paperclip", size=18, color="#14b8a6"),
                    rx.heading("3. Adjuntar el Documento (PDF)", size="4", color="#ffffff"),
                    spacing="2",
                    align="center",
                ),
                rx.text(
                    "Cargue el proyecto de ley, memorial o sustento técnico. El sistema lo extraerá automáticamente y lo adjuntará al expediente registrado.",
                    size="2",
                    color="#94a3b8",
                    line_height="1.5",
                ),
                spacing="2",
                align="start",
            ),
            padding="16px 20px",
            background="rgba(13, 148, 136, 0.1)",
            border="1px solid rgba(20, 184, 166, 0.25)",
            border_radius="12px",
            width="100%",
        ),

        # Dropzone
        rx.upload(
            rx.vstack(
                rx.icon("cloud_upload", size=36, color="#14b8a6"),
                rx.text("Arrastra tu PDF o haz clic para seleccionarlo", size="3", color="#ffffff", weight="medium"),
                rx.text("Soporta .pdf · .docx · .txt", size="1", color="#5eead4"),
                align="center",
                spacing="2",
            ),
            id="ciudadana_uploader",
            border="2px dashed #0d9488",
            padding="28px",
            border_radius="14px",
            background="rgba(13, 148, 136, 0.1)",
            cursor="pointer",
            width="100%",
            accept={
                "application/pdf": [".pdf"],
                "application/x-pdf": [".pdf"],
                "text/plain": [".txt"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                "application/msword": [".docx"],
                "application/octet-stream": [".pdf", ".docx", ".txt"],
            },
            max_files=1,
            # Antes este dropzone no tenía on_drop: soltar un archivo aquí no
            # hacía nada, así que is_file_loaded nunca se activaba desde esta
            # pantalla y el botón de clasificar (más abajo) jamás aparecía.
            on_drop=State.handle_upload(rx.upload_files(upload_id="ciudadana_uploader")),
            style={
                "transition": "all 0.2s ease",
                "_hover": {
                    "border_color": "#14b8a6",
                    "background": "rgba(20, 184, 166, 0.15)",
                },
            },
        ),

        # Archivo seleccionado pero aún no confirmado/cargado
        rx.cond(
            ~State.is_file_loaded & (rx.selected_files("ciudadana_uploader").length() > 0),
            rx.box(
                rx.hstack(
                    rx.icon("file", size=18, color="#5eead4"),
                    rx.foreach(rx.selected_files("ciudadana_uploader"), lambda f: rx.text(f, size="2", weight="bold", color="#ffffff")),
                    rx.spacer(),
                    rx.button(
                        rx.icon("upload", size=15),
                        "Confirmar Carga",
                        on_click=State.handle_upload(rx.upload_files(upload_id="ciudadana_uploader")),
                        color_scheme="teal",
                        size="2",
                        cursor="pointer",
                    ),
                    align="center",
                    width="100%",
                ),
                padding="10px 16px",
                background="rgba(20, 184, 166, 0.1)",
                border="1px solid #14b8a6",
                border_radius="10px",
                width="100%",
            ),
        ),

        # Info del archivo cargado (si ya existe uno)
        rx.cond(
            State.is_file_loaded,
            rx.box(
                rx.hstack(
                    rx.icon("file_check", size=22, color="#34d399"),
                    rx.vstack(
                        rx.text(State.upload_filename, size="2", weight="bold", color="#ffffff"),
                        rx.hstack(
                            rx.badge(State.upload_filesize, color_scheme="gray", size="1"),
                            rx.badge(State.extracted_pages.to_string() + " páginas", color_scheme="teal", size="1"),
                            rx.badge(State.extracted_words.to_string() + " palabras", color_scheme="green", size="1"),
                            spacing="2",
                        ),
                        align="start",
                        spacing="0",
                    ),
                    rx.spacer(),
                    rx.hstack(
                        rx.button(
                            rx.hstack(rx.icon("eye", size=15), rx.text("Ver Proyecto de Ley"), gap="5px"),
                            on_click=State.open_text_modal,
                            color_scheme="teal",
                            variant="soft",
                            size="2",
                            cursor="pointer",
                            style={"border": "1px solid rgba(20, 184, 166, 0.5)"},
                        ),
                        rx.button(
                            rx.hstack(rx.icon("trash_2", size=14), rx.text("Quitar"), gap="5px"),
                            on_click=State.clear_upload,
                            color_scheme="red",
                            variant="soft",
                            size="2",
                            cursor="pointer",
                        ),
                        gap="8px",
                    ),
                    align="center",
                    width="100%",
                ),
                padding="14px 18px",
                background="rgba(16, 185, 129, 0.12)",
                border="1px solid #10b981",
                border_radius="10px",
                width="100%",
            ),
        ),

        # Botón de clasificar (solo aparece si hay archivo listo)
        rx.cond(
            State.is_file_loaded,
            rx.button(
                rx.cond(
                    State.is_processing,
                    rx.hstack(rx.spinner(size="2"), rx.text("Clasificando con los agentes..."), gap="8px"),
                    rx.hstack(rx.icon("sparkles", size=18), rx.text("Clasificar y Enrutar Documento"), gap="8px"),
                ),
                # Antes esto volvía a llamar a handle_upload_and_classify,
                # que reintenta releer rx.upload_files() del navegador aunque
                # el archivo ya estaba cargado (is_file_loaded=True). Si esa
                # selección ya estaba vacía (consumida por una carga previa
                # via on_drop), disparaba la clasificación con estado vacío.
                # Como el archivo ya está cargado, clasificar directamente.
                on_click=State.ejecutar_fase_1_clasificar,
                is_disabled=State.is_processing,
                color_scheme="teal",
                size="3",
                width="100%",
                cursor="pointer",
                style={
                    "background": "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
                    "box_shadow": "0 6px 24px rgba(20, 184, 166, 0.35)",
                    "color": "#ffffff",
                    "font_weight": "bold",
                    "font_size": "15px",
                },
            ),
        ),

        # Spinner de procesamiento
        rx.cond(
            State.is_processing,
            rx.vstack(
                rx.hstack(
                    rx.spinner(size="2", color="#14b8a6"),
                    rx.text(State.process_step_text, size="2", color="#5eead4", weight="medium"),
                ),
                rx.progress(is_indeterminate=True, color_scheme="teal", size="1", width="100%"),
                spacing="2",
                width="100%",
            ),
        ),

        gap="14px",
        width="100%",
    )


def ciudadana_page() -> rx.Component:
    return rx.vstack(
        # Encabezado del agente con robot
        rx.box(
            rx.hstack(
                rx.image(
                    src="/robots/robot_ciudadano.jpg",
                    width="80px",
                    height="80px",
                    object_fit="contain",
                    border_radius="16px",
                    border="2px solid #d1fae5",
                    background="#f0fdf4",
                ),
                rx.vstack(
                    rx.hstack(
                        rx.heading("Agente de Interacción Ciudadana", size="5", color="#0f172a"),
                        rx.badge("Agente Independiente", color_scheme="green", variant="surface", size="2"),
                        spacing="2",
                        align="center",
                        flex_wrap="wrap",
                    ),
                    rx.text("Lic. María Helena Choque — Oficialía Mayor, Cámara de Senadores", size="2", color="#059669"),
                    rx.text(
                        "Bienvenido. Este agente lo atenderá de manera personal para registrar su trámite y adjuntar el documento de sustento al expediente. Sus datos se sincronizan de forma segura con las bases de datos del Senado.",
                        size="2",
                        color="#374151",
                        line_height="1.6",
                    ),
                    align="start",
                    spacing="2",
                ),
                spacing="4",
                align="start",
                width="100%",
            ),
            padding="22px 26px",
            background="#ffffff",
            border="1px solid #d1fae5",
            border_radius="16px",
            box_shadow="0 2px 12px rgba(5, 150, 105, 0.08)",
            width="100%",
        ),

        # Formulario + Respuesta del agente
        rx.grid(
            # Columna izquierda: Formulario de datos
            rx.box(
                rx.vstack(
                    rx.hstack(
                        rx.badge("PASO 1", color_scheme="teal", size="1"),
                        rx.heading("Datos de Recepción Ciudadana", size="4", color="#ffffff"),
                        spacing="2",
                        align="center",
                    ),

                    rx.vstack(
                        rx.text("Nombre Completo del Ciudadano / Remitente:", size="1", color="#5eead4", weight="bold"),
                        rx.input(
                            placeholder="Ej. Sr. Carlos Mamani Quispe",
                            value=State.ciudadano_nombre,
                            on_change=State.set_ciudadano_nombre,
                            width="100%",
                            size="3",
                            variant="surface",
                            color_scheme="teal",
                        ),
                        align="start",
                        spacing="1",
                        width="100%",
                    ),

                    rx.vstack(
                        rx.text("Motivo / Petición Principal del Trámite:", size="1", color="#5eead4", weight="bold"),
                        rx.text_area(
                            placeholder="Describa el motivo de su trámite o el objeto del documento...",
                            value=State.ciudadano_motivo,
                            on_change=State.set_ciudadano_motivo,
                            width="100%",
                            size="3",
                            variant="surface",
                            color_scheme="teal",
                            rows="4",
                        ),
                        align="start",
                        spacing="1",
                        width="100%",
                    ),

                    rx.vstack(
                        rx.text("Modo de Recepción del Documento:", size="1", color="#5eead4", weight="bold"),
                        rx.select(
                            ["Digital", "Física", "Oficialía de Partes"],
                            value=State.ciudadano_recepcion,
                            on_change=State.set_ciudadano_recepcion,
                            width="100%",
                            size="3",
                            color_scheme="teal",
                        ),
                        align="start",
                        spacing="1",
                        width="100%",
                    ),

                    rx.button(
                        rx.cond(
                            State.ciudadana_is_saving,
                            rx.hstack(rx.spinner(size="2"), rx.text("Registrando en el sistema..."), gap="8px"),
                            rx.hstack(rx.icon("send", size=18), rx.text("Registrar Solicitud en el Senado"), gap="8px"),
                        ),
                        on_click=State.interactuar_ciudadano,
                        is_disabled=State.ciudadana_is_saving,
                        color_scheme="teal",
                        size="3",
                        width="100%",
                        cursor="pointer",
                        style={
                            "background": "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
                            "box_shadow": "0 4px 16px rgba(20, 184, 166, 0.3)",
                            "color": "#ffffff",
                            "font_weight": "bold",
                        },
                    ),

                    # Error
                    rx.cond(
                        State.process_error != "",
                        rx.callout(
                            State.process_error,
                            icon="triangle_alert",
                            color_scheme="red",
                            size="2",
                            width="100%",
                        ),
                    ),

                    spacing="4",
                    width="100%",
                ),
                padding="24px",
                background="rgba(6, 78, 59, 0.2)",
                border="1px solid rgba(20, 184, 166, 0.2)",
                border_radius="14px",
                width="100%",
            ),

            # Columna derecha: Respuesta del Agente
            rx.vstack(
                rx.hstack(
                    rx.badge("PASO 2", color_scheme="green", size="1"),
                    rx.heading("Respuesta del Agente", size="4", color="#ffffff"),
                    spacing="2",
                    align="center",
                ),

                rx.cond(
                    State.ciudadana_is_saving,
                    rx.box(
                        rx.vstack(
                            rx.hstack(
                                rx.spinner(size="3", color="#14b8a6"),
                                rx.text("La Lic. María Helena está procesando su solicitud...", size="2", color="#5eead4"),
                                spacing="3",
                                align="center",
                            ),
                            rx.text(
                                "Verificando datos · Registrando en PostgreSQL · Sincronizando con MongoDB Atlas",
                                size="1",
                                color="#64748b",
                                text_align="center",
                            ),
                            spacing="2",
                            align="center",
                        ),
                        padding="30px 20px",
                        border="1px dashed rgba(20, 184, 166, 0.3)",
                        border_radius="12px",
                        width="100%",
                        display="flex",
                        align_items="center",
                        justify_content="center",
                    ),
                    rx.cond(
                        State.ciudadana_agente_respuesta != "",
                        # Burbuja de conversación del agente
                        rx.box(
                            rx.vstack(
                                rx.hstack(
                                    rx.box(
                                        rx.icon("bot", size=18, color="#ffffff"),
                                        padding="6px",
                                        background="linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
                                        border_radius="50%",
                                    ),
                                    rx.text("Lic. María Helena Choque", size="1", color="#5eead4", weight="bold"),
                                    rx.spacer(),
                                    rx.badge("✓ Registrado", color_scheme="green", size="1", variant="surface"),
                                    align="center",
                                    width="100%",
                                ),
                                rx.text(
                                    State.ciudadana_agente_respuesta,
                                    size="2",
                                    color="#e2e8f0",
                                    line_height="1.75",
                                    white_space="pre-wrap",
                                ),
                                spacing="3",
                            ),
                            padding="20px",
                            background="rgba(13, 148, 136, 0.12)",
                            border="1px solid rgba(20, 184, 166, 0.3)",
                            border_left="4px solid #14b8a6",
                            border_radius="12px",
                            width="100%",
                        ),
                        # Estado inicial: esperando datos
                        rx.box(
                            rx.vstack(
                                rx.icon("message_circle", size=36, color="#374151"),
                                rx.text(
                                    "El agente responderá aquí una vez registre los datos del ciudadano.",
                                    size="2",
                                    color="#6b7280",
                                    text_align="center",
                                ),
                                spacing="2",
                                align="center",
                            ),
                            padding="40px 20px",
                            border="1px dashed rgba(148, 163, 184, 0.2)",
                            border_radius="12px",
                            width="100%",
                            display="flex",
                            align_items="center",
                            justify_content="center",
                        ),
                    ),
                ),
                spacing="4",
                width="100%",
            ),

            columns="2",
            gap="24px",
            width="100%",
        ),

        # Sección de carga de PDF (aparece solo tras registro exitoso)
        rx.cond(
            State.ciudadana_guardado_ok,
            rx.box(
                _zona_carga_pdf_ciudadana(),
                padding="24px",
                background="rgba(6, 78, 59, 0.2)",
                border="1px solid rgba(20, 184, 166, 0.25)",
                border_radius="14px",
                width="100%",
            ),
        ),

        # Modal para ver el documento
        _modal_visor_documento_ciudadana(),

        gap="22px",
        width="100%",
    )
