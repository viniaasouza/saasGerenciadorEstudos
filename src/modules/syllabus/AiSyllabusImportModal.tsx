import React, { useState } from 'react';
import { db } from '../../db/database';
import { generateStudyCycle } from '../cycle/cycleGenerator';
import { AI_SYLLABUS_PROMPT } from '../landing/LandingPage';
import { sanitizeString, extractAndParseJson } from '../../lib/security';
import { parseSyllabusWithOpenLLM, parseSyllabusFallback } from '../../services/aiSyllabusService';
import type { Subject, CicloWorkspace, ConcursoInfo, Topic, Subtopic } from '../../types';
import { 
  X, Bot, Copy, Check, Upload, CheckCircle2, AlertCircle, 
  Sparkles, Loader2, FileText
} from 'lucide-react';

export interface AiSyllabusImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated: (workspaceId: string) => void;
  activeWorkspaceId?: string;
}

interface ParsedSyllabusData {
  concursoInfo?: {
    concurso?: string;
    cargo?: string;
    banca?: string;
    dataProva?: string;
  };
  subjects: any[];
  source?: string;
}

export const AiSyllabusImportModal: React.FC<AiSyllabusImportModalProps> = ({
  isOpen,
  onClose,
  onWorkspaceCreated,
  activeWorkspaceId,
}) => {
  const [activeTab, setActiveTab] = useState<'ai_text' | 'json_paste'>('ai_text');
  
  // Direct AI text input states
  const [rawSyllabusText, setRawSyllabusText] = useState('');
  const [targetWeeklyHours, setTargetWeeklyHours] = useState<number>(20);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<string>('');

  // JSON paste states
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');

  // Shared parsed state
  const [parsedData, setParsedData] = useState<ParsedSyllabusData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Merge strategy
  const currentWorkspaces = db.getWorkspaces();
  const currentWsId = activeWorkspaceId || db.getActiveWorkspaceId() || (currentWorkspaces[0]?.id);
  const currentWorkspace = currentWorkspaces.find((w) => w.id === currentWsId);
  const hasExistingSubjects = currentWsId ? db.getSubjects(currentWsId).length > 0 : false;
  const [importMode, setImportMode] = useState<'merge' | 'new'>(hasExistingSubjects ? 'merge' : 'new');

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_SYLLABUS_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleRunAiAnalysis = async () => {
    const trimmed = rawSyllabusText.trim();
    if (!trimmed) {
      setParseError('Por favor, cole o texto do edital para que a IA possa analisá-lo.');
      return;
    }

    setParseError(null);
    setIsAnalyzingAi(true);
    setAiAnalysisStatus('Analisando edital com IA...');

    try {
      const result = await parseSyllabusWithOpenLLM(trimmed);
      if (!result.subjects || result.subjects.length === 0) {
        throw new Error('Nenhuma disciplina identificada no texto fornecido.');
      }

      setParsedData({
        concursoInfo: result.concursoInfo,
        subjects: result.subjects,
        source: result.source,
      });
      setAiAnalysisStatus('');
    } catch (err: any) {
      console.warn('Erro na análise por LLM, tentando fallback local...', err);
      try {
        const fallbackRes = parseSyllabusFallback(trimmed);
        setParsedData({
          concursoInfo: fallbackRes.concursoInfo,
          subjects: fallbackRes.subjects,
          source: 'fallback',
        });
        setAiAnalysisStatus('');
      } catch (fbErr: any) {
        setParseError(fbErr?.message || err?.message || 'Erro ao processar edital com IA.');
      }
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleValidateJson = (text: string) => {
    setRawJsonText(text);
    setParseError(null);
    setParsedData(null);

    const trimmed = text.trim();
    if (!trimmed) return;

    const result = extractAndParseJson<any>(trimmed);
    if (!result.success || !result.data) {
      setParseError(result.error || 'Erro ao processar JSON.');
      return;
    }

    const parsed = result.data;
    if (!parsed || typeof parsed !== 'object') {
      setParseError('O JSON fornecido deve ser um objeto estruturado.');
      return;
    }

    // Check for subjects array
    const rawSubjects = Array.isArray(parsed.subjects)
      ? parsed.subjects
      : Array.isArray(parsed.disciplinas)
      ? parsed.disciplinas
      : parsed.edital && Array.isArray(parsed.edital.subjects)
      ? parsed.edital.subjects
      : Array.isArray(parsed)
      ? parsed
      : null;

    if (!rawSubjects || rawSubjects.length === 0) {
      setParseError('Nenhuma matéria encontrada. Certifique-se de que há uma lista "subjects" ou "disciplinas" com ao menos 1 disciplina.');
      return;
    }

    const info = parsed.concursoInfo || parsed.concurso_info || parsed.edital?.concursoInfo || {};

    setParsedData({
      concursoInfo: info,
      subjects: rawSubjects,
      source: 'json',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleValidateJson(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteImport = () => {
    if (!parsedData || !parsedData.subjects || parsedData.subjects.length === 0) return;
    setIsImporting(true);

    try {
      const timestamp = Date.now();
      const existingWsList = db.getWorkspaces();
      const concursoName = parsedData.concursoInfo?.concurso?.trim() || 'Novo Concurso';
      const cargoName = parsedData.concursoInfo?.cargo?.trim() || 'Geral';
      const workspaceTitle = cargoName !== 'Geral' ? `${concursoName} (${cargoName})` : concursoName;

      let targetWsId = '';

      if (importMode === 'merge' && currentWsId) {
        targetWsId = currentWsId;
      } else {
        targetWsId = `workspace-${timestamp}`;
        const newWs: CicloWorkspace = {
          id: targetWsId,
          name: sanitizeString(workspaceTitle),
          createdAt: new Date().toISOString(),
        };
        db.saveWorkspaces([...existingWsList, newWs]);
      }

      // Format incoming subjects
      const incomingFormatted: Subject[] = parsedData.subjects.map((s, sIdx) => {
        const subId = `sub-${timestamp}-${sIdx + 1}`;
        const subName = sanitizeString(s.name || s.disciplina || s.materia || s.titulo || `Disciplina ${sIdx + 1}`);
        const rawWeight = s.weight ?? s.peso;
        const weight = typeof rawWeight === 'number' && rawWeight >= 1 && rawWeight <= 5 ? rawWeight : 3;
        const status = s.status === 'backlog' || s.status === 'maintenance' ? s.status : 'active';

        const rawTopics = Array.isArray(s.topics)
          ? s.topics
          : Array.isArray(s.topicos)
          ? s.topicos
          : Array.isArray(s.conteudo)
          ? s.conteudo
          : [];

        const formattedTopics: Topic[] = rawTopics.map((t: any, tIdx: number) => {
          const topId = `top-${timestamp}-${sIdx + 1}-${tIdx + 1}`;
          const isTopicString = typeof t === 'string';
          const topName = sanitizeString(isTopicString ? t : (t.name || t.topico || t.titulo || t.nome || `Tópico ${tIdx + 1}`));

          const rawSubtopics = !isTopicString && Array.isArray(t.subtopics)
            ? t.subtopics
            : !isTopicString && Array.isArray(t.subtopicos)
            ? t.subtopicos
            : !isTopicString && Array.isArray(t.itens)
            ? t.itens
            : [];

          const formattedSubtopics: Subtopic[] = rawSubtopics.map((st: any, stIdx: number) => {
            const stId = `st-${timestamp}-${sIdx + 1}-${tIdx + 1}-${stIdx + 1}`;
            const isSubString = typeof st === 'string';
            const stName = sanitizeString(isSubString ? st : (st.name || st.subtopico || st.item || st.titulo || st.nome || `Item ${stIdx + 1}`));
            return {
              id: stId,
              name: stName,
              completed: false,
            };
          });

          if (formattedSubtopics.length === 0) {
            formattedSubtopics.push({
              id: `st-${timestamp}-${sIdx + 1}-${tIdx + 1}-1`,
              name: topName,
              completed: false,
            });
          }

          return {
            id: topId,
            name: topName,
            subtopics: formattedSubtopics,
          };
        });

        if (formattedTopics.length === 0) {
          formattedTopics.push({
            id: `top-${timestamp}-${sIdx + 1}-1`,
            name: subName,
            subtopics: [{ id: `st-${timestamp}-${sIdx + 1}-1-1`, name: subName, completed: false }],
          });
        }

        return {
          id: subId,
          name: subName,
          weight,
          targetHours: 0,
          status,
          topics: formattedTopics,
        };
      });

      // NON-DESTRUCTIVE MERGE LOGIC
      let finalSubjects: Subject[] = [];

      if (importMode === 'merge' && currentWsId) {
        const existingSubjects = db.getSubjects(targetWsId);
        finalSubjects = [...existingSubjects];

        for (const incSub of incomingFormatted) {
          const existingMatch = finalSubjects.find(
            (s) => s.name.trim().toLowerCase() === incSub.name.trim().toLowerCase()
          );

          if (!existingMatch) {
            finalSubjects.push(incSub);
          } else {
            // Merge topics and subtopics non-destructively
            const mergedTopics: Topic[] = [...existingMatch.topics];
            for (const incTop of incSub.topics) {
              const existingTop = mergedTopics.find(
                (t) => t.name.trim().toLowerCase() === incTop.name.trim().toLowerCase()
              );
              if (!existingTop) {
                mergedTopics.push(incTop);
              } else {
                // Merge subtopics
                const existingSubtopics = [...existingTop.subtopics];
                for (const incSt of incTop.subtopics) {
                  const hasSt = existingSubtopics.some(
                    (st) => st.name.trim().toLowerCase() === incSt.name.trim().toLowerCase()
                  );
                  if (!hasSt) {
                    existingSubtopics.push(incSt);
                  }
                }
                existingTop.subtopics = existingSubtopics;
              }
            }
            existingMatch.topics = mergedTopics;
          }
        }
      } else {
        finalSubjects = incomingFormatted;
      }

      db.saveSubjects(targetWsId, finalSubjects);

      // Save Concurso Info if not already set or if empty
      const existingInfo = db.getConcursoInfo(targetWsId);
      if (!existingInfo || !existingInfo.concurso) {
        const info: ConcursoInfo = {
          concurso: sanitizeString(concursoName),
          cargo: sanitizeString(cargoName),
          banca: sanitizeString(parsedData.concursoInfo?.banca?.trim() || 'A Definir'),
          dataProva: parsedData.concursoInfo?.dataProva?.trim() || '',
        };
        db.saveConcursoInfo(targetWsId, info);
      }

      // Generate or update initial study cycle blocks based on target weekly hours
      const cycleBlocks = generateStudyCycle(finalSubjects, targetWeeklyHours, 90);
      db.saveCycleBlocks(targetWsId, cycleBlocks);

      // Set active workspace
      db.setActiveWorkspaceId(targetWsId);
      onWorkspaceCreated(targetWsId);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const totalTopics = parsedData?.subjects?.reduce((acc: number, s: any) => {
    const tList = s?.topics || s?.topicos || s?.conteudo || [];
    return acc + (Array.isArray(tList) ? tList.length : 0);
  }, 0) || 0;

  const totalSubtopics = parsedData?.subjects?.reduce((acc: number, s: any) => {
    const tList = s?.topics || s?.topicos || s?.conteudo || [];
    if (!Array.isArray(tList)) return acc;
    const subCount = tList.reduce((tAcc: number, t: any) => {
      if (typeof t === 'string') return tAcc + 1;
      const stList = t?.subtopics || t?.subtopicos || t?.itens || [];
      return tAcc + (Array.isArray(stList) ? Math.max(stList.length, 1) : 1);
    }, 0);
    return acc + subCount;
  }, 0) || 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card-primary app-modal-card"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '20px',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="modal-close-btn"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
          }}
          title="Fechar"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', paddingRight: '48px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
              flexShrink: 0,
            }}
          >
            <Bot size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', margin: 0 }}>
              Importar Edital Verticalizado com IA
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Estruturação automática em matérias, tópicos e pesos em segundos.
            </p>
          </div>
        </div>

        {/* Mode Switch Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('ai_text')}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: activeTab === 'ai_text' ? 'var(--color-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'ai_text' ? '2px solid var(--color-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={16} />
            <span>⚡ Analisar Texto com IA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json_paste')}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: activeTab === 'json_paste' ? 'var(--color-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'json_paste' ? '2px solid var(--color-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={16} />
            <span>📋 Colar JSON / Upload</span>
          </button>
        </div>

        {/* TAB 1: Direct AI Syllabus Analysis */}
        {activeTab === 'ai_text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Conteúdo Programático do Edital
              </label>
              <textarea
                rows={7}
                value={rawSyllabusText}
                onChange={(e) => setRawSyllabusText(e.target.value)}
                placeholder="Cole aqui o texto do seu edital (disciplinas, tópicos e subtópicos). A IA identificará a hierarquia e pesos automaticamente..."
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Target Weekly Hours Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '0.75rem 1rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Meta de Horas Semanais no Ciclo:</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Distribui proporcionalmente pelos pesos das disciplinas</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[15, 20, 25, 30, 40].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setTargetWeeklyHours(h)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: targetWeeklyHours === h ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)',
                      backgroundColor: targetWeeklyHours === h ? 'var(--color-primary-glow)' : 'var(--bg-element)',
                      color: targetWeeklyHours === h ? 'var(--color-primary)' : 'var(--text-main)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {h}h/sem
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isAnalyzingAi || !rawSyllabusText.trim()}
              onClick={handleRunAiAnalysis}
              className="mock-btn"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.925rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isAnalyzingAi || !rawSyllabusText.trim() ? 0.6 : 1,
                cursor: isAnalyzingAi || !rawSyllabusText.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isAnalyzingAi ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>{aiAnalysisStatus || 'Analisando edital com IA...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>⚡ Analisar Edital com IA</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* TAB 2: JSON Code Paste & Upload */}
        {activeTab === 'json_paste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Step 1 Prompt Copy */}
            <div style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    1
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                    Copie o Prompt Especializado
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="mock-btn"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedPrompt ? 'Copiado!' : 'Copiar Prompt'}</span>
                </button>
              </div>
            </div>

            {/* Step 2 JSON Paste / Upload */}
            <div style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    2
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                    Cole aqui o JSON gerado ou Faça Upload
                  </span>
                </div>

                <label
                  className="mock-btn text-muted"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                  <Upload size={12} />
                  <span>Upload .JSON</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <textarea
                rows={6}
                value={rawJsonText}
                onChange={(e) => handleValidateJson(e.target.value)}
                placeholder="Cole o código JSON gerado pela IA aqui..."
                className="input-field"
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {parseError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ef4444',
              fontSize: '0.825rem',
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <AlertCircle size={16} />
            <span>{parseError}</span>
          </div>
        )}

        {/* Success Preview & Non-Destructive Options */}
        {parsedData && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1.5px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 700 }}>
              <CheckCircle2 size={18} />
              <span>Edital Reconhecido com Sucesso!</span>
            </div>

            <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
              <strong>Concurso:</strong> {parsedData.concursoInfo?.concurso || 'Não especificado'} •{' '}
              <strong>Cargo:</strong> {parsedData.concursoInfo?.cargo || 'Geral'} •{' '}
              <strong>Banca:</strong> {parsedData.concursoInfo?.banca || 'FCC'}
            </div>

            <div style={{ color: 'var(--text-muted)' }}>
              {parsedData.subjects.length} disciplinas identificadas • {totalTopics} tópicos • {totalSubtopics} subtópicos atômicos
            </div>

            {/* Non-destructive Merge Option */}
            {hasExistingSubjects && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(34, 197, 94, 0.3)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Estratégia de Importação (Garantia Zero Data Loss):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="checkbox-row" style={{ fontSize: '0.825rem' }}>
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                    />
                    <span>
                      <strong>Mesclar no Ciclo Atual ({currentWorkspace?.name || 'Meu Ciclo'})</strong> — Adiciona novas matérias/tópicos sem apagar horas ou histórico já estudados.
                    </span>
                  </label>
                  <label className="checkbox-row" style={{ fontSize: '0.825rem' }}>
                    <input
                      type="radio"
                      name="importMode"
                      value="new"
                      checked={importMode === 'new'}
                      onChange={() => setImportMode('new')}
                    />
                    <span>
                      <strong>Criar Novo Ciclo Separado</strong> — Cria um novo workspace mantendo o ciclo atual intacto.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            className="mock-btn text-muted"
            style={{ fontSize: '0.85rem', padding: '0.65rem 1.25rem' }}
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!parsedData || isImporting}
            onClick={handleExecuteImport}
            className="mock-btn"
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              padding: '0.65rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: !parsedData || isImporting ? 0.6 : 1,
              cursor: !parsedData || isImporting ? 'not-allowed' : 'pointer',
            }}
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Importando...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{importMode === 'merge' ? 'Mesclar no Ciclo & Salvar' : 'Criar Ciclo & Importar Edital'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
