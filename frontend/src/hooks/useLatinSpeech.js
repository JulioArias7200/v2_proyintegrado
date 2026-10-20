/**
 * useLatinSpeech.js — Hook de Voz en Español Latino con Fallback Multi-Capa y Recuperación de Red
 * =================================================================================================
 * Sistema Multi-Agente (SMA) Congreso de Bolivia.
 *
 * Capas STT (Speech-to-Text):
 *   Capa 1: Web Speech API nativa (Chrome/Edge/Safari — instantáneo)
 *   Capa 2: Grabador WAV PCM 16kHz nativo JS → /api/voz/transcribir (Google STT / Whisper)
 *   Capa 3: Modo texto manual (degradación 100% garantizada)
 *
 * Recuperación automática de error de red:
 *   Si Web Speech API arroja error 'network', el hook conmuta automáticamente al
 *   modo de grabación WAV de audio directa del servidor sin bloquear la interfaz.
 *
 * Capas TTS (Text-to-Speech):
 *   Capa 1: window.speechSynthesis nativa (voces en español latino / neutro)
 *   Capa 2: /api/voz/leer → audio MP3 base64 (gTTS online)
 *   Capa 3: Texto visible en pantalla
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { API_BASE_URL } from '../services/api';

// Variantes latinoamericanas reconocidas con sus etiquetas de visualización
const LATIN_REGIONS = {
  'es-419': { name: 'Español Latinoamericano (Neutral)', flag: '🌎', priority: 1 },
  'es-mx': { name: 'Español (México - Neutro)', flag: '🇲🇽', priority: 2 },
  'es-us': { name: 'Español (Latinoamérica / EE.UU.)', flag: '🇺🇸', priority: 3 },
  'es-co': { name: 'Español (Colombia)', flag: '🇨🇴', priority: 4 },
  'es-ar': { name: 'Español (Argentina)', flag: '🇦🇷', priority: 5 },
  'es-cl': { name: 'Español (Chile)', flag: '🇨🇱', priority: 6 },
  'es-pe': { name: 'Español (Perú)', flag: '🇵🇪', priority: 7 },
  'es-bo': { name: 'Español (Bolivia)', flag: '🇧🇴', priority: 8 },
  'es-ec': { name: 'Español (Ecuador)', flag: '🇪🇨', priority: 9 },
  'es-ve': { name: 'Español (Venezuela)', flag: '🇻🇪', priority: 10 },
  'es-uy': { name: 'Español (Uruguay)', flag: '🇺🇾', priority: 11 },
  'es-cr': { name: 'Español (Costa Rica)', flag: '🇨🇷', priority: 12 },
  'es-gt': { name: 'Español (Guatemala)', flag: '🇬🇹', priority: 13 },
};

/**
 * Codificador PCM 16-bit Mono WAV puro en JavaScript.
 * Genera un Blob de audio WAV RIFF compatible 100% con Python speech_recognition.
 */
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 = mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Escribir muestras PCM de 16 bits
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/** Reproduce un audio MP3 codificado en base64 como elemento <audio> en el DOM */
function playBase64Audio(base64String) {
  return new Promise((resolve, reject) => {
    if (!base64String) {
      resolve();
      return;
    }
    try {
      const audioSrc = `data:audio/mp3;base64,${base64String}`;
      const audio = new Audio(audioSrc);
      audio.onended = () => resolve();
      audio.onerror = (e) => resolve(); // no bloquear si falla audio
      audio.play().catch(() => resolve());
    } catch {
      resolve();
    }
  });
}

export function useLatinSpeech() {
  // ── Modos STT ───────────────────────────────────────────────────────────────
  // 'auto': intenta Web Speech API, y ante error de red conmuta a grabación WAV backend
  // 'native': fuerza Web Speech API del navegador
  // 'backend': fuerza grabación de audio WAV directa enviada a /api/voz/transcribir
  const [sttMode, setSttMode] = useState('auto');

  // ── Estados TTS ────────────────────────────────────────────────────────────
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [ttsEngineUsed, setTtsEngineUsed] = useState(null); // 'native' | 'gtts' | null

  // ── Estados STT ────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recognitionStatus, setRecognitionStatus] = useState('idle');
  // 'idle' | 'listening' | 'recording' | 'processing' | 'ready'
  const [sttEngineUsed, setSttEngineUsed] = useState(null); // 'native' | 'google_stt' | 'whisper' | 'wav_pcm_directo' | 'manual'

  // ── Grabación de Audio Backend Fallback ────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState('idle');
  // 'idle' | 'recording' | 'processing' | 'done' | 'error'

  // ── Diagnósticos y Soporte ─────────────────────────────────────────────────
  const [isSTTSupported, setIsSTTSupported] = useState(false);
  const [isTTSSupported, setIsTTSSupported] = useState(false);
  const [isWhisperAvailable, setIsWhisperAvailable] = useState(null);
  const [serverVoiceStatus, setServerVoiceStatus] = useState(null);
  const [networkWarning, setNetworkWarning] = useState(null);
  const [error, setError] = useState(null);

  // ── Refs de audio y reconocimiento ─────────────────────────────────────────
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const finalTranscriptAccumulator = useRef('');
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const pcmSamplesRef = useRef([]);
  const currentAgentRef = useRef('Distribuidor');
  const currentSessionIdRef = useRef(null);

  // ── Historial de comandos ──────────────────────────────────────────────────
  const [commandHistory, setCommandHistory] = useState([]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CARGA Y FILTRADO ESTRICTO DE VOCES EN ESPAÑOL LATINO / NEUTRO (TTS)
  // ──────────────────────────────────────────────────────────────────────────
  const filterAndSortLatinVoices = useCallback((availableVoices) => {
    if (!availableVoices || availableVoices.length === 0) return [];

    const isPeninsular = (voice) => {
      const langLower = (voice.lang || '').toLowerCase();
      const nameLower = (voice.name || '').toLowerCase();
      return (
        langLower === 'es-es' ||
        langLower.startsWith('es-es') ||
        langLower.startsWith('es_es') ||
        nameLower.includes('spain') ||
        nameLower.includes('españa') ||
        nameLower.includes('castilian') ||
        nameLower.includes('peninsular')
      );
    };

    let latinVoices = availableVoices.filter((voice) => {
      const langLower = (voice.lang || '').toLowerCase();
      const isSpanish = langLower.startsWith('es') || langLower.startsWith('es_');
      return isSpanish && !isPeninsular(voice);
    });

    const scoredVoices = latinVoices.map((voice) => {
      const langLower = (voice.lang || '').toLowerCase().replace('_', '-');
      const region = LATIN_REGIONS[langLower] || {
        name: `Español (${voice.lang || 'Latinoamérica'})`,
        flag: '🌎',
        priority: 99,
      };
      let extraBoost = 0;
      const nameLower = voice.name.toLowerCase();
      if (nameLower.includes('mexic') || langLower === 'es-mx') extraBoost -= 2;
      if (langLower === 'es-419' || nameLower.includes('latin') || nameLower.includes('neural')) extraBoost -= 3;
      return {
        voice,
        id: `${voice.name}-${voice.lang}`,
        name: voice.name,
        lang: voice.lang,
        label: `${region.flag} ${voice.name} (${region.name.replace('Español ', '')})`,
        regionInfo: region,
        score: region.priority + extraBoost,
      };
    });

    scoredVoices.sort((a, b) => a.score - b.score);

    if (scoredVoices.length === 0) {
      const allSpanish = availableVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('es'));
      if (allSpanish.length > 0) {
        return allSpanish.map((v) => ({
          voice: v,
          id: `${v.name}-${v.lang}`,
          name: v.name,
          lang: v.lang,
          label: `🌐 ${v.name} (${v.lang}) [Genérico]`,
          regionInfo: { name: 'Español Genérico', flag: '🌐', priority: 100 },
          score: 100,
        }));
      }
    }

    return scoredVoices;
  }, []);

  // Cargar voces del sistema (TTS)
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsTTSSupported(false);
      return;
    }
    setIsTTSSupported(true);

    const updateVoices = () => {
      try {
        const rawVoices = window.speechSynthesis.getVoices();
        const filtered = filterAndSortLatinVoices(rawVoices);
        setVoices(filtered);
        if (filtered.length > 0) {
          setSelectedVoice((prev) => {
            if (!prev) return filtered[0];
            const stillExists = filtered.find((v) => v.id === prev.id);
            return stillExists || filtered[0];
          });
        }
      } catch (err) {
        console.warn('[useLatinSpeech] Error al cargar voces:', err);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [filterAndSortLatinVoices]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CONSULTAR ESTADO DEL SERVIDOR DE VOZ (motores disponibles)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchVozEstado = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/voz/estado`);
        if (res.ok) {
          const data = await res.json();
          setServerVoiceStatus(data);
          const whisperMotor = data?.stt_motores?.find(
            (m) => m.motor === 'whisper' && m.disponible
          );
          setIsWhisperAvailable(!!whisperMotor);
        }
      } catch {
        setIsWhisperAvailable(false);
      }
    };
    fetchVozEstado();
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CONFIGURAR RECONOCIMIENTO NATIVO (STT — WEB SPEECH API)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSTTSupported(false);
      return;
    }
    setIsSTTSupported(true);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-419';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionStatus('listening');
        setSttEngineUsed('native');
        setError(null);
        setNetworkWarning(null);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let currentFinal = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            currentFinal += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }
        if (currentFinal) {
          finalTranscriptAccumulator.current += currentFinal;
          setTranscript(finalTranscriptAccumulator.current.trim());
          setRecognitionStatus('processing');
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        console.warn('[useLatinSpeech] Evento error STT nativo:', event.error);
        if (event.error === 'no-speech') {
          return;
        }

        // Manejo inteligente del error de red
        if (event.error === 'network') {
          setNetworkWarning(
            'Aviso de red en Web Speech API del navegador. Conmutando automáticamente al modo de grabación directa del Servidor STT...'
          );
          setIsListening(false);
          setRecognitionStatus('idle');

          // Si el modo es auto, cambiar automáticamente a grabación WAV backend
          if (sttMode === 'auto') {
            console.info('[useLatinSpeech] Conmutación automática a Grabación Backend por error de red.');
            setSttMode('backend');
            // Iniciar grabación directa backend
            setTimeout(() => {
              startRecordingWAV(currentAgentRef.current, currentSessionIdRef.current);
            }, 200);
          }
          return;
        }

        let msg = 'Error en el reconocimiento de voz.';
        if (event.error === 'not-allowed') {
          msg = 'Permiso de micrófono denegado. Permite el acceso al micrófono en el navegador.';
        } else if (event.error === 'audio-capture') {
          msg = 'No se detectó ningún micrófono conectado o en funcionamiento.';
        }
        setError(msg);
        setIsListening(false);
        setRecognitionStatus('idle');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        setRecognitionStatus('ready');
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error('[useLatinSpeech] Error inicializando SpeechRecognition:', err);
      setIsSTTSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, [sttMode]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MÉTODOS STT — CAPA 1: WEB SPEECH API NATIVA
  // ──────────────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Si el modo forzado es backend, redirigir a grabación WAV
    if (sttMode === 'backend') {
      startRecordingWAV(currentAgentRef.current, currentSessionIdRef.current);
      return;
    }

    if (!recognitionRef.current) {
      // Si el navegador no soporta Web Speech, activar grabación backend directamente
      startRecordingWAV(currentAgentRef.current, currentSessionIdRef.current);
      return;
    }

    setError(null);
    setNetworkWarning(null);
    try {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
      }
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[useLatinSpeech] startListening warn:', err);
      try {
        recognitionRef.current.stop();
        setTimeout(() => { recognitionRef.current?.start(); }, 150);
      } catch (e) {
        // Fallback a grabación backend si falla el inicio
        startRecordingWAV(currentAgentRef.current, currentSessionIdRef.current);
      }
    }
  }, [sttMode]);

  const stopListening = useCallback(() => {
    if (isRecording) {
      stopRecordingWAV();
      return;
    }
    if (recognitionRef.current && isListening) {
      try { recognitionRef.current.stop(); } catch (err) {
        console.warn('[useLatinSpeech] stopListening error:', err);
      }
    }
    setIsListening(false);
    setRecognitionStatus('ready');
  }, [isListening, isRecording]);

  const clearTranscript = useCallback(() => {
    finalTranscriptAccumulator.current = '';
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setNetworkWarning(null);
    setRecognitionStatus('idle');
    setSttEngineUsed(null);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. MÉTODOS STT — CAPA 2: GRABADOR WAV DIRECTO (AudioContext 16kHz PCM)
  // ──────────────────────────────────────────────────────────────────────────
  const startRecordingWAV = useCallback(async (agente = 'Distribuidor', sesionId = null) => {
    currentAgentRef.current = agente;
    currentSessionIdRef.current = sesionId;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Tu navegador no soporta acceso al micrófono.');
      return;
    }

    try {
      setError(null);
      setWhisperStatus('recording');
      setIsRecording(true);
      setRecognitionStatus('recording');
      setSttEngineUsed('wav_pcm_directo');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });

      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      // Procesador para acumular muestras Float32 de audio
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;
      pcmSamplesRef.current = [];

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length; i++) {
          pcmSamplesRef.current.push(inputData[i]);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error('[useLatinSpeech] Error al iniciar grabación WAV:', err);
      setError('No se pudo acceder al micrófono. Revisa los permisos en tu navegador.');
      setIsRecording(false);
      setWhisperStatus('error');
      setRecognitionStatus('idle');
    }
  }, []);

  const stopRecordingWAV = useCallback(async () => {
    if (!isRecording && !audioContextRef.current) return;

    setIsRecording(false);
    setRecognitionStatus('processing');
    setWhisperStatus('processing');

    try {
      // Detener stream y procesador de audio
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      const samples = pcmSamplesRef.current;
      if (!samples || samples.length < 1600) {
        // Menos de 100ms de audio
        setWhisperStatus('idle');
        setRecognitionStatus('idle');
        setError('Grabación demasiado corta. Mantén presionado mientras hablas.');
        return;
      }

      // Codificar a WAV PCM estándar 16kHz
      const wavBlob = encodeWAV(samples, 16000);
      pcmSamplesRef.current = [];

      // Enviar al backend FastAPI
      const formData = new FormData();
      formData.append('audio', wavBlob, 'audio_grabado.wav');
      formData.append('agente', currentAgentRef.current || 'Distribuidor');
      if (currentSessionIdRef.current) {
        formData.append('sesion_id', currentSessionIdRef.current);
      }

      const res = await fetch(`${API_BASE_URL}/voz/transcribir`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (data.texto) {
        const textoTranscrito = data.texto.trim();
        finalTranscriptAccumulator.current = textoTranscrito;
        setTranscript(textoTranscrito);
        setSttEngineUsed(data.motor || 'google_stt');
        setWhisperStatus('done');
        setRecognitionStatus('ready');
        setNetworkWarning(null);
      } else {
        const msg = data.mensaje || 'No se detectó voz clara. Intenta hablar más cerca del micrófono.';
        setWhisperStatus('done');
        setRecognitionStatus('ready');
        setError(msg);
      }
    } catch (fetchErr) {
      console.error('[useLatinSpeech] Error al enviar audio al servidor:', fetchErr);
      setError(`Error de comunicación con el servidor de voz: ${fetchErr.message}`);
      setWhisperStatus('error');
      setRecognitionStatus('idle');
    }
  }, [isRecording]);

  // Alias para mantener compatibilidad con componentes que usan startRecordingFallback
  const startRecordingFallback = startRecordingWAV;
  const stopRecordingFallback = stopRecordingWAV;

  // ──────────────────────────────────────────────────────────────────────────
  // 6. MÉTODOS TTS — SÍNTESIS CON DEGRADACIÓN AUTOMÁTICA
  // ──────────────────────────────────────────────────────────────────────────
  const speak = useCallback(
    (textToSpeak, customOptions = {}) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        setError('La síntesis de voz no está disponible en este navegador.');
        return;
      }
      const text = (textToSpeak || transcript || '').trim();
      if (!text) {
        setError('No hay texto para reproducir.');
        return;
      }
      window.speechSynthesis.cancel();
      if (isListening) stopListening();

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;
        const activeVoice = customOptions.voice || selectedVoice?.voice;
        if (activeVoice) {
          utterance.voice = activeVoice;
          utterance.lang = activeVoice.lang || 'es-419';
        } else {
          utterance.lang = 'es-419';
        }
        utterance.rate = Math.max(0.8, Math.min(1.4, customOptions.rate ?? rate));
        utterance.pitch = Math.max(0.8, Math.min(1.2, customOptions.pitch ?? pitch));

        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
          setTtsEngineUsed('native');
          setError(null);
        };
        utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
        utterance.onerror = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setTtsEngineUsed(null);
        };
        utterance.onpause = () => setIsPaused(true);
        utterance.onresume = () => setIsPaused(false);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[useLatinSpeech] Error al ejecutar speak:', err);
        setIsSpeaking(false);
      }
    },
    [transcript, selectedVoice, rate, pitch, isListening, stopListening]
  );

  const speakWithFallback = useCallback(
    async (text, agente = 'Distribuidor', sesionId = null, usuarioEmail = null) => {
      const targetText = (text || transcript || '').trim();
      if (!targetText) return;

      // Capa 1: Nativa si hay voces disponibles
      if (typeof window !== 'undefined' && window.speechSynthesis && voices.length > 0) {
        speak(targetText);
        return;
      }

      // Capa 2: gTTS backend
      try {
        setIsSpeaking(true);
        setTtsEngineUsed('gtts');
        const res = await fetch(`${API_BASE_URL}/voz/leer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texto: targetText,
            agente,
            sesion_id: sesionId,
            usuario_email: usuarioEmail,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audio_base64) {
            await playBase64Audio(data.audio_base64);
          }
        }
      } catch (ttsErr) {
        console.warn('[useLatinSpeech] Fallback gTTS omitido:', ttsErr);
      } finally {
        setIsSpeaking(false);
        setTtsEngineUsed(null);
      }
    },
    [transcript, voices, speak]
  );

  const pauseSpeaking = useCallback(() => {
    if (window.speechSynthesis && isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resumeSpeaking = useCallback(() => {
    if (window.speechSynthesis && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. ENVIAR COMANDOS DE VOZ POR AGENTE
  // ──────────────────────────────────────────────────────────────────────────
  const sendVoiceCommand = useCallback(
    async (textoComando, agente, sesionId = null, datosContexto = {}) => {
      if (!textoComando || !agente) return null;
      try {
        const res = await fetch(`${API_BASE_URL}/voz/comando`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comando_texto: textoComando,
            agente,
            sesion_id: sesionId,
            datos_contexto: datosContexto,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setCommandHistory((prev) => [
          {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString('es-BO'),
            agente,
            texto: textoComando,
            accion: data.resultado?.accion || 'consulta_general',
            reconocido: data.resultado?.reconocido || false,
            respuesta: data.texto_respuesta_tts || '',
          },
          ...prev.slice(0, 14), // Mantener los últimos 15
        ]);

        return data;
      } catch (cmdErr) {
        console.error('[useLatinSpeech] Error sendVoiceCommand:', cmdErr);
        setError(`Error al enviar comando de voz: ${cmdErr.message}`);
        return null;
      }
    },
    []
  );

  const fetchAgentCommands = useCallback(async (agente) => {
    if (!agente) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/voz/comandos/${encodeURIComponent(agente)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.comandos || [];
    } catch {
      return [];
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 8. MÉTODO COMBINADO: ESCUCHAR O GRABAR SEGÚN MODO
  // ──────────────────────────────────────────────────────────────────────────
  const handleVoiceAction = useCallback(
    (agente, sesionId = null, onTranscribed = null) => {
      currentAgentRef.current = agente;
      currentSessionIdRef.current = sesionId;

      if (sttMode === 'backend' || !isSTTSupported) {
        if (isRecording) {
          stopRecordingWAV();
        } else {
          startRecordingWAV(agente, sesionId);
        }
        return stopRecordingWAV;
      }

      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
      return stopListening;
    },
    [
      sttMode,
      isSTTSupported,
      isListening,
      isRecording,
      startListening,
      stopListening,
      startRecordingWAV,
      stopRecordingWAV,
    ]
  );

  return {
    // ── Configuración de Modo STT ──
    sttMode,
    setSttMode,

    // ── STT Estados y Controles ──
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    recognitionStatus,
    startListening,
    stopListening,
    clearTranscript,
    sttEngineUsed,

    // ── Grabación WAV / Backend Fallback ──
    isRecording,
    whisperStatus,
    startRecordingWAV,
    stopRecordingWAV,
    startRecordingFallback,
    stopRecordingFallback,
    isWhisperAvailable,

    // ── TTS ──
    voices,
    selectedVoice,
    setSelectedVoice,
    isSpeaking,
    isPaused,
    rate,
    setRate,
    pitch,
    setPitch,
    speak,
    speakWithFallback,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    ttsEngineUsed,

    // ── Comandos de Voz Multi-Agente ──
    sendVoiceCommand,
    fetchAgentCommands,
    commandHistory,
    handleVoiceAction,

    // ── Diagnósticos y Alertas ──
    isSTTSupported,
    isTTSSupported,
    serverVoiceStatus,
    networkWarning,
    setNetworkWarning,
    error,
    setError,
  };
}

export default useLatinSpeech;
