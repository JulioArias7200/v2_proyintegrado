"""
Página de Archivo de Expedientes — Archivo Legislativo
======================================================
Registro histórico de documentos procesados, en tonos verde esmeralda y blanco.
Fácil de comprender para usuarios no técnicos.
"""
from typing import Any
import reflex as rx
from sma_unified.state import State, DocumentoItem


def badge_cat_expediente(cat: Any) -> rx.Component:
    return rx.match(
        cat.to(str),
        ("AGENTE_REGISTRO_LEGISLATIVO", rx.badge("📜 Proyecto de Ley", color_scheme="green", variant="solid", size="1")),
        ("AGENTE_ATENCION_CIUDADANA", rx.badge("👥 Petición Ciudadana", color_scheme="teal", variant="solid", size="1")),
        ("AGENTE_GESTION_CORRESPONDENCIA", rx.badge("✉️ Oficio Oficial", color_scheme="amber", variant="solid", size="1")),
        rx.badge("📄 Trámite General", color_scheme="gray", variant="surface", size="1"),
    )


def badge_const_expediente(val: Any) -> rx.Component:
    return rx.match(
        val.to(str),
        ("True", rx.badge("✅ Conforme", color_scheme="green", variant="solid", size="1")),
        ("False", rx.badge("⚠️ Observado", color_scheme="red", variant="solid", size="1")),
        rx.badge("N/A", color_scheme="gray", variant="surface", size="1"),
    )


def expediente_row(doc: DocumentoItem) -> rx.Component:
    return rx.table.row(
        rx.table.cell(
            rx.vstack(
                rx.text(
                    doc.nombre_archivo,
                    size="2",
                    weight="bold",
                    color="#ffffff",
                    overflow="hidden",
                    text_overflow="ellipsis",
                    max_width="240px",
                ),
                rx.text(
                    doc.expediente_id,
                    size="1",
                    color="#a7f3d0",
                    font_family="monospace",
                ),
                align="start",
                spacing="0",
            )
        ),
        rx.table.cell(badge_cat_expediente(doc.categoria)),
        rx.table.cell(
            rx.text(
                doc.comision,
                size="2",
                color="#e2e8f0",
                overflow="hidden",
                text_overflow="ellipsis",
                max_width="220px",
            )
        ),
        rx.table.cell(badge_const_expediente(doc.valido_constitucional)),
        rx.table.cell(
            rx.text(
                doc.duracion_ms.to_string() + " ms",
                size="1",
                color="#a7f3d0",
            )
        ),
        rx.table.cell(
            rx.text(
                doc.fecha_ingreso,
                size="1",
                color="#94a3b8",
            )
        ),
        rx.table.cell(
            rx.button(
                rx.icon("eye", size=14),
                "Ver Expediente",
                size="1",
                variant="solid",
                color_scheme="green",
                cursor="pointer",
                on_click=State.ver_detalle_expediente(doc),
            )
        ),
        _hover={"background": "rgba(16, 185, 129, 0.1)"},
    )


def modal_detalle_expediente() -> rx.Component:
    """Modal institucional con la ficha completa del expediente."""
    doc = State.selected_expediente
    return rx.dialog.root(
        rx.dialog.content(
            rx.dialog.title(
                rx.hstack(
                    rx.box(
                        rx.icon("folder_check", size=24, color="#34d399"),
                        padding="8px",
                        background="rgba(16, 185, 129, 0.2)",
                        border_radius="8px",
                    ),
                    rx.heading(doc.nombre_archivo, size="4", color="#ffffff"),
                    rx.spacer(),
                    badge_cat_expediente(doc.categoria),
                    align="center",
                    width="100%",
                )
            ),
            rx.dialog.description(
                rx.vstack(
                    rx.divider(border_color="rgba(16, 185, 129, 0.3)"),
                    # Metadatos Principales
                    rx.grid(
                        rx.vstack(
                            rx.text("COMISIÓN / DESTINO ASIGNADO", size="1", color="#a7f3d0", weight="bold"),
                            rx.text(doc.comision, size="2", color="#ffffff", weight="bold"),
                            align="start",
                        ),
                        rx.vstack(
                            rx.text("CONTROL CONSTITUCIONAL", size="1", color="#a7f3d0", weight="bold"),
                            badge_const_expediente(doc.valido_constitucional),
                            align="start",
                        ),
                        rx.vstack(
                            rx.text("FECHA DE REGISTRO", size="1", color="#a7f3d0", weight="bold"),
                            rx.text(doc.fecha_ingreso, size="2", color="#ffffff"),
                            align="start",
                        ),
                        columns="3",
                        gap="14px",
                        width="100%",
                        padding="14px",
                        background="rgba(6, 78, 59, 0.4)",
                        border_radius="10px",
                        border="1px solid rgba(16, 185, 129, 0.25)",
                    ),

                    # Resumen
                    rx.vstack(
                        rx.text("RESUMEN EJECUTIVO DEL DOCUMENTO:", size="1", color="#6ee7b7", weight="bold"),
                        rx.box(
                            rx.text(doc.resumen, size="2", color="#f1f5f9", line_height="1.7"),
                            padding="14px",
                            background="rgba(6, 34, 28, 0.8)",
                            border_radius="8px",
                            width="100%",
                        ),
                        align="start",
                        spacing="1",
                        width="100%",
                    ),

                    # Vista previa del texto original
                    rx.vstack(
                        rx.text("EXTRACTO DEL TEXTO INGRESADO:", size="1", color="#a7f3d0", weight="bold"),
                        rx.box(
                            rx.text(doc.texto_preview, size="1", color="#cbd5e1", font_family="monospace"),
                            padding="12px",
                            background="rgba(6, 34, 28, 0.6)",
                            border_radius="8px",
                            width="100%",
                            max_height="140px",
                            overflow_y="auto",
                        ),
                        align="start",
                        spacing="1",
                        width="100%",
                    ),

                    # Identificadores Oficiales
                    rx.hstack(
                        rx.badge("Código de Trámite: " + doc.expediente_id, color_scheme="green", size="1"),
                        rx.cond(
                            doc.id_proyecto_pg != "",
                            rx.badge("N° Registro Oficial: #" + doc.id_proyecto_pg, color_scheme="teal", size="1"),
                        ),
                        spacing="2",
                    ),
                    spacing="4",
                    width="100%",
                    padding_y="12px",
                )
            ),
            rx.hstack(
                rx.spacer(),
                rx.button(
                    "Cerrar Ficha",
                    on_click=State.cerrar_detalle_expediente,
                    variant="solid",
                    color_scheme="green",
                    cursor="pointer",
                ),
                width="100%",
            ),
            background="#093c32",
            border="2px solid #10b981",
            max_width="720px",
        ),
        open=State.is_expediente_modal_open,
    )


def expedientes_page() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.hstack(
                    rx.box(
                        rx.icon("folder_check", size=24, color="#34d399"),
                        width="44px",
                        height="44px",
                        border_radius="10px",
                        background="rgba(16, 185, 129, 0.2)",
                        border="1px solid #10b981",
                        display="flex",
                        align_items="center",
                        justify_content="center",
                    ),
                    rx.vstack(
                        rx.heading("Archivo Central de Expedientes", size="5", color="#ffffff"),
                        rx.text("Consulta el historial de todos los trámites, proyectos y comunicaciones registrados.", size="2", color="#a7f3d0"),
                        align="start",
                        spacing="0",
                    ),
                    spacing="3",
                    align="center",
                ),
                rx.spacer(),
                rx.button(
                    rx.icon("refresh_cw", size=16),
                    "Actualizar Lista",
                    on_click=State.cargar_expedientes,
                    size="2",
                    variant="solid",
                    color_scheme="green",
                    cursor="pointer",
                ),
                align="center",
                width="100%",
            ),
            rx.divider(border_color="rgba(16, 185, 129, 0.3)"),

            # Tabla de Expedientes
            rx.cond(
                State.documentos.length() > 0,
                rx.table.root(
                    rx.table.header(
                        rx.table.row(
                            rx.table.column_header_cell("Documento / Código"),
                            rx.table.column_header_cell("Tipo de Trámite"),
                            rx.table.column_header_cell("Comisión / Destino"),
                            rx.table.column_header_cell("Constitución"),
                            rx.table.column_header_cell("Tiempo"),
                            rx.table.column_header_cell("Fecha"),
                            rx.table.column_header_cell("Acción"),
                        )
                    ),
                    rx.table.body(
                        rx.foreach(State.documentos, expediente_row)
                    ),
                    width="100%",
                    variant="surface",
                ),
                rx.vstack(
                    rx.icon("folder_open", size=54, color="#047857"),
                    rx.text("No hay expedientes archivados aún.", color="#a7f3d0", size="3", weight="bold"),
                    rx.text("Ingresa un documento desde la Mesa de Entradas para verlo aquí.", color="#94a3b8", size="2"),
                    align="center",
                    padding="60px",
                ),
            ),
            gap="18px",
            width="100%",
        ),
        modal_detalle_expediente(),
        padding="28px",
        background="linear-gradient(180deg, rgba(6, 78, 59, 0.35) 0%, rgba(9, 60, 50, 0.5) 100%)",
        border="1px solid rgba(16, 185, 129, 0.3)",
        border_radius="18px",
        width="100%",
        overflow="auto",
        on_mount=State.cargar_expedientes,
    )
