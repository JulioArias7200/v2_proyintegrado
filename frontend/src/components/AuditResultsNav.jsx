import React from 'react';

export default function AuditResultsNav({ constitucional, consistencia, selected, onSelect }) {
  return <section className="revision-panel" aria-label="Resultados de las auditorías">
    <h3>Resultados de Constitucional y Consistencia</h3>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { id: 'constitucional', label: 'Ver resultado Constitucional', data: constitucional },
        { id: 'consistencia', label: 'Ver resultado de Consistencia', data: consistencia },
      ].map(({ id, label, data }) => <div key={id}>
        <button type="button" className={selected === id ? 'btn-primary' : 'btn-secondary'}
          disabled={!data} aria-pressed={selected === id} onClick={() => onSelect(id)}>{label}</button>
        <p>{!data ? 'Todavía no hay un resultado guardado para este caso.' :
          data.error || data.estado === 'PENDIENTE_REVISION' ? 'Resultado disponible con errores o cotejos pendientes.' :
          'Resultado disponible. Puede abrirlo sin detener el flujo.'}</p>
        {selected === id && data?.error && <p role="alert">{data.error}</p>}
        {selected === id && data?.pendientes_revision?.length > 0 && <details open>
          <summary>Cotejos pendientes ({data.pendientes_revision.length})</summary>
          <ul>{data.pendientes_revision.map((p, i) => <li key={i}>
            {p.articulo_constitucional ? `Artículo constitucional ${p.articulo_constitucional}: ` : ''}
            {p.articulo_proyecto ? `Artículo del proyecto ${p.articulo_proyecto}: ` : ''}
            {p.motivo || p.error || p.justificacion || JSON.stringify(p)}
          </li>)}</ul>
        </details>}
      </div>)}
    </div>
  </section>;
}
