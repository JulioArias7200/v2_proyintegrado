import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Clock3, Download, FileCheck2, FileText, Gavel, RefreshCw, Scale, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useCasosCompartidos } from '../hooks/useCasosCompartidos';
import { DecisionEjecutivaPanel } from '../components/RevisionLegislativa';

const box = { background: '#fff', border: '1px solid #d4e3ed', borderRadius: 14, padding: 18, boxShadow: '0 6px 20px rgba(24,58,86,.06)' };
const tabs = [
  { id: 'resumen', label: 'Resumen ejecutivo' },
  { id: 'constitucional', label: 'Constitucionalidad' },
  { id: 'normativa', label: 'Consistencia normativa' },
  { id: 'historial', label: 'Agentes anteriores' },
];

const valueOr = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const jsonText = value => JSON.stringify(value ?? {}, null, 2);

function EvidenceCard({ title, subtitle, data, icon: Icon = FileCheck2 }) {
  const available = data && Object.keys(data).length > 0;
  return <details className="executive-evidence-card" open={available}>
    <summary><span className="executive-evidence-icon"><Icon size={17}/></span><span><strong>{title}</strong><small>{subtitle}</small></span><span className={available ? 'executive-status-ready' : 'executive-status-wait'}>{available ? 'Disponible' : 'Sin registro'}</span></summary>
    {available ? <pre>{jsonText(data)}</pre> : <p className="executive-muted">Este informe todavía no está registrado en el expediente.</p>}
  </details>;
}

export default function DespachoEjecutivo({ currentUser, activeCase, onActiveCaseChange }) {
  const [cases, setCases] = useState(() => activeCase?.id ? [activeCase] : []);
  const [selectedId, setSelectedId] = useState(activeCase?.id || '');
  const [tab, setTab] = useState('resumen');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const autoRunCase = useRef(null);
  const shared = useCasosCompartidos(cases, setCases, item => ({ ...item, isProcessing: false }));

  useEffect(() => { if (activeCase?.id) setSelectedId(activeCase.id); }, [activeCase?.id]);

  useEffect(() => {
    const activeApproval = activeCase?.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion === 'APROBAR';
    if (!activeApproval) return;
    const storedCase = cases.find(item => item.id === activeCase.id);
    if (!storedCase || storedCase.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion === 'APROBAR') return;
    setCases(previous => previous.map(item => item.id === activeCase.id &&
      item.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion !== 'APROBAR'
      ? { ...item, ...activeCase } : item));
  }, [activeCase?.id, activeCase?.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion, cases]);

  const selectedCase = useMemo(() => {
    const stored = cases.find(item => item.id === selectedId);
    const activeApproval = activeCase?.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion === 'APROBAR';
    const storedApproval = stored?.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion === 'APROBAR';
    // Keep the freshly approved in-memory expediente while the shared-case
    // refresh catches up with its persisted snapshot.
    if (activeCase?.id === selectedId && activeApproval && !storedApproval) {
      return { ...stored, ...activeCase };
    }
    return stored || (activeCase?.id === selectedId ? activeCase : null);
  }, [cases, selectedId, activeCase]);

  useEffect(() => {
    if (selectedCase) onActiveCaseChange?.(selectedCase);
  }, [selectedCase?.id, selectedCase?._sharedVersion, selectedCase?.updatedAt, selectedCase?.pipelineStep, selectedCase?.vetoPromulgacionData]);

  const bicameral = selectedCase?.bicameralData?.ciclo_bicameral || {};
  const bicameralApproved = bicameral?.aprobacion_humana?.accion === 'APROBAR';
  const vetoData = selectedCase?.vetoPromulgacionData;
  const evaluation = vetoData?.evaluacion_veto || {};
  const title = valueOr(selectedCase?.fase1Data?.titulo_completo, selectedCase?.fase1Data?.titulo,
    selectedCase?.concentradorData?.expediente_consolidado?.titulo, selectedCase?.title, selectedCase?.documentName, 'Proyecto de ley sancionado');
  const projectId = valueOr(selectedCase?.fase1Data?.id_proyecto, selectedCase?.proyectoId, selectedCase?.concentradorData?.expediente_consolidado?.proyecto_id);
  const projectInfo = {
    id: projectId,
    id_proyecto: projectId,
    titulo: title,
    titulo_completo: title,
    texto_completo: selectedCase?.documentText || bicameral?.texto_sancionado || '',
    texto_documento: selectedCase?.documentText || bicameral?.texto_sancionado || '',
  };
  const previousAgents = [
    ['Clasificación institucional', selectedCase?.fase1Data],
    ['Asignación parlamentaria', selectedCase?.comisionData],
    ['Verificación constitucional', selectedCase?.dictamenData],
    ['Consistencia normativa', selectedCase?.consistenciaData],
    ['Análisis constitucional de fondo', selectedCase?.constitucionFondoData],
    ['Concentrador y dictamen', selectedCase?.concentradorData],
    ['Emisión de documento y notificación', selectedCase?.pdfResult || selectedCase?.notificadorData],
    ['Secretario de Cámara', selectedCase?.secretarioData],
    ['Revisión bicameral', selectedCase?.bicameralData],
  ].filter(([, data]) => data && Object.keys(data).length);

  const patchCase = (patch, logEntry) => {
    const now = new Date().toISOString();
    setCases(previous => previous.map(item => item.id !== selectedId ? item : ({
      ...item,
      ...patch,
      updatedAt: now,
      pipelineLog: logEntry ? [...(item.pipelineLog || []), { ...logEntry, ts: now }] : item.pipelineLog,
    })));
  };

  const runEvaluation = async () => {
    if (!selectedCase || !bicameralApproved || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.runAgentVetoPromulgacion({
        proyecto_info: projectInfo,
        id_proyecto: projectId,
        expediente: {
          ...(selectedCase.concentradorData?.expediente_consolidado || {}),
          expediente_consolidado: selectedCase.concentradorData?.expediente_consolidado || {},
          ciclo_bicameral: bicameral,
          antecedentes_agentes: {
            clasificacion: selectedCase.fase1Data || null,
            comision: selectedCase.comisionData || null,
            constitucionalidad: selectedCase.dictamenData || null,
            consistencia_normativa: selectedCase.consistenciaData || null,
            constitucion_fondo: selectedCase.constitucionFondoData || null,
            concentrador: selectedCase.concentradorData || null,
            emision_pdf: selectedCase.pdfResult || null,
            notificacion: selectedCase.notificadorData || null,
            secretario: selectedCase.secretarioData || null,
            bicameral: selectedCase.bicameralData || null,
          },
        },
      });
      if (!response?.success || !response?.data?.evaluacion_veto) throw new Error(response?.detail || 'La evaluación ejecutiva no devolvió un dictamen.');
      patchCase({ vetoPromulgacionData: response.data, pipelineStep: 14 }, { etapa: 'Agente_Veto_Promulgacion', estado: 'COMPLETADO', msg: 'Evaluación estratégica lista para decisión humana.' });
      setNotice('Evaluación completada. El informe asesor está listo; la decisión final corresponde a la autoridad humana.');
    } catch (err) { setError(err.message || 'No se pudo ejecutar la evaluación.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!selectedCase || !bicameralApproved || vetoData || busy || !shared.ready) return;
    if (autoRunCase.current === selectedCase.id) return;
    autoRunCase.current = selectedCase.id;
    runEvaluation();
  }, [selectedCase?.id, bicameralApproved, vetoData, busy, shared.ready]);

  const registerDecision = async (action, reference, reason = '', manualLawNumber = '') => {
    if (!selectedCase || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.runAgentVetoPromulgacion({
        proyecto_info: projectInfo,
        id_proyecto: projectId,
        expediente: {
          ...(selectedCase.concentradorData?.expediente_consolidado || {}),
          expediente_consolidado: selectedCase.concentradorData?.expediente_consolidado || {},
          ciclo_bicameral: bicameral,
          antecedentes_agentes: {
            clasificacion: selectedCase.fase1Data || null,
            comision: selectedCase.comisionData || null,
            constitucionalidad: selectedCase.dictamenData || null,
            consistencia_normativa: selectedCase.consistenciaData || null,
            constitucion_fondo: selectedCase.constitucionFondoData || null,
            concentrador: selectedCase.concentradorData || null,
            emision_pdf: selectedCase.pdfResult || null,
            notificacion: selectedCase.notificadorData || null,
            secretario: selectedCase.secretarioData || null,
            bicameral: selectedCase.bicameralData || null,
          },
          decision_operador: action,
          referencia_decision: reference,
          numero_ley_personalizado: manualLawNumber.trim() || undefined,
          pliego_objeciones: reason ? [{ motivo_objecion: reason }] : [],
        },
      });
      const decisionData = result?.data;
      if (!result?.success || (decisionData?.evaluacion_veto?.decision !== action && !decisionData?.evaluacion_veto?.decision?.includes(action))) {
        throw new Error(result?.detail || 'No se pudo registrar la decisión presidencial.');
      }
      decisionData.numero_ley_personalizado = manualLawNumber.trim() || undefined;
      decisionData.evaluacion_veto = { ...decisionData.evaluacion_veto, decision: action, referencia_decision: reference, numero_ley_personalizado: manualLawNumber.trim() || undefined };
      patchCase({ vetoPromulgacionData: decisionData, pipelineStep: 14 }, { etapa: 'Decision_Ejecutiva', estado: action, msg: `${action} · ${reference}` });
      setNotice(action === 'PROMULGAR' ? 'Promulgación registrada. Puede transferir el expediente a Publicación Oficial.' : 'Veto registrado con sus observaciones para devolver el proyecto a la Asamblea.');
    } catch (err) { setError(err.message || 'No se pudo registrar la decisión.'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!selectedCase || evaluation.decision !== 'PROMULGAR' || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const number = vetoData?.numero_ley_personalizado || evaluation.numero_ley_personalizado || (evaluation.referencia_decision || '').replace(/\D/g, '') || undefined;
      const response = await api.runAgentPublicacion({ proyecto_info: projectInfo, evaluacion_veto: vetoData, id_proyecto: projectId, numero_ley_personalizado: number });
      if (!response?.success || !response.data?.publicacion_oficial?.numero_ley || response.data.error) throw new Error(response?.detail || response.data?.error || 'No se completó la publicación.');
      patchCase({ publicacionData: response.data, pipelineStep: 15 }, { etapa: 'Publicacion_Oficial', estado: 'COMPLETADO', msg: response.data.publicacion_oficial.numero_ley });
      setNotice(`Expediente transferido a Publicación Oficial: ${response.data.publicacion_oficial.numero_ley}.`);
    } catch (err) { setError(err.message || 'No se pudo transferir a la Gaceta Oficial.'); }
    finally { setBusy(false); }
  };

  const refreshCases = async () => {
    setError('');
    try { await shared.refresh(); }
    catch (err) { setError(err.message); }
  };

  const downloadOriginal = async () => {
    if (!selectedCase?.id || downloading) return;
    setDownloading(true); setError('');
    try {
      const blob = await api.getCasoDocumento(selectedCase.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = selectedCase.documentPdf?.nombre || selectedCase.uploadStats?.filename || selectedCase.documentName || 'proyecto-legislativo';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message || 'No se pudo descargar el documento original.'); }
    finally { setDownloading(false); }
  };

  const titleCount = cases.filter(item => item.bicameralData?.ciclo_bicameral?.aprobacion_humana?.accion === 'APROBAR').length;

  return <main className="mesa-page executive-page">
    <header className="mesa-institutional-header executive-header">
      <div><span className="executive-kicker">ÓRGANO EJECUTIVO · ETAPA POST BICAMERAL</span><h1>Despacho Ejecutivo</h1><p>Revisión estratégica de la ley sancionada, asesoría normativa y registro de decisión presidencial.</p></div>
      <div className="executive-header-status"><ShieldCheck size={18}/> Control humano obligatorio</div>
    </header>

    <div className="executive-layout">
      <aside className="executive-sidebar">
        <label htmlFor="executive-case">Expediente del Ejecutivo</label>
        <select id="executive-case" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          <option value="">Seleccione un expediente…</option>
          {cases.map(item => <option key={item.id} value={item.id}>{valueOr(item.fase1Data?.titulo, item.title, item.documentName, item.id)}</option>)}
        </select>
        <div className="executive-sidebar-count"><span>Listos para revisión bicameral aprobada</span><strong>{titleCount}</strong></div>
        <button type="button" className="sidebar-refresh" onClick={refreshCases}><RefreshCw size={14}/> Actualizar expedientes</button>
        <small>{shared.ready ? shared.saving ? 'Guardando los cambios del expediente…' : 'Sincronización con expediente compartido activa.' : 'Cargando expedientes compartidos…'}</small>
        {shared.error && <p role="alert" className="executive-error">{shared.error}</p>}
        <div className="executive-stage-list" aria-label="Etapas del despacho">
          <div className={bicameralApproved ? 'done' : 'waiting'}><CheckCircle2 size={16}/><span><strong>Trámite bicameral</strong><small>{bicameralApproved ? 'Aprobado' : 'Pendiente de aprobación'}</small></span></div>
          <div className={vetoData ? 'done' : 'current'}><Gavel size={16}/><span><strong>Veto y promulgación</strong><small>{vetoData ? 'Evaluación registrada' : 'Evaluación estratégica'}</small></span></div>
          <div className={vetoData?.informe_asesor_presidencial ? 'done' : 'current'}><Building2 size={16}/><span><strong>Asistente de Presidencia</strong><small>{vetoData?.informe_asesor_presidencial ? 'Informe asesor disponible' : 'Apoyo jurídico y normativo'}</small></span></div>
          <div className={selectedCase?.publicacionData ? 'done' : 'waiting'}><FileText size={16}/><span><strong>Publicación Oficial</strong><small>{selectedCase?.publicacionData?.publicacion_oficial?.numero_ley || 'Después de promulgar'}</small></span></div>
        </div>
        <div className="executive-human-note"><ShieldCheck size={16}/><span>La IA analiza y recomienda. La autoridad humana registra la decisión y firma los documentos.</span></div>
      </aside>

      <section className="executive-main">
        {!selectedCase ? <div className="executive-empty" style={box}><FileText size={26}/><h2>Seleccione un expediente</h2><p>Los proyectos aprobados por el ciclo bicameral aparecerán aquí junto con sus documentos y análisis previos.</p></div> : <>
          <section className="executive-project" style={box}>
            <div className="executive-project-heading"><div><span className="executive-kicker">EXPEDIENTE SELECCIONADO</span><h2>{title}</h2><p>{selectedCase.id} · {projectId ? `Proyecto ${projectId}` : 'Identificador legislativo pendiente'}</p></div><span className={`executive-chip ${bicameralApproved ? 'approved' : 'pending'}`}>{bicameralApproved ? 'Sancionado por ambas cámaras' : 'Requiere aprobación bicameral'}</span></div>
            <div className="executive-summary-grid">
              <div><small>Estado del agente</small><strong>{busy ? 'En análisis' : vetoData ? (evaluation.decision || 'Informe emitido') : 'En espera'}</strong></div>
              <div><small>Agentes previos disponibles</small><strong>{previousAgents.length} de 9</strong></div>
              <div><small>Último movimiento</small><strong>{selectedCase.updatedAt ? new Date(selectedCase.updatedAt).toLocaleString() : 'Sin fecha'}</strong></div>
            </div>
            {!bicameralApproved && <div className="executive-gate"><Clock3 size={17}/><span>La evaluación ejecutiva se habilita después de registrar la aprobación del trámite bicameral en Mesa de Partes.</span></div>}
            {error && <p role="alert" className="executive-error">{error}</p>}
            {notice && <p role="status" className="executive-notice">{notice}</p>}
            <div className="executive-action-row">
              <button type="button" className="btn-primary" disabled={!shared.ready || !bicameralApproved || busy} onClick={runEvaluation}>{busy ? 'Procesando…' : vetoData ? 'Actualizar evaluación estratégica' : 'Iniciar evaluación ejecutiva'} <ArrowRight size={16}/></button>
          {(selectedCase.documentName || selectedCase.uploadStats?.saved_as || selectedCase.documentPdf?.saved_as) && <button type="button" className="download-original-button" disabled={downloading} onClick={downloadOriginal}><Download size={15}/>{downloading ? 'Descargando…' : 'Descargar original'}</button>}
              {selectedCase.documentPdf?.drive_url && <a href={selectedCase.documentPdf.drive_url} target="_blank" rel="noreferrer" className="executive-link">Abrir documento del expediente</a>}
            </div>
          </section>

          <nav className="executive-tabs" aria-label="Información del expediente">
            {tabs.map(item => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}
          </nav>

          {tab === 'resumen' && <div className="executive-content-grid">
            <section style={box} className="executive-advisor-card">
              <div className="executive-card-title"><Building2 size={19}/><div><h3>Agente de Presidencia</h3><p>Asistente de Promulgación y Control Normativo</p></div></div>
              {evaluation.informe_asesor_presidencial ? <>
                <span className="executive-advisor-status">Informe asesor del análisis ejecutivo</span>
                <p>{evaluation.informe_asesor_presidencial.resumen_ejecutivo || 'El informe se generó a partir del proyecto y sus antecedentes legislativos.'}</p>
                <div className="executive-advisor-metrics"><div><small>Recomendación técnica</small><strong>{(evaluation.informe_asesor_presidencial.dictamen_sugerido || 'Pendiente').replaceAll('_', ' ')}</strong></div><div><small>Impacto presupuestario</small><strong>{evaluation.informe_asesor_presidencial.impacto_presupuestario || 'No informado'}</strong></div></div>
                <details className="executive-advisor-details"><summary>Ver fundamentación y alertas</summary><p>{evaluation.informe_asesor_presidencial.fundamentacion || 'Sin fundamentación adicional registrada.'}</p><ul>{(evaluation.informe_asesor_presidencial.alertas_constitucionales || []).map((item, index) => <li key={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}</ul></details>
              </> : <p>Este asistente organiza los dictámenes constitucionales, la consistencia normativa, el acta bicameral y las alertas fiscales para preparar la asesoría presidencial. Ejecute la evaluación para recibir su informe.</p>}
              <div className="executive-ethics"><ShieldCheck size={15}/> La recomendación no sustituye la decisión política ni la firma de la autoridad.</div>
            </section>
            <section style={box} className="executive-changes-card"><div className="executive-card-title"><RefreshCw size={18}/><div><h3>Resumen de cambios y movimientos</h3><p>Registro cronológico de agentes y decisiones del expediente</p></div></div>
              {selectedCase.pipelineLog?.length ? <ol>{[...selectedCase.pipelineLog].reverse().slice(0, 12).map((entry, index) => <li key={`${entry.ts || index}-${index}`}><strong>{(entry.etapa || 'Actualización').replaceAll('_', ' ')}</strong><span>{entry.msg || entry.estado || 'Movimiento registrado'}</span><small>{entry.ts ? new Date(entry.ts).toLocaleString() : 'Fecha no disponible'}</small></li>)}</ol> : <p className="executive-muted">Los movimientos previos aparecerán aquí conforme se registren en Mesa de Partes.</p>}
            </section>
          </div>}
          {tab === 'constitucional' && <div style={box}><h3><Scale size={18}/> Revisión de constitucionalidad</h3><EvidenceCard title="Verificador Constitucional" subtitle="Dictamen de forma y fondo, observaciones y precedentes" data={selectedCase.dictamenData}/></div>}
          {tab === 'normativa' && <div style={box}><h3><FileCheck2 size={18}/> Consistencia y control normativo</h3><EvidenceCard title="Agente de Consistencia Normativa" subtitle="Hallazgos, antinomias y normativa vigente" data={selectedCase.consistenciaData}/></div>}
          {tab === 'historial' && <div style={box}><h3><FileText size={18}/> Expediente y resultados de agentes anteriores</h3><div className="executive-evidence-list">{previousAgents.map(([name, data]) => <EvidenceCard key={name} title={name} subtitle="Resultado incorporado al expediente compartido" data={data}/>)}</div></div>}

          {vetoData && <section className="executive-decision-section"><div className="executive-section-heading"><div><span className="executive-kicker">DECISIÓN EJECUTIVA · HUMAN-IN-THE-LOOP</span><h2>Registro presidencial</h2></div><span>La autoridad mantiene el control de la decisión</span></div><DecisionEjecutivaPanel evaluacion={evaluation} usuario={currentUser} procesando={busy} onRegistrar={registerDecision} onPublicar={publish}/></section>}
          {selectedCase.documentText && <details className="executive-fulltext" style={box}><summary>Consultar texto íntegro recibido</summary><pre>{selectedCase.documentText}</pre></details>}
        </>}
      </section>
    </div>
  </main>;
}
