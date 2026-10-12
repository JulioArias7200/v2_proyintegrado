/**
 * AgentChatPanel.jsx - Chatbot Conversacional por Agente (audio ↔ texto)
 * =======================================================================
 * Chat interactivo de la Mesa de Partes: el usuario escribe o dicta por voz,
 * el Orquestador (LLM, backend /api/chat/*) decide el agente destino y la
 * acción del pipeline, y el panel ejecuta acciones vía callback onAccion.
 *
 * Precisión: las acciones irreversibles llegan con `requiere_confirmacion`
 * y se muestran como tarjeta de confirmación humana antes de ejecutarse.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Send, Volume2, VolumeX, Loader,
  AlertTriangle, CheckCircle2, X, MessageSquare
} from "lucide-react";
import {
  sendChatMessage,
  getChatHistory,
  confirmarChatAccion,
} from "../services/api";

// Config por agente de la mesa de partes (nombre canónico = clave de COMANDOS_VOZ backend)
const AGENT_CHAT_CONFIG = {
  distribuidor: {
    canonico: "Distribuidor", icon: "📥", color: "#00B4D8",
    logo: "/robots/logos/agente_distribuidor.jpeg",
    bienvenida: "Soy el Agente Distribuidor. Puedes dictarme el texto del proyecto, pedirme que lo clasifique o leerte la categoría asignada.",
  },
  comision: {
    canonico: "Comision", icon: "🏛️", color: "#7C3AED",
    logo: "/robots/logos/agente_comision.jpeg",
    bienvenida: "Soy el Agente de Comisión. Puedo leerte la comisión asignada o modificar la asignación si me lo dictas.",
  },
  constitucional: {
    canonico: "VerificadorConstitucional", icon: "⚖️", color: "#F59E0B",
    logo: "/robots/logos/agente_constitucional.jpeg",
    bienvenida: "Soy el Verificador Constitucional. Te leo las observaciones frente a la CPE y tomo nota de las que me dictes.",
  },
  consistencia: {
    canonico: "ConsistenciaNormativa", icon: "🔍", color: "#10B981",
    logo: "/robots/logos/agente_consistencia.jpeg",
    bienvenida: "Soy el Agente de Consistencia Normativa. Te leo los hallazgos y conflictos con leyes vigentes; dicta tus notas cuando quieras.",
  },
  emisor: {
    canonico: "EmisorResultados", icon: "📄", color: "#EC4899",
    logo: "/robots/logos/concentrador.jpeg",
    bienvenida: "Soy el Emisor de Resultados. Te leo el dictamen PDF y si me dictas observaciones las envío como notificación.",
  },
  notificador: {
    canonico: "NotificadorComision", icon: "📧", color: "#6366F1",
    logo: "/robots/logos/agente_comodin.jpeg",
    bienvenida: "Soy el Notificador de Comisión. Puedo enviar los correos a la comisión o al autor, previa confirmación.",
  },
  secretario: {
    canonico: "SecretarioCamara", icon: "✍️", color: "#14B8A6",
    logo: "/robots/logos/agente_secretario.jpeg",
    bienvenida: "Soy la Secretaría de Cámara. Dictame correcciones y te leo el acta y las votaciones para enviarlas al Bicameral.",
  },
  bicameral: {
    canonico: "Bicameral", icon: "🤝", color: "#F97316",
    logo: "/robots/logos/agente_bicamaral.jpeg",
    bienvenida: "Soy el Agente Bicameral. Te leo la resolución de las cámaras y coordino la reconciliación del texto.",
  },
  veto_promulgacion: {
    canonico: "VetoPromulgacion", icon: "📜", color: "#EF4444",
    logo: "/robots/logos/agente_veto.jpeg",
    bienvenida: "Soy el Agente de Veto y Promulgación. Te leo la evaluación del Ejecutivo y puedo registrar tu decisión.",
  },
  publicacion: {
    canonico: "Publicacion", icon: "📰", color: "#84CC16",
    logo: "/robots/logos/agente_publicacion.jpeg",
    bienvenida: "Soy el Agente de Publicación. Te leo la ley final publicada en la Gaceta Oficial y su número de ley.",
  },
  orquestador: {
    canonico: "orquestador", icon: "💬", color: "#00B4D8",
    logo: "/robots/logos/agente_distribuidor.jpeg",
    bienvenida: "Soy el Chat del Sistema. Hablo con todos los agentes de la mesa de partes: dime qué necesitas y lo derivo al agente correcto.",
  },
};

const SUGERENCIAS_ORQUESTADOR = [
  "¿En qué estado está el proyecto?",
  "Clasifica el documento",
  "Lee la comisión asignada",
  "Lee las observaciones constitucionales",
];

const fmtHora = (ts) => {
  try {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function AgentChatPanel({
  agentId = "orquestador",
  agentLabel,
  sesionId = null,
  speechHook,
  datosContexto = null,
  primaryColor,
  onAccion = null,
  compact = false,
  onClose = null,
}) {
  const cfg = AGENT_CHAT_CONFIG[agentId] || AGENT_CHAT_CONFIG.orquestador;
  const color = primaryColor || cfg.color;

  const [mensajes, setMensajes] = useState([]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [chips, setChips] = useState([]);
  const [pendiente, setPendiente] = useState(null); // {accion, agente_destino, descripcion}
  const [modo, setModo] = useState(null);
  const [sesionInterna, setSesionInterna] = useState(sesionId || null);

  const listaRef = useRef(null);
  const dictadoRef = useRef(false);
  const {
    isListening, transcript, interimTranscript,
    startListening, stopListening, clearTranscript,
    speakWithFallback, isSpeaking, stopSpeaking,
    fetchAgentCommands,
  } = speechHook || {};

  // ── Reinicio al cambiar de agente: bienvenida + chips + historial ─────────
  useEffect(() => {
    setMensajes([
      { rol: "agente", texto: cfg.bienvenida, agente: agentLabel || cfg.canonico, timestamp: new Date().toISOString() },
    ]);
    setPendiente(null);
    setModo(null);
    setSesionInterna(sesionId || null);

    if (agentId === "orquestador") {
      setChips(SUGERENCIAS_ORQUESTADOR.map((t) => ({ texto: t })));
    } else if (fetchAgentCommands) {
      fetchAgentCommands(cfg.canonico)
        .then((cmds) => setChips((cmds || []).slice(0, 4).map((c) => ({
          texto: c.palabras?.[0] || c.descripcion,
          descripcion: c.descripcion,
        }))))
        .catch(() => setChips([]));
    }

    if (sesionId) {
      getChatHistory(sesionId).then((res) => {
        if (res?.success && Array.isArray(res.mensajes) && res.mensajes.length > 0) {
          setMensajes(res.mensajes.map((m) => ({
            rol: m.rol, texto: m.texto, agente: m.agente, timestamp: m.timestamp,
          })));
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // ── Auto-scroll al último mensaje ─────────────────────────────────────────
  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight;
    }
  }, [mensajes, enviando, pendiente]);

  // ── Dictado por voz: cuando se detiene la escucha, enviar lo transcrito ───
  useEffect(() => {
    if (!dictadoRef.current || isListening) return;
    const texto = (transcript || "").trim();
    if (!texto) return;
    dictadoRef.current = false;
    clearTranscript?.();
    enviarTexto(texto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript]);

  const agregarMensaje = useCallback((msg) => {
    setMensajes((prev) => [...prev.slice(-60), { timestamp: new Date().toISOString(), ...msg }]);
  }, []);

  const hablar = useCallback((texto, agente) => {
    if (autoSpeak && speakWithFallback) {
      speakWithFallback(texto, agente || cfg.canonico, sesionInterna);
    }
  }, [autoSpeak, speakWithFallback, cfg.canonico, sesionInterna]);

  // ── Envío de mensaje al orquestador ───────────────────────────────────────
  const enviarTexto = useCallback(async (textoRaw) => {
    const texto = (textoRaw || "").trim();
    if (!texto || enviando) return;
    setEntrada("");
    agregarMensaje({ rol: "usuario", texto });
    setEnviando(true);
    try {
      const res = await sendChatMessage({
        sesionId: sesionInterna,
        agente: cfg.canonico,
        mensaje: texto,
        datosContexto: datosContexto || null,
      });
      if (res?.sesion_id) setSesionInterna(res.sesion_id);
      if (!res?.success) {
        agregarMensaje({ rol: "sistema", texto: `No pude procesar tu mensaje: ${res?.error || res?.respuesta_chat || "error desconocido"}` });
        return;
      }
      setModo(res.modo || null);
      agregarMensaje({
        rol: "agente",
        texto: res.respuesta_chat || "Entendido.",
        agente: res.agente_destino,
        confianza: res.confianza,
      });
      hablar(res.respuesta_chat || "", res.agente_destino);

      if (res.requiere_confirmacion && res.accion) {
        setPendiente({ accion: res.accion, agente_destino: res.agente_destino, parametros: res.parametros || {} });
      } else if (res.accion && onAccion) {
        onAccion(res.accion, res.agente_destino, res.parametros || {});
      }
    } catch (e) {
      agregarMensaje({ rol: "sistema", texto: `Error de comunicación con el orquestador: ${e.message}` });
    } finally {
      setEnviando(false);
    }
  }, [enviando, sesionInterna, cfg.canonico, datosContexto, agregarMensaje, hablar, onAccion]);

  // ── Confirmación de acción irreversible ───────────────────────────────────
  const confirmarAccion = useCallback(async () => {
    if (!pendiente || !sesionInterna) return;
    setEnviando(true);
    try {
      const res = await confirmarChatAccion(sesionInterna);
      const accion = res?.accion || pendiente.accion;
      const agenteDestino = res?.agente_destino || pendiente.agente_destino;
      agregarMensaje({ rol: "agente", texto: "✅ Acción confirmada. Ejecutando…", agente: agenteDestino });
      if (onAccion && accion) onAccion(accion, agenteDestino, res?.parametros || pendiente.parametros || {});
      hablar("Acción confirmada. Ejecutando.", agenteDestino);
    } catch (e) {
      agregarMensaje({ rol: "sistema", texto: `No se pudo confirmar la acción: ${e.message}` });
    } finally {
      setPendiente(null);
      setEnviando(false);
    }
  }, [pendiente, sesionInterna, agregarMensaje, onAccion, hablar]);

  const cancelarAccion = useCallback(() => {
    agregarMensaje({ rol: "sistema", texto: "Acción cancelada por el usuario." });
    setPendiente(null);
  }, [agregarMensaje]);

  const toggleMic = useCallback(() => {
    if (!startListening || !stopListening) return;
    if (isListening) {
      stopListening();
    } else {
      dictadoRef.current = true;
      clearTranscript?.();
      startListening();
    }
  }, [isListening, startListening, stopListening, clearTranscript]);

  const altoLista = compact ? 260 : 380;

  return (
    <div style={{
      background: "rgba(11, 21, 38, 0.96)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: `1.5px solid ${color}55`,
      borderRadius: 16,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      fontFamily: "inherit",
      boxShadow: `0 20px 50px rgba(0, 0, 0, 0.75), 0 0 25px ${color}20`,
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          overflow: "hidden",
          border: `1.5px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: "#0B2545"
        }}>
          {cfg.logo ? (
            <img src={cfg.logo} alt={cfg.canonico} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: "#E2E8F0",
            fontWeight: 700,
            fontSize: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {agentLabel || `Chat — ${cfg.canonico}`}
          </div>
          <div style={{ color: "#94A3B8", fontSize: 11 }}>
            Chat por voz y texto · {agentId === "orquestador" ? "habla con todos los agentes" : "agente de mesa de partes"}
          </div>
        </div>
        {modo === "fallback" && (
          <span style={{
            fontSize: 10, color: "#FBBF24", border: "1px solid #FBBF2455",
            borderRadius: 8, padding: "2px 8px",
          }}>
            modo básico
          </span>
        )}
        <button
          onClick={() => (autoSpeak ? stopSpeaking?.() : null) || setAutoSpeak(!autoSpeak)}
          title={autoSpeak ? "Silenciar lectura automática" : "Activar lectura automática"}
          style={{
            background: "transparent", border: `1px solid ${color}55`, borderRadius: 8,
            color: autoSpeak ? color : "#64748B", padding: "5px 7px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            title="Cerrar chat emergente"
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 8,
              color: "#FCA5A5",
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.35)";
              e.currentTarget.style.color = "#FFFFFF";
              e.currentTarget.style.borderColor = "#EF4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
              e.currentTarget.style.color = "#FCA5A5";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Mensajes ── */}
      <div ref={listaRef} style={{
        height: altoLista, overflowY: "auto", display: "flex", flexDirection: "column",
        gap: 8, padding: 10, background: "rgba(2, 6, 23, 0.6)", borderRadius: 12,
      }}>
        {mensajes.map((m, i) => {
          const esUsuario = m.rol === "usuario";
          const esSistema = m.rol === "sistema";
          return (
            <div key={i} style={{
              alignSelf: esSistema ? "center" : esUsuario ? "flex-end" : "flex-start",
              maxWidth: "85%",
            }}>
              {!esUsuario && !esSistema && (
                <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>
                  {m.agente || cfg.canonico}
                  {typeof m.confianza === "number" ? ` · confianza ${Math.round(m.confianza)}%` : ""}
                </div>
              )}
              <div style={{
                background: esSistema
                  ? "rgba(239, 68, 68, 0.15)"
                  : esUsuario ? `${color}33` : "rgba(51, 65, 85, 0.7)",
                border: `1px solid ${esSistema ? "#EF444455" : esUsuario ? color + "55" : "#47556955"}`,
                borderRadius: 12,
                padding: "8px 12px",
                color: "#E2E8F0",
                fontSize: 13,
                lineHeight: 1.45,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}>
                <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{m.texto}</span>
                {!esUsuario && !esSistema && speakWithFallback && (
                  <button
                    onClick={() => speakWithFallback(m.texto, m.agente || cfg.canonico, sesionInterna)}
                    title="Leer en voz alta"
                    style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 0 }}
                  >
                    <Volume2 size={13} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: 9, color: "#475569", marginTop: 2, textAlign: esUsuario ? "right" : "left" }}>
                {fmtHora(m.timestamp)}
              </div>
            </div>
          );
        })}

        {enviando && (
          <div style={{ alignSelf: "flex-start", color: "#94A3B8", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <Loader size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            el agente está escribiendo…
          </div>
        )}

        {/* ── Tarjeta de confirmación de acción irreversible ── */}
        {pendiente && (
          <div style={{
            alignSelf: "stretch", background: "rgba(251, 191, 36, 0.08)",
            border: "1px solid rgba(251, 191, 36, 0.45)", borderRadius: 12, padding: 12,
          }}>
            <div style={{ color: "#FBBF24", fontSize: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center" }}>
              <AlertTriangle size={14} /> Acción pendiente de confirmación
            </div>
            <div style={{ color: "#E2E8F0", fontSize: 12, marginTop: 6 }}>
              <b>{pendiente.agente_destino}</b> ejecutará <code style={{ color: "#FBBF24" }}>{pendiente.accion}</code>.
              Esta acción modifica el flujo legislativo y no se puede deshacer automáticamente.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={confirmarAccion} disabled={enviando} style={{
                background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10B98166", color: "#34D399",
                borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                <CheckCircle2 size={14} /> Confirmar
              </button>
              <button onClick={cancelarAccion} disabled={enviando} style={{
                background: "rgba(239, 68, 68, 0.12)", border: "1px solid #EF444466", color: "#F87171",
                borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Chips de acciones rápidas ── */}
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.map((c, i) => (
            <button
              key={i}
              onClick={() => enviarTexto(c.texto)}
              disabled={enviando}
              title={c.descripcion || c.texto}
              style={{
                background: "rgba(30, 41, 59, 0.9)", border: `1px solid ${color}33`,
                color: "#CBD5E1", borderRadius: 999, padding: "4px 12px",
                fontSize: 11, cursor: "pointer",
              }}
            >
              {c.descripcion || c.texto}
            </button>
          ))}
        </div>
      )}

      {/* ── Entrada de texto + micrófono ── */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {speechHook && (
          <button
            onClick={toggleMic}
            title={isListening ? "Detener dictado" : "Dictar mensaje por voz"}
            style={{
              background: isListening ? "rgba(239, 68, 68, 0.25)" : `${color}22`,
              border: `1px solid ${isListening ? "#EF4444" : color + "66"}`,
              borderRadius: 10, padding: 9, cursor: "pointer",
              color: isListening ? "#F87171" : color, flexShrink: 0,
              animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
          >
            {isListening ? <Square size={16} /> : <Mic size={16} />}
          </button>
        )}
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            value={isListening && interimTranscript ? interimTranscript : entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarTexto(entrada);
              }
            }}
            placeholder={isListening ? "Escuchando… habla ahora" : "Escribe o dicta tu mensaje al agente…"}
            rows={1}
            style={{
              width: "100%", resize: "none", background: "rgba(2, 6, 23, 0.8)",
              border: `1px solid ${isListening ? "#EF444488" : color + "44"}`, borderRadius: 10,
              padding: "9px 12px", color: "#E2E8F0", fontSize: 13, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={() => enviarTexto(entrada)}
          disabled={enviando || !entrada.trim()}
          title="Enviar mensaje"
          style={{
            background: `${color}33`, border: `1px solid ${color}66`, borderRadius: 10,
            padding: 9, cursor: entrada.trim() ? "pointer" : "not-allowed",
            color: entrada.trim() ? color : "#475569", flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>

      {isSpeaking && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94A3B8", fontSize: 11 }}>
          <MessageSquare size={12} /> Reproduciendo respuesta de voz…
          <button onClick={() => stopSpeaking?.()} style={{
            background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: 11,
          }}>
            detener
          </button>
        </div>
      )}
    </div>
  );
}
