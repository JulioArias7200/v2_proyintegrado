"""
Sistema de Gestión Documental y Control Legislativo
Cámara de Senadores — Estado Plurinacional de Bolivia
======================================================
Interfaz institucional moderna: FONDO BLANCO, letras negras y verde esmeralda.
Robots políticos por cada agente.
"""
import reflex as rx
from sma_unified.state import State
from sma_unified.pages.upload import upload_page
from sma_unified.pages.flujo import flujo_page
from sma_unified.pages.expedientes import expedientes_page
from sma_unified.pages.ciudadana import ciudadana_page
from sma_unified.pages.normativa import normativa_page


# ════════════════════════════════════════════════════════════════════════════
# TOKENS DE COLOR — TEMA BLANCO / NEGRO / VERDE
# ════════════════════════════════════════════════════════════════════════════
# Primario:  #059669  (verde esmeralda oscuro)
# Secundario:#10b981  (verde esmeralda medio)
# Acento:    #34d399  (verde claro)
# Fondo:     #ffffff  (blanco puro)
# Superficie:#f0fdf4  (blanco verdoso muy suave)
# Borde:     #d1fae5  (borde verde muy claro)
# Texto:     #0f172a  (casi negro)
# Subtítulo: #374151  (gris oscuro)


# ════════════════════════════════════════════════════════════════════════════
# HEADER
# ════════════════════════════════════════════════════════════════════════════

def estado_sistema_badge() -> rx.Component:
    return rx.hstack(
        rx.box(
            width="10px",
            height="10px",
            border_radius="50%",
            background="#10b981",
            box_shadow="0 0 8px #10b981",
        ),
        rx.text("Sistema Operativo y Activo", size="2", weight="medium", color="#059669"),
        align="center",
        padding="6px 14px",
        background="#f0fdf4",
        border="1px solid #6ee7b7",
        border_radius="20px",
        gap="6px",
    )


def kpi_institucional(label: str, value: rx.Var, icon_name: str) -> rx.Component:
    return rx.hstack(
        rx.box(
            rx.icon(icon_name, size=20, color="#059669"),
            padding="8px",
            background="#f0fdf4",
            border_radius="8px",
            border="1px solid #d1fae5",
        ),
        rx.vstack(
            rx.text(value, size="4", weight="bold", color="#0f172a"),
            rx.text(label, size="1", color="#6b7280"),
            spacing="0",
            align="start",
        ),
        align="center",
        gap="10px",
        padding="8px 16px",
        background="#ffffff",
        border="1px solid #d1fae5",
        border_radius="10px",
        box_shadow="0 1px 4px rgba(5, 150, 105, 0.08)",
    )


def header() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.hstack(
                rx.box(
                    rx.icon("landmark", size=28, color="#ffffff"),
                    padding="10px",
                    background="linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    border_radius="12px",
                    box_shadow="0 4px 14px rgba(5, 150, 105, 0.35)",
                ),
                rx.vstack(
                    rx.heading("Gestión y Control Legislativo", size="5", weight="bold", color="#0f172a"),
                    rx.text("Mesa de Partes Digital · Cámara de Senadores", size="2", color="#059669", weight="medium"),
                    spacing="0",
                    align="start",
                ),
                gap="14px",
                align="center",
            ),
            rx.spacer(),
            rx.hstack(
                kpi_institucional("Documentos Recibidos", State.kpi_total_mensajes.to_string(), "file_text"),
                kpi_institucional("Dictámenes Listos", State.kpi_completados.to_string(), "circle_check"),
                display=["none", "none", "flex"],
                gap="12px",
            ),
            rx.spacer(),
            estado_sistema_badge(),
            align="center",
            width="100%",
        ),
        padding="14px 32px",
        background="#ffffff",
        border_bottom="2px solid #d1fae5",
        position="sticky",
        top="0",
        z_index="100",
        box_shadow="0 2px 12px rgba(5, 150, 105, 0.08)",
    )


# ════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ════════════════════════════════════════════════════════════════════════════

def nav_tab(label: str, icon_name: str, tab_id: str, description: str = "") -> rx.Component:
    is_active = State.active_tab == tab_id
    return rx.button(
        rx.hstack(
            rx.box(
                rx.icon(icon_name, size=18, color=rx.cond(is_active, "#ffffff", "#059669")),
                padding="8px",
                border_radius="8px",
                background=rx.cond(is_active, "rgba(255,255,255,0.25)", "#f0fdf4"),
            ),
            rx.vstack(
                rx.text(label, size="2", weight="bold", color=rx.cond(is_active, "#ffffff", "#0f172a")),
                rx.text(description, size="1", color=rx.cond(is_active, "#d1fae5", "#6b7280")),
                align="start",
                spacing="0",
            ),
            gap="10px",
            align="center",
            width="100%",
        ),
        on_click=State.set_active_tab(tab_id),
        variant="ghost",
        width="100%",
        height="auto",
        padding="10px 14px",
        style={
            "background": rx.cond(
                is_active,
                "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                "transparent",
            ),
            "border": rx.cond(is_active, "1px solid #6ee7b7", "1px solid transparent"),
            "border_radius": "12px",
            "box_shadow": rx.cond(is_active, "0 4px 14px rgba(5, 150, 105, 0.25)", "none"),
            "cursor": "pointer",
            "transition": "all 0.2s ease",
            "_hover": {
                "background": rx.cond(is_active, "#059669", "#f0fdf4"),
            },
        },
    )


def sidebar() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text("SERVICIOS DE TRÁMITE", size="1", color="#059669", weight="bold", letter_spacing="0.1em"),
            nav_tab("Mesa de Entradas", "file_up", "upload", "Subir y procesar documento"),
            nav_tab("Interacción Ciudadana", "users", "ciudadana", "Recepción y consulta ciudadana"),
            nav_tab("Seguimiento de Pasos", "route", "flujo", "Bitácora cronológica del trámite"),
            nav_tab("Archivo de Expedientes", "folder_check", "expedientes", "Historial de trámites registrados"),
            nav_tab("Base Legal", "book_open_check", "normativa", "Cargar códigos y leyes (RAG)"),
            rx.divider(border_color="#d1fae5"),

            rx.text("RESUMEN DE ACTIVIDAD", size="1", color="#059669", weight="bold", letter_spacing="0.1em"),
            rx.vstack(
                rx.hstack(
                    rx.text("Documentos atendidos:", size="1", color="#374151"),
                    rx.text(State.kpi_total_mensajes.to_string(), size="1", color="#0f172a", weight="bold"),
                    justify="between", width="100%",
                ),
                rx.hstack(
                    rx.text("Dictámenes concluidos:", size="1", color="#374151"),
                    rx.text(State.kpi_completados.to_string(), size="1", color="#059669", weight="bold"),
                    justify="between", width="100%",
                ),
                rx.hstack(
                    rx.text("En proceso de revisión:", size="1", color="#374151"),
                    rx.text(State.kpi_en_proceso.to_string(), size="1", color="#0284c7", weight="bold"),
                    justify="between", width="100%",
                ),
                rx.hstack(
                    rx.text("Tiempo promedio:", size="1", color="#374151"),
                    rx.text(State.kpi_avg_ms.to_string() + " ms", size="1", color="#374151", weight="bold"),
                    justify="between", width="100%",
                ),
                gap="6px",
                width="100%",
                padding="14px",
                background="#f0fdf4",
                border="1px solid #d1fae5",
                border_radius="10px",
            ),

            rx.spacer(),

            rx.text("ÁREAS DE REVISIÓN", size="1", color="#059669", weight="bold", letter_spacing="0.1em"),
            rx.vstack(
                *[
                    rx.hstack(
                        rx.box(width="8px", height="8px", border_radius="50%", background=color, flex_shrink="0"),
                        rx.text(nombre, size="1", color="#374151"),
                        gap="6px",
                        align="center",
                    )
                    for nombre, color in [
                        ("1. Mesa de Partes y Enrutamiento", "#059669"),
                        ("2. Comisiones Legislativas (10)", "#10b981"),
                        ("3. Auditoría Constitucional (CPE)", "#047857"),
                        ("4. Atención Ciudadana", "#0d9488"),
                        ("5. Correspondencia Institucional", "#d97706"),
                    ]
                ],
                gap="6px",
                width="100%",
                padding="10px",
                background="#f0fdf4",
                border="1px solid #d1fae5",
                border_radius="8px",
            ),
            gap="14px",
            width="100%",
            height="100%",
            align="start",
        ),
        width="270px",
        min_width="270px",
        padding="24px 18px",
        background="#ffffff",
        border_right="1px solid #d1fae5",
        height="calc(100vh - 73px)",
        position="sticky",
        top="73px",
        overflow_y="auto",
        box_shadow="2px 0 8px rgba(5, 150, 105, 0.06)",
    )


def content_area() -> rx.Component:
    return rx.box(
        rx.cond(
            State.active_tab == "upload",
            upload_page(),
            rx.cond(
                State.active_tab == "ciudadana",
                ciudadana_page(),
                rx.cond(
                    State.active_tab == "flujo",
                    flujo_page(),
                    rx.cond(
                        State.active_tab == "normativa",
                        normativa_page(),
                        expedientes_page(),
                    ),
                ),
            ),
        ),
        flex="1",
        padding="32px 40px",
        overflow_y="auto",
        min_height="calc(100vh - 73px)",
        background="#f8fffe",
    )


# ════════════════════════════════════════════════════════════════════════════
# PÁGINA PRINCIPAL
# ════════════════════════════════════════════════════════════════════════════

def index() -> rx.Component:
    return rx.box(
        rx.vstack(
            header(),
            rx.hstack(
                sidebar(),
                content_area(),
                gap="0",
                width="100%",
                align="start",
            ),
            gap="0",
            width="100%",
        ),
        background="#f8fffe",
        min_height="100vh",
        color="#0f172a",
        font_family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    )


app = rx.App(
    theme=rx.theme(
        appearance="light",
        accent_color="green",
        gray_color="slate",
        radius="medium",
    ),
    head_components=[
        rx.el.link(rel="preconnect", href="https://fonts.googleapis.com"),
        rx.el.link(rel="preconnect", href="https://fonts.gstatic.com", cross_origin=""),
        rx.el.link(
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
            rel="stylesheet",
        ),
    ],
)
app.add_page(index, route="/", title="Sistema de Gestión y Control Legislativo — Senado")
