"""
Página de Seguimiento y Bitácora del Trámite
============================================
Visualización paso a paso del recorrido institucional del documento.
En tonos verde esmeralda y blanco, sin tecnicismos ni nombres de bases de datos.
"""
from typing import Any
import reflex as rx
from sma_unified.state import State


def estado_badge(estado: str) -> rx.Component:
    return rx.badge(
        rx.cond(
            estado == "completado",
            "✅ Concluido",
            rx.cond(
                estado == "en_proceso",
                "⚡ En Revisión",
                rx.cond(
                    estado == "error",
                    "❌ Observado",
                    "⏳ Pendiente",
                ),
            ),
        ),
        color_scheme=rx.cond(
            estado == "completado", "green",
            rx.cond(
                estado == "en_proceso", "teal",
                rx.cond(estado == "error", "red", "amber"),
            ),
        ),
        variant="solid",
        size="1",
    )


def agent_node(nombre: str, label_amigable: str, es_activo: Any = False) -> rx.Component:
    """Nodo visual institucional."""
    icon = "landmark"
    if "Distribuidor" in nombre or "Partes" in nombre:
        icon = "file_search"
    elif "Comision" in nombre or "Legislativa" in nombre:
        icon = "building_2"
    elif "Verificador" in nombre or "Constitucional" in nombre:
        icon = "scale"
    elif "Ciudadana" in nombre:
        icon = "users"
    elif "Correspondencia" in nombre:
        icon = "mail"
    elif "Usuario" in nombre or "Operador" in nombre:
        icon = "user_check"

    return rx.vstack(
        rx.box(
            rx.icon(icon, size=24, color=rx.cond(es_activo, "#ffffff", "#a7f3d0")),
            width="56px",
            height="56px",
            display="flex",
            align_items="center",
            justify_content="center",
            background=rx.cond(es_activo, "linear-gradient(135deg, #059669 0%, #10b981 100%)", "rgba(6, 78, 59, 0.4)"),
            border=rx.cond(es_activo, "2px solid #34d399", "1px solid rgba(16, 185, 129, 0.3)"),
            border_radius="14px",
            box_shadow=rx.cond(es_activo, "0 0 20px rgba(16, 185, 129, 0.5)", "none"),
        ),
        rx.text(label_amigable, size="1", weight="bold", color="#ffffff", text_align="center", max_width="110px"),
        align="center",
        gap="4px",
    )


def diagrama_flujo_sesion() -> rx.Component:
    """Diagrama visual del flujo de revisión para el documento activo."""
    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.box(
                    rx.icon("route", size=24, color="#34d399"),
                    padding="8px",
                    background="rgba(16, 185, 129, 0.2)",
                    border_radius="8px",
                ),
                rx.vstack(
                    rx.heading("Diagrama de Recorrido del Documento", size="4", color="#ffffff"),
                    rx.text("Flujo automático desde la Mesa de Entradas hasta la emisión del dictamen.", size="1", color="#a7f3d0"),
                    spacing="0",
                    align="start",
                ),
                rx.spacer(),
                align="center",
                width="100%",
            ),
            rx.divider(border_color="rgba(16, 185, 129, 0.3)"),

            # Diagrama horizontal
            rx.hstack(
                # Nodo 1: Operador
                agent_node("Operador", "1. Mesa de Entradas", es_activo=True),
                # Flecha
                rx.hstack(
                    rx.box(height="3px", width="24px", background="#10b981"),
                    rx.icon("chevron_right", size=16, color="#10b981"),
                    align="center",
                ),
                # Nodo 2: Mesa de Partes
                agent_node("Distribuidor", "2. Clasificación Inicial", es_activo=State.last_sesion_id != ""),
                # Flecha
                rx.hstack(
                    rx.box(height="3px", width="24px", background="#10b981"),
                    rx.icon("chevron_right", size=16, color="#10b981"),
                    align="center",
                ),
                # Nodo 3: Especialistas
                rx.cond(
                    State.last_categoria == "AGENTE_REGISTRO_LEGISLATIVO",
                    rx.hstack(
                        agent_node("Legislativa", "3. Comisión Senado", es_activo=True),
                        rx.hstack(
                            rx.box(height="3px", width="20px", background="#10b981"),
                            rx.icon("chevron_right", size=14, color="#10b981"),
                            align="center",
                        ),
                        agent_node("Constitucional", "4. Control CPE", es_activo=True),
                        gap="6px",
                        align="center",
                    ),
                    rx.cond(
                        State.last_categoria == "AGENTE_ATENCION_CIUDADANA",
                        agent_node("Ciudadana", "3. Atención Ciudadana", es_activo=True),
                        agent_node("Correspondencia", "3. Despacho Oficial", es_activo=True),
                    ),
                ),
                align="center",
                gap="8px",
                overflow_x="auto",
                padding="16px",
                width="100%",
                justify="center",
            ),
            gap="16px",
            width="100%",
        ),
        padding="24px",
        background="linear-gradient(180deg, rgba(6, 78, 59, 0.4) 0%, rgba(9, 60, 50, 0.6) 100%)",
        border="1px solid rgba(16, 185, 129, 0.3)",
        border_radius="18px",
        width="100%",
        overflow="hidden",
    )


def formatear_nombre_area(nombre: Any) -> rx.Component:
    return rx.match(
        nombre.to(str),
        ("Agente_Distribuidor", rx.text("Mesa de Entradas / Distribución", size="1", color="#6ee7b7", weight="bold")),
        ("Agente_Comision_Legislativa", rx.text("Comisiones Legislativas del Senado", size="1", color="#34d399", weight="bold")),
        ("Agente_Verificador_Constitucional", rx.text("Auditoría y Control Constitucional", size="1", color="#a7f3d0", weight="bold")),
        ("Agente_Atencion_Ciudadana", rx.text("Área de Atención Ciudadana", size="1", color="#5eead4", weight="bold")),
        ("Agente_Gestion_Correspondencia", rx.text("Despacho y Correspondencia Oficial", size="1", color="#fde68a", weight="bold")),
        rx.text(nombre.to(str), size="1", color="#cbd5e1", weight="bold"),
    )


def mensaje_item(msg: Any) -> rx.Component:
    """Renderiza un paso individual de la bitácora."""
    return rx.box(
        rx.hstack(
            # Indicador
            rx.box(
                width="12px",
                height="12px",
                border_radius="50%",
                background=rx.cond(
                    msg.estado == "completado", "#10b981",
                    rx.cond(msg.estado == "en_proceso", "#3b82f6", "#f59e0b"),
                ),
                flex_shrink="0",
                margin_top="6px",
            ),
            # Detalle
            rx.vstack(
                rx.hstack(
                    formatear_nombre_area(msg.agente_origen),
                    rx.icon("arrow_right", size=14, color="#a7f3d0"),
                    formatear_nombre_area(msg.agente_destino),
                    rx.spacer(),
                    estado_badge(msg.estado),
                    align="center",
                    flex_wrap="wrap",
                    gap="6px",
                ),
                rx.text(msg.tipo_tarea, size="2", color="#ffffff", weight="medium"),
                rx.hstack(
                    rx.text(msg.timestamp, size="1", color="#94a3b8"),
                    rx.cond(
                        msg.duracion_ms != 0,
                        rx.badge(msg.duracion_ms.to_string() + " ms", color_scheme="green", size="1"),
                    ),
                    gap="10px",
                ),
                align="start",
                gap="3px",
                flex="1",
            ),
            align="start",
            gap="14px",
            width="100%",
        ),
        padding="14px 18px",
        background="rgba(6, 78, 59, 0.25)",
        border_left="4px solid",
        border_left_color=rx.cond(
            msg.estado == "completado", "#10b981",
            rx.cond(msg.estado == "en_proceso", "#3b82f6", "#f59e0b"),
        ),
        border_radius="0 10px 10px 0",
        margin_bottom="10px",
    )


def tabla_mensajes_recientes() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.hstack(
                    rx.box(
                        rx.icon("history", size=22, color="#34d399"),
                        padding="8px",
                        background="rgba(16, 185, 129, 0.2)",
                        border_radius="8px",
                    ),
                    rx.vstack(
                        rx.heading("Bitácora Cronológica de Revisiones", size="4", color="#ffffff"),
                        rx.text("Historial detallado de todas las validaciones efectuadas a los documentos.", size="1", color="#a7f3d0"),
                        spacing="0",
                        align="start",
                    ),
                ),
                rx.spacer(),
                rx.button(
                    rx.icon("refresh_cw", size=14),
                    "Actualizar",
                    on_click=State.cargar_mensajes_recientes,
                    size="2",
                    variant="solid",
                    color_scheme="green",
                    cursor="pointer",
                ),
                align="center",
                width="100%",
            ),
            rx.divider(border_color="rgba(16, 185, 129, 0.3)"),

            # Lista de pasos
            rx.cond(
                State.messages_loading,
                rx.hstack(rx.spinner(size="2", color="#10b981"), rx.text("Actualizando bitácora...", size="2", color="#a7f3d0")),
                rx.cond(
                    State.agent_messages.length() > 0,
                    rx.vstack(
                        rx.foreach(
                            State.agent_messages,
                            mensaje_item,
                        ),
                        gap="0",
                        width="100%",
                        max_height="520px",
                        overflow_y="auto",
                    ),
                    rx.vstack(
                        rx.icon("inbox", size=44, color="#047857"),
                        rx.text("No hay registros en la bitácora aún.", size="2", color="#a7f3d0", weight="bold"),
                        rx.text("Procesa un documento para ver sus pasos registrados aquí.", size="1", color="#94a3b8"),
                        align="center",
                        gap="6px",
                        padding="40px",
                    ),
                ),
            ),
            gap="14px",
            width="100%",
        ),
        padding="24px",
        background="linear-gradient(180deg, rgba(6, 78, 59, 0.35) 0%, rgba(9, 60, 50, 0.5) 100%)",
        border="1px solid rgba(16, 185, 129, 0.3)",
        border_radius="18px",
        width="100%",
    )


def flujo_page() -> rx.Component:
    return rx.vstack(
        diagrama_flujo_sesion(),
        tabla_mensajes_recientes(),
        gap="24px",
        width="100%",
        on_mount=State.cargar_mensajes_recientes,
    )
