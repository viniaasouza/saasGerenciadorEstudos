import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Sparkles, Plus, Check, CheckCircle2 } from 'lucide-react';
import type { Flashcard, Subject } from '../../types';
import { FormattedText } from './FormattedText';
import { formatLocalDate } from './sm2';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: Flashcard) => void;
  initialData?: Partial<Flashcard> | null;
  workspaceId: string;
  subjects: Subject[];
}

export const FlashcardModal: React.FC<FlashcardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  workspaceId,
  subjects,
}) => {
  const [subjectId, setSubjectId] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [topicName, setTopicName] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const frontTextareaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsOpenRef = useRef(false);
  const prevCardIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isNewOpening = isOpen && !prevIsOpenRef.current;
    const isCardIdChanged = initialData?.id !== prevCardIdRef.current;

    if (isOpen && (isNewOpening || isCardIdChanged)) {
      setSuccessMsg(null);
      setCreatedCount(0);
      if (initialData) {
        const matchedSub = subjects.find(
          (s) => s.id === initialData.subjectId || (initialData.subjectName && s.name.toLowerCase() === initialData.subjectName.toLowerCase())
        );
        if (matchedSub) {
          setSubjectId(matchedSub.id);
          setCustomSubject('');
        } else if (initialData.subjectName && initialData.subjectName.toLowerCase() !== 'geral') {
          setSubjectId('__custom_subject__');
          setCustomSubject(initialData.subjectName);
        } else {
          setSubjectId(subjects[0]?.id || 'geral');
          setCustomSubject('');
        }

        const resolvedSubId = matchedSub?.id || initialData.subjectId || subjects[0]?.id || '';
        const subTopics = matchedSub?.topics || subjects.find((s) => s.id === resolvedSubId)?.topics || [];
        const topicInList = subTopics.some((t) => t.name === initialData.topicName);

        if (initialData.topicName) {
          if (topicInList) {
            setTopicName(initialData.topicName);
            setCustomTopic('');
          } else {
            setTopicName('__custom__');
            setCustomTopic(initialData.topicName);
          }
        } else {
          setTopicName(subTopics[0]?.name || '__custom__');
          setCustomTopic('');
        }

        setFront(initialData.front || '');
        setBack(initialData.back || '');
        setTagsInput(initialData.tags ? initialData.tags.join(', ') : '');
      } else {
        const defaultSub = subjects[0];
        if (defaultSub) {
          setSubjectId(defaultSub.id);
          setCustomSubject('');
          setTopicName(defaultSub.topics[0]?.name || '__custom__');
        } else {
          setSubjectId('geral');
          setCustomSubject('');
          setTopicName('__custom__');
        }
        setCustomTopic('');
        setFront('');
        setBack('');
        setTagsInput('');
      }
      setIsPreviewMode(false);
    }
    prevIsOpenRef.current = isOpen;
    prevCardIdRef.current = initialData?.id;
  }, [isOpen, initialData, subjects]);

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSubject = subjects.find((s) => s.id === subjectId);
  const currentTopics = currentSubject?.topics || [];

  const handleSubjectChange = (newSubId: string) => {
    setSubjectId(newSubId);
    if (newSubId === '__custom_subject__' || newSubId === 'geral') {
      setTopicName('__custom__');
    } else {
      const sub = subjects.find((s) => s.id === newSubId);
      if (sub && sub.topics.length > 0) {
        setTopicName(sub.topics[0].name);
      } else {
        setTopicName('__custom__');
      }
    }
  };

  const saveCard = (closeAfterSave: boolean) => {
    // If user already saved cards in this session and fields are blank, "Salvar e Fechar" closes cleanly
    if (closeAfterSave && createdCount > 0 && !front.trim() && !back.trim()) {
      onClose();
      return;
    }

    if (!front.trim()) {
      alert('Por favor, informe o conteúdo da Frente (pergunta / estímulo).');
      frontTextareaRef.current?.focus();
      return;
    }
    if (!back.trim()) {
      alert('Por favor, informe o conteúdo do Verso (resposta / explicação).');
      return;
    }

    const finalTopicName = topicName === '__custom__' || !topicName
      ? (customTopic.trim() || 'Geral')
      : topicName;

    let finalSubjectId = 'geral';
    let finalSubjectName = 'Geral';

    if (subjectId === '__custom_subject__') {
      const trimmed = customSubject.trim() || 'Geral';
      finalSubjectName = trimmed;
      finalSubjectId = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-') || Date.now()}`;
    } else if (subjectId === 'geral') {
      finalSubjectId = 'geral';
      finalSubjectName = 'Geral';
    } else if (currentSubject) {
      finalSubjectId = currentSubject.id;
      finalSubjectName = currentSubject.name;
    } else if (initialData?.subjectName) {
      finalSubjectId = initialData.subjectId || 'geral';
      finalSubjectName = initialData.subjectName;
    }

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const nowStr = formatLocalDate(new Date());
    const isEditing = Boolean(initialData?.id);

    const card: Flashcard = {
      id: initialData?.id || `card-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      workspaceId,
      subjectId: finalSubjectId,
      subjectName: finalSubjectName,
      topicName: finalTopicName,
      subtopicName: initialData?.subtopicName,
      front: front.trim(),
      back: back.trim(),
      tags: parsedTags,
      createdAt: initialData?.createdAt || nowStr,
      dueDate: initialData?.dueDate || nowStr,
      interval: initialData?.interval ?? 0,
      repetition: initialData?.repetition ?? 0,
      easeFactor: initialData?.easeFactor ?? 2.5,
      state: initialData?.state || 'new',
    };

    onSave(card);

    if (isEditing || closeAfterSave) {
      onClose();
    } else {
      // Keep modal open for continuous creation
      setCreatedCount((prev) => prev + 1);
      setSuccessMsg('Flashcard salvo com sucesso! Pronto para o próximo.');
      setFront('');
      setBack('');
      setIsPreviewMode(false);
      setTimeout(() => {
        frontTextareaRef.current?.focus();
      }, 50);
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        saveCard(true);
      } else {
        saveCard(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCard(false);
  };

  const insertClozeSyntax = () => {
    const textarea = frontTextareaRef.current;
    if (!textarea) {
      setFront((prev) => prev + '{{c1::termo_oculto}}');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = front.substring(start, end);
    const replacement = selectedText ? `{{c1::${selectedText}}}` : '{{c1::termo_oculto}}';
    const newFront = front.substring(0, start) + replacement + front.substring(end);
    setFront(newFront);
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start, start + replacement.length);
      } else {
        textarea.setSelectionRange(start + 6, start + replacement.length - 2);
      }
    }, 0);
  };

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
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="placeholder-card card-primary modal-dialog"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={22} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-title)' }}>
              {initialData?.id ? 'Editar Flashcard' : 'Novo Flashcard (Anki SM-2)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Continuous Creation Success Indicator */}
        {successMsg && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              border: '1.5px solid #22c55e',
              borderRadius: '10px',
              padding: '10px 14px',
              color: 'var(--color-success)',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fadeInTab 0.2s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} />
              <span>
                {successMsg} ({createdCount} {createdCount === 1 ? 'card criado nesta sessão' : 'cards criados nesta sessão'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Fechar alerta"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Row: Subject & Topic */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Matéria
              </label>
              <select
                value={subjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                style={{
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.9rem',
                }}
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
                <option value="geral">Geral / Concurso</option>
                <option value="__custom_subject__">➕ Nova Matéria Personalizada</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Tópico / Assunto
              </label>
              <select
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                style={{
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.9rem',
                }}
              >
                {currentTopics.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
                <option value="__custom__">➕ {currentTopics.length === 0 ? 'Tópico Personalizado' : 'Outro Tópico Personalizado'}</option>
              </select>
            </div>
          </div>

          {/* Custom Subject Input if selected */}
          {subjectId === '__custom_subject__' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nome da Nova Matéria</label>
              <input
                type="text"
                placeholder="Ex: Direito Constitucional"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          )}

          {(topicName === '__custom__' || currentTopics.length === 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nome do Tópico / Assunto</label>
              <input
                type="text"
                placeholder="Ex: Recursos no Processo Civil"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          )}

          {/* Toggle Preview and Formatting Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={insertClozeSyntax}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-primary)',
                  backgroundColor: 'var(--color-primary-glow)',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                }}
                title="Inserir Omissão de Palavras (Cloze Deletion)"
              >
                + Omissão de Palavra (Cloze)
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Dica: <code>**negrito**</code>, <code>*itálico*</code>, <code>`código`</code> e <code>- tópicos</code>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-title)',
                backgroundColor: 'var(--bg-element)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              {isPreviewMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {isPreviewMode ? 'Editar' : 'Visualizar Card'}
            </button>
          </div>

          {/* Front */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
              Frente (Pergunta ou Prompt)
            </label>
            {isPreviewMode ? (
              <div
                style={{
                  minHeight: '80px',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <FormattedText text={front || '*(Frente vazia)*'} isAnswerRevealed={false} />
              </div>
            ) : (
              <textarea
                ref={frontTextareaRef}
                rows={3}
                placeholder="Ex: Quais são os 5 requisitos de validade do ato administrativo (COMFIFORM)?"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            )}
          </div>

          {/* Back */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
              Verso (Resposta ou Explicação)
            </label>
            {isPreviewMode ? (
              <div
                style={{
                  minHeight: '100px',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <FormattedText text={back || '*(Verso vazio)*'} isAnswerRevealed={true} />
              </div>
            ) : (
              <textarea
                rows={4}
                placeholder="Ex: Competência, Finalidade, Forma, Motivo e Objeto."
                value={back}
                onChange={(e) => setBack(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            )}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
              Tags (separadas por vírgula)
            </label>
            <input
              type="text"
              placeholder="Ex: atos, doutrina, pegadinha, fcc"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{
                padding: '0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-title)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="mock-btn text-muted"
              style={{ padding: '0.7rem 1.25rem' }}
            >
              {!initialData?.id && createdCount > 0 ? `Concluir (${createdCount} salvo${createdCount > 1 ? 's' : ''})` : 'Cancelar'}
            </button>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!initialData?.id && (
                <button
                  type="button"
                  onClick={() => saveCard(true)}
                  className="mock-btn text-muted"
                  style={{
                    padding: '0.7rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontWeight: 600,
                  }}
                  title="Salvar este card e fechar a janela (Ctrl+Shift+Enter)"
                >
                  <Check size={16} />
                  Salvar e Fechar
                </button>
              )}

              <button
                type="submit"
                className="mock-btn"
                style={{
                  padding: '0.7rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 700,
                }}
                title={initialData?.id ? 'Salvar alterações deste card (Ctrl+Enter)' : 'Salvar este card e adicionar o próximo (Ctrl+Enter)'}
              >
                {initialData?.id ? <Check size={18} /> : <Plus size={18} />}
                {initialData?.id ? 'Salvar Alterações' : 'Salvar e Adicionar Outro'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
