import React, { useState } from 'react';
import { db } from '../../db/database';
import { generateStudyCycle } from '../cycle/cycleGenerator';
import { TCE_GO_SUBJECTS_PRESET, TCE_GO_CONCURSO_INFO } from '../../data/tceGoPreset';
import { AI_SYLLABUS_PROMPT } from '../landing/LandingPage';
import { sanitizeString, extractAndParseJson } from '../../lib/security';
import type { Subject, CicloWorkspace, ConcursoInfo, Topic, Subtopic } from '../../types';
import { 
  X, Bot, Copy, Check, Upload, CheckCircle2, AlertCircle, 
  Sparkles, RefreshCw 
} from 'lucide-react';

interface AiSyllabusImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated: (workspaceId: string) => void;
}

interface ParsedSyllabusData {
  concursoInfo?: {
    concurso?: string;
    cargo?: string;
    banca?: string;
    dataProva?: string;
  };
  subjects: any[];
}

export const AiSyllabusImportModal: React.FC<AiSyllabusImportModalProps> = ({
  isOpen,
  onClose,
  onWorkspaceCreated,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedSyllabusData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_SYLLABUS_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
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

    // Check for subjects array (supports subjects, disciplinas, edital.subjects, or array at root)
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
    if (!parsedData) return;
    setIsImporting(true);

    try {
      const timestamp = Date.now();
      const wsId = `workspace-${timestamp}`;
      const concursoName = parsedData.concursoInfo?.concurso?.trim() || 'Novo Concurso';
      const cargoName = parsedData.concursoInfo?.cargo?.trim() || 'Geral';
      const workspaceTitle = cargoName !== 'Geral' ? `${concursoName} (${cargoName})` : concursoName;

      // 1. Create or update Workspace
      const existingWsList = db.getWorkspaces();
      let targetWsId = wsId;

      if (existingWsList.length === 1 && db.getSubjects(existingWsList[0].id).length === 0) {
        targetWsId = existingWsList[0].id;
        const updatedWsList: CicloWorkspace[] = [
          {
            ...existingWsList[0],
            name: sanitizeString(workspaceTitle),
          },
        ];
        db.saveWorkspaces(updatedWsList);
      } else {
        const newWs: CicloWorkspace = {
          id: targetWsId,
          name: sanitizeString(workspaceTitle),
          createdAt: new Date().toISOString(),
        };
        db.saveWorkspaces([...existingWsList, newWs]);
      }

      // 2. Format Subjects with IDs & Subtopics
      const formattedSubjects: Subject[] = parsedData.subjects.map((s, sIdx) => {
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

          // Fallback if topic had no subtopics: create 1 default subtopic
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

        return {
          id: subId,
          name: subName,
          weight,
          targetHours: 0,
          status,
          topics: formattedTopics,
        };
      });

      db.saveSubjects(targetWsId, formattedSubjects);

      // 3. Save Concurso Info
      const info: ConcursoInfo = {
        concurso: sanitizeString(concursoName),
        cargo: sanitizeString(cargoName),
        banca: sanitizeString(parsedData.concursoInfo?.banca?.trim() || 'A Definir'),
        dataProva: parsedData.concursoInfo?.dataProva?.trim() || '2027-01-17',
      };
      db.saveConcursoInfo(targetWsId, info);

      // 4. Generate initial study cycle blocks
      const cycleBlocks = generateStudyCycle(formattedSubjects, 20, 90);
      db.saveCycleBlocks(targetWsId, cycleBlocks);

      // Set active workspace
      db.setActiveWorkspaceId(targetWsId);
      onWorkspaceCreated(targetWsId);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadDemoModel = () => {
    const timestamp = Date.now();
    const existingWsList = db.getWorkspaces();
    let wsId = `workspace-${timestamp}`;

    if (existingWsList.length === 1 && db.getSubjects(existingWsList[0].id).length === 0) {
      wsId = existingWsList[0].id;
      db.saveWorkspaces([{ ...existingWsList[0], name: 'TCE-GO (Analista TI - Demo)' }]);
    } else {
      const newWs: CicloWorkspace = {
        id: wsId,
        name: 'TCE-GO (Analista TI - Demo)',
        createdAt: new Date().toISOString(),
      };
      db.saveWorkspaces([...existingWsList, newWs]);
    }

    db.saveSubjects(wsId, TCE_GO_SUBJECTS_PRESET);
    db.saveConcursoInfo(wsId, TCE_GO_CONCURSO_INFO);
    const blocks = generateStudyCycle(TCE_GO_SUBJECTS_PRESET, 20, 90);
    db.saveCycleBlocks(wsId, blocks);
    db.setActiveWorkspaceId(wsId);
    onWorkspaceCreated(wsId);
    onClose();
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
        className="card-primary"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '2rem',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
          }}
          title="Fechar"
        >
          <X size={20} />
        </button>

        {/* Title & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
              Importar Edital Verticalizado com IA
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Use qualquer IA gratuita para formatar seu edital em 1 minuto sem complicação.
            </p>
          </div>
        </div>

        {/* 3 Step Guide Accordion / Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
          {/* Step 1 */}
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  1
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Copie o Prompt Especializado
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="mock-btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedPrompt ? 'Copiado!' : 'Copiar Prompt'}</span>
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
              Este prompt instrui qualquer IA (ChatGPT, Claude, Gemini ou DeepSeek) a formatar rigorosamente o conteúdo do edital na estrutura do estud.ai.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                2
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                Cole na sua IA favorita junto com o texto do Edital
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
              Abra o <a href="https://chatgpt.com" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>ChatGPT</a>, <a href="https://claude.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>Claude</a> ou <a href="https://gemini.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>Gemini</a>. Cole o prompt acima e, logo abaixo, cole o texto do conteúdo programático do edital do seu concurso.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  3
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Cole aqui o JSON gerado pela IA
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

            {parseError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  marginTop: '0.5rem',
                }}
              >
                <AlertCircle size={14} />
                <span>{parseError}</span>
              </div>
            )}

            {parsedData && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '0.825rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 700 }}>
                  <CheckCircle2 size={16} />
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
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleLoadDemoModel}
            className="mock-btn text-muted"
            style={{ fontSize: '0.85rem', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Carregar modelo de exemplo completo do concurso TCE-GO Analista de TI"
          >
            <RefreshCw size={14} />
            <span>Carregar Modelo Exemplo (TCE-GO)</span>
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
              <Sparkles size={16} />
              <span>{isImporting ? 'Importando...' : 'Criar Ciclo & Importar Edital'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
