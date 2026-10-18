import React, { useState } from 'react';
import './RevisionLegislativa.css';

const visible = (valor) => valor == null || valor === '' ? 'No informado' : String(valor);

export function Evidencia({ datos }) {
  if (datos == null || datos === '') return <p>No informado</p>;
  if (typeof datos !== 'object') return <span style={{ whiteSpace: 'pre-wrap' }}>{String(datos)}</span>;
  if (Array.isArray(datos)) return datos.length
    ? <ul>{datos.map((d, i) => <li key={i}><Evidencia datos={d} /></li>)}</ul>
    : <p>Sin elementos registrados</p>;
  return <dl>{Object.entries(datos).map(([k, v]) => (
    <React.Fragment key={k}><dt>{k.replaceAll('_', ' ')}</dt><dd><Evidencia datos={v} /></dd></React.Fragment>
  ))}</dl>;
}

function VotosForm({ valor = {}, onChange, articulo }) {
  return <div className="revision-votos">
    {articulo && <label>Artículo<input value={valor.articulo ?? ''} onChange={e => onChange({ ...valor, articulo: e.target.value })} placeholder="Número o único" /></label>}
    {['favor', 'contra', 'abstenciones'].map(c => (
      <label key={c}>{c === 'favor' ? 'A favor' : c === 'contra' ? 'En contra' : 'Abstenciones'}
        <input type="number" min="0" step="1" value={valor[c] ?? ''} onChange={e => onChange({ ...valor, [c]: e.target.value })} />
      </label>
    ))}
  </div>;
}

export function ActaSesionForm({ titulo, valor = {}, onChange, disabled = false }) {
  const detalle = Array.isArray(valor.votacion_en_detalle) ? valor.votacion_en_detalle : [];
  const cambiar = (campo, dato) => onChange({ ...valor, [campo]: dato });
  const registrar = (campo, texto) => cambiar(campo, texto ? texto.split('\n').map(contenido => ({ contenido })) : []);
  return <fieldset className="revision-panel" disabled={disabled}>
    <legend>{titulo}</legend>
    <p>Ingrese los datos del acta oficial y el texto íntegro votado. Procedimiento ordinario.</p>
    <div className="revision-grid">
      <label>Procedimiento<select value={valor.tipo_procedimiento || ''} onChange={e => cambiar('tipo_procedimiento', e.target.value)}>
        <option value="">Confirmar procedimiento</option><option value="LEY_ORDINARIA">Ley ordinaria</option>
        <option value="PROCEDIMIENTO_ESPECIAL">Procedimiento especial (requiere revisión específica)</option>
      </select></label>
      <label>Cámara<select value={valor.camara || ''} onChange={e => cambiar('camara', e.target.value)}>
        <option value="">Seleccionar</option><option value="DIPUTADOS">Diputados</option><option value="SENADORES">Senadores</option>
      </select></label>
      <label>Fecha de sesión<input type="date" value={valor.fecha || ''} onChange={e => cambiar('fecha', e.target.value)} /></label>
      <label>Número de sesión<input value={valor.sesion_numero || ''} onChange={e => cambiar('sesion_numero', e.target.value)} /></label>
      <label>Referencia del acta<input value={valor.referencia_acta || ''} onChange={e => cambiar('referencia_acta', e.target.value)} placeholder="Identificador, folio o enlace documental" /></label>
      <label>Miembros presentes<input type="number" min="0" step="1" value={valor.quorum_legal?.presentes ?? ''}
        onChange={e => cambiar('quorum_legal', { presentes: e.target.value })} /></label>
    </div>
    <label>Texto íntegro sometido a votación<textarea rows="8" value={valor.texto_aprobado || ''} onChange={e => cambiar('texto_aprobado', e.target.value)} placeholder="Artículo 1. …" /></label>
    <h4>Votación en grande</h4>
    <VotosForm valor={valor.votacion_en_grande} onChange={v => cambiar('votacion_en_grande', v)} />
    <h4>Votación en detalle</h4>
    {detalle.map((v, i) => <div key={i} className="revision-row">
      <VotosForm valor={v} articulo onChange={nuevo => cambiar('votacion_en_detalle', detalle.map((d, n) => n === i ? nuevo : d))} />
      <button type="button" className="btn-secondary" onClick={() => cambiar('votacion_en_detalle', detalle.filter((_, n) => n !== i))}>Quitar artículo</button>
    </div>)}
    <button type="button" className="btn-secondary" onClick={() => cambiar('votacion_en_detalle', [...detalle, {}])}>Agregar artículo</button>
    <label>Intervenciones (una por línea, con legislador, bancada y contenido)
      <textarea rows="3" value={(valor.intervenciones || []).map(d => d.contenido || '').join('\n')} onChange={e => registrar('intervenciones', e.target.value)} />
    </label>
    <label>Mociones y acuerdos (una por línea, con proponente y resultado)
      <textarea rows="3" value={(valor.mociones || []).map(d => d.contenido || '').join('\n')} onChange={e => registrar('mociones', e.target.value)} />
    </label>
  </fieldset>;
}

export function ActaResumen({ acta = {}, titulo = 'Acta del Secretario' }) {
  const votos = [acta.votacion_en_grande || {}, ...(acta.votacion_en_detalle || [])];
  return <section className="revision-panel">
    <h3>{titulo}</h3>
    <p>{visible(acta.camara)} · Sesión {visible(acta.sesion_numero)} · {visible(acta.fecha)}</p>
    <p>Referencia: {visible(acta.referencia_acta)} · Presentes: {visible(acta.quorum_legal?.presentes)} · {visible(acta.resultado_final)}</p>
    <div className="revision-scroll"><table>
      <thead><tr><th>Votación</th><th>A favor</th><th>En contra</th><th>Abstenciones</th><th>Mayoría requerida</th><th>Resultado</th></tr></thead>
      <tbody>{votos.map((v, i) => <tr key={i}><td>{i === 0 ? 'En grande' : 'Artículo ' + visible(v.articulo)}</td>
        <td>{visible(v.favor)}</td><td>{visible(v.contra)}</td><td>{visible(v.abstenciones)}</td>
        <td>{visible(v.mayoria_absoluta_requerida)}</td><td>{visible(v.resultado)}</td></tr>)}</tbody>
    </table></div>
    {acta.faltantes?.length > 0 && <div role="status"><strong>Falta verificar</strong><ul>{acta.faltantes.map(f => <li key={f}>{f}</li>)}</ul></div>}
    <details><summary>Texto íntegro y registro de la sesión</summary><Evidencia datos={acta} /></details>
  </section>;
}

export function RevisionBicameralPanel({ ciclo, usuario, procesando, onDecision, onContinuar, onCorregir, onActualizar }) {
  const [confirmado, setConfirmado] = useState(false);
  const [motivo, setMotivo] = useState('');
  const decision = ciclo.aprobacion_humana;
  const autorizado = (ciclo.control_aprobacion?.roles_permitidos || []).includes(usuario?.rol);
  const expediente = ciclo.expediente_consolidado || {};
  return <div className="revision-panel">
    <h2>Revisión humana del expediente</h2>
    <p>Estado: <strong>{decision?.estado || 'PENDIENTE_APROBACION_HUMANA'}</strong></p>
    <p>{ciclo.alcance_verificacion}</p>
    <ActaResumen acta={ciclo.acta_secretario} />
    <ActaResumen acta={ciclo.acta_revisora} titulo="Acta de la Cámara Revisora" />
    <details><summary>Versiones y aceptación de enmiendas</summary><Evidencia datos={{ texto_origen: ciclo.version_original?.texto,
      texto_revisora: ciclo.texto_sancionado, aceptacion_enmiendas: ciclo.version_retornada?.acta_aceptacion_enmiendas }} /></details>
    <h3>Expediente del Concentrador</h3>
    <p>{expediente.resumen_ejecutivo}</p>
    <p>Riesgo: {visible(expediente.nivel_riesgo_general)} · Observaciones pendientes: {(expediente.observaciones_pendientes || []).length}</p>
    <details><summary>Informes, citas, fuentes y observaciones</summary><Evidencia datos={expediente} /></details>
    <h3>Factibilidad</h3>
    {ciclo.factibilidad?.length ? <Evidencia datos={ciclo.factibilidad} /> : <p>No se recibieron informes de factibilidad identificados. Compruebe su exigibilidad y los antecedentes antes de confirmar.</p>}
    <h3>Verificación normativa</h3>
    <div className="revision-scroll"><table>
      <thead><tr><th>Requisito</th><th>Estado</th><th>Evidencia</th><th>Fundamento</th></tr></thead>
      <tbody>{(ciclo.verificaciones_normativas || []).map((v, i) => <tr key={i}>
        <td>{v.requisito}</td><td className={v.estado === 'CUMPLE' ? 'revision-cumple' : 'revision-pendiente'}>{v.estado}</td>
        <td>{visible(v.evidencia)}</td><td>{v.fundamento}</td></tr>)}</tbody>
    </table></div>
    {decision ? <div role="status">
      <p>Decisión registrada por {decision.nombre_usuario} · {decision.fecha}</p>
      {decision.aprobado_con_observaciones && <p>Aprobado con observaciones. Las verificaciones pendientes se conservan en el registro de la decisión.</p>}
      {decision.motivo && <p>Motivo: {decision.motivo}</p>}
    </div> : <>
      {!ciclo.puede_aprobar && <p className="revision-pendiente">Hay observaciones pendientes. Puede aprobar el expediente bajo su decisión; las observaciones quedarán registradas.</p>}
      {!autorizado && <p>Su rol no tiene permiso para resolver esta revisión.</p>}
      <label className="revision-check"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} disabled={procesando || !autorizado} />
        Confirmo que revisé el expediente y sus observaciones para registrar mi decisión.</label>
      <label>Motivo de la decisión (obligatorio para mandar a revisión)<textarea value={motivo} onChange={e => setMotivo(e.target.value)} disabled={procesando} maxLength="5000" /></label>
      <div className="revision-actions">
        <button type="button" className="btn-primary" disabled={procesando || !autorizado || !confirmado}
          onClick={() => onDecision('APROBAR', motivo, confirmado)}>Aprobar</button>
        <button type="button" className="btn-secondary" disabled={procesando || !autorizado || !motivo.trim()}
          onClick={() => onDecision('MANDAR_A_REVISION', motivo, false)}>Mandar a revisión</button>
      </div>
    </>}
    <div className="revision-actions">
      <button type="button" className="btn-secondary" disabled={procesando} onClick={onActualizar}>Actualizar estado</button>
      <button type="button" className="btn-secondary" disabled={procesando} onClick={onCorregir}>Corregir antecedentes</button>
      <button type="button" className="btn-primary" disabled={procesando || decision?.accion !== 'APROBAR'} onClick={onContinuar}>Continuar: Veto y Promulgación</button>
    </div>
  </div>;
}

export function DecisionEjecutivaPanel({ evaluacion, usuario, procesando, onRegistrar, onPublicar }) {
  const [referencia, setReferencia] = useState('');
  const [accion, setAccion] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const pendiente = evaluacion.decision === 'PENDIENTE_DECISION_HUMANA';
  return <div className="revision-panel">
    <h2>Asesoría de Veto y Promulgación</h2>
    <p>Estado: <strong>{evaluacion.decision}</strong></p>
    <Evidencia datos={evaluacion.recomendacion_tecnica} />
    <details><summary>Pliego de observaciones</summary><Evidencia datos={evaluacion.pliego_observaciones} /></details>
    <p>{evaluacion.justificacion}</p>
    {pendiente && <>
      <p>Registre la decisión del documento emitido por la autoridad competente.</p>
      <label>Decisión documentada<select value={accion} onChange={e => setAccion(e.target.value)}>
        <option value="">Seleccionar</option>
        {(evaluacion.opciones_operador_humano || []).map(o => <option key={o.accion} value={o.accion}>{o.etiqueta}</option>)}
      </select></label>
      <label>Referencia del documento<input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Identificador, folio o enlace documental" /></label>
      <label className="revision-check"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />
        Confirmo que la decisión corresponde al documento de la autoridad competente.</label>
      <button type="button" className="btn-primary" disabled={procesando || !(evaluacion.roles_registro || []).includes(usuario?.rol) || !accion || !referencia.trim() || !confirmado}
        onClick={() => onRegistrar(accion, referencia)}>Registrar decisión documentada</button>
    </>}
    {evaluacion.referencia_decision && <p>Referencia: {evaluacion.referencia_decision}</p>}
    <button type="button" className="btn-primary" disabled={procesando || evaluacion.decision !== 'PROMULGAR'} onClick={onPublicar}>Continuar: Publicación Oficial</button>
  </div>;
}
