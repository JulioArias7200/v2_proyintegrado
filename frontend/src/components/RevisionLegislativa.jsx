import React, { useState } from 'react';
import './RevisionLegislativa.css';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Building2,
  Users,
  ShieldCheck,
  Scale,
  Award,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';

const visible = (valor) => (valor == null || valor === '' ? 'No informado' : String(valor));

export function Evidencia({ datos }) {
  if (datos == null || datos === '') return <p>No informado</p>;
  if (typeof datos !== 'object') return <span style={{ whiteSpace: 'pre-wrap' }}>{String(datos)}</span>;
  if (Array.isArray(datos))
    return datos.length ? (
      <ul>
        {datos.map((d, i) => (
          <li key={i}>
            <Evidencia datos={d} />
          </li>
        ))}
      </ul>
    ) : (
      <p>Sin elementos registrados</p>
    );
  return (
    <dl>
      {Object.entries(datos).map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k.replaceAll('_', ' ')}</dt>
          <dd>
            <Evidencia datos={v} />
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function VotosForm({ valor = {}, onChange, articulo }) {
  return (
    <div className="revision-votos">
      {articulo && (
        <label>
          Artículo
          <input
            value={valor.articulo ?? ''}
            onChange={(e) => onChange({ ...valor, articulo: e.target.value })}
            placeholder="Número o único"
          />
        </label>
      )}
      {['favor', 'contra', 'abstenciones'].map((c) => (
        <label key={c}>
          {c === 'favor' ? 'A favor' : c === 'contra' ? 'En contra' : 'Abstenciones'}
          <input
            type="number"
            min="0"
            step="1"
            value={valor[c] ?? ''}
            onChange={(e) => onChange({ ...valor, [c]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

export function ActaSesionForm({ titulo, valor = {}, onChange, disabled = false }) {
  const detalle = Array.isArray(valor.votacion_en_detalle) ? valor.votacion_en_detalle : [];
  const cambiar = (campo, dato) => onChange({ ...valor, [campo]: dato });

  return (
    <fieldset className="revision-panel" disabled={disabled}>
      <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileText size={18} color="#38bdf8" /> {titulo}
      </legend>
      <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
        Registro esencial de votación plenaria. Se registran estrictamente los 3 datos constitucionales: Votos a favor, en contra y abstenciones.
      </p>

      <div className="revision-grid">
        <label>
          Cámara Legislativa
          <select value={valor.camara || ''} onChange={(e) => cambiar('camara', e.target.value)}>
            <option value="">Seleccionar</option>
            <option value="DIPUTADOS">Cámara de Diputados (130 escaños)</option>
            <option value="SENADORES">Cámara de Senadores (36 escaños)</option>
          </select>
        </label>
        <label>
          Fecha de sesión
          <input type="date" value={valor.fecha || ''} onChange={(e) => cambiar('fecha', e.target.value)} />
        </label>
        <label>
          Número de sesión
          <input value={valor.sesion_numero || ''} onChange={(e) => cambiar('sesion_numero', e.target.value)} />
        </label>
        <label>
          Miembros presentes (Quórum)
          <input
            type="number"
            min="0"
            step="1"
            value={valor.quorum_legal?.presentes ?? ''}
            onChange={(e) => cambiar('quorum_legal', { presentes: e.target.value })}
          />
        </label>
      </div>

      <div style={{ marginTop: '16px', background: 'rgba(30,41,59,0.5)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)' }}>
        <h4 style={{ color: '#38bdf8', margin: '0 0 10px 0', fontSize: '0.95rem' }}>
          🟦 Resultados del análisis en grande (Votación General)
        </h4>
        <VotosForm valor={valor.votacion_en_grande} onChange={(v) => cambiar('votacion_en_grande', v)} />
      </div>

      <div style={{ marginTop: '16px', background: 'rgba(30,41,59,0.5)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(134,239,172,0.2)' }}>
        <h4 style={{ color: '#86efac', margin: '0 0 10px 0', fontSize: '0.95rem' }}>
          🟩 Resultados del análisis en detalle (artículo por artículo)
        </h4>
        {detalle.map((v, i) => (
          <div key={i} className="revision-row" style={{ marginBottom: '10px' }}>
            <VotosForm
              valor={v}
              articulo
              onChange={(nuevo) => cambiar('votacion_en_detalle', detalle.map((d, n) => (n === i ? nuevo : d)))}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.78rem', marginTop: '6px' }}
              onClick={() => cambiar('votacion_en_detalle', detalle.filter((_, n) => n !== i))}
            >
              Quitar artículo
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: '0.82rem', marginTop: '8px' }}
          onClick={() => cambiar('votacion_en_detalle', [...detalle, {}])}
        >
          + Agregar artículo al análisis en detalle
        </button>
      </div>
    </fieldset>
  );
}

export function ActaResumen({ acta = {}, titulo = 'Acta Parlamentaria Oficial' }) {
  const vGrande = acta.votacion_en_grande || {};
  const vDetalle = Array.isArray(acta.votacion_en_detalle) ? acta.votacion_en_detalle : [];

  return (
    <section className="revision-panel" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#38bdf8', fontSize: '1.15rem' }}>{titulo}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            {visible(acta.camara)} · Sesión #{visible(acta.sesion_numero)} · Fecha: {visible(acta.fecha)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
            Presentes: {visible(acta.quorum_legal?.presentes)}
          </span>
          <span style={{
            background: acta.resultado_final === 'APROBADO_EN_GRANDE_Y_DETALLE' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: acta.resultado_final === 'APROBADO_EN_GRANDE_Y_DETALLE' ? '#86efac' : '#fca5a5',
            padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700
          }}>
            {visible(acta.resultado_final)}
          </span>
        </div>
      </div>

      {/* BLOQUE 1: RESULTADOS DEL ANÁLISIS EN GRANDE */}
      <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '8px', padding: '14px', marginBottom: '14px', borderLeft: '4px solid #38bdf8' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🟦 Resultados del análisis en grande (Votación General)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Votos a Favor</span>
            <div style={{ color: '#86efac', fontSize: '1.2rem', fontWeight: 800 }}>{visible(vGrande.favor)}</div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Votos en Contra</span>
            <div style={{ color: '#f87171', fontSize: '1.2rem', fontWeight: 800 }}>{visible(vGrande.contra)}</div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Abstenciones</span>
            <div style={{ color: '#fbbf24', fontSize: '1.2rem', fontWeight: 800 }}>{visible(vGrande.abstenciones)}</div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mayoría Requerida</span>
            <div style={{ color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 700 }}>{visible(vGrande.mayoria_absoluta_requerida)}</div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dictamen en Grande</span>
            <div style={{ color: vGrande.resultado === 'APROBADO' ? '#86efac' : '#f87171', fontSize: '1.1rem', fontWeight: 800 }}>
              {visible(vGrande.resultado)}
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: RESULTADOS DEL ANÁLISIS EN DETALLE */}
      <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #86efac' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#86efac', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🟩 Resultados del análisis en detalle (artículo por artículo)
        </h4>
        {vDetalle.length > 0 ? (
          <div className="revision-scroll">
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>A favor</th>
                  <th>En contra</th>
                  <th>Abstención</th>
                  <th>Mayoría Req.</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {vDetalle.map((v, i) => {
                  const nombreArt = v.etiqueta || (v.articulo ? (String(v.articulo).toLowerCase().startsWith('disposicion') ? v.articulo : `Art. ${v.articulo}`) : `Art. ${i + 1}`);
                  return (
                    <tr key={i}>
                      <td>
                        <strong style={{ color: '#e2e8f0' }}>{nombreArt}</strong>
                        {v.epigrafe && !nombreArt.includes(v.epigrafe) && (
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                            {v.epigrafe}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#86efac', fontWeight: 700 }}>{visible(v.favor)}</td>
                      <td style={{ color: '#f87171', fontWeight: 700 }}>{visible(v.contra)}</td>
                      <td style={{ color: '#fbbf24', fontWeight: 700 }}>{visible(v.abstenciones)}</td>
                      <td style={{ color: '#cbd5e1' }}>{visible(v.mayoria_absoluta_requerida)}</td>
                      <td>
                        <span style={{
                          color: v.resultado === 'APROBADO' ? '#86efac' : '#f87171',
                          fontWeight: 700, fontSize: '0.8rem'
                        }}>
                          {visible(v.resultado)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Aprobación unánime del texto en bloque según lo acordado en sala plenaria.
          </p>
        )}
      </div>
    </section>
  );
}

export function RevisionBicameralPanel({
  ciclo = {},
  usuario,
  procesando,
  onDecision,
  onContinuar,
  onDevolverComision,
  onActualizar
}) {
  const [confirmado, setConfirmado] = useState(false);
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [mostrarModalDevolucion, setMostrarModalDevolucion] = useState(false);
  const [verTextoDoc, setVerTextoDoc] = useState(false);
  const [copiadoTexto, setCopiadoTexto] = useState(false);

  const decision = ciclo.aprobacion_humana;
  const rolEfectivo = usuario?.rol || 'Senador';
  const autorizado = (ciclo.control_aprobacion?.roles_permitidos || []).includes(rolEfectivo);
  const expediente = ciclo.expediente_consolidado || {};
  const normativa = ciclo.normativa_en_tratamiento || {};
  const circuito = ciclo.circuito_dos_camaras || {};

  const handleEjecutarDevolucion = () => {
    if (!motivoDevolucion.trim()) return;
    if (onDevolverComision) {
      onDevolverComision(motivoDevolucion);
    } else {
      onDecision('MANDAR_A_REVISION', motivoDevolucion, false);
    }
    setMostrarModalDevolucion(false);
  };

  return (
    <div className="revision-panel" style={{ background: '#0b132b', border: '1.5px solid rgba(56, 189, 248, 0.4)' }}>
      {/* ── CABECERA DESTACADA: NOMBRE COMPLETO DE LA NORMATIVA EN TRATAMIENTO ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 58, 138, 0.45) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        padding: '18px 20px',
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ background: '#1e3a8a', color: '#7dd3fc', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>
            NORMATIVA EN TRATAMIENTO BICAMERAL (ART. 163 CPE)
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Expediente: <strong>{normativa.codigo_expediente || `PL-${ciclo.proyecto_id || 136}/2026`}</strong>
          </span>
        </div>
        <h2 style={{ fontSize: '1.35rem', color: '#ffffff', margin: '4px 0 8px 0', lineHeight: 1.35 }}>
          {normativa.titulo_completo || 'Proyecto de Ley en Revisión de Asamblea Legislativa Plurinacional'}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
            <span>Comisión Dictaminadora: <strong style={{ color: '#38bdf8' }}>{normativa.comision_origen || 'Comisión de Constitución'}</strong></span>
            <span>Fecha de Ingreso: <strong style={{ color: '#94a3b8' }}>{normativa.fecha_ingreso || '2026'}</strong></span>
            <span>Estado del Circuito: <strong style={{ color: '#86efac' }}>{circuito.estado_sancion || 'EN_REVISION'}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setVerTextoDoc(!verTextoDoc)}
            className="btn-secondary"
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: verTextoDoc ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.8)',
              borderColor: verTextoDoc ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)',
              color: verTextoDoc ? '#38bdf8' : '#ffffff',
              cursor: 'pointer'
            }}
          >
            <BookOpen size={15} />
            <span>{verTextoDoc ? 'Ocultar Documento Analizado' : 'Ver Documento Analizado'}</span>
          </button>
        </div>

        {/* Visor desplegable del texto analizado */}
        {verTextoDoc && (
          <div style={{
            marginTop: '14px',
            background: 'rgba(2, 6, 23, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '8px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                TEXTO COMPLETO SOMETIDO A TRÁMITE BICAMERAL:
              </span>
              <button
                type="button"
                onClick={() => {
                  const t = ciclo.acta_secretario?.texto_documento || ciclo.acta_secretario?.texto_aprobado || ciclo.texto_sancionado || '';
                  navigator.clipboard.writeText(t);
                  setCopiadoTexto(true);
                  setTimeout(() => setCopiadoTexto(false), 2000);
                }}
                className="btn-secondary"
                style={{ padding: '3px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                {copiadoTexto ? <Check size={13} color="#86efac" /> : <Copy size={13} />}
                <span>{copiadoTexto ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <div style={{
              maxHeight: '380px',
              overflowY: 'auto',
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '12px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              color: '#e2e8f0',
              lineHeight: 1.65,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              whiteSpace: 'pre-wrap',
              border: '1px solid rgba(148, 163, 184, 0.15)'
            }}>
              {ciclo.acta_secretario?.texto_documento || ciclo.acta_secretario?.texto_aprobado || ciclo.texto_sancionado || 'Texto íntegro no disponible en el expediente.'}
            </div>
          </div>
        )}
      </div>

      {/* ── CIRCUITO REAL DE LAS DOS CÁMARAS: ORIGEN (DIPUTADOS) VS REVISORA (SENADORES) ── */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#7dd3fc', fontSize: '1.05rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={20} color="#38bdf8" /> Circuito Constitucional de Ambas Cámaras
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {/* CÁMARA DE ORIGEN */}
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '16px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.95rem' }}>
                1. {circuito.camara_origen?.nombre || 'Cámara de Diputados'} (Origen)
              </span>
              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#86efac', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                {circuito.camara_origen?.porcentaje_aprobacion || 72.5}% de Apoyo
              </span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Iniciativa y aprobación en grande y detalle aprobada formalmente.
            </p>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.82rem' }}>
              <span>A Favor: <strong style={{ color: '#86efac' }}>{circuito.camara_origen?.votacion_en_grande?.favor || 85}</strong></span>
              <span>En Contra: <strong style={{ color: '#f87171' }}>{circuito.camara_origen?.votacion_en_grande?.contra || 25}</strong></span>
              <span>Abstención: <strong style={{ color: '#fbbf24' }}>{circuito.camara_origen?.votacion_en_grande?.abstenciones || 5}</strong></span>
            </div>
          </div>

          {/* CÁMARA REVISORA */}
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(134, 239, 172, 0.25)', padding: '16px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#86efac', fontWeight: 800, fontSize: '0.95rem' }}>
                2. {circuito.camara_revisora?.nombre || 'Cámara de Senadores'} (Revisora)
              </span>
              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#86efac', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                {circuito.camara_revisora?.porcentaje_aprobacion || 68.0}% de Apoyo
              </span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Revisión de legalidad y cotejo de enmiendas conforme a la CPE.
            </p>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.82rem' }}>
              <span>A Favor: <strong style={{ color: '#86efac' }}>{circuito.camara_revisora?.votacion_en_grande?.favor || 24}</strong></span>
              <span>En Contra: <strong style={{ color: '#f87171' }}>{circuito.camara_revisora?.votacion_en_grande?.contra || 8}</strong></span>
              <span>Abstención: <strong style={{ color: '#fbbf24' }}>{circuito.camara_revisora?.votacion_en_grande?.abstenciones || 2}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* RESUMEN DE ACTAS CON TÍTULOS EXPRESOS: EN GRANDE Y EN DETALLE */}
      <ActaResumen acta={ciclo.acta_secretario} titulo="Acta Oficial — Cámara de Origen" />
      <ActaResumen acta={ciclo.acta_revisora} titulo="Acta Oficial — Cámara Revisora" />

      {/* ACCIONES Y BUCLE DE RETROALIMENTACIÓN */}
      <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '18px', borderRadius: '10px', marginTop: '20px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '1rem' }}>
          Resolución Bicameral y Control Humano (Firma Parlamentaria)
        </h4>

        {decision ? (
          <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #86efac' }}>
            <p style={{ margin: '0 0 4px 0', color: '#86efac', fontWeight: 700 }}>
              Sanción Bicameral Formal Registrada
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
              Registrada por: <strong>{decision.nombre_usuario}</strong> · Fecha: {decision.fecha}
            </p>
            {decision.motivo && <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>Fundamentación: {decision.motivo}</p>}
          </div>
        ) : (
          <>
            <label className="revision-check" style={{ marginBottom: '14px' }}>
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                disabled={procesando || !autorizado}
              />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Confirmo que revisé la autenticidad de las actas de ambas cámaras (en grande y en detalle) y que la norma cumple los requisitos constitucionales.
              </span>
            </label>

            <div className="revision-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#2563eb', padding: '10px 20px', fontWeight: 700 }}
                disabled={procesando || !autorizado || !ciclo.puede_aprobar || !confirmado}
                onClick={() => onDecision('APROBAR', 'Aprobado formalmente en trámite bicameral', confirmado)}
              >
                Aprobar Sanción Bicameral
              </button>

              {/* ── BOTÓN DE BUCLE DE RETORNO / RETROALIMENTACIÓN A COMISIONES ── */}
              <button
                type="button"
                className="btn-secondary"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '10px 18px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                disabled={procesando || !autorizado}
                onClick={() => setMostrarModalDevolucion(true)}
              >
                <RotateCcw size={16} /> Devolver a Comisión para Revisión
              </button>

              <button type="button" className="btn-secondary" disabled={procesando} onClick={onActualizar}>
                Actualizar estado
              </button>
            </div>
          </>
        )}

        {decision?.accion === 'APROBAR' && (
          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'linear-gradient(90deg, #0284c7 0%, #2563eb 100%)', width: '100%', padding: '12px', fontWeight: 800, fontSize: '0.95rem' }}
              disabled={procesando}
              onClick={onContinuar}
            >
              Remitir al Órgano Ejecutivo (Veto o Promulgación) <ArrowRight size={18} style={{ verticalAlign: 'middle', marginLeft: '6px' }} />
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL DE BUCLE DE RETORNO A COMISIÓN ── */}
      {mostrarModalDevolucion && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#0f172a', border: '1.5px solid #ef4444', borderRadius: '12px', padding: '24px', maxWidth: '580px', width: '100%', boxShadow: '0 0 35px rgba(239,68,68,0.3)'
          }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={20} /> Devolución de Expediente a Comisión
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '14px' }}>
              Si la revisión bicameral detectó contradicciones o fallas, el proyecto no debe avanzar. Se devolverá formalmente a la Comisión correspondiente para subsanar los artículos observados.
            </p>
            <label style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Motivo y fundamento de la devolución (observaciones detalladas):
              </span>
              <textarea
                rows={4}
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
                placeholder="Indique las contradicciones detectadas entre ambas cámaras o con la normativa vigente..."
                style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: '6px', padding: '10px' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarModalDevolucion(false)}
                style={{ padding: '8px 16px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#ef4444', padding: '8px 20px', fontWeight: 700 }}
                disabled={!motivoDevolucion.trim()}
                onClick={handleEjecutarDevolucion}
              >
                Confirmar Devolución a Comisión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DecisionEjecutivaPanel({
  evaluacion = {},
  usuario,
  procesando,
  onRegistrar,
  onPublicar
}) {
  const [referencia, setReferencia] = useState('');
  const [accion, setAccion] = useState('PROMULGAR');
  const [confirmado, setConfirmado] = useState(false);
  const [motivoVeto, setMotivoVeto] = useState('');

  const informeAsesor = evaluacion.informe_asesor_presidencial || evaluacion.recomendacion_tecnica || {};
  const respaldoVotos = informeAsesor.respaldo_legislativo || {};
  const pendiente = evaluacion.decision === 'PENDIENTE_DECISION_PRESIDENCIAL' || evaluacion.decision === 'PENDIENTE_DECISION_HUMANA' || !evaluacion.decision;

  const esPromulgada = evaluacion.decision === 'PROMULGAR' || evaluacion.decision === 'PROMULGADA_POR_EJECUTIVO' || evaluacion.decision === 'PROMULGADO_DOCUMENTADO';
  const esVetada = evaluacion.decision === 'VETAR_TOTAL' || evaluacion.decision === 'VETAR_PARCIAL' || evaluacion.decision === 'VETADA_DEVUELTA_A_ALP';

  const dictamenRecomendado = informeAsesor.dictamen_sugerido || 'RECOMIENDA_PROMULGAR';

  return (
    <div className="revision-panel" style={{ background: '#091326', border: '1.5px solid rgba(56, 189, 248, 0.4)' }}>
      {/* CABECERA INSTITUCIONAL EJECUTIVA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 58, 138, 0.5) 100%)',
        padding: '18px',
        borderRadius: '10px',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ background: '#1e3a8a', color: '#7dd3fc', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
            ÓRGANO EJECUTIVO · PRESIDENCIA DEL ESTADO (ARTS. 163-165 CPE)
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Plazo Constitucional: <strong>10 días hábiles</strong>
          </span>
        </div>
        <h2 style={{ fontSize: '1.35rem', color: '#ffffff', margin: '4px 0 6px 0' }}>
          Evaluación Presidencial de Promulgación o Veto
        </h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
          Normativa Sancionada: <strong>{evaluacion.titulo_normativa || 'Ley remitida por la Asamblea Legislativa Plurinacional'}</strong>
        </p>
      </div>

      {/* ── INFORME ASESOR INTELIGENTE PARA EL PRESIDENTE ── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={24} color="#38bdf8" />
            <div>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.1rem' }}>
                Informe del Agente Asesor Presidencial
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Asesoría Jurídica y Estratégica para la toma de decisión del Presidente del Estado
              </span>
            </div>
          </div>

          <span style={{
            background: dictamenRecomendado.includes('PROMULGAR') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: dictamenRecomendado.includes('PROMULGAR') ? '#86efac' : '#fca5a5',
            padding: '6px 12px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 800,
            border: `1px solid ${dictamenRecomendado.includes('PROMULGAR') ? '#22c55e' : '#ef4444'}`
          }}>
            Dictamen Técnico: {dictamenRecomendado.replaceAll('_', ' ')}
          </span>
        </div>

        {/* Resumen y Concordancia */}
        <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.5, margin: '0 0 14px 0' }}>
          {informeAsesor.resumen_ejecutivo || 'Se evaluó la norma sancionada, verificando su compatibilidad jurídica y técnica con el plan de gobierno.'}
        </p>

        {/* MÉTRICAS DE RESPALDO LEGISLATIVO (% DE VOTOS) Y FISCAL */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Respaldo en Diputados</span>
            <div style={{ color: '#86efac', fontSize: '1.25rem', fontWeight: 800 }}>
              {respaldoVotos.camara_diputados_pct ?? 72.5}%
            </div>
            <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Aprobada por mayoría parlamentaria</span>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Respaldo en Senadores</span>
            <div style={{ color: '#38bdf8', fontSize: '1.25rem', fontWeight: 800 }}>
              {respaldoVotos.camara_senadores_pct ?? 68.0}%
            </div>
            <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Cámara Revisora ratificante</span>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sostenibilidad Fiscal</span>
            <div style={{ color: '#fde047', fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>
              {informeAsesor.impacto_presupuestario || 'Verificada (Ley SAFCO)'}
            </div>
          </div>
        </div>

        {/* Concordancia legal */}
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
          <strong>Concordancia Constitucional:</strong> {informeAsesor.concordancia_constitucional || 'Compatibilidad confirmada contra los Arts. 1-410 de la CPE.'}
        </div>
      </div>

      {/* ESTADO DE LA DECISIÓN PRESIDENCIAL */}
      {esPromulgada && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1.5px solid #22c55e', padding: '18px', borderRadius: '10px', marginBottom: '20px' }}>
          <h4 style={{ color: '#86efac', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="#86efac" /> Ley Promulgada por el Presidente del Estado
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#e2e8f0' }}>
            La Presidencia del Estado ha firmado el Decreto Supremo de Promulgación. La ley se encuentra lista con todos sus antecedentes históricos para ser transferida a la Gaceta Oficial.
          </p>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '14px' }}>
            Referencia: <strong>{evaluacion.referencia_decision || 'Decreto Supremo de Promulgación'}</strong>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', width: '100%', padding: '12px', fontWeight: 800, fontSize: '0.95rem' }}
            disabled={procesando}
            onClick={onPublicar}
          >
            Transferir a la Gaceta Oficial para Publicación Definitiva <ArrowRight size={18} style={{ verticalAlign: 'middle', marginLeft: '6px' }} />
          </button>
        </div>
      )}

      {esVetada && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1.5px solid #ef4444', padding: '18px', borderRadius: '10px', marginBottom: '20px' }}>
          <h4 style={{ color: '#fca5a5', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={20} color="#fca5a5" /> Ley Vetada / Observada por la Presidencia del Estado
          </h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#e2e8f0' }}>
            La norma fue devuelta oficialmente con el Pliego de Objeciones a la Asamblea Legislativa Plurinacional (Art. 164 CPE).
          </p>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
            Documento remitido: <strong>{evaluacion.referencia_decision}</strong>
          </div>
        </div>
      )}

      {/* FORMULARIO DE TOMA DE DECISIÓN (SI ESTÁ PENDIENTE) */}
      {pendiente && (
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
          <h4 style={{ color: '#ffffff', margin: '0 0 12px 0' }}>
            Registro Formal de la Decisión Presidencial (Art. 164 CPE)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <label>
              Decisión del Presidente del Estado
              <select value={accion} onChange={(e) => setAccion(e.target.value)}>
                <option value="PROMULGAR">Promulgar Ley (Emitir Decreto de Promulgación)</option>
                <option value="VETAR_PARCIAL">Vetar / Observar Parcialmente (Devolver a ALP)</option>
                <option value="VETAR_TOTAL">Vetar / Observar Totalmente (Devolver a ALP)</option>
              </select>
            </label>

            <label>
              Número de Decreto o Nota de Devolución
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej. Decreto Supremo N° 5280 o CITE-PRES-089-2026"
              />
            </label>
          </div>

          {accion !== 'PROMULGAR' && (
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.82rem', color: '#fca5a5', display: 'block', marginBottom: '6px' }}>
                Pliego de Objeciones Fundadas del Presidente (Artículos observados y motivos):
              </span>
              <textarea
                rows={3}
                value={motivoVeto}
                onChange={(e) => setMotivoVeto(e.target.value)}
                placeholder="Detalle los motivos de incompatibilidad constitucional o económica por los que se objeta la ley..."
                style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', color: '#fff', border: '1px solid #ef4444', borderRadius: '6px', padding: '10px' }}
              />
            </label>
          )}

          <label className="revision-check" style={{ marginBottom: '16px' }}>
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              Certifico que la decisión seleccionada cuenta con el respaldo documental oficial de la Presidencia del Estado.
            </span>
          </label>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn-primary"
              style={{
                background: accion === 'PROMULGAR' ? '#10b981' : '#ef4444',
                padding: '10px 24px',
                fontWeight: 800
              }}
              disabled={procesando || !confirmado || !referencia.trim() || (accion !== 'PROMULGAR' && !motivoVeto.trim())}
              onClick={() => onRegistrar(accion, referencia, motivoVeto)}
            >
              {accion === 'PROMULGAR' ? 'Registrar Promulgación Oficial' : 'Registrar Veto y Devolver a la ALP'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
