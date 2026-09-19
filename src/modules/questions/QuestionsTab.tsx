import React, { useState, useEffect } from 'react';
import { db } from '../../db/database';
import { buildGranQuestoesUrl } from '../../data/tceGoPreset';
import type { Subject, QuestionSession, Flashcard } from '../../types';
import { Plus, Trash2, Award, ClipboardList, TrendingUp, Info, Keyboard, CheckCircle, ExternalLink, Zap } from 'lucide-react';
import { FlashcardModal } from '../flashcards/FlashcardModal';

interface QuestionsTabProps {
  activeWorkspaceId: string;
  onTriggerPromotion?: (subjectId: string, subjectName: string) => void;
}

export const QuestionsTab: React.FC<QuestionsTabProps> = ({ activeWorkspaceId, onTriggerPromotion }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<QuestionSession[]>([]);

  // Flashcard Creator Modal states
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  const [flashcardInitialData, setFlashcardInitialData] = useState<Partial<Flashcard> | null>(null);
  const [flashcardSuccessMsg, setFlashcardSuccessMsg] = useState<string | null>(null);
  const [onlyErrorsFilter, setOnlyErrorsFilter] = useState(false);

  // Manual Form states
  const [subjectId, setSubjectId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [attempted, setAttempted] = useState<number | ''>('');
  const [correct, setCorrect] = useState<number | ''>('');
  const [banca, setBanca] = useState('FGV');
  const [tipo, setTipo] = useState<'treino' | 'simulado'>('treino');
  const [adicionarParaRevisao, setAdicionarParaRevisao] = useState(false);
  const [insightAncoragem, setInsightAncoragem] = useState('');

  // Quick Logger states
  const [quickInput, setQuickInput] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickPreview, setQuickPreview] = useState<{
    subjectName: string;
    topicName: string;
    attempted: number;
    correct: number;
    banca: string;
    tipo: 'treino' | 'simulado';
    insight?: string;
    isNewSubject: boolean;
  } | null>(null);

  const bancas = ['FGV', 'Cebraspe', 'FCC', 'Vunesp', 'Cesgranrio', 'Outra'];

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setSubjects(db.getSubjects(activeWorkspaceId));
    setQuestions(db.getQuestions());
  }, [activeWorkspaceId]);

  const handleSubjectChange = (id: string) => {
    setSubjectId(id);
    const sub = subjects.find((s) => s.id === id);
    if (sub && sub.topics.length > 0) {
      setTopicName(sub.topics[0].name);
    } else {
      setTopicName('');
    }
  };

  // Sync initial dropdown selections
  useEffect(() => {
    if (subjects.length > 0 && !subjectId) {
      setSubjectId(subjects[0].id);
      if (subjects[0].topics.length > 0) {
        setTopicName(subjects[0].topics[0].name);
      }
    }
  }, [subjects, subjectId]);

  const hasErrors = attempted !== '' && correct !== '' && Number(correct) < Number(attempted);

  // Parse quick input live for preview
  useEffect(() => {
    if (!quickInput.trim()) {
      setQuickPreview(null);
      setQuickError(null);
      return;
    }

    const parts = quickInput.split('|').map(p => p.trim());
    if (parts.length < 4) {
      setQuickPreview(null);
      setQuickError('Digite pelo menos: Matéria | Tópico | Total | Acertos');
      return;
    }

    const [subName, topName, attStr, corStr, bncStr, insStr] = parts;
    const att = parseInt(attStr);
    const cor = parseInt(corStr);

    if (isNaN(att) || att <= 0) {
      setQuickPreview(null);
      setQuickError('Total de questões deve ser um número maior que 0.');
      return;
    }

    if (isNaN(cor) || cor < 0 || cor > att) {
      setQuickPreview(null);
      setQuickError('Acertos deve ser um número entre 0 e o Total.');
      return;
    }

    const matched = subjects.find(s => s.name.toLowerCase().includes(subName.toLowerCase()));

    // Check if "simulado" is specified anywhere in the parts
    let resolvedTipo: 'treino' | 'simulado' = 'treino';
    const hasSimuladoKeyword = parts.some(p => p.toLowerCase() === 'simulado');
    if (hasSimuladoKeyword) {
      resolvedTipo = 'simulado';
    }

    setQuickError(null);
    setQuickPreview({
      subjectName: matched ? matched.name : subName,
      topicName: topName || 'Geral',
      attempted: att,
      correct: cor,
      banca: bncStr || 'FGV',
      tipo: resolvedTipo,
      insight: insStr,
      isNewSubject: !matched
    });

  }, [quickInput, subjects]);

  // Handle manual question registration
  const handleAddQuestionSession = (e: React.FormEvent) => {
    e.preventDefault();

    const sub = subjects.find((s) => s.id === subjectId);
    if (!sub) {
      alert('Por favor, selecione uma matéria.');
      return;
    }

    const qAttempted = Number(attempted);
    const qCorrect = Number(correct);

    if (isNaN(qAttempted) || qAttempted <= 0) {
      alert('Quantidade de questões tentadas inválida.');
      return;
    }

    if (isNaN(qCorrect) || qCorrect < 0 || qCorrect > qAttempted) {
      alert('Quantidade de acertos inválida (deve ser menor ou igual às tentadas).');
      return;
    }

    // Get active workspace details for tag
    const wsList = db.getWorkspaces();
    const activeWs = wsList.find(w => w.id === activeWorkspaceId);

    const newLog: QuestionSession = {
      id: `question-${Date.now()}`,
      subjectId: sub.id,
      subjectName: sub.name,
      topicName: topicName || 'Geral',
      attempted: qAttempted,
      correct: qCorrect,
      banca: banca,
      tipo: tipo,
      date: new Date().toISOString(),
      adicionarParaRevisao: qCorrect < qAttempted ? adicionarParaRevisao : false,
      insightAncoragem: qCorrect < qAttempted && adicionarParaRevisao ? insightAncoragem.trim() : undefined,
      workspaceId: activeWorkspaceId,
      workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo'
    };

    const updated = [newLog, ...questions];
    setQuestions(updated);
    db.saveQuestions(updated);

    // Trigger promotion check if the registered session is a simulado with >= 85%
    if (tipo === 'simulado' && (qCorrect / qAttempted) >= 0.85 && sub.status === 'active') {
      const subjectSimuladosCount = updated.filter(
        q => q.subjectId === sub.id && 
             q.workspaceId === activeWorkspaceId && 
             q.tipo === 'simulado' && 
             (q.correct / q.attempted) >= 0.85
      ).length;

      if (subjectSimuladosCount >= 3 && onTriggerPromotion) {
        onTriggerPromotion(sub.id, sub.name);
      }
    }

    // Reset inputs
    setAttempted('');
    setCorrect('');
    setTipo('treino');
    setAdicionarParaRevisao(false);
    setInsightAncoragem('');
  };

  // Handle Quick Logger Submit
  const handleQuickLoggerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickError || !quickPreview) return;

    let finalSubjectId = '';
    let finalSubjectStatus = 'active';
    const matched = subjects.find(s => s.name.toLowerCase().includes(quickPreview.subjectName.toLowerCase()));

    if (matched) {
      finalSubjectId = matched.id;
      finalSubjectStatus = matched.status;
    } else {
      const newSub: Subject = {
        id: `subject-${Date.now()}`,
        name: quickPreview.subjectName,
        weight: 3,
        status: 'active',
        targetHours: 0,
        topics: [{
          id: `topic-${Date.now()}`,
          name: quickPreview.topicName,
          subtopics: []
        }]
      };
      const updatedSubjects = [...subjects, newSub];
      setSubjects(updatedSubjects);
      db.saveSubjects(activeWorkspaceId, updatedSubjects);
      finalSubjectId = newSub.id;
    }

    const wsList = db.getWorkspaces();
    const activeWs = wsList.find(w => w.id === activeWorkspaceId);

    const hasErr = quickPreview.correct < quickPreview.attempted;
    const log: QuestionSession = {
      id: `question-${Date.now()}`,
      subjectId: finalSubjectId,
      subjectName: quickPreview.subjectName,
      topicName: quickPreview.topicName,
      attempted: quickPreview.attempted,
      correct: quickPreview.correct,
      banca: quickPreview.banca,
      tipo: quickPreview.tipo,
      date: new Date().toISOString(),
      adicionarParaRevisao: hasErr,
      insightAncoragem: quickPreview.insight?.trim() || (hasErr ? 'Erro registrado via Quick Logger.' : undefined),
      workspaceId: activeWorkspaceId,
      workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo'
    };

    const updated = [log, ...questions];
    setQuestions(updated);
    db.saveQuestions(updated);
    setQuickInput('');

    // Trigger promotion check
    if (quickPreview.tipo === 'simulado' && (quickPreview.correct / quickPreview.attempted) >= 0.85 && finalSubjectStatus === 'active') {
      const subjectSimuladosCount = updated.filter(
        q => q.subjectId === finalSubjectId && 
             q.workspaceId === activeWorkspaceId && 
             q.tipo === 'simulado' && 
             (q.correct / q.attempted) >= 0.85
      ).length;

      if (subjectSimuladosCount >= 3 && onTriggerPromotion) {
        onTriggerPromotion(finalSubjectId, quickPreview.subjectName);
      }
    }
  };

  const handleDeleteLog = (id: string) => {
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);
    db.saveQuestions(updated);
  };

  const handleOpenFlashcardFromQuestion = (log: QuestionSession) => {
    setFlashcardInitialData({
      subjectId: log.subjectId,
      subjectName: log.subjectName,
      topicName: log.topicName,
      front: `[${log.banca}] ${log.subjectName} - ${log.topicName}:\nQual é o fundamento correto e por que errei esta questão?`,
      back: log.insightAncoragem?.trim()
        ? `**Insight / Regra de Ouro:**\n${log.insightAncoragem.trim()}`
        : `*Caderno de Erros:* Anote aqui a fundamentação da banca e por que esta alternativa é correta.`,
      tags: ['caderno-de-erros', log.banca.toLowerCase(), 'revisao'],
    });
    setIsFlashcardModalOpen(true);
  };

  const handleSaveFlashcard = (card: Flashcard) => {
    const existingCards = db.getFlashcards(activeWorkspaceId);
    const updatedCards = [card, ...existingCards.filter((c) => c.id !== card.id)];
    db.saveFlashcards(activeWorkspaceId, updatedCards);
    setFlashcardSuccessMsg(`⚡ Flashcard criado com sucesso para "${card.topicName}"!`);
    setTimeout(() => setFlashcardSuccessMsg(null), 4000);
  };

  // Filter history list to only show questions of active workspace
  const activeWorkspaceQuestions = questions.filter(q => q.workspaceId === activeWorkspaceId);
  const errorQuestionsCount = activeWorkspaceQuestions.filter(q => q.adicionarParaRevisao || q.correct < q.attempted).length;
  const displayedQuestions = onlyErrorsFilter
    ? activeWorkspaceQuestions.filter(q => q.adicionarParaRevisao || q.correct < q.attempted)
    : activeWorkspaceQuestions;

  // Metrics calculation
  const totalAttempted = activeWorkspaceQuestions.reduce((sum, q) => sum + q.attempted, 0);
  const totalCorrect = activeWorkspaceQuestions.reduce((sum, q) => sum + q.correct, 0);
  const averageRate = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

  const activeSubject = subjects.find((s) => s.id === subjectId);
  const activeTopics = activeSubject?.topics || [];

  // Calculate consistency progress for active subjects (3 simulados >= 85%)
  const activeSubjects = subjects.filter(s => s.status === 'active');
  const consistencyStats = activeSubjects.map(sub => {
    const successfulSimuladosCount = activeWorkspaceQuestions.filter(
      q => q.subjectId === sub.id && 
           q.tipo === 'simulado' && 
           (q.correct / q.attempted) >= 0.85
    ).length;

    return {
      id: sub.id,
      name: sub.name,
      count: Math.min(3, successfulSimuladosCount),
      assuntoId: sub.assuntoId,
      disciplinaId: sub.disciplinaId,
      granQuery: sub.granQuery
    };
  });

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h2>Registro de Questões Resolvidas</h2>
        <p className="tab-description">
          Acompanhe seu desempenho e alimente o seu Caderno de Erros. Use o formulário manual ou o Quick Logger para registrar linhas únicas rapidamente.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="placeholder-grid" style={{ marginBottom: '1rem' }}>
        <div className="placeholder-card card-primary" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>TENTATIVAS DO CICLO</span>
              <h3 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--text-title)' }}>{totalAttempted}</h3>
            </div>
            <ClipboardList size={32} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
          </div>
        </div>

        <div className="placeholder-card card-secondary" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ACERTOS DO CICLO</span>
              <h3 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--text-title)' }}>{totalCorrect}</h3>
            </div>
            <Award size={32} style={{ color: 'var(--color-secondary)', opacity: 0.8 }} />
          </div>
        </div>

        <div className="placeholder-card card-highlight" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>TAXA DE ACERTOS</span>
              <h3 style={{ fontSize: '2rem', marginTop: '0.25rem', color: averageRate >= 75 ? 'var(--color-success)' : averageRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                {averageRate.toFixed(1)}%
              </h3>
            </div>
            <TrendingUp size={32} style={{ color: 'var(--color-success)', opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* Progress tracker for mock exams (Simulados por Matéria) */}
      <div className="placeholder-card card-primary" style={{ padding: '1.5rem', marginBottom: '1rem', minHeight: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
          <h3>Simulados por Matéria (Progresso de Consistência)</h3>
        </div>
        <p className="card-notes" style={{ marginBottom: '1rem' }}>
          Realize 3 simulados com taxa de acerto $\ge 85\%$ para promover a matéria ao modo de manutenção e liberar novas disciplinas do backlog.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {consistencyStats.length === 0 ? (
            <p style={{ gridColumn: '1/-1', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              Nenhuma matéria ativa cadastrada para rastreamento.
            </p>
          ) : (
            consistencyStats.map((stat) => (
              <div key={stat.id} style={{
                backgroundColor: 'var(--bg-element)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stat.name}
                </span>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {[1, 2, 3].map((num) => (
                      <div
                        key={num}
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: stat.count >= num ? 'var(--color-success)' : 'var(--border-color)',
                          border: stat.count >= num ? 'none' : '1px solid var(--text-muted)'
                        }}
                      />
                    ))}
                  </div>

                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: stat.count === 3 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {stat.count}/3 concluídos
                  </span>
                </div>

                {/* Micro progress bar */}
                <div style={{ height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(stat.count / 3) * 100}%`,
                    backgroundColor: stat.count === 3 ? 'var(--color-success)' : 'var(--color-primary)'
                  }} />
                </div>

                {/* Gran Questoes shortcut */}
                <a
                  href={buildGranQuestoesUrl({
                    assuntoId: stat.assuntoId,
                    disciplinaId: stat.disciplinaId,
                    query: stat.granQuery || stat.name,
                    banca: 'FCC',
                    filterBanca: true
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '4px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#c8102e',
                    background: 'rgba(200, 16, 46, 0.08)',
                    textDecoration: 'none',
                    marginTop: '2px'
                  }}
                  title="Abrir questões no Gran Questões (Filtro Inteligente)"
                >
                  <span>🎯 Praticar no Gran</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Logger Field */}
      <div className="placeholder-card card-primary" style={{ padding: '1.5rem', marginBottom: '1rem', minHeight: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Keyboard size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '1.1rem' }}>Quick Logger (Linha Única)</h3>
        </div>
        <p className="card-notes" style={{ marginBottom: '0.75rem' }}>
          Formato: <code>Matéria | Tópico | Total | Acertos | FGV | Insight (Opcional) | simulado</code>
        </p>
        <form onSubmit={handleQuickLoggerSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Ex: Direito Administrativo | Atos | 10 | 9 | FGV | O ato nulo não gera direitos. | simulado"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-element)',
              color: 'var(--text-title)',
              fontSize: '0.95rem'
            }}
          />
          <button
            type="submit"
            disabled={!!quickError || !quickPreview}
            className="mock-btn"
            style={{
              padding: '0.75rem 1.5rem',
              opacity: (quickError || !quickPreview) ? 0.5 : 1,
              cursor: (quickError || !quickPreview) ? 'not-allowed' : 'pointer'
            }}
          >
            Registrar Rápido
          </button>
        </form>

        {quickPreview && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-element)',
            fontSize: '0.8rem',
            border: '1px solid var(--border-color)',
            animation: 'fadeInTab 0.2s ease-out'
          }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>[Preview]</span>{' '}
            Matéria: <strong>{quickPreview.subjectName}</strong>{' '}
            {quickPreview.isNewSubject && <span style={{ color: 'var(--color-warning)', fontSize: '0.7rem' }}>(Nova)</span>} ·{' '}
            Tópico: <strong>{quickPreview.topicName}</strong> ·{' '}
            Desempenho: <strong>{quickPreview.correct}/{quickPreview.attempted}</strong> ({(quickPreview.correct/quickPreview.attempted*100).toFixed(0)}%) ·{' '}
            Banca: <strong>{quickPreview.banca}</strong> ·{' '}
            Tipo: <strong style={{ color: quickPreview.tipo === 'simulado' ? 'var(--color-success)' : 'var(--text-muted)' }}>{quickPreview.tipo.toUpperCase()}</strong>
            {quickPreview.insight && <div>Insight: <em>"{quickPreview.insight}"</em></div>}
          </div>
        )}

        {quickError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-warning)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            <Info size={14} />
            <span>{quickError}</span>
          </div>
        )}
      </div>

      {subjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
          <p>Você precisa cadastrar matérias no Planejamento antes de registrar questões.</p>
        </div>
      ) : (
        <div className="responsive-split-grid-three">
          
          {/* Left: Input Form */}
          <div className="placeholder-card card-primary" style={{ height: 'fit-content' }}>
            <h3>Inserir Novo Desempenho</h3>
            <form onSubmit={handleAddQuestionSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Matéria</label>
                <select
                  value={subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                    fontWeight: '600'
                  }}
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Tópico</label>
                <select
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  disabled={activeTopics.length === 0}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                  }}
                >
                  <option value="">Geral / Outro</option>
                  {activeTopics.map((topic) => (
                    <option key={topic.id} value={topic.name}>{topic.name}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Registro (Treino ou Simulado) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Tipo de Exercício</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="exerciseType"
                      checked={tipo === 'treino'}
                      onChange={() => setTipo('treino')}
                    />
                    Treino Comum
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="exerciseType"
                      checked={tipo === 'simulado'}
                      onChange={() => setTipo('simulado')}
                    />
                    Simulado Completo
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Tentadas</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={attempted}
                    onChange={(e) => setAttempted(e.target.value === '' ? '' : parseInt(e.target.value))}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Acertos</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value === '' ? '' : parseInt(e.target.value))}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Banca</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {bancas.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBanca(b === 'Outra' ? '' : b)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: (b === banca || (b === 'Outra' && !bancas.slice(0, 5).includes(banca))) ? 'var(--color-primary)' : 'var(--border-color)',
                        backgroundColor: (b === banca || (b === 'Outra' && !bancas.slice(0, 5).includes(banca))) ? 'var(--color-primary-glow)' : 'var(--bg-element)',
                        color: (b === banca || (b === 'Outra' && !bancas.slice(0, 5).includes(banca))) ? 'var(--color-primary)' : 'var(--text-main)',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                {!bancas.slice(0, 5).includes(banca) && (
                  <input
                    type="text"
                    placeholder="Digite o nome da banca"
                    value={banca}
                    onChange={(e) => setBanca(e.target.value)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                      marginTop: '0.5rem',
                      fontSize: '0.85rem'
                    }}
                  />
                )}
              </div>

              {hasErrors && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px dashed rgba(239, 68, 68, 0.2)',
                  animation: 'fadeInTab 0.2s ease-out'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>
                    <input
                      type="checkbox"
                      checked={adicionarParaRevisao}
                      onChange={(e) => setAdicionarParaRevisao(e.target.checked)}
                    />
                    Adicionar ao Caderno de Erros?
                  </label>

                  {adicionarParaRevisao && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Insight de Ancoragem (Fórmula/Conceito)</span>
                      <input
                        type="text"
                        placeholder="Ex: Autoexecutoriedade não exige ordem judicial."
                        value={insightAncoragem}
                        onChange={(e) => setInsightAncoragem(e.target.value)}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-element)',
                          color: 'var(--text-title)',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="mock-btn" style={{ padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                <Plus size={18} /> Registrar
              </button>
            </form>
          </div>

          {/* Right: History List */}
          <div className="placeholder-card card-secondary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3>Histórico de Questões</h3>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-element)', padding: '3px', borderRadius: '6px' }}>
                <button
                  type="button"
                  onClick={() => setOnlyErrorsFilter(false)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: !onlyErrorsFilter ? 700 : 500,
                    backgroundColor: !onlyErrorsFilter ? 'var(--bg-card)' : 'transparent',
                    color: !onlyErrorsFilter ? 'var(--color-primary)' : 'var(--text-muted)',
                  }}
                >
                  Todas ({activeWorkspaceQuestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyErrorsFilter(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: onlyErrorsFilter ? 700 : 500,
                    backgroundColor: onlyErrorsFilter ? 'var(--bg-card)' : 'transparent',
                    color: onlyErrorsFilter ? 'var(--color-danger)' : 'var(--text-muted)',
                  }}
                >
                  ⚡ Caderno de Erros ({errorQuestionsCount})
                </button>
              </div>
            </div>

            {displayedQuestions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                {onlyErrorsFilter ? 'Nenhum erro registrado neste ciclo! Parabéns!' : 'Nenhuma questão registrada recentemente para este ciclo.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Matéria / Tópico</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Tipo / Banca</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Acertos</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>%</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedQuestions.map((log) => {
                      const rate = log.attempted > 0 ? (log.correct / log.attempted) * 100 : 0;
                      const hasError = log.adicionarParaRevisao || log.correct < log.attempted;

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-title)' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {log.subjectName}
                              {log.adicionarParaRevisao && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  color: 'var(--color-danger)',
                                  padding: '0.1rem 0.3rem',
                                  borderRadius: '4px',
                                  fontWeight: 'bold'
                                }}>
                                  Erro Ativo
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.topicName}</div>
                            {log.insightAncoragem && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                                &ldquo;{log.insightAncoragem}&rdquo;
                              </div>
                            )}

                            {/* 1-Click Flashcard Creator Button for Errors */}
                            {hasError && (
                              <div style={{ marginTop: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenFlashcardFromQuestion(log)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--color-primary)',
                                    backgroundColor: 'var(--color-primary-glow)',
                                    border: '1px solid rgba(129, 140, 248, 0.3)',
                                    cursor: 'pointer',
                                  }}
                                  title="Criar Flashcard Anki a partir deste erro"
                                >
                                  <Zap size={11} fill="currentColor" /> Criar Flashcard
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.75rem', color: log.tipo === 'simulado' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                              {log.tipo ? log.tipo.toUpperCase() : 'TREINO'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.1rem' }}>{log.banca}</div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {log.correct} / {log.attempted}
                          </td>
                          <td style={{
                            padding: '0.75rem 0.5rem',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: rate >= 75 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
                          }}>
                            {rate.toFixed(0)}%
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              style={{ color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}
                              title="Excluir registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 1-Click Flashcard Creator Modal */}
      <FlashcardModal
        isOpen={isFlashcardModalOpen}
        onClose={() => {
          setIsFlashcardModalOpen(false);
          setFlashcardInitialData(null);
        }}
        onSave={handleSaveFlashcard}
        initialData={flashcardInitialData}
        workspaceId={activeWorkspaceId}
        subjects={subjects}
      />

      {/* Success Toast */}
      {flashcardSuccessMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--text-inverse)',
            padding: '0.8rem 1.4rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            zIndex: 99999,
            animation: 'fadeInTab 0.2s ease-out',
          }}
        >
          <CheckCircle size={18} />
          <span>{flashcardSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};
