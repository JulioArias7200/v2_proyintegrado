// MesaPartes v2.1 — Human-in-the-Loop Multi-Agent Pipeline
import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Scale, 
  Cpu, 
  Building2, 
  Users, 
  Mail, 
  RotateCcw, 
  Check, 
  ExternalLink,
  BookOpen,
  Download,
  FileCheck,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import RobotCard from '../components/RobotCard';

export default function MesaPartes({ onNavigateExpedientes }) {
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'text'
  const [file, setFile] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [uploadStats, setUploadStats] = useState(null);
  
  // Pipeline State: 0: Idle, 1: Fase 1 en Proceso, 2: Control Humano, 3: Fase 2 en Proceso, 4: Completado
  const [pipelineStep, setPipelineStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fase 1 Resultado
  const [fase1Data, setFase1Data] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Agentes Separados
  const [comisionData, setComisionData] = useState(null);
  const [dictamenData, setDictamenData] = useState(null);
  const [consistenciaData, setConsistenciaData] = useState(null);

  // Fase 3 (PDF)
  const [pdfResult, setPdfResult] = useState(null);

  // Fase 4 (Notificador)
  const [notificadorData, setNotificadorData] = useState(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  const fileInputRef = useRef(null);

  // Manejar Carga de Archivo
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setDocumentName(selectedFile.name);
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await api.uploadDocument(selectedFile);
      setDocumentText(res.texto_completo);
      setUploadStats({
        paginas: res.paginas,
        palabras: res.palabras,
        caracteres: res.caracteres,
        motor: res.motor,
        saved_as: res.saved_as,
        local_path: res.local_path,
      });
    } catch (err) {
      setErrorMessage(err.message || 'Error al procesar el archivo');
    } finally {
      setIsProcessing(false);
    }
  };

  // Iniciar Fase 1: Agente Distribuidor
  const handleIniciarFase1 = async () => {
    if (!documentText.trim()) {
      setErrorMessage('Por favor ingrese texto o suba un archivo.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setPipelineStep(1);

    try {
      const res = await api.runPhase1({
        texto: documentText,
        nombre_archivo: documentName || (inputMode === 'file' ? 'documento.pdf' : 'texto_mesa_partes.txt'),
        tipo_entrada: inputMode === 'file' ? 'Archivo PDF/DOCX' : 'Texto Directo',
        metadata_extra: {
          palabras: uploadStats?.palabras || documentText.split(/\s+/).length,
          caracteres: documentText.length,
        },
      });

      setFase1Data(res.data);
      setSelectedCategory(res.data.categoria);
      setPipelineStep(2); // Pausa en Control Humano
    } catch (err) {
      setErrorMessage(err.message || 'Error durante la clasificación de Fase 1');
      setPipelineStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const buildPayload = () => ({
    sesion_id: fase1Data.sesion_id,
    task_id_inicial: fase1Data.task_id_inicial,
    task_id_distribuidor: fase1Data.task_id_distribuidor,
    categoria: selectedCategory,
    agente_destino_nombre: selectedCategory === 'AGENTE_REGISTRO_LEGISLATIVO'
      ? 'Agente_Comision_Legislativa'
      : selectedCategory === 'AGENTE_ATENCION_CIUDADANA'
      ? 'Agente_Atencion_Ciudadana'
      : 'Agente_Gestion_Correspondencia',
    texto_documento: documentText,
    nombre_archivo: fase1Data.nombre_archivo,
    tipo_entrada: fase1Data.tipo_entrada,
    id_proyecto: fase1Data.id_proyecto,
    solicitud_id: fase1Data.solicitud_id,
    t_inicio_fase1: fase1Data.t_inicio_fase1,
    local_filepath: uploadStats?.local_path || null,
  });

  const handleEjecutarComision = async () => {
    if (!fase1Data) return;
    setIsProcessing(true);
    setErrorMessage('');
    setPipelineStep(3);
    try {
      if (selectedCategory !== 'AGENTE_REGISTRO_LEGISLATIVO') {
        // Skip direct to end for non-legislative
        setPipelineStep(6);
        return;
      }
      const res = await api.runAgentComision(buildPayload());
      setComisionData(res.data);
      setPipelineStep(4);
    } catch (err) {
      setErrorMessage(err.message || 'Error en Asignación de Comisión');
      setPipelineStep(2);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEjecutarConstitucional = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const res = await api.runAgentConstitucional(buildPayload());
      setDictamenData(res.data);
      setPipelineStep(5);
    } catch (err) {
      setErrorMessage(err.message || 'Error en Verificación Constitucional');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEjecutarConsistencia = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const res = await api.runAgentConsistencia(buildPayload());
      setConsistenciaData(res.data);
      setPipelineStep(6);
    } catch (err) {
      setErrorMessage(err.message || 'Error en Consistencia Normativa');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmitPDF = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    
    try {
      const res = await api.emitPdf({
        sesion_id: fase1Data.sesion_id,
        datos_constitucionales: dictamenData || { valido: true },
        datos_consistencia: consistenciaData || {}
      });
      setPdfResult(res.data);
      setPipelineStep(7);
    } catch (err) {
      setErrorMessage(err.message || 'Error al emitir el reporte PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  // Fase Notificador Comisión (5to Agente)
  const handleNotificar = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const res = await api.runAgentNotificador({
        sesion_id: fase1Data.sesion_id,
        id_proyecto: fase1Data.id_proyecto || null,
        datos_comision: comisionData || {},
        datos_constitucionales: dictamenData || {},
        datos_consistencia: consistenciaData || {},
        pdf_filename: pdfResult?.filename || null,
        destinatario_extra: customEmail || null,
      });
      setNotificadorData(res.data);
      setShowEmailPreview(true);
      setPipelineStep(8);
    } catch (err) {
      setErrorMessage(err.message || 'Error en Agente Notificador');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDocumentText('');
    setDocumentName('');
    setUploadStats(null);
    setFase1Data(null);
    setComisionData(null);
    setDictamenData(null);
    setConsistenciaData(null);
    setPdfResult(null);
    setNotificadorData(null);
    setShowEmailPreview(false);
    setCustomEmail('');
    setPipelineStep(0);
    setErrorMessage('');
  };



  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-green">Mesa de Partes Virtual</span>
          <span className="badge badge-gold">Flujo Asistido con Control Humano</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Ingreso y Auditoría Automática de Documentos
        </h1>
        <p style={{ color: '#475569', fontSize: '1.02rem', maxWidth: '850px', lineHeight: 1.6 }}>
          Cargue proyectos de ley, solicitudes ciudadanas u oficios oficiales. El SMA clasificará el documento mediante{' '}
          <strong style={{ color: '#059669' }}>Agentes Inteligentes</strong>, verificará la conformidad constitucional contra la CPE y evaluará la consistencia normativa contra leyes vigentes.
        </p>
      </div>

      {/* Agents Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <RobotCard
          name="Agente de Interacción"
          role="Clasificación Institucional"
          level="Nivel 1"
          image="/robots/robot_distribuidor.jpg"
          isActive={pipelineStep === 1 || pipelineStep === 2}
          desc="Determina si el documento es legislativo, ciudadano o correspondencia."
          model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
          theme="cyan"
        />
        <RobotCard
          name="Comisión Legislativa"
          role="Asignación y Temática"
          level="Nivel 2"
          image="/robots/robot_legislativo.jpg"
          isActive={pipelineStep === 3}
          desc="Asigna la comisión parlamentaria competente según la materia de ley."
          model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
          theme="blue"
        />
        <RobotCard
          name="Verificador Constitucional"
          role="Auditoría contra CPE"
          level="Nivel 2"
          image="/robots/robot_constitucional.jpg"
          isActive={pipelineStep === 4}
          desc="Coteja artículos contra la Constitución Política del Estado."
          model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
          theme="green"
        />
        <RobotCard
          name="Consistencia Normativa"
          role="Similitud Semántica pgvector"
          level="Nivel 2"
          image="/robots/robot_ciudadano.jpg"
          isActive={pipelineStep === 5}
          desc="Detecta contradicciones o repeticiones contra leyes vigentes."
          model="nvidia/nemotron-3-embed-1b"
          theme="gold"
        />
        <RobotCard
          name="Emisor de Resultados"
          role="Redacción y PDF"
          level="Nivel 3"
          image="/robots/robot_distribuidor.jpg"
          isActive={pipelineStep === 6 && isProcessing}
          desc="Genera el reporte profesional en PDF con los resultados consolidados."
          model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
          theme="pink"
        />
        <RobotCard
          name="Notificador de Comisión"
          role="Correo HTML Institucional"
          level="Nivel 3"
          image="/robots/robot_legislativo.jpg"
          isActive={pipelineStep === 7 || pipelineStep === 8}
          desc="Redacta y despacha la comunicación oficial HTML a los miembros parlamentarios de la comisión."
          model="SMA/notificador-v1"
          theme="violet"
        />
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="glass-card" style={{
          padding: '16px 20px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#991b1b'
        }}>
          <AlertTriangle size={22} color="#dc2626" />
          <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600 }}>{errorMessage}</div>
          <button className="btn-secondary" onClick={() => setErrorMessage('')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Descartar
          </button>
        </div>
      )}

      {/* STEP 0: Upload & Input */}
      {pipelineStep === 0 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <button
              onClick={() => setInputMode('file')}
              className={inputMode === 'file' ? 'btn-primary' : 'btn-secondary'}
            >
              <UploadCloud size={18} />
              <span>Subir Archivo (PDF / DOCX)</span>
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}
            >
              <FileText size={18} />
              <span>Pegar Texto Directo</span>
            </button>
          </div>

          {inputMode === 'file' ? (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.doc,.txt"
                style={{ display: 'none' }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #94a3b8',
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.2s',
                  marginBottom: '20px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.background = '#f0fdf4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.background = '#f8fafc';
                }}
              >
                <UploadCloud size={48} color="#059669" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
                  {file ? file.name : 'Haz clic aquí para seleccionar tu archivo'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Soporta formatos PDF, DOCX o archivos de texto plano (.txt)
                </p>
              </div>

              {uploadStats && (
                <div style={{
                  display: 'flex',
                  gap: '20px',
                  background: '#f8fafc',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '24px',
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Páginas:</span>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.15rem' }}>{uploadStats.paginas}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Palabras:</span>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.15rem' }}>{uploadStats.palabras.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Caracteres:</span>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.15rem' }}>{uploadStats.caracteres.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Motor:</span>
                    <strong style={{ display: 'block', color: '#059669', fontSize: '1.15rem' }}>{uploadStats.motor}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontSize: '0.92rem', fontWeight: 600 }}>
                Contenido del Documento o Proyecto:
              </label>
              <textarea
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Pegue aquí el texto completo del proyecto de ley o solicitud..."
                rows={10}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '16px',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={handleIniciarFase1}
              disabled={isProcessing || !documentText.trim()}
              className="btn-primary"
              style={{ fontSize: '1rem', padding: '14px 28px' }}
            >
              {isProcessing ? (
                <>
                  <Cpu size={20} className="pulse-active" />
                  <span>Analizando con Agente Distribuidor...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Iniciar Clasificación (Fase 1)</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: Fase 1 Loading */}
      {pipelineStep === 1 && (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Cpu size={56} color="#34d399" className="pulse-active" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#ffffff', marginBottom: '8px' }}>
            Fase 1: Agente Distribuidor en Ejecución
          </h2>
          <p style={{ color: '#a7f3d0', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto' }}>
            Analizando la materia institucional, el petitorio y la estructura del documento para determinar la categoría correspondiente...
          </p>
        </div>
      )}

      {/* STEP 2: Control Humano / 🛑 Botón de Alto */}
      {pipelineStep === 2 && fase1Data && (
        <div className="glass-card" style={{ padding: '36px', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              background: 'rgba(251, 191, 36, 0.2)',
              border: '1px solid #fbbf24',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={22} color="#fbbf24" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: '#fbbf24', fontWeight: 800 }}>
                🛑 PUNTO DE CONTROL HUMANO (Alto del Pipeline)
              </h2>
              <p style={{ color: '#fef3c7', fontSize: '0.85rem' }}>
                El Agente Distribuidor ha emitido su recomendación. Puede confirmar la categoría sugerida o reasignarla manualmente antes de activar la Fase 2.
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(6, 40, 32, 0.8)',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '8px' }}>Categoría Sugerida por la IA:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span className="badge badge-green" style={{ fontSize: '1rem', padding: '6px 14px' }}>
                {fase1Data.categoria}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#6ee7b7' }}>
                → Agente Destino: <strong>{fase1Data.agente_destino_nombre}</strong>
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '8px' }}>
              Ajustar Categoría si es necesario:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {[
                { id: 'AGENTE_REGISTRO_LEGISLATIVO', label: '📜 Registro Legislativo (Proyecto de Ley)', icon: Scale },
                { id: 'AGENTE_ATENCION_CIUDADANA', label: '👥 Atención Ciudadana (Petición/Reclamo)', icon: Users },
                { id: 'AGENTE_GESTION_CORRESPONDENCIA', label: '✉️ Gestión de Correspondencia (Oficio)', icon: Mail },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSel = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: isSel ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.2)',
                      background: isSel ? 'rgba(16, 185, 129, 0.25)' : 'rgba(3, 20, 16, 0.5)',
                      color: isSel ? '#ffffff' : '#a7f3d0',
                      cursor: 'pointer',
                      fontWeight: isSel ? 700 : 500,
                      transition: 'all 0.2s',
                    }}
                  >
                    <Icon size={18} color={isSel ? '#34d399' : '#a7f3d0'} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn-secondary" onClick={handleReset}>
              <RotateCcw size={16} />
              <span>Cancelar y Reiniciar</span>
            </button>

            <button
              onClick={handleEjecutarComision}
              disabled={isProcessing}
              className="btn-primary"
              style={{ fontSize: '1rem', padding: '14px 28px' }}
            >
              <Check size={20} />
              <span>Confirmar y Ejecutar Comisión</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Fase Comisión Loading */}
      {pipelineStep === 3 && (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Sparkles size={56} color="#3b82f6" className="pulse-active" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#ffffff', marginBottom: '8px' }}>
            Agente de Comisión en Ejecución
          </h2>
          <p style={{ color: '#a7f3d0', fontSize: '0.95rem', maxWidth: '650px', margin: '0 auto 20px' }}>
            Asignando comisión parlamentaria...
          </p>
        </div>
      )}

      {/* STEP 4: Comisión Data & Action */}
      {pipelineStep === 4 && comisionData && (
        <div className="glass-card" style={{ padding: '32px', marginBottom: '24px', border: '1px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building2 size={36} color="#60a5fa" />
              <div>
                <h2 style={{ fontSize: '1.6rem', color: '#ffffff', fontWeight: 800 }}>Comisión Parlamentaria Asignada</h2>
              </div>
            </div>
            <button className="btn-secondary" onClick={handleReset}>
              <RotateCcw size={16} />
              <span>Nuevo Trámite</span>
            </button>
          </div>

          <div style={{
            background: 'rgba(29, 78, 216, 0.2)',
            padding: '20px',
            borderRadius: '14px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#bfdbfe', marginBottom: '4px' }}>Comisión Principal Recomendada:</div>
            <div style={{ fontSize: '1.4rem', color: '#60a5fa', fontWeight: 800, marginBottom: '6px' }}>
              {comisionData.comision_principal}
            </div>
            {comisionData.comision_secundaria && (
              <div style={{ fontSize: '0.9rem', color: '#bfdbfe' }}>
                Comisión Secundaria: <strong style={{ color: '#ffffff' }}>{comisionData.comision_secundaria}</strong>
              </div>
            )}
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <span className="badge badge-gold">Prioridad: {comisionData.prioridad || 'Media'}</span>
              <span className="badge badge-blue">Complejidad: {comisionData.complejidad || 'Media'}</span>
            </div>
          </div>

          {comisionData.resumen && (
            <div style={{
              background: 'rgba(3, 20, 16, 0.6)',
              padding: '20px',
              borderRadius: '14px',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: '24px',
            }}>
              <h3 style={{ fontSize: '1rem', color: '#34d399', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} />
                Resumen Ejecutivo
              </h3>
              <p style={{ color: '#f0fdf4', fontSize: '0.92rem', lineHeight: 1.6 }}>{comisionData.resumen}</p>
            </div>
          )}

          {/* Miembros de la Comisión Asignada desde sistema.miembro_comision */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '20px',
            borderRadius: '14px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '1.05rem', color: '#60a5fa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} />
              Miembros Parlamentarios Asignados (Destinatarios Oficiales)
            </h3>
            {comisionData.miembros && comisionData.miembros.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {comisionData.miembros.map((m, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.92rem' }}>{m.nombre_completo}</span>
                      <span className="badge badge-gold">{m.cargo}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Cámara: <strong style={{ color: '#cbd5e1' }}>{m.tipo_camara}</strong> {m.partido_politico ? `| ${m.partido_politico}` : ''}
                    </div>
                    {m.email && (
                      <div style={{ fontSize: '0.82rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} />
                        <span>{m.email}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.88rem', color: '#94a3b8', fontStyle: 'italic' }}>
                No hay parlamentarios registrados aún para esta comisión. Puedes agregarlos con sus correos Gmail desde la sección de configuración.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={handleEjecutarConstitucional}
              disabled={isProcessing}
              className="btn-primary"
              style={{ fontSize: '1.1rem', padding: '16px 32px', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
            >
              {isProcessing ? (
                <>
                  <Cpu size={22} className="pulse-active" />
                  <span>Ejecutando Agente Constitucional...</span>
                </>
              ) : (
                <>
                  <Check size={22} />
                  <span>Continuar: Verificación Constitucional</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Verificación Constitucional CPE */}
      {pipelineStep === 5 && dictamenData && (
        <div className="glass-card" style={{ padding: '0', marginBottom: '24px', border: dictamenData.valido ? '1px solid #10b981' : '1px solid #ef4444', borderRadius: '20px', overflow: 'hidden' }}>
          
          {/* Header de estado */}
          <div style={{
            background: dictamenData.valido
              ? 'linear-gradient(135deg, rgba(6,78,59,0.9), rgba(4,120,87,0.7))'
              : 'linear-gradient(135deg, rgba(127,29,29,0.9), rgba(185,28,28,0.7))',
            padding: '28px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '12px', display: 'flex' }}>
                <Scale size={36} color={dictamenData.valido ? '#34d399' : '#f87171'} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Agente Verificador Constitucional — CPE Bolivia 2009
                </div>
                <h2 style={{ fontSize: '1.5rem', color: '#ffffff', fontWeight: 800, margin: 0 }}>
                  {dictamenData.valido ? '✅ CONFORME CON LA CONSTITUCIÓN' : '⚠️ OBSERVACIONES CONSTITUCIONALES'}
                </h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: dictamenData.valido ? '#34d399' : '#fbbf24' }}>
                  {dictamenData.confianza || 95}%
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Confianza</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171' }}>
                  {dictamenData.num_contradicciones || dictamenData.contradicciones?.length || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Obs. CPE</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>
                  {(dictamenData.articulos_a_favor?.length || dictamenData.articulos_consultados?.length || 0)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Normas Revisadas</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '28px 32px' }}>
            
            {/* Severidad */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Severidad Máxima:</span>
              <span className={`badge ${
                dictamenData.severidad_maxima === 'bloqueante' ? 'badge-red' :
                dictamenData.severidad_maxima === 'grave' ? 'badge-gold' :
                dictamenData.severidad_maxima === 'leve' ? 'badge-blue' : 'badge-green'
              }`} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
                {dictamenData.severidad_maxima || 'ninguna'}
              </span>
            </div>

            {/* ── SECCIÓN A FAVOR ── */}
            {(() => {
              const aFavor = dictamenData.articulos_a_favor?.length > 0
                ? dictamenData.articulos_a_favor
                : (dictamenData.articulos_consultados || []);
              return aFavor.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(16,185,129,0.25)' }}>
                    <div style={{ width: '4px', height: '24px', background: '#10b981', borderRadius: '2px' }} />
                    <h3 style={{ fontSize: '1.05rem', color: '#34d399', margin: 0, fontWeight: 700 }}>
                      Artículos CPE — RESPALDO A FAVOR ({aFavor.length})
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                      Fuente: public.articulos_constitucion
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                    {aFavor.map((art, idx) => (
                      <div key={idx} style={{
                        background: 'rgba(6, 30, 20, 0.85)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '16px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: '#10b981', borderRadius: '12px 0 0 12px' }} />
                        <div style={{ paddingLeft: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.92rem' }}>
                              Art. {art.numero}
                            </span>
                            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>
                              A FAVOR
                            </span>
                          </div>
                          {art.titulo && (
                            <div style={{ color: '#a7f3d0', fontWeight: 600, fontSize: '0.82rem', marginBottom: '6px' }}>
                              {art.titulo}
                            </div>
                          )}
                          <div style={{ color: 'rgba(167,243,208,0.75)', fontSize: '0.8rem', lineHeight: 1.55, borderTop: '1px solid rgba(16,185,129,0.1)', paddingTop: '8px' }}>
                            {art.extracto || art.fundamento || 'Artículo de la CPE verificado como conforme.'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── SECCIÓN EN CONTRA ── */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ width: '4px', height: '24px', background: '#ef4444', borderRadius: '2px' }} />
                <h3 style={{ fontSize: '1.05rem', color: '#f87171', margin: 0, fontWeight: 700 }}>
                  Párrafos Observados — INFRINGEN LA CPE ({dictamenData.contradicciones?.length || 0})
                </h3>
              </div>

              {dictamenData.contradicciones?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {dictamenData.contradicciones.map((c, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(30, 5, 5, 0.8)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                    }}>
                      {/* Título de la observación */}
                      <div style={{ background: 'rgba(239,68,68,0.15)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <ShieldAlert size={18} color="#f87171" />
                          <span style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.92rem' }}>
                            OBSERVACIÓN #{idx + 1} — Párrafo del Proyecto: {c.articulo_proyecto}
                          </span>
                        </div>
                        <span className={`badge ${c.severidad === 'bloqueante' ? 'badge-red' : c.severidad === 'grave' ? 'badge-gold' : 'badge-blue'}`}>
                          {c.severidad || 'bloqueante'}
                        </span>
                      </div>
                      
                      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Fragmento del proyecto observado */}
                        {c.fragmento_proyecto && (
                          <div>
                            <div style={{ fontSize: '0.72rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontWeight: 600 }}>
                              📄 Texto del Proyecto que Genera la Contradicción:
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '8px', color: '#fed7aa', fontSize: '0.87rem', fontStyle: 'italic', lineHeight: 1.6, borderLeft: '3px solid #ef4444' }}>
                              "{c.fragmento_proyecto}"
                            </div>
                          </div>
                        )}

                        {/* Norma CPE infringida */}
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontWeight: 600 }}>
                            ⚖️ Norma Constitucional Infringida (CPE):
                          </div>
                          <div style={{ background: 'rgba(15, 30, 60, 0.7)', padding: '12px 16px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                            <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                              {c.articulo_constitucional}
                            </div>
                            {c.texto_constitucional_verificado && (
                              <div style={{ color: '#e2e8f0', fontSize: '0.84rem', lineHeight: 1.6 }}>
                                {c.texto_constitucional_verificado}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fundamentación jurídica */}
                        {c.fundamento && (
                          <div>
                            <div style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontWeight: 600 }}>
                              📋 Fundamentación Jurídica:
                            </div>
                            <div style={{ color: '#fef3c7', fontSize: '0.87rem', lineHeight: 1.65 }}>
                              {c.fundamento}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'rgba(6, 78, 59, 0.25)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <CheckCircle2 size={28} color="#34d399" />
                  <div>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.95rem' }}>
                      Sin contradicciones constitucionales detectadas
                    </div>
                    <div style={{ color: 'rgba(167,243,208,0.7)', fontSize: '0.83rem', marginTop: '4px' }}>
                      El proyecto es plenamente compatible con la Constitución Política del Estado.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botón continuar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button
                onClick={handleEjecutarConsistencia}
                disabled={isProcessing}
                className="btn-primary"
                style={{ fontSize: '1.05rem', padding: '14px 30px', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
              >
                {isProcessing ? (
                  <>
                    <Cpu size={20} className="pulse-active" />
                    <span>Ejecutando Agente de Consistencia...</span>
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    <span>Continuar: Consistencia Normativa</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: Consistencia Normativa */}
      {pipelineStep === 6 && (
        <div className="glass-card" style={{ padding: '0', marginBottom: '24px', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '20px', overflow: 'hidden' }}>
          
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,27,8,0.95), rgba(60,50,5,0.8))',
            padding: '28px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
            borderBottom: '1px solid rgba(251,191,36,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '12px', display: 'flex' }}>
                <BookOpen size={36} color="#fbbf24" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Agente de Consistencia Normativa — Leyes Vigentes Bolivia
                </div>
                <h2 style={{ fontSize: '1.5rem', color: '#ffffff', fontWeight: 800, margin: 0 }}>
                  Auditoría contra el Ordenamiento Legal Vigente
                </h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24' }}>
                  {consistenciaData?.total_hallazgos || consistenciaData?.analisis?.length || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Hallazgos</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color:
                  consistenciaData?.nivel_riesgo_global === 'ALTO' ? '#ef4444' :
                  consistenciaData?.nivel_riesgo_global === 'MEDIO' ? '#f59e0b' :
                  '#34d399'
                }}>
                  {consistenciaData?.nivel_riesgo_global || 'OK'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Riesgo Global</div>
              </div>
              {consistenciaData?.posibles_derogaciones_tacitas > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.15)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171' }}>
                    {consistenciaData.posibles_derogaciones_tacitas}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#fca5a5', textTransform: 'uppercase' }}>Derogaciones Tácitas</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '28px 32px' }}>

            {/* Resumen por tipo */}
            {consistenciaData?.resumen_por_tipo && Object.keys(consistenciaData.resumen_por_tipo).length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '28px', padding: '16px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.15)' }}>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', alignSelf: 'center', marginRight: '4px' }}>Clasificación:</span>
                {Object.entries(consistenciaData.resumen_por_tipo).map(([tipo, count]) => (
                  <span key={tipo} style={{
                    padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                    background: tipo === 'contradiccion' ? 'rgba(239,68,68,0.2)' : tipo === 'repeticion' ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                    color: tipo === 'contradiccion' ? '#f87171' : tipo === 'repeticion' ? '#fbbf24' : '#34d399',
                    border: `1px solid ${tipo === 'contradiccion' ? 'rgba(239,68,68,0.3)' : tipo === 'repeticion' ? 'rgba(251,191,36,0.25)' : 'rgba(16,185,129,0.25)'}`,
                  }}>
                    {tipo.replace('_', ' ').toUpperCase()}: {count}
                  </span>
                ))}
              </div>
            )}

            {/* Hallazgos detallados */}
            {consistenciaData?.analisis?.length > 0 ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '10px', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                  <div style={{ width: '4px', height: '24px', background: '#fbbf24', borderRadius: '2px' }} />
                  <h3 style={{ fontSize: '1.05rem', color: '#fbbf24', margin: 0, fontWeight: 700 }}>
                    Hallazgos con Leyes Vigentes ({consistenciaData.analisis.length})
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                    Fuente: public.articulos_normativos
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {consistenciaData.analisis.map((item, idx) => {
                    const esContradiccion = item.tipo_relacion === 'contradiccion';
                    const esRepeticion = item.tipo_relacion === 'repeticion';
                    const borde = esContradiccion ? '#ef4444' : esRepeticion ? '#f59e0b' : '#10b981';
                    const bgCard = esContradiccion ? 'rgba(30,5,5,0.75)' : esRepeticion ? 'rgba(30,20,0,0.75)' : 'rgba(4,20,14,0.75)';
                    const badgeClass = esContradiccion ? 'badge-red' : esRepeticion ? 'badge-gold' : 'badge-green';
                    return (
                      <div key={idx} style={{
                        background: bgCard,
                        border: `1px solid ${borde}40`,
                        borderRadius: '14px',
                        overflow: 'hidden',
                      }}>
                        {/* Header del hallazgo */}
                        <div style={{ background: `${borde}18`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${borde}25` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: borde, fontWeight: 700, fontSize: '0.9rem' }}>
                              📜 {item.norma}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                              Art. {item.numero_articulo}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {item.derogacion_tacita && (
                              <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>
                                DEROGACIÓN TÁCITA
                              </span>
                            )}
                            {item.conflicto_especialidad && (
                              <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>
                                CONFLICTO ESPECIALIDAD
                              </span>
                            )}
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.78rem' }}>
                              {item.tipo_relacion?.replace('_', ' ')?.toUpperCase()}
                            </span>
                            <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {Math.round(item.similitud * 100)}% similitud
                            </span>
                          </div>
                        </div>

                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Artículo del proyecto */}
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px', fontWeight: 600 }}>
                              Artículo del Proyecto Analizado:
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                              {item.articulo_proyecto || '(Documento completo)'}
                            </div>
                          </div>

                          {/* Justificación */}
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px', fontWeight: 600 }}>
                              Análisis Jurídico:
                            </div>
                            <div style={{ color: '#fef3c7', fontSize: '0.86rem', lineHeight: 1.65 }}>
                              {item.justificacion}
                            </div>
                          </div>

                          {/* Sugerencia */}
                          {item.sugerencia && (
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '1rem' }}>💡</span>
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recomendación: </span>
                                <span style={{ color: '#e0f2fe', fontSize: '0.84rem' }}>{item.sugerencia}</span>
                              </div>
                            </div>
                          )}

                          {/* Nivel de riesgo individual */}
                          {item.riesgo && item.riesgo !== 'ninguno' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: '20px',
                                background: item.riesgo === 'alto' ? 'rgba(239,68,68,0.15)' : item.riesgo === 'medio' ? 'rgba(251,191,36,0.12)' : 'rgba(16,185,129,0.1)',
                                color: item.riesgo === 'alto' ? '#f87171' : item.riesgo === 'medio' ? '#fbbf24' : '#34d399',
                                border: `1px solid ${item.riesgo === 'alto' ? 'rgba(239,68,68,0.3)' : item.riesgo === 'medio' ? 'rgba(251,191,36,0.25)' : 'rgba(16,185,129,0.2)'}`,
                              }}>
                                Riesgo {item.riesgo.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(6, 30, 10, 0.5)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <CheckCircle2 size={32} color="#34d399" />
                <div>
                  <div style={{ color: '#34d399', fontWeight: 700, fontSize: '1rem' }}>
                    Sin incompatibilidades normativas graves detectadas
                  </div>
                  <div style={{ color: 'rgba(167,243,208,0.65)', fontSize: '0.84rem', marginTop: '4px' }}>
                    {selectedCategory !== 'AGENTE_REGISTRO_LEGISLATIVO'
                      ? 'No aplica verificación normativa para esta categoría de documento.'
                      : 'El corpus normativo vigente no registra conflictos con el proyecto analizado.'}
                  </div>
                </div>
              </div>
            )}

            {/* Botón PDF */}
            {selectedCategory === 'AGENTE_REGISTRO_LEGISLATIVO' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
                <button
                  onClick={handleEmitPDF}
                  disabled={isProcessing}
                  className="btn-primary"
                  style={{ fontSize: '1.05rem', padding: '14px 30px', background: 'linear-gradient(135deg, #f472b6, #db2777)', boxShadow: '0 4px 14px rgba(219,39,119,0.4)' }}
                >
                  {isProcessing ? (
                    <>
                      <Cpu size={20} className="pulse-active" />
                      <span>Generando Informe PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck size={20} />
                      <span>Generar Informe de Auditoría PDF</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}




      {/* STEP 7: Resultado Final PDF → botón Notificar */}
      {pipelineStep === 7 && pdfResult && (
        <div className="glass-card float-in" style={{ padding: '40px', border: '1px solid #f472b6', textAlign: 'center' }}>
           <FileCheck size={64} color="#f472b6" style={{ margin: '0 auto 20px' }} />
           <h2 style={{ fontSize: '1.8rem', color: '#ffffff', fontWeight: 800, marginBottom: '16px' }}>
              Informe Consolidado Generado
           </h2>
           <p style={{ color: '#fbcfe8', fontSize: '1.05rem', maxWidth: '700px', margin: '0 auto 32px' }}>
              El Agente Emisor ha generado el dictamen técnico-jurídico formal. Ahora puede notificar a los miembros de la comisión.
           </p>
           
           <div style={{ maxWidth: '480px', margin: '0 auto 24px auto' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#7dd3fc', fontWeight: 600, marginBottom: '8px' }}>
                ✉️ Enviar copia directa a correo / Gmail (Opcional):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="ejemplo: tu_correo@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(14, 22, 42, 0.9)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
           </div>
           
           <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <a 
                href={`http://127.0.0.1:8085/uploaded_files/informes/${pdfResult.filename}`}
                target="_blank" 
                rel="noreferrer"
                className="btn-primary"
                style={{ fontSize: '1rem', padding: '13px 24px', background: '#3b82f6', textDecoration: 'none' }}
              >
                <Download size={20} />
                <span>Descargar PDF</span>
              </a>
              <button
                onClick={handleNotificar}
                disabled={isProcessing}
                className="btn-primary"
                style={{ fontSize: '1rem', padding: '13px 26px', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', boxShadow: '0 4px 18px rgba(56,189,248,0.4)' }}
              >
                {isProcessing ? (
                  <><Cpu size={20} className="pulse-active" /><span>Redactando y Enviando...</span></>
                ) : (
                  <><Mail size={20} /><span>Notificar a Comisión (5to Agente)</span><ArrowRight size={18} /></>
                )}
              </button>
              <button className="btn-secondary" onClick={handleReset} style={{ fontSize: '1rem', padding: '13px 24px' }}>
                <RotateCcw size={20} />
                <span>Nuevo Análisis</span>
              </button>
           </div>
        </div>
      )}

      {/* STEP 8: Notificador — Vista Previa Correo HTML Institucional */}
      {pipelineStep === 8 && notificadorData && (
        <div className="glass-card float-in" style={{ padding: '0', marginBottom: '24px', border: '1px solid rgba(56,189,248,0.5)', borderRadius: '20px', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(3,30,60,0.97), rgba(7,50,90,0.9))',
            padding: '26px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
            borderBottom: '1px solid rgba(56,189,248,0.22)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(56,189,248,0.15)', borderRadius: '50%', padding: '12px', display: 'flex', boxShadow: '0 0 20px rgba(56,189,248,0.25)' }}>
                <Mail size={34} color="#38bdf8" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Agente Notificador — Despacho Institucional Completado
                </div>
                <h2 style={{ fontSize: '1.45rem', color: '#ffffff', fontWeight: 800, margin: 0 }}>
                  📨 Correo HTML Formal Generado
                </h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(0,0,0,0.35)', padding: '10px 16px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
                  {notificadorData.total_destinatarios || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Destinatarios</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.35)', padding: '10px 16px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>✅ PROCESADO</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Estado</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '28px 32px' }}>

            {/* Metadatos del despacho */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div className="process-step completed">
                <div className="process-step-number">✓</div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Comisión Notificada</div>
                  <div style={{ fontWeight: 700, color: '#e8edf5', fontSize: '0.95rem', marginTop: '2px' }}>
                    {notificadorData.comision || 'Comisión Legislativa'}
                  </div>
                </div>
              </div>
              <div className="process-step completed">
                <div className="process-step-number">✓</div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Asunto del Correo</div>
                  <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.84rem', marginTop: '2px', lineHeight: 1.4 }}>
                    {notificadorData.asunto}
                  </div>
                </div>
              </div>
              <div className="process-step completed">
                <div className="process-step-number">✓</div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fecha de Despacho</div>
                  <div style={{ fontWeight: 700, color: '#e8edf5', fontSize: '0.9rem', marginTop: '2px' }}>
                    {notificadorData.fecha_despacho ? new Date(notificadorData.fecha_despacho).toLocaleString('es-BO') : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Destinatarios */}
            {notificadorData.miembros_notificados?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  👥 Miembros Destinatarios
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {notificadorData.miembros_notificados.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: 'rgba(14,19,32,0.85)', padding: '8px 14px', borderRadius: '10px',
                      border: '1px solid rgba(56,189,248,0.22)'
                    }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>
                        👤
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e8edf5' }}>{m.nombre_completo}</div>
                        <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{m.cargo} · {m.tipo_camara}</div>
                        {m.email && <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{m.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vista previa del correo HTML */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  📧 Vista Previa del Correo HTML Institucional
                </div>
                <button
                  onClick={() => setShowEmailPreview(v => !v)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  {showEmailPreview ? 'Ocultar Vista Previa' : 'Mostrar Vista Previa'}
                </button>
              </div>
              {showEmailPreview && notificadorData.html_preview && (
                <div className="email-preview-frame" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <iframe
                    srcDoc={notificadorData.html_preview}
                    title="Vista previa del correo institucional"
                    style={{ width: '100%', height: '580px', border: 'none', display: 'block' }}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>

            {/* Acciones finales */}
            <div className="glow-divider" />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {pdfResult?.filename && (
                <a
                  href={`http://127.0.0.1:8085/uploaded_files/informes/${pdfResult.filename}`}
                  target="_blank" rel="noreferrer"
                  className="btn-primary"
                  style={{ fontSize: '1rem', padding: '13px 24px', background: '#3b82f6', textDecoration: 'none' }}
                >
                  <Download size={20} />
                  <span>Descargar PDF</span>
                </a>
              )}
              {onNavigateExpedientes && (
                <button className="btn-primary" onClick={onNavigateExpedientes}
                  style={{ fontSize: '1rem', padding: '13px 24px', background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  <ExternalLink size={20} />
                  <span>Ver Expedientes</span>
                </button>
              )}
              <button className="btn-secondary" onClick={handleReset} style={{ fontSize: '1rem', padding: '13px 24px' }}>
                <RotateCcw size={20} />
                <span>Nuevo Análisis</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
