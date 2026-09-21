import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/database';
import type { Flashcard, Subject, FlashcardState } from '../../types';
import { FormattedText } from './FormattedText';
import { FlashcardModal } from './FlashcardModal';
import { FlashcardReviewModal } from './FlashcardReviewModal';
import { exportCardsToAnki } from './exportAnki';
import { formatLocalDate } from './sm2';
import {
  Layers,
  Play,
  Plus,
  Download,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Award,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  FolderKanban,
  LayoutGrid,
} from 'lucide-react';

interface FlashcardsTabProps {
  activeWorkspaceId: string;
}

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({ activeWorkspaceId }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // View Mode: 'grouped' (Decks por Matéria) or 'list' (Grade corrida)
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // all, due, new, learning, review
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<Flashcard> | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);

  // Expanded cards state (to show back on cards list)
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  // Expanded subject groups state
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<Set<string>>(new Set());

  const todayStr = formatLocalDate(new Date());

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setCards(db.getFlashcards(activeWorkspaceId));
    setSubjects(db.getSubjects(activeWorkspaceId));
  }, [activeWorkspaceId]);

  // Keep all subjects expanded by default when subjects load
  useEffect(() => {
    if (subjects.length > 0) {
      setExpandedSubjectIds(new Set(subjects.map((s) => s.id).concat(['geral'])));
    }
  }, [subjects]);

  const handleSaveCard = (savedCard: Flashcard) => {
    setCards((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === savedCard.id);
      const updated = existingIdx !== -1
        ? prev.map((c) => (c.id === savedCard.id ? savedCard : c))
        : [savedCard, ...prev];
      db.saveFlashcards(activeWorkspaceId, updated);
      return updated;
    });
  };

  const handleDeleteCard = (cardId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este flashcard?')) return;
    setCards((prev) => {
      const updated = prev.filter((c) => c.id !== cardId);
      db.saveFlashcards(activeWorkspaceId, updated);
      return updated;
    });
  };

  const toggleExpandSubject = (subId: string) => {
    setExpandedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const toggleAllSubjects = () => {
    if (expandedSubjectIds.size > 0) {
      setExpandedSubjectIds(new Set());
    } else {
      const allIds = new Set(subjects.map((s) => s.id).concat(['geral']));
      setExpandedSubjectIds(allIds);
    }
  };

  const toggleExpandCard = (cardId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Due cards
  const dueCards = useMemo(() => {
    return cards.filter((c) => c.dueDate <= todayStr);
  }, [cards, todayStr]);

  // Unique tags across workspace cards
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    cards.forEach((c) => (c.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [cards]);

  // Filtered cards list
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFront = card.front.toLowerCase().includes(q);
        const matchesBack = card.back.toLowerCase().includes(q);
        const matchesTopic = card.topicName.toLowerCase().includes(q);
        const matchesSubject = card.subjectName.toLowerCase().includes(q);
        const matchesTags = (card.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchesFront && !matchesBack && !matchesTopic && !matchesSubject && !matchesTags) {
          return false;
        }
      }

      // Subject filter
      if (selectedSubjectId !== 'all' && card.subjectId !== selectedSubjectId) {
        return false;
      }

      // Status filter
      if (selectedStatus === 'due' && card.dueDate > todayStr) {
        return false;
      }
      if (selectedStatus === 'new' && card.state !== 'new') {
        return false;
      }
      if (selectedStatus === 'learning' && card.state !== 'learning') {
        return false;
      }
      if (selectedStatus === 'review' && card.state !== 'review') {
        return false;
      }

      // Tag filter
      if (selectedTag !== 'all' && !(card.tags || []).includes(selectedTag)) {
        return false;
      }

      return true;
    });
  }, [cards, searchQuery, selectedSubjectId, selectedStatus, selectedTag, todayStr]);

  // Subject Groups (Deck Structure)
  const subjectGroups = useMemo(() => {
    const map = new Map<string, { subjectId: string; subjectName: string; cards: Flashcard[] }>();

    // Seed known subjects so canonical display order is preserved
    subjects.forEach((sub) => {
      map.set(sub.id, { subjectId: sub.id, subjectName: sub.name, cards: [] });
    });

    // Populate with filtered cards
    filteredCards.forEach((card) => {
      const subId = card.subjectId || 'geral';
      if (!map.has(subId)) {
        map.set(subId, {
          subjectId: subId,
          subjectName: card.subjectName || 'Outros / Geral',
          cards: [],
        });
      }
      map.get(subId)!.cards.push(card);
    });

    // Only return groups with at least 1 matching card
    return Array.from(map.values()).filter((g) => g.cards.length > 0);
  }, [subjects, filteredCards]);

  // Overall Metrics
  const totalCards = cards.length;
  const dueTodayCount = dueCards.length;
  const newCardsCount = cards.filter((c) => c.state === 'new').length;
  const learningCount = cards.filter((c) => c.state === 'learning').length;
  const reviewCount = cards.filter((c) => c.state === 'review').length;
  const retentionRate = totalCards > 0 ? Math.round((reviewCount / totalCards) * 100) : 0;

  // Start Review Session (all workspace due, or specific group due cards)
  const handleStartReview = (cardsToReview?: Flashcard[]) => {
    const queue = cardsToReview && cardsToReview.length > 0 ? cardsToReview : dueCards;
    if (queue.length === 0) {
      alert('Não há flashcards devidos para revisão hoje nesta seleção!');
      return;
    }
    setReviewQueue(queue);
    setIsReviewModalOpen(true);
  };

  // Export to Anki (.txt UTF-8 compatible format)
  const handleExportAnki = () => {
    const targetCards = filteredCards.length > 0 ? filteredCards : cards;
    if (targetCards.length === 0) {
      alert('Não há flashcards para exportar.');
      return;
    }
    const workspaces = db.getWorkspaces();
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    const count = exportCardsToAnki(targetCards, ws?.name || 'concurso');
    alert(`Sucesso! ${count} flashcards foram exportados no formato oficial do Anki (.txt).`);
  };

  // Open modal pre-filled for a specific subject
  const handleOpenCreateForSubject = (subId: string, subName: string) => {
    setEditingCard({
      subjectId: subId,
      subjectName: subName,
    });
    setIsCreateModalOpen(true);
  };

  const getStateBadge = (state: FlashcardState) => {
    switch (state) {
      case 'new':
        return (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--color-primary)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Novo
          </span>
        );
      case 'learning':
        return (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--color-warning)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Aprendendo
          </span>
        );
      case 'review':
        return (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-success)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Revisão
          </span>
        );
    }
  };

  const getDueDateLabel = (dueDateStr: string) => {
    if (dueDateStr < todayStr) {
      return (
        <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.75rem' }}>
          Atrasado ({dueDateStr})
        </span>
      );
    }
    if (dueDateStr === todayStr) {
      return (
        <span style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '0.75rem' }}>
          Hoje
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {dueDateStr}
      </span>
    );
  };

  // Reusable Single Card Item Renderer
  const renderCardItem = (card: Flashcard) => {
    const isExpanded = expandedCardIds.has(card.id);
    const isDue = card.dueDate <= todayStr;

    return (
      <div
        key={card.id}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: isDue
            ? '1.5px solid rgba(245, 158, 11, 0.45)'
            : '1px solid var(--border-color)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.85rem',
          boxShadow: 'var(--box-shadow)',
          position: 'relative',
        }}
      >
        {/* Card Top: Subject, Topic, State */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    backgroundColor: 'var(--color-primary-glow)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {card.subjectName}
                </span>
                {getStateBadge(card.state)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                {card.topicName}
              </div>
            </div>

            {/* Actions: Edit & Delete */}
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingCard(card);
                  setIsCreateModalOpen(true);
                }}
                style={{
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                title="Editar card"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCard(card.id)}
                style={{
                  color: 'var(--color-danger)',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                title="Excluir card"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Card Front Content (Cloze reveals if card is expanded) */}
          <div
            style={{
              margin: '0.75rem 0 0.5rem',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-element)',
              border: '1px solid var(--border-color)',
              fontSize: '0.9rem',
              color: 'var(--text-title)',
              minHeight: '60px',
            }}
          >
            <FormattedText text={card.front} isAnswerRevealed={isExpanded} />
          </div>

          {/* Card Back Content (Expandable) */}
          {isExpanded && (
            <div
              style={{
                margin: '0.5rem 0',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: '0.85rem',
                color: 'var(--text-title)',
                animation: 'fadeInTab 0.2s ease-out',
              }}
            >
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '4px' }}>
                Verso
              </div>
              <FormattedText text={card.back} isAnswerRevealed={true} />
            </div>
          )}

          {/* Toggle Back Button */}
          <button
            type="button"
            onClick={() => toggleExpandCard(card.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              color: 'var(--color-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {isExpanded ? 'Ocultar Resposta' : 'Ver Resposta'}
          </button>
        </div>

        {/* Card Bottom: Metadata & Due status */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <span>Int: <strong>{card.interval}d</strong></span>
              <span>Rep: <strong>{card.repetition}</strong></span>
              <span>EF: <strong>{card.easeFactor.toFixed(2)}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
              {getDueDateLabel(card.dueDate)}
            </div>
          </div>

          {/* Tags list */}
          {card.tags && card.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              {card.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: '0.65rem',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-muted)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="tab-container">
      {/* Header section */}
      <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers className="logo-icon" style={{ width: '1.75rem', height: '1.75rem' }} />
            <h2>Flashcards & Repetição Espaçada</h2>
          </div>
          <p className="tab-description">
            Retenção de longo prazo com evocação ativa (Active Recall) e algoritmo <strong>Anki SM-2</strong>.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportAnki}
            className="mock-btn text-muted"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1rem' }}
            title="Exportar flashcards para o Anki Desktop/Mobile (.txt)"
          >
            <Download size={16} /> Exportar Anki
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCard(null);
              setIsCreateModalOpen(true);
            }}
            className="mock-btn text-muted"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1rem' }}
          >
            <Plus size={16} /> Novo Card
          </button>

          <button
            type="button"
            onClick={() => handleStartReview(dueCards)}
            className="mock-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.4rem',
              fontWeight: 700,
              backgroundColor: dueTodayCount > 0 ? 'var(--color-primary)' : 'var(--bg-element)',
              color: dueTodayCount > 0 ? 'var(--text-inverse)' : 'var(--text-muted)',
              border: dueTodayCount > 0 ? 'none' : '1px solid var(--border-color)',
            }}
          >
            <Play size={16} fill="currentColor" />
            Revisar Hoje ({dueTodayCount})
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="placeholder-grid" style={{ marginBottom: '0.5rem' }}>
        <div className="placeholder-card card-primary" style={{ padding: '1.25rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL DE CARDS</span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.2rem', color: 'var(--text-title)' }}>{totalCards}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {newCardsCount} novos • {learningCount} aprendendo
              </div>
            </div>
            <Layers size={28} style={{ color: 'var(--color-primary)', opacity: 0.85 }} />
          </div>
        </div>

        <div className="placeholder-card card-secondary" style={{ padding: '1.25rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>PARA REVISAR HOJE</span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.2rem', color: dueTodayCount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {dueTodayCount}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {dueTodayCount === 0 ? 'Tudo em dia para hoje!' : 'Exigem revisão SM-2 hoje'}
              </div>
            </div>
            <Clock size={28} style={{ color: 'var(--color-secondary)', opacity: 0.85 }} />
          </div>
        </div>

        <div className="placeholder-card card-highlight" style={{ padding: '1.25rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>RETENÇÃO MADURA</span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.2rem', color: 'var(--color-success)' }}>
                {retentionRate}%
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {reviewCount} cards em fase consolidada
              </div>
            </div>
            <Award size={28} style={{ color: 'var(--color-success)', opacity: 0.85 }} />
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-card)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Buscar em frente, verso, tópicos ou tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-title)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-element)',
              color: 'var(--text-title)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">Todas as Matérias</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* View Mode Switcher (Agrupado por Matéria vs Lista Corrida) */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-element)', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'grouped' ? 700 : 500,
                backgroundColor: viewMode === 'grouped' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'grouped' ? 'var(--color-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'grouped' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
              title="Visualizar flashcards agrupados por Matéria (Decks Anki)"
            >
              <FolderKanban size={13} /> Por Matéria
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'list' ? 700 : 500,
                backgroundColor: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
              title="Visualizar todos os flashcards em grade contínua"
            >
              <LayoutGrid size={13} /> Lista
            </button>
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-element)', padding: '3px', borderRadius: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'due', label: `Para Revisar Hoje (${dueTodayCount})` },
              { id: 'new', label: 'Novos' },
              { id: 'learning', label: 'Aprendendo' },
              { id: 'review', label: 'Revisão' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: selectedStatus === tab.id ? 700 : 500,
                  backgroundColor: selectedStatus === tab.id ? 'var(--bg-card)' : 'transparent',
                  color: selectedStatus === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
                  boxShadow: selectedStatus === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tag chips row and Group View Expand/Collapse */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
          {allTags.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Filter size={12} /> Tags:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTag('all')}
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: selectedTag === 'all' ? 'var(--color-primary)' : 'var(--bg-element)',
                  color: selectedTag === 'all' ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                todas
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: selectedTag === tag ? 'var(--color-primary)' : 'var(--bg-element)',
                    color: selectedTag === tag ? 'var(--text-inverse)' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : <div />}

          {viewMode === 'grouped' && subjectGroups.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSubjects}
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-primary)',
                background: 'none',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {expandedSubjectIds.size > 0 ? 'Recolher Todas Matérias' : 'Expandir Todas Matérias'}
            </button>
          )}
        </div>
      </div>

      {/* Cards Display (Grouped by Subject or Flat Grid) */}
      {cards.length === 0 ? (
        /* Zero Cards Empty State */
        <div
          style={{
            textAlign: 'center',
            padding: '3.5rem 1.5rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <Sparkles size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-title)', fontWeight: 700 }}>
              Nenhum flashcard criado ainda neste ciclo
            </h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0.4rem auto 0', fontSize: '0.9rem' }}>
              Flashcards aceleram a memorização de súmulas, fórmulas, prazos e conceitos que caem com alta frequência em provas.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setEditingCard(null);
                setIsCreateModalOpen(true);
              }}
              className="mock-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: 700 }}
            >
              <Plus size={18} /> Criar Primeiro Flashcard
            </button>
          </div>
        </div>
      ) : filteredCards.length === 0 ? (
        /* Filtered Empty State */
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <Search size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
          <p>Nenhum flashcard corresponde aos filtros selecionados.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedSubjectId('all');
              setSelectedStatus('all');
              setSelectedTag('all');
            }}
            className="mock-btn text-muted"
            style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.4rem 1rem' }}
          >
            Limpar Filtros
          </button>
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped by Subject View (Decks) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {subjectGroups.map((group) => {
            const groupDueCards = group.cards.filter((c) => c.dueDate <= todayStr);
            const groupDueCount = groupDueCards.length;
            const groupNewCount = group.cards.filter((c) => c.state === 'new').length;
            const groupLearningCount = group.cards.filter((c) => c.state === 'learning').length;
            const groupReviewCount = group.cards.filter((c) => c.state === 'review').length;
            const isSubjectExpanded = expandedSubjectIds.has(group.subjectId);

            return (
              <div
                key={group.subjectId}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: groupDueCount > 0
                    ? '1.5px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: 'var(--box-shadow)',
                }}
              >
                {/* Subject Deck Header */}
                <div
                  style={{
                    padding: '1.1rem 1.25rem',
                    backgroundColor: 'var(--bg-element)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    borderBottom: isSubjectExpanded ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  {/* Left: Subject Name & Metrics */}
                  <div
                    onClick={() => toggleExpandSubject(group.subjectId)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '220px' }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-primary-glow)',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BookOpen size={20} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
                          {group.subjectName}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: groupDueCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: groupDueCount > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                          }}
                        >
                          {groupDueCount > 0 ? `${groupDueCount} para revisar hoje` : '✓ Em dia'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <strong>{group.cards.length}</strong> {group.cards.length === 1 ? 'card' : 'cards'} no total • {groupNewCount} novos • {groupLearningCount} aprendendo • {groupReviewCount} revisão
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Review this subject deck button */}
                    <button
                      type="button"
                      onClick={() => handleStartReview(groupDueCards)}
                      className="mock-btn"
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backgroundColor: groupDueCount > 0 ? 'var(--color-primary)' : 'var(--bg-element)',
                        color: groupDueCount > 0 ? 'var(--text-inverse)' : 'var(--text-muted)',
                        border: groupDueCount > 0 ? 'none' : '1px solid var(--border-color)',
                        opacity: groupDueCount > 0 ? 1 : 0.7,
                      }}
                      title={groupDueCount > 0 ? `Revisar os ${groupDueCount} cards devidos desta matéria` : 'Nenhum card desta matéria devido hoje'}
                    >
                      <Play size={13} fill="currentColor" /> Revisar ({groupDueCount})
                    </button>

                    {/* Add card in this subject */}
                    <button
                      type="button"
                      onClick={() => handleOpenCreateForSubject(group.subjectId, group.subjectName)}
                      className="mock-btn text-muted"
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title={`Adicionar novo card em ${group.subjectName}`}
                    >
                      <Plus size={14} /> Card
                    </button>

                    {/* Expand/Collapse Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpandSubject(group.subjectId)}
                      style={{
                        color: 'var(--text-muted)',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title={isSubjectExpanded ? 'Recolher cards' : 'Expandir cards'}
                    >
                      {isSubjectExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Cards Inside This Subject Deck */}
                {isSubjectExpanded && (
                  <div
                    style={{
                      padding: '1.25rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                      gap: '1rem',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    {group.cards.map(renderCardItem)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Cards Grid View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          {filteredCards.map(renderCardItem)}
        </div>
      )}

      {/* Card Creation / Editing Modal */}
      <FlashcardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        initialData={editingCard}
        workspaceId={activeWorkspaceId}
        subjects={subjects}
      />

      {/* Review Modal (Anki SM-2 Engine) */}
      <FlashcardReviewModal
        isOpen={isReviewModalOpen}
        cards={reviewQueue}
        onSaveCard={handleSaveCard}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewQueue([]);
        }}
      />
    </div>
  );
};
