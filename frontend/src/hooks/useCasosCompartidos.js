import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

function fingerprint(session) {
  const { _sharedVersion, _sharedProcessing, updatedAt, inspectedAgentId, isProcessing,
    estadoCompartido, autorCaso, ...data } = session;
  return JSON.stringify(data);
}

export function useCasosCompartidos(sessions, setSessions, normalizar, readOnly = false) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const current = useRef(sessions);
  current.current = sessions;
  const known = useRef(new Map());
  const versions = useRef(new Map());
  const busy = useRef(false);
  const paused = useRef(false);
  const normalize = useRef(normalizar);
  normalize.current = normalizar;

  const refresh = useCallback(async (force = false) => {
    if (busy.current) return;
    if (!readOnly && !force && current.current.some(s => !s._sharedProcessing && (s.isProcessing ||
      ((s.documentText || s.fase1Data) && known.current.get(s.id) !== fingerprint(s))))) return;
    try {
      const res = await api.getCasosCompartidos();
      // El usuario pudo empezar a editar mientras la petición estaba en vuelo.
      if (!readOnly && !force && (busy.current || current.current.some(s => !s._sharedProcessing &&
          (s.isProcessing || ((s.documentText || s.fase1Data) && known.current.get(s.id) !== fingerprint(s)))))) return;
      const remote = res.data.map(normalize.current);
      remote.forEach(s => { known.current.set(s.id, fingerprint(s)); versions.current.set(s.id, s._sharedVersion); });
      setSessions(prev => [
        ...remote.map(s => ({ ...s, inspectedAgentId: prev.find(p => p.id === s.id)?.inspectedAgentId || null })),
        ...(readOnly ? [] : prev.filter(s => !remote.some(r => r.id === s.id))),
      ]);
      paused.current = false;
      setError('');
      setReady(true);
    } catch (err) { setError(`No se pudo sincronizar: ${err.message}`); }
  }, [setSessions, readOnly]);

  useEffect(() => {
    refresh(true);
    const timer = setInterval(() => { if (!paused.current) refresh(); }, readOnly ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [refresh, readOnly]);

  useEffect(() => {
    if (readOnly || !ready || paused.current) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        for (const s of current.current) {
          if (s.isProcessing || s._sharedProcessing || !(s.documentText || s.fase1Data)) continue;
          const stamp = fingerprint(s);
          if (known.current.get(s.id) === stamp) continue;
          setSaving(true);
          const res = await api.guardarCasoCompartido(s.id, s, versions.current.get(s.id) || 0);
          versions.current.set(s.id, res.data._sharedVersion);
          known.current.set(s.id, stamp);
          setSessions(prev => prev.map(old => old.id === s.id ? { ...old, _sharedVersion: res.data._sharedVersion } : old));
        }
        setError('');
      } catch (err) {
        paused.current = true;
        setError(`No se guardó el cambio compartido: ${err.message}. Pulse Actualizar casos para cargar la versión del servidor.`);
      } finally { busy.current = false; setSaving(false); }
    }, 800);
    return () => clearTimeout(timer);
  }, [sessions, ready, setSessions, readOnly]);

  return { ready, saving, error, refresh: () => refresh(true) };
}
