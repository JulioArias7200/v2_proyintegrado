"""
Página de Mesa de Entradas y Procesamiento de Documentos
=========================================================
Diseño en tonos verde esmeralda y blanco, 100% entendible para operadores no técnicos.
Sin jerga de bases de datos.
"""
import reflex as rx
from sma_unified.state import State, ContradiccionItem, ChatMessageCiudadano


def badge_categoria(cat: str) -> rx.Component:
    return rx.match(
        cat,
        ("AGENTE_REGISTRO_LEGISLATIVO", rx.badge("📜 Proyecto de Ley / Asunto Legislativo", color_scheme="green", variant="solid", size="2")),
        ("AGENTE_ATENCION_CIUDADANA", rx.badge("👥 Solicitud / Petición Ciudadana", color_scheme="teal", variant="solid", size="2")),
        ("AGENTE_GESTION_CORRESPONDENCIA", rx.badge("✉️ Oficio / Comunicación Institucional", color_scheme="amber", variant="solid", size="2")),
        rx.badge("❓ Documento por Clasificar", color_scheme="gray", variant="surface", size="2"),
    )


def stepper_workflow() -> rx.Component:
    """Guía visual de 5 pasos para el operador."""
    def step_circle(num: int, label: str, icon_name: str) -> rx.Component:
        is_current = State.workflow_step == num
        is_completed = State.workflow_step > num
        return rx.vstack(
            rx.box(
                rx.cond(
                    is_completed,
                    rx.icon("check", size=20, color="#ffffff"),
                    rx.cond(
                        is_current,
                        rx.cond(
                            num == 3,
                            rx.icon("circle_stop", size=20, color="#ffffff"),
                            rx.spinner(size="1", color="#ffffff"),
                        ),
                        rx.icon(icon_name, size=18, color="#a7f3d0"),
                    ),
                ),
                width="42px",
                height="42px",
                border_radius="50%",
                display="flex",
                align_items="center",
                justify_content="center",
                background=rx.cond(
                    is_completed,
                    "#059669",
                    rx.cond(
                        is_current,
                        rx.cond(num == 3, "#d97706", "#10b981"),
                        "rgba(6, 78, 59, 0.6)",
                    ),
                ),
                border=rx.cond(
                    is_completed,
                    "2px solid #34d399",
                    rx.cond(
                        is_current,
                        rx.cond(num == 3, "2px solid #fde68a", "2px solid #6ee7b7"),
                        "1px solid rgba(16, 185, 129, 0.2)",
                    ),
                ),
                box_shadow=rx.cond(
                    is_current,
                    rx.cond(num == 3, "0 0 18px rgba(245,158,11,0.6)", "0 0 18px rgba(16,185,129,0.6)"),
                    "none",
                ),
                transition="all 0.3s ease",
            ),
            rx.text(
                label,
                size="1",
                weight=rx.cond(is_current, "bold", "medium"),
                color=rx.cond(is_completed, "#34d399", rx.cond(is_current, "#ffffff", "#94a3b8")),
                text_align="center",
            ),
            align="center",
            spacing="1",
        )

    def step_line(before_num: int) -> rx.Component:
        return rx.box(
            height="3px",
            flex="1",
            background=rx.cond(State.workflow_step > before_num, "#10b981", "rgba(16, 185, 129, 0.2)"),
            margin_x="10px",
            margin_bottom="24px",
            transition="background 0.3s ease",
            border_radius="2px",
        )

    return rx.box(
        rx.hstack(
            step_circle(1, "1. Carga", "file_up"),
            step_line(1),
            step_circle(2, "2. Clasificación", "search"),
            step_line(2),
            step_circle(3, "3. Revisión / Alto", "hand"),
            step_line(3),
            step_circle(4, "4. Comisión & Ley", "scale"),
            step_line(4),
            step_circle(5, "5. Dictamen Listo", "award"),
            align="center",
            width="100%",
            justify="between",
        ),
        padding="20px 28px",
        background="linear-gradient(180deg, rgba(6, 78, 59, 0.4) 0%, rgba(9, 60, 50, 0.6) 100%)",
        border="1px solid rgba(16, 185, 129, 0.3)",
        border_radius="16px",
        backdrop_filter="blur(10px)",
        width="100%",
        margin_bottom="16px",
        box_shadow="0 8px 30px rgba(0, 0, 0, 0.2)",
    )


def modal_articulo_viewer() -> rx.Component:
    """Visor accesible del texto oficial de la Constitución."""
    return rx.dialog.root(
        rx.dialog.content(
            rx.dialog.title(
                rx.hstack(
                    rx.badge(f"Artículo {State.selected_articulo['numero']}", color_scheme="green", size="2"),
                    rx.heading(State.selected_articulo["titulo"], size="4", color="#ffffff"),
                    spacing="2",
                    align="center",
                )
            ),
            rx.dialog.description(
                rx.vstack(
                    rx.hstack(
                        rx.badge(f"Capítulo: {State.selected_articulo['capitulo']}", color_scheme="teal", variant="surface"),
                        rx.badge(f"Sección: {State.selected_articulo['seccion']}", color_scheme="gray", variant="surface"),
                        spacing="2",
                    ),
                    rx.box(
                        rx.text(
                            State.selected_articulo["texto"],
                            color="#f1f5f9",
                            font_size="1rem",
                            line_height="1.8",
                            white_space="pre-wrap",
                        ),
                        padding="18px",
                        background="rgba(6, 34, 28, 0.95)",
                        border_radius="10px",
                        border="1px solid rgba(16, 185, 129, 0.3)",
                        max_height="400px",
                        overflow_y="auto",
                        width="100%",
                    ),
                    spacing="3",
                    width="100%",
                    padding_y="12px",
                )
            ),
            rx.hstack(
                rx.spacer(),
                rx.button(
                    "Entendido / Cerrar",
                    on_click=State.close_articulo_modal,
                    variant="solid",
                    color_scheme="green",
                    cursor="pointer",
                ),
                width="100%",
            ),
            background="#093c32",
            border="1px solid #10b981",
            max_width="700px",
        ),
        open=State.is_articulo_modal_open,
    )


def modal_documento_viewer() -> rx.Component:
    """Ventana emergente para ver el texto completo del documento/proyecto de ley cargado."""
    return rx.dialog.root(
        rx.dialog.content(
            rx.dialog.title(
                rx.hstack(
                    rx.box(
                        rx.icon("file_text", size=20, color="#ffffff"),
                        padding="8px",
                        background="linear-gradient(135deg, #059669 0%, #10b981 100%)",
                        border_radius="8px",
                    ),
                    rx.vstack(
                        rx.heading("Contenido del Documento Cargado", size="4", color="#ffffff"),
                        rx.text(State.upload_filename, size="1", color="#6ee7b7"),
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
                        rx.badge(State.extracted_pages.to_string() + " páginas", color_scheme="green", size="1"),
                        rx.badge(State.extracted_words.to_string() + " palabras", color_scheme="teal", size="1"),
                        rx.badge(State.upload_filesize, color_scheme="gray", size="1"),
                        spacing="2",
                    ),
                    rx.box(
                        rx.text(
                            State.upload_text,
                            color="#e2e8f0",
                            font_size="0.875rem",
                            line_height="1.75",
                            white_space="pre-wrap",
                        ),
                        padding="20px",
                        background="rgba(6, 34, 28, 0.95)",
                        border_radius="12px",
                        border="1px solid rgba(16, 185, 129, 0.25)",
                        max_height="55vh",
                        overflow_y="auto",
                        width="100%",
                    ),
                    spacing="3",
                    width="100%",
                    padding_y="12px",
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
            border="1px solid #10b981",
            max_width="800px",
            width="90vw",
        ),
        open=State.is_text_modal_open,
    )


def control_humano_card() -> rx.Component:
    """Punto de Control / Pausa para que el operador confirme o ajuste la categoría."""
    return rx.cond(
        State.workflow_step == 3,
        rx.box(
            rx.vstack(
                rx.hstack(
                    rx.image(
                        src="/robots/robot_distribuidor.jpg",
                        width="60px",
                        height="60px",
                        object_fit="contain",
                        border_radius="10px",
                        border="2px solid rgba(253, 230, 138, 0.5)",
                        background="#ffffff",
                    ),
                    rx.vstack(
                        rx.heading("Punto de Revisión y Confirmación del Operador", size="4", color="#ffffff"),
                        rx.text("El Agente Distribuidor identificó la siguiente instancia. Puedes confirmar o cambiar la categoría antes de continuar.", size="2", color="#fde68a"),
                        align="start",
                        spacing="0",
                    ),
                    spacing="3",
                    align="center",
                ),
                rx.divider(border_color="rgba(245, 158, 11, 0.4)"),


                # Resumen de sugerencia y selector de cambio
                rx.grid(
                    rx.vstack(
                        rx.text("CATEGORÍA IDENTIFICADA:", size="1", color="#fde68a", weight="bold"),
                        badge_categoria(State.categoria_sugerida),
                        align="start",
                        spacing="2",
                    ),
                    rx.vstack(
                        rx.text("SI DESEAS MODIFICARLA, SELECCIONA AQUÍ:", size="1", color="#fde68a", weight="bold"),
                        rx.select(
                            [
                                "AGENTE_REGISTRO_LEGISLATIVO",
                                "AGENTE_ATENCION_CIUDADANA",
                                "AGENTE_GESTION_CORRESPONDENCIA",
                            ],
                            value=State.categoria_seleccionada,
                            on_change=State.set_categoria_seleccionada,
                            size="2",
                            variant="surface",
                            color_scheme="green",
                        ),
                        align="start",
                        spacing="2",
                    ),
                    columns="2",
                    gap="16px",
                    width="100%",
                ),

                # Botones de Acción: DETENER vs CONTINUAR
                rx.hstack(
                    rx.button(
                        rx.icon("ban", size=16),
                        "✋ Detener / Cancelar Trámite",
                        on_click=State.detener_proceso,
                        color_scheme="red",
                        variant="soft",
                        size="3",
                        cursor="pointer",
                    ),
                    rx.spacer(),
                    rx.button(
                        rx.icon("arrow_right", size=18),
                        "▶️ Confirmar y Continuar Análisis",
                        on_click=State.continuar_fase_2_agentes,
                        color_scheme="green",
                        size="3",
                        cursor="pointer",
                        style={
                            "background": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                            "box_shadow": "0 4px 20px rgba(16, 185, 129, 0.4)",
                            "color": "#ffffff",
                            "font_weight": "bold",
                        },
                    ),
                    width="100%",
                    align="center",
                    margin_top="12px",
                ),
                spacing="4",
                align="start",
                width="100%",
            ),
            padding="26px",
            background="linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(9, 60, 50, 0.95) 100%)",
            border="2px solid #f59e0b",
            border_radius="16px",
            box_shadow="0 8px 32px rgba(245, 158, 11, 0.25)",
            width="100%",
        ),
    )


def card_constitucional_resultado() -> rx.Component:
    """Tarjeta de Auditoría Constitucional con Semáforo y desglose accesible."""
    is_conforme = State.last_valido.contains("CONFORME")

    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.box(
                    rx.icon("scale", size=24, color=rx.cond(is_conforme, "#10b981", "#ef4444")),
                    width="40px",
                    height="40px",
                    border_radius="10px",
                    background="rgba(6, 78, 59, 0.4)",
                    border=rx.cond(is_conforme, "1px solid #10b981", "1px solid #ef4444"),
                    display="flex",
                    align_items="center",
                    justify_content="center",
                ),
                rx.vstack(
                    rx.heading("Control de Constitucionalidad", size="3", color="#ffffff"),
                    rx.text("Cotejo frente a los artículos de la Constitución del Estado.", size="1", color="#a7f3d0"),
                    align="start",
                    spacing="0",
                ),
                rx.spacer(),
                rx.badge(
                    State.last_valido,
                    color_scheme=rx.cond(is_conforme, "green", "red"),
                    size="2",
                    variant="solid",
                ),
                align="center",
                width="100%",
            ),
            rx.divider(border_color="rgba(16, 185, 129, 0.2)"),

            # Métricas Claras
            rx.grid(
                rx.vstack(
                    rx.text("NIVEL DE CONFORMIDAD", size="1", color="#a7f3d0"),
                    rx.heading(State.last_confianza, size="4", color="#ffffff"),
                    align="center",
                ),
                rx.vstack(
                    rx.text("ESTADO LEGAL", size="1", color="#a7f3d0"),
                    rx.badge(State.last_severidad.upper(), color_scheme=rx.cond(is_conforme, "green", "amber"), size="2"),
                    align="center",
                ),
                rx.vstack(
                    rx.text("OBSERVACIONES", size="1", color="#a7f3d0"),
                    rx.heading(State.last_num_contradicciones.to_string(), size="4", color=rx.cond(is_conforme, "#10b981", "#ef4444")),
                    align="center",
                ),
                columns="3",
                gap="12px",
                width="100%",
                padding="14px",
                background="rgba(6, 78, 59, 0.3)",
                border_radius="10px",
                border="1px solid rgba(16, 185, 129, 0.2)",
            ),

            # Fundamentación
            rx.cond(
                State.last_fundamentacion != "",
                rx.vstack(
                    rx.text("FUNDAMENTACIÓN Y EXPLICACIÓN JURÍDICA:", size="1", color="#6ee7b7", weight="bold"),
                    rx.box(
                        rx.text(State.last_fundamentacion, size="2", color="#f1f5f9", line_height="1.7"),
                        padding="12px",
                        background="rgba(6, 34, 28, 0.8)",
                        border_radius="8px",
                        width="100%",
                    ),
                    align="start",
                    spacing="1",
                    width="100%",
                ),
            ),

            # Lista de Contradicciones / Observaciones
            rx.cond(
                State.last_contradicciones.length() > 0,
                rx.vstack(
                    rx.text("ARTÍCULOS CON OBSERVACIONES:", size="1", color="#ef4444", weight="bold"),
                    rx.foreach(
                        State.last_contradicciones,
                        lambda c: rx.box(
                            rx.vstack(
                                rx.hstack(
                                    rx.badge("En el Proyecto: " + c.articulo_proyecto, color_scheme="red", size="1"),
                                    rx.badge("En la Constitución: " + c.articulo_constitucional, color_scheme="green", size="1"),
                                    rx.badge(c.severidad.upper(), color_scheme="amber", size="1"),
                                    spacing="2",
                                ),
                                rx.text("Mandato Constitucional: " + c.texto_constitucional_verificado, size="1", color="#cbd5e1", font_style="italic"),
                                rx.text("Motivo de la observación: " + c.fundamento, size="1", color="#fca5a5"),
                                spacing="1",
                                align="start",
                            ),
                            padding="12px",
                            background="rgba(239, 68, 68, 0.1)",
                            border_left="4px solid #ef4444",
                            border_radius="6px",
                            width="100%",
                        ),
                    ),
                    spacing="2",
                    width="100%",
                ),
            ),
            spacing="3",
            align="start",
            width="100%",
        ),
        padding="20px",
        background="rgba(6, 78, 59, 0.35)",
        border="1px solid rgba(16, 185, 129, 0.3)",
        border_radius="14px",
        width="100%",
    )


def card_consistencia_normativa_resultado() -> rx.Component:
    """Tarjeta de Consistencia Normativa: cotejo contra el resto del ordenamiento vigente."""
    return rx.cond(
        State.last_num_hallazgos_consistencia > 0,
        rx.box(
            rx.vstack(
                rx.hstack(
                    rx.box(
                        rx.icon("git-compare", size=24, color="#f59e0b"),
                        width="40px",
                        height="40px",
                        border_radius="10px",
                        background="rgba(6, 78, 59, 0.4)",
                        border="1px solid #f59e0b",
                        display="flex",
                        align_items="center",
                        justify_content="center",
                    ),
                    rx.vstack(
                        rx.heading("Consistencia Normativa", size="3", color="#ffffff"),
                        rx.text("Cotejo semántico frente a leyes y decretos vigentes.", size="1", color="#a7f3d0"),
                        align="start",
                        spacing="0",
                    ),
                    rx.spacer(),
                    rx.badge(
                        State.last_num_hallazgos_consistencia.to_string() + " hallazgo(s)",
                        color_scheme="amber",
                        size="2",
                        variant="solid",
                    ),
                    align="center",
                    width="100%",
                ),
                rx.divider(border_color="rgba(16, 185, 129, 0.2)"),
                rx.vstack(
                    rx.foreach(
                        State.last_consistencia,
                        lambda h: rx.box(
                            rx.vstack(
                                rx.hstack(
                                    rx.badge(
                                        rx.match(
                                            h.tipo_relacion,
                                            ("contradiccion", "Contradicción"),
                                            ("repeticion", "Repetición"),
                                            ("vacio_llenado", "Llena un vacío"),
                                            ("complementario", "Complementario"),
                                            h.tipo_relacion,
                                        ),
                                        color_scheme=rx.match(
                                            h.tipo_relacion,
                                            ("contradiccion", "red"),
                                            ("repeticion", "amber"),
                                            ("vacio_llenado", "blue"),
                                            ("complementario", "green"),
                                            "gray",
                                        ),
                                        size="1",
                                    ),
                                    rx.cond(
                                        h.articulo_proyecto != "",
                                        rx.badge("Art. " + h.articulo_proyecto + " del documento", color_scheme="cyan", size="1"),
                                    ),
                                    rx.badge(h.norma + " — Art. " + h.numero_articulo, color_scheme="gray", size="1"),
                                    rx.text(
                                        "sim. " + (h.similitud * 100).to_string() + "%",
                                        size="1",
                                        color="#a7f3d0",
                                    ),
                                    spacing="2",
                                ),
                                rx.text(h.justificacion, size="1", color="#e2e8f0", line_height="1.6"),
                                rx.cond(
                                    h.sugerencia != "",
                                    rx.text("Sugerencia: " + h.sugerencia, size="1", color="#fbbf24", font_style="italic"),
                                ),
                                spacing="1",
                                align="start",
                            ),
                            padding="12px",
                            background="rgba(245, 158, 11, 0.08)",
                            border_left="4px solid #f59e0b",
                            border_radius="6px",
                            width="100%",
                        ),
                    ),
                    spacing="2",
                    width="100%",
                ),
                spacing="3",
                align="start",
                width="100%",
            ),
            padding="20px",
            background="rgba(6, 78, 59, 0.35)",
            border="1px solid rgba(245, 158, 11, 0.3)",
            border_radius="14px",
            width="100%",
        ),
    )


def resultado_completo_card() -> rx.Component:
    """Dictamen final claro y listo para imprimir o archivar."""
    return rx.cond(
        State.show_result,
        rx.box(
            rx.vstack(
                rx.hstack(
                    rx.image(
                        src="/robots/robot_legislativo.jpg",
                        width="56px",
                        height="56px",
                        object_fit="contain",
                        border_radius="10px",
                        border="2px solid #d1fae5",
                        background="#f0fdf4",
                    ),
                    rx.heading("Dictamen Final del Documento", size="5", color="#0f172a"),
                    rx.spacer(),
                    badge_categoria(State.last_categoria),
                    align="center",
                    width="100%",
                ),
                rx.divider(border_color="rgba(16, 185, 129, 0.3)"),

                rx.grid(
                    # Columna 1: Comisión, Resumen y Despacho
                    rx.vstack(
                        rx.text("🏛️ DESTINO / COMISIÓN ASIGNADA", size="1", color="#a7f3d0", weight="bold"),
                        rx.box(
                            rx.text(State.last_comision, size="3", color="#ffffff", weight="bold"),
                            padding="12px",
                            background="rgba(16, 185, 129, 0.15)",
                            border="1px solid rgba(16, 185, 129, 0.3)",
                            border_radius="8px",
                            width="100%",
                        ),
                        rx.text("📝 RESUMEN EJECUTIVO", size="1", color="#a7f3d0", weight="bold", margin_top="12px"),
                        rx.text(State.last_resumen, size="2", color="#e2e8f0", line_height="1.6"),
                        align="start",
                        gap="4px",
                        padding="20px",
                        background="rgba(6, 78, 59, 0.3)",
                        border_radius="12px",
                        border="1px solid rgba(16, 185, 129, 0.25)",
                    ),
                    # Columna 2: Auditoría Constitucional
                    card_constitucional_resultado(),
                    columns="2",
                    gap="20px",
                    width="100%",
                ),

                # Consistencia Normativa (contra leyes/decretos vigentes)
                card_consistencia_normativa_resultado(),

                # Botones de Acción
                rx.hstack(
                    rx.hstack(
                        rx.icon("clock", size=16, color="#a7f3d0"),
                        rx.text(f"Tiempo total de revisión: {State.last_duracion_ms} milisegundos", size="1", color="#a7f3d0"),
                        align="center",
                    ),
                    rx.spacer(),
                    rx.button(
                        rx.icon("folder_check", size=16),
                        "Ver en Archivo de Expedientes",
                        on_click=State.set_active_tab("expedientes"),
                        color_scheme="green",
                        size="2",
                        cursor="pointer",
                    ),
                    width="100%",
                    align="center",
                    margin_top="14px",
                ),
                gap="18px",
                align="start",
                width="100%",
            ),
            padding="28px",
            background="linear-gradient(135deg, rgba(6, 78, 59, 0.5) 0%, rgba(9, 60, 50, 0.95) 100%)",
            border="2px solid #10b981",
            border_radius="18px",
            width="100%",
            box_shadow="0 10px 40px rgba(0, 0, 0, 0.3)",
        ),
    )


def agente_constitucional_inline() -> rx.Component:
    """Widget compacto del Agente de Verificación Constitucional, integrado en el paso 4 (Comisión & Ley).

    Se muestra mientras el Agente Fiscal Constitucional está cotejando el proyecto de ley
    contra la Constitución Política del Estado (Nivel 2 del pipeline)."""
    return rx.cond(
        (State.workflow_step == 4) & (State.categoria_seleccionada == "AGENTE_REGISTRO_LEGISLATIVO"),
        rx.box(
            rx.vstack(
                # Cabecera del agente con robot
                rx.hstack(
                    rx.image(
                        src="/robots/robot_constitucional.jpg",
                        width="64px",
                        height="64px",
                        object_fit="contain",
                        border_radius="12px",
                        border="2px solid #d1fae5",
                        background="#f0fdf4",
                    ),
                    rx.vstack(
                        rx.hstack(
                            rx.text("Agente de Verificación Constitucional", size="2", weight="bold", color="#0f172a"),
                            rx.badge("● En línea", color_scheme="green", size="1", variant="soft"),
                            gap="8px",
                            align="center",
                        ),
                        rx.text("Dr. Ramiro Aranda Peñaranda — Comisión de Constitución, Legislación y Sistema Electoral", size="1", color="#059669"),
                        align="start",
                        spacing="0",
                    ),
                    rx.spacer(),
                    spacing="3",
                    align="center",
                    width="100%",
                ),

                rx.divider(border_color="rgba(5, 150, 105, 0.25)"),

                # Mensaje del agente en curso
                rx.vstack(
                    rx.text(
                        "Buenas tardes. He recibido el proyecto de ley para su control de constitucionalidad. "
                        "Procederé con el cotejo textual estricto frente a la Constitución Política del Estado:",
                        size="2", color="#374151", font_style="italic",
                    ),
                    rx.vstack(
                        rx.hstack(rx.icon("circle_check", size=14, color="#059669"), rx.text("Segmentando el proyecto en artículos y proposiciones normativas", size="1", color="#374151"), gap="6px"),
                        rx.hstack(rx.icon("circle_check", size=14, color="#059669"), rx.text("Buscando artículos concordantes en la Constitución Política del Estado", size="1", color="#374151"), gap="6px"),
                        rx.hstack(rx.icon("circle_check", size=14, color="#059669"), rx.text("Realizando el cotejo forense artículo por artículo", size="1", color="#374151"), gap="6px"),
                        rx.hstack(
                            rx.spinner(size="1", color="#059669"),
                            rx.text(State.process_step_text, size="1", color="#059669", weight="bold"),
                            gap="6px",
                        ),
                        spacing="2",
                        align="start",
                        padding="12px 16px",
                        background="#f0fdf4",
                        border_left="3px solid #059669",
                        border_radius="8px",
                        width="100%",
                    ),
                    spacing="3",
                    width="100%",
                ),
                spacing="3",
                width="100%",
            ),
            padding="18px 22px",
            background="#ffffff",
            border="1px solid #d1fae5",
            border_radius="14px",
            box_shadow="0 2px 10px rgba(5, 150, 105, 0.08)",
            width="100%",
        ),
    )


def chat_bubble_ciudadano(msg: ChatMessageCiudadano) -> rx.Component:
    """Burbuja individual del chat con el Agente de Interacción Ciudadana."""
    es_usuario = msg.role == "user"
    return rx.hstack(
        rx.box(
            rx.text(msg.content, size="2", line_height="1.6", white_space="pre-wrap"),
            padding="10px 14px",
            max_width="80%",
            background=rx.cond(es_usuario, "#059669", "#f0fdf4"),
            color=rx.cond(es_usuario, "#ffffff", "#0f172a"),
            border=rx.cond(es_usuario, "none", "1px solid #d1fae5"),
            border_radius=rx.cond(es_usuario, "14px 14px 2px 14px", "14px 14px 14px 2px"),
        ),
        width="100%",
        justify=rx.cond(es_usuario, "end", "start"),
    )


def agente_ciudadano_inline() -> rx.Component:
    """Widget compacto del Agente de Interacción Ciudadana integrado en la zona de Carga, con chat conversacional real."""
    return rx.cond(
        State.workflow_step == 1,
        rx.box(
            rx.vstack(
                # Cabecera del agente con robot
                rx.hstack(
                    rx.image(
                        src="/robots/robot_ciudadano.jpg",
                        width="64px",
                        height="64px",
                        object_fit="contain",
                        border_radius="12px",
                        border="2px solid #d1fae5",
                        background="#f0fdf4",
                    ),
                    rx.vstack(
                        rx.hstack(
                            rx.text("Agente de Interacción Ciudadana", size="2", weight="bold", color="#0f172a"),
                            rx.badge("● En línea", color_scheme="green", size="1", variant="soft"),
                            gap="8px",
                            align="center",
                        ),
                        rx.text("Lic. María Helena Choque — Oficialía Mayor, Cámara de Senadores", size="1", color="#059669"),
                        align="start",
                        spacing="0",
                    ),
                    rx.spacer(),
                    rx.button(
                        rx.icon("rotate_ccw", size=14),
                        on_click=State.limpiar_chat_ciudadano,
                        variant="ghost",
                        color_scheme="gray",
                        size="1",
                        cursor="pointer",
                    ),
                    spacing="3",
                    align="center",
                    width="100%",
                ),

                # ── Ventana de chat conversacional (real, vía LLM) ─────────────
                rx.box(
                    rx.cond(
                        State.ciudadano_chat_history.length() > 0,
                        rx.vstack(
                            rx.foreach(State.ciudadano_chat_history, chat_bubble_ciudadano),
                            spacing="3",
                            width="100%",
                        ),
                        rx.text(
                            "Buenos días. Soy la Lic. María Helena Choque, de la Oficialía Mayor. "
                            "Cuénteme, ¿en qué puedo ayudarle hoy? Puede contarme su petición o consultarme "
                            "cómo funciona el trámite.",
                            size="2", color="#374151", font_style="italic",
                        ),
                    ),
                    rx.cond(
                        State.ciudadano_chat_loading,
                        rx.hstack(
                            rx.spinner(size="1", color="#059669"),
                            rx.text("La Lic. Choque está escribiendo...", size="1", color="#059669"),
                            gap="6px",
                            margin_top="8px",
                        ),
                    ),
                    padding="14px 16px",
                    background="#fafffe",
                    border="1px solid #e2f5ea",
                    border_radius="12px",
                    max_height="320px",
                    overflow_y="auto",
                    width="100%",
                ),

                # ── Barra de entrada del chat ───────────────────────────────────
                rx.hstack(
                    rx.input(
                        placeholder="Escriba su mensaje o petición aquí...",
                        value=State.ciudadano_chat_input,
                        on_change=State.set_ciudadano_chat_input,
                        on_key_down=State.on_key_chat_ciudadano,
                        is_disabled=State.ciudadano_chat_loading,
                        size="2", variant="surface", color_scheme="green", width="100%",
                    ),
                    rx.button(
                        rx.icon("send", size=16),
                        on_click=State.enviar_mensaje_ciudadano,
                        is_disabled=State.ciudadano_chat_loading | (State.ciudadano_chat_input == ""),
                        color_scheme="green",
                        size="2",
                        cursor="pointer",
                        style={"background": "linear-gradient(135deg, #059669 0%, #10b981 100%)", "color": "#ffffff"},
                    ),
                    width="100%",
                    gap="8px",
                ),

                rx.divider(border_color="rgba(5, 150, 105, 0.2)"),

                # Formulario (solo si no está registrado aun)
                rx.cond(
                    ~State.ciudadana_guardado_ok,
                    rx.vstack(
                        rx.text(
                            "Cuando tenga claro su motivo, complete estos datos para formalizar el trámite:",
                            size="2", color="#374151", font_style="italic",
                        ),
                        rx.grid(
                            rx.vstack(
                                rx.text("Nombre del ciudadano:", size="1", color="#059669", weight="bold"),
                                rx.input(
                                    placeholder="Ej. Carlos Mamani Quispe",
                                    value=State.ciudadano_nombre,
                                    on_change=State.set_ciudadano_nombre,
                                    size="2", variant="surface", color_scheme="green", width="100%",
                                ),
                                spacing="1", align="start", width="100%",
                            ),
                            rx.vstack(
                                rx.text("Motivo / Petición:", size="1", color="#059669", weight="bold"),
                                rx.input(
                                    placeholder="Ej. Solicitud de financiamiento para proyecto de riego",
                                    value=State.ciudadano_motivo,
                                    on_change=State.set_ciudadano_motivo,
                                    size="2", variant="surface", color_scheme="green", width="100%",
                                ),
                                spacing="1", align="start", width="100%",
                            ),
                            rx.vstack(
                                rx.text("Vía de Recepción:", size="1", color="#059669", weight="bold"),
                                rx.select(
                                    ["Digital", "Física", "Oficialía de Partes"],
                                    value=State.ciudadano_recepcion,
                                    on_change=State.set_ciudadano_recepcion,
                                    size="2", color_scheme="green", width="100%",
                                ),
                                spacing="1", align="start", width="100%",
                            ),
                            columns="3",
                            gap="12px",
                            width="100%",
                        ),
                        rx.button(
                            rx.cond(
                                State.ciudadana_is_saving,
                                rx.hstack(rx.spinner(size="1"), rx.text("Registrando..."), gap="6px"),
                                rx.hstack(rx.icon("send", size=15), rx.text("Registrar y continuar"), gap="6px"),
                            ),
                            on_click=State.interactuar_ciudadano,
                            is_disabled=State.ciudadana_is_saving,
                            color_scheme="green",
                            size="2",
                            cursor="pointer",
                            style={
                                "background": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                                "color": "#ffffff",
                                "font_weight": "bold",
                            },
                        ),
                        spacing="3",
                        width="100%",
                    ),
                    # Confirmación tras el registro (el detalle ya se muestra arriba en el chat)
                    rx.vstack(
                        rx.hstack(
                            rx.icon("circle_check", size=16, color="#059669"),
                            rx.text("Trámite registrado exitosamente", size="1", color="#059669", weight="bold"),
                            rx.spacer(),
                            rx.badge("ID: " + State.sesion_id_short, color_scheme="green", size="1", variant="surface"),
                            align="center",
                            width="100%",
                        ),
                        rx.text(
                            "↓ El área de carga de documentos se ha habilitado a continuación.",
                            size="1", color="#059669", weight="medium",
                        ),
                        spacing="2",
                        width="100%",
                    ),
                ),
                spacing="3",
                width="100%",
            ),
            padding="18px 22px",
            background="#ffffff",
            border="1px solid #d1fae5",
            border_radius="14px",
            box_shadow="0 2px 10px rgba(5, 150, 105, 0.08)",
            width="100%",
        ),
    )


def upload_section() -> rx.Component:
    """Zona de recepción con Dropzone y texto directo."""
    return rx.vstack(
        # Agente de Interacción Ciudadana (integrado, solo en el paso de Carga)
        agente_ciudadano_inline(),

        # Selector de modo (solo en paso de Carga)
        rx.cond(
            State.workflow_step == 1,
            rx.hstack(
                rx.button(
                    rx.icon("file_up", size=16),
                    "Subir Documento (PDF / Word)",
                    on_click=State.set_upload_mode("file"),
                    variant=rx.cond(State.upload_mode == "file", "solid", "surface"),
                    color_scheme="green",
                    size="3",
                    cursor="pointer",
                ),
                rx.button(
                    rx.icon("type", size=16),
                    "Pegar Texto Directo",
                    on_click=State.set_upload_mode("text"),
                    variant=rx.cond(State.upload_mode == "text", "solid", "surface"),
                    color_scheme="green",
                    size="3",
                    cursor="pointer",
                ),
                gap="10px",
            ),
        ),

        # Modo 1: Carga de Archivo
        rx.cond(
            State.upload_mode == "file",
            rx.vstack(
                rx.upload(
                    rx.vstack(
                        rx.icon("cloud_upload", size=42, color="#34d399"),
                        rx.heading("Arrastra tu documento PDF o haz clic para seleccionarlo", size="3", color="#ffffff"),
                        rx.text("Acepta archivos .pdf, .docx y .txt con lectura automática", size="2", color="#a7f3d0"),
                        align="center",
                        spacing="2",
                    ),
                    id="doc_uploader",
                    border="2px dashed #10b981",
                    padding="36px",
                    border_radius="16px",
                    background="rgba(6, 78, 59, 0.25)",
                    _hover={"border_color": "#34d399", "background": "rgba(6, 78, 59, 0.4)"},
                    cursor="pointer",
                    width="100%",
                    # El accept anterior sólo permitía el MIME type "correcto"
                    # de cada extensión (application/pdf, etc.). Muchos
                    # navegadores/SO reportan PDFs y DOCX como
                    # application/octet-stream (o sin MIME), y react-dropzone
                    # los rechazaba en silencio antes de llegar a Python —
                    # por eso rx.upload_files() volvía vacío aunque el
                    # usuario sí soltara un PDF válido. Se agregan los
                    # fallbacks de MIME más comunes por extensión.
                    accept={
                        "application/pdf": [".pdf"],
                        "application/x-pdf": [".pdf"],
                        "text/plain": [".txt"],
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                        "application/msword": [".docx"],
                        "application/octet-stream": [".pdf", ".docx", ".txt"],
                    },
                    max_files=1,
                    on_drop=State.handle_upload(rx.upload_files(upload_id="doc_uploader")),
                ),

                # Archivo seleccionado pendiente de cargar
                rx.cond(
                    ~State.is_file_loaded & (rx.selected_files("doc_uploader").length() > 0),
                    rx.box(
                        rx.hstack(
                            rx.icon("file", size=20, color="#fde68a"),
                            rx.vstack(
                                rx.text("Archivo seleccionado:", size="1", color="#fde68a"),
                                rx.foreach(rx.selected_files("doc_uploader"), lambda f: rx.text(f, size="2", weight="bold", color="#ffffff")),
                                align="start",
                                spacing="0",
                            ),
                            rx.spacer(),
                            rx.button(
                                rx.icon("upload", size=16),
                                "Confirmar Carga",
                                on_click=State.handle_upload(rx.upload_files(upload_id="doc_uploader")),
                                color_scheme="teal",
                                size="2",
                                cursor="pointer",
                            ),
                            align="center",
                            width="100%",
                        ),
                        padding="12px 18px",
                        background="rgba(245, 158, 11, 0.15)",
                        border="1px solid #f59e0b",
                        border_radius="12px",
                        width="100%",
                    ),
                ),

                # Info del archivo extraído/cargado — con botón para ver el contenido en modal
                rx.cond(
                    State.is_file_loaded,
                    rx.box(
                        rx.hstack(
                            rx.icon("file_check", size=24, color="#34d399"),
                            rx.vstack(
                                rx.text(State.upload_filename, size="2", weight="bold", color="#ffffff"),
                                rx.hstack(
                                    rx.badge(State.upload_filesize, color_scheme="gray", size="1"),
                                    rx.cond(
                                        State.extracted_words > 0,
                                        rx.fragment(
                                            rx.badge(State.extracted_pages.to_string() + " páginas", color_scheme="green", size="1"),
                                            rx.badge(State.extracted_words.to_string() + " palabras", color_scheme="teal", size="1"),
                                        ),
                                        rx.badge("Pendiente de extracción", color_scheme="amber", size="1"),
                                    ),
                                    spacing="2",
                                ),
                                align="start",
                                spacing="0",
                            ),
                            rx.spacer(),
                            rx.hstack(
                                rx.button(
                                    rx.hstack(rx.icon("eye", size=15), rx.text("Ver Proyecto de Ley"), gap="6px"),
                                    on_click=State.open_text_modal,
                                    color_scheme="teal",
                                    variant="soft",
                                    size="2",
                                    cursor="pointer",
                                    style={
                                        "border": "1px solid rgba(20, 184, 166, 0.5)",
                                    },
                                ),
                                rx.button(
                                    rx.icon("trash_2", size=16),
                                    "Quitar",
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
                        padding="16px 20px",
                        background="rgba(16, 185, 129, 0.15)",
                        border="1px solid #10b981",
                        border_radius="12px",
                        width="100%",
                    ),
                ),
                width="100%",
                spacing="3",
            ),
        ),

        # Modo 2: Text Area (ingreso manual) — solo visible en paso 1
        rx.cond(
            (State.upload_mode == "text") & (State.workflow_step == 1),
            rx.vstack(
                rx.text_area(
                    placeholder="Pega aquí el contenido del proyecto de ley, carta ciudadana u oficio...",
                    value=State.upload_text,
                    on_change=State.set_upload_text,
                    rows="8",
                    width="100%",
                    style={
                        "background": "rgba(6, 34, 28, 0.8)",
                        "border": "1px solid rgba(16, 185, 129, 0.3)",
                        "color": "#f8fafc",
                        "border_radius": "12px",
                        "padding": "16px",
                        "font_size": "15px",
                    },
                ),
                width="100%",
            ),
        ),

        # Vista previa del documento extraído — solo en paso 1, como botón de modal (no textarea)
        # Antes esta condición sólo chequeaba is_file_loaded, que se activa
        # apenas se guarda el archivo (antes de la extracción real). Por eso
        # el usuario veía "Texto extraído y listo" junto con "0 páginas / 0
        # palabras". Ahora exige que ya haya texto extraído de verdad.
        rx.cond(
            (State.upload_mode == "file") & State.is_file_loaded & (State.workflow_step == 1) & (State.extracted_words > 0),
            rx.box(
                rx.hstack(
                    rx.icon("circle_check", size=18, color="#34d399"),
                    rx.text("Texto extraído y listo para clasificar.", size="2", color="#a7f3d0", weight="medium"),
                    rx.spacer(),
                    rx.button(
                        rx.hstack(rx.icon("eye", size=14), rx.text("Previsualizar contenido completo"), gap="5px"),
                        on_click=State.open_text_modal,
                        variant="ghost",
                        color_scheme="teal",
                        size="1",
                        cursor="pointer",
                    ),
                    align="center",
                    width="100%",
                ),
                padding="10px 16px",
                background="rgba(16, 185, 129, 0.08)",
                border="1px dashed rgba(16, 185, 129, 0.3)",
                border_radius="10px",
                width="100%",
            ),
        ),

        # Ejemplos rápidos (solo en paso 1)
        rx.cond(
            State.workflow_step == 1,
            rx.hstack(
                rx.text("Cargar ejemplo de prueba:", size="1", color="#a7f3d0", weight="bold"),
                rx.button("📜 P.L. Energías Renovables", on_click=State.cargar_ejemplo_legislativo, size="1", variant="surface", color_scheme="green"),
                rx.button("👥 Petición Agua Viacha", on_click=State.cargar_ejemplo_ciudadano, size="1", variant="surface", color_scheme="teal"),
                rx.button("✉️ Oficio Min. Economía", on_click=State.cargar_ejemplo_oficio, size="1", variant="surface", color_scheme="amber"),
                wrap="wrap",
                gap="8px",
            ),
        ),

        # Mensaje de Error
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

        # Spinner de progreso amigable
        rx.cond(
            State.is_processing,
            rx.vstack(
                rx.hstack(
                    rx.spinner(size="2", color="#34d399"),
                    rx.text(State.process_step_text, size="2", color="#a7f3d0", weight="medium"),
                ),
                rx.progress(is_indeterminate=True, color_scheme="green", size="1", width="100%"),
                spacing="2",
                width="100%",
            ),
        ),

        # Botón de Inicio
        rx.cond(
            (State.workflow_step == 1) | (State.workflow_step == 2),
            rx.cond(
                State.upload_mode == "text",
                # MODO TEXTO: Ejecuta clasificación directamente
                rx.button(
                    rx.cond(
                        State.is_processing,
                        rx.hstack(rx.spinner(size="2"), rx.text("Examinando documento..."), gap="8px"),
                        rx.hstack(rx.icon("sparkles", size=18), rx.text("Comenzar Clasificación del Documento"), gap="8px"),
                    ),
                    on_click=State.ejecutar_fase_1_clasificar,
                    is_disabled=State.is_processing,
                    color_scheme="green",
                    size="3",
                    width="100%",
                    style={
                        "background": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                        "box_shadow": "0 6px 24px rgba(16, 185, 129, 0.4)",
                        "color": "#ffffff",
                        "font_weight": "bold",
                        "font_size": "15px",
                        "cursor": "pointer",
                    },
                ),
                rx.cond(
                    State.is_file_loaded,
                    # MODO ARCHIVO (Ya cargado): Ejecuta clasificación directamente
                    rx.button(
                        rx.cond(
                            State.is_processing,
                            rx.hstack(rx.spinner(size="2"), rx.text("Examinando documento..."), gap="8px"),
                            rx.hstack(rx.icon("sparkles", size=18), rx.text("Comenzar Clasificación del Documento"), gap="8px"),
                        ),
                        on_click=State.ejecutar_fase_1_clasificar,
                        is_disabled=State.is_processing,
                        color_scheme="green",
                        size="3",
                        width="100%",
                        style={
                            "background": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                            "box_shadow": "0 6px 24px rgba(16, 185, 129, 0.4)",
                            "color": "#ffffff",
                            "font_weight": "bold",
                            "font_size": "15px",
                            "cursor": "pointer",
                        },
                    ),
                    # MODO ARCHIVO (Pendiente de cargar): Primero sube y luego clasifica
                    rx.button(
                        rx.cond(
                            State.is_processing,
                            rx.hstack(rx.spinner(size="2"), rx.text("Cargando y clasificando..."), gap="8px"),
                            rx.hstack(rx.icon("sparkles", size=18), rx.text("Comenzar Clasificación del Documento"), gap="8px"),
                        ),
                        on_click=State.handle_upload_and_classify(rx.upload_files(upload_id="doc_uploader")),
                        # Antes este botón quedaba habilitado aunque el usuario
                        # no hubiera elegido ningún archivo todavía, disparando
                        # la clasificación con estado vacío. Ahora exige que
                        # haya al menos un archivo seleccionado en el dropzone.
                        is_disabled=State.is_processing | (rx.selected_files("doc_uploader").length() == 0),
                        color_scheme="green",
                        size="3",
                        width="100%",
                        style={
                            "background": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                            "box_shadow": "0 6px 24px rgba(16, 185, 129, 0.4)",
                            "color": "#ffffff",
                            "font_weight": "bold",
                            "font_size": "15px",
                            "cursor": "pointer",
                        },
                    ),
                ),
            ),
        ),
        gap="16px",
        width="100%",
    )


def upload_page() -> rx.Component:
    return rx.vstack(
        stepper_workflow(),
        upload_section(),
        control_humano_card(),
        agente_constitucional_inline(),
        resultado_completo_card(),
        modal_articulo_viewer(),
        modal_documento_viewer(),
        gap="28px",
        width="100%",
        align="start",
    )
