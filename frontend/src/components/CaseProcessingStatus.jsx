import React from 'react';

export default function CaseProcessingStatus({ caso, onReanudar, reanudando = false }) {
  const legislativo = caso.tipoPresentacion === 'iniciativa' || caso.tipoProcesamiento === 'iniciativa'
    || caso.fase1Data?.categoria === 'AGENTE_REGISTRO_LEGISLATIVO';
  if (!legislativo) return null;
  const auditorias = [['constitucional', 'Constitucional', caso.dictamenData], ['consistencia', 'Consistencia', caso.consistenciaData]];
  const incompleto = auditorias.some(([, , data]) => !data || data.error || data.estado === 'PENDIENTE_REVISION');
  return <section aria-label="Ejecución real de las auditorías">
    <h3>Proceso automático del caso</h3>
    <p>Las auditorías avanzan automáticamente. Sus resultados y observaciones aparecen al terminar cada agente.</p>
    <ul>{auditorias.map(([id, nombre, data]) => <li key={id}>
      <strong>{nombre}:</strong> {caso._sharedProcessing && caso.agentesEnProceso?.includes(id) ? 'En proceso' :
        data ? data.error || data.estado === 'PENDIENTE_REVISION' ? 'Terminó con errores o cotejos pendientes' : 'Resultado guardado' :
        'Sin resultado guardado; no se considera completado'}
    </li>)}</ul>
    {incompleto && !caso._sharedProcessing && caso.pipelineStep <= 11 && <button type="button"
      className="btn-secondary" disabled={reanudando} onClick={onReanudar}>
      {reanudando ? 'Iniciando auditorías…' : 'Reanudar auditorías de este caso'}
    </button>}
  </section>;
}
