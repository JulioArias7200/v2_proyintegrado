/**
 * EmailDespachoDrawer.jsx
 * Panel deslizante lateral para Despacho Institucional por Gmail/correo.
 * Permite: editar destinatario, asunto, texto extra (teclado o voz), y enviar.
 */
import React, { useState, useRef } from "react";
import {
  Mail, X, Mic, MicOff, Send, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, RotateCcw, Volume2
} from "lucide-react";
import { api } from "../services/api";

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1.5px solid rgba(56, 189, 248, 0.3)",
  color: "#ffffff",
  fontSize: "0.87rem",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
  fontFamily: "Outfit, sans-serif",
};

const iconBtnStyle = (color, bg, border) => ({
  display: "flex", alignItems: "center", gap: "4px",
  background: bg, border: `1px solid ${border}`,
  borderRadius: "6px", color, padding: "4px 10px",
  fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
});

export default function EmailDespachoDrawer({
  isOpen,
  onClose,
  defaultEmail = "",
  defaultSubject = "",
  defaultMensaje = "",
  sesionId = null,
  idProyecto = null,
  onChange = () => {},
  onSent = () => {},
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState(defaultSubject);
  const [mensaje, setMensaje] = useState(defaultMensaje);
  const [isListening, setIsListening] = useState(false);
  const [micFeedback, setMicFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState(false);
  const recognitionRef = useRef(null);

  const startDictation = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setErrorMsg("Reconocimiento de voz no disponible (Chrome recomendado).");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "es-BO";
    rec.interimResults = true;
    recognitionRef.current = rec;
    rec.onstart = () => { setIsListening(true); setMicFeedback("Escuchando..."); };
    rec.onresult = (ev) => {
      let interim = "", final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript + " ";
        else interim += ev.results[i][0].transcript;
      }
      if (final) {
        setMensaje(prev => (prev ? prev + " " : "") + final.trim());
        setMicFeedback(`Capturado: "${final.trim().substring(0, 60)}"`);
      } else {
        setMicFeedback(`Escuchando: "${interim.substring(0, 60)}"`);
      }
    };
    rec.onerror = (ev) => { setErrorMsg(`Error mic: ${ev.error}`); setIsListening(false); setMicFeedback(""); };
    rec.onend = () => { setIsListening(false); setMicFeedback(""); };
    rec.start();
  };

  const stopDictation = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false); setMicFeedback("");
  };

  const readAloud = () => {
    if (!("speechSynthesis" in window)) return;
    const utt = new SpeechSynthesisUtterance(mensaje || "(Sin mensaje)");
    utt.lang = "es-BO"; utt.rate = 0.92;
    window.speechSynthesis.speak(utt);
  };

  const handleSend = async () => {
    if (!email.trim()) { setErrorMsg("Ingrese un correo destino valido."); return; }
    setErrorMsg(""); setSending(true);
    try {
      await api.post("/api/pipeline/agent_notificador", {
        sesion_id: sesionId || `despacho-${Date.now()}`,
        id_proyecto: idProyecto,
        email_autor: email.trim(),
        asunto_personalizado: subject.trim() || undefined,
        mensaje_extra: mensaje.trim() || undefined,
      });
      setSentOk(true);
      onSent({ email, subject, mensaje });
      setTimeout(() => setSentOk(false), 6000);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || "Error al enviar.");
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setEmail(defaultEmail); setSubject(defaultSubject); setMensaje(defaultMensaje);
    setSentOk(false); setErrorMsg(""); setPreview(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", zIndex: 1100, animation: "fadeIn 0.22s ease" }} />

      <div style={{
        position: "fixed", top: 0, right: 0,
        width: "min(480px, 100vw)", height: "100dvh",
        background: "linear-gradient(170deg, #0D1B2A 0%, #1B2A4A 60%, #0D1B2A 100%)",
        borderLeft: "1.5px solid rgba(56,189,248,0.35)",
        boxShadow: "-12px 0 60px rgba(0,0,0,0.7)",
        zIndex: 1101, display: "flex", flexDirection: "column", overflowY: "auto",
        animation: "slideInRight 0.28s cubic-bezier(0.25,0.8,0.25,1)",
      }}>
        <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#38bdf8,#3B82F6,transparent)", flexShrink: 0 }} />

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 16px", borderBottom: "1px solid rgba(56,189,248,0.15)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg,rgba(2,132,199,0.3),rgba(56,189,248,0.15))", border: "1px solid rgba(56,189,248,0.45)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(56,189,248,0.25)" }}>
              <Mail size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>Despacho Institucional</h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>Correo + Observacion por teclado o voz</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#f87171" }}>
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: "22px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
          {sentOk && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 10, padding: "12px 16px", color: "#34d399", animation: "fadeIn 0.3s ease" }}>
              <CheckCircle2 size={20} />
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Correo enviado exitosamente.</span>
            </div>
          )}
          {errorMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "12px 16px", color: "#f87171", animation: "fadeIn 0.3s ease" }}>
              <AlertTriangle size={18} />
              <span style={{ fontWeight: 600, fontSize: "0.85rem", flex: 1 }}>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171" }}><X size={14} /></button>
            </div>
          )}
          {micFeedback && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 8, padding: "8px 14px", color: "#7dd3fc", fontSize: "0.82rem" }}>
              <Mic size={14} />
              <span>{micFeedback}</span>
            </div>
          )}

          {/* Correo */}
          <div>
            <label style={{ display: "block", fontSize: "0.77rem", fontWeight: 700, color: "#7dd3fc", marginBottom: 7, letterSpacing: "0.04em", textTransform: "uppercase" }}>Correo Destino *</label>
            <input type="email" placeholder="destinatario@gmail.com / @senado.gob.bo" value={email} onChange={e => { setEmail(e.target.value); onChange({ email: e.target.value }); }} style={inputStyle} />
          </div>

          {/* Asunto */}
          <div>
            <label style={{ display: "block", fontSize: "0.77rem", fontWeight: 700, color: "#7dd3fc", marginBottom: 7, letterSpacing: "0.04em", textTransform: "uppercase" }}>Asunto del Correo</label>
            <input type="text" placeholder="Asunto formal institucional..." value={subject} onChange={e => { setSubject(e.target.value); onChange({ subject: e.target.value }); }} style={inputStyle} />
          </div>

          {/* Mensaje Extra */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <label style={{ fontSize: "0.77rem", fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" }}>Mensaje Extra / Observaciones</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={readAloud} style={iconBtnStyle("#7dd3fc","rgba(56,189,248,0.15)","rgba(56,189,248,0.35)")}>
                  <Volume2 size={13} /><span>Leer</span>
                </button>
                <button type="button" onClick={isListening ? stopDictation : startDictation} style={iconBtnStyle(isListening?"#f87171":"#fbbf24",isListening?"rgba(239,68,68,0.2)":"rgba(245,158,11,0.18)",isListening?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.4)")}>
                  {isListening ? <MicOff size={13}/> : <Mic size={13}/>}
                  <span>{isListening ? "Detener" : "Dictar"}</span>
                </button>
              </div>
            </div>
            <textarea
              rows={6}
              placeholder="Escriba observaciones adicionales o presione 'Dictar' para usar el microfono..."
              value={mensaje}
              onChange={e => { setMensaje(e.target.value); onChange({ mensaje: e.target.value }); }}
              style={{ ...inputStyle, resize: "vertical", minHeight: 130, border: isListening ? "1.5px solid rgba(245,158,11,0.6)" : "1.5px solid rgba(245,158,11,0.3)" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{mensaje.length} caracteres</span>
            </div>
          </div>

          {/* Preview */}
          <div>
            <button type="button" onClick={() => setPreview(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.78rem", fontWeight: 600, padding: "4px 0" }}>
              {preview ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              <span>{preview ? "Ocultar vista previa" : "Ver vista previa del correo"}</span>
            </button>
            {preview && (
              <div style={{ marginTop: 10, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 10, padding: 16, fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.7, animation: "fadeIn 0.25s ease" }}>
                <div style={{ borderBottom: "1px solid rgba(56,189,248,0.15)", paddingBottom: 8, marginBottom: 10 }}>
                  <strong style={{ color: "#7dd3fc" }}>Para:</strong> {email || "(sin destinatario)"}<br />
                  <strong style={{ color: "#7dd3fc" }}>Asunto:</strong> {subject || "Dictamen Legislativo — GobernIA"}
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#94a3b8", fontSize: "0.8rem" }}>
                  {mensaje ? `Se adjunta el dictamen.\n\nNota del remitente:\n${mensaje}` : "(Sin mensaje extra)"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "18px 22px", borderTop: "1px solid rgba(56,189,248,0.15)", display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0, background: "rgba(13,27,42,0.8)" }}>
          <button onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#94a3b8", padding: "10px 16px", fontSize: "0.83rem", fontWeight: 600, cursor: "pointer" }}>
            <RotateCcw size={15}/> Limpiar
          </button>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#94a3b8", padding: "10px 16px", fontSize: "0.83rem", fontWeight: 600, cursor: "pointer" }}>
            <X size={15}/> Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: sending || !email.trim() ? "rgba(59,130,246,0.3)" : "linear-gradient(135deg,#2563EB 0%,#38bdf8 100%)", border: "1px solid rgba(56,189,248,0.5)", borderRadius: 10, color: "#ffffff", padding: "11px 22px", fontSize: "0.9rem", fontWeight: 800, cursor: sending || !email.trim() ? "not-allowed" : "pointer", boxShadow: email.trim() && !sending ? "0 4px 20px rgba(56,189,248,0.35)" : "none", transition: "all 0.25s ease", minWidth: 140 }}
          >
            {sending ? "Enviando..." : <><Send size={16}/> Enviar Correo</>}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </>
  );
}
