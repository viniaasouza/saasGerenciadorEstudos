import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle2, Trophy } from 'lucide-react';
import type { Flashcard } from '../../types';
import { FormattedText } from './FormattedText';
import { calculateSM2, getIntervalPreviews, formatLocalDate, type ReviewRating } from './sm2';

interface FlashcardReviewModalProps {
  isOpen: boolean;
  cards: Flashcard[];
  onSaveCard: (card: Flashcard) => void;
  onClose: () => void;
}

export const FlashcardReviewModal: React.FC<FlashcardReviewModalProps> = ({
  isOpen,
  cards,
  onSaveCard,
  onClose,
}) => {
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const prevIsOpenRef = useRef(false);

  // Initialize session only on initial modal open to avoid resetting progress on parent re-renders
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSessionCards(cards);
      setCurrentIndex(0);
      setIsAnswerRevealed(false);
      setIsFinished(cards.length === 0);
      setStats({ again: 0, hard: 0, good: 0, easy: 0 });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, cards]);

  const currentCard = sessionCards[currentIndex];

  const handleRate = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard) return;

      const result = calculateSM2(currentCard, rating);
      const updatedCard: Flashcard = {
        ...currentCard,
        interval: result.interval,
        repetition: result.repetition,
        easeFactor: result.easeFactor,
        state: result.state,
        dueDate: result.dueDate,
      };

      onSaveCard(updatedCard);

      setStats((prev) => ({
        ...prev,
        [rating]: prev[rating] + 1,
      }));

      if (currentIndex + 1 < sessionCards.length) {
        setCurrentIndex((prev) => prev + 1);
        setIsAnswerRevealed(false);
      } else {
        setIsFinished(true);
      }
    },
    [currentCard, currentIndex, sessionCards.length, onSaveCard]
  );

  // Keyboard shortcut listener (Space, Enter, 1, 2, 3, 4, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on an input or textarea, don't hijack keys
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (isFinished) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (!isAnswerRevealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setIsAnswerRevealed(true);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleRate('again');
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate('hard');
        } else if (e.key === '3' || e.key === ' ' || e.key === 'Enter') {
          // Standard Anki shortcut: Space or Enter when answer revealed rates 'Good'
          e.preventDefault();
          handleRate('good');
        } else if (e.key === '4') {
          e.preventDefault();
          handleRate('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAnswerRevealed, isFinished, handleRate, onClose]);

  if (!isOpen) return null;

  const totalCards = sessionCards.length;
  const progressPercent = totalCards > 0 ? (currentIndex / totalCards) * 100 : 100;
  const previews = currentCard ? getIntervalPreviews(currentCard) : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '1.5rem',
      }}
    >
      <div
        className="placeholder-card modal-dialog"
        style={{
          width: '100%',
          maxWidth: '780px',
          minHeight: '480px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Top Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-primary-glow)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                {currentCard?.subjectName || 'Sessão de Revisão'}
              </span>
              {currentCard?.topicName && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  • {currentCard.topicName}
                </span>
              )}
            </div>
            {!isFinished && totalCards > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Card <strong>{currentIndex + 1}</strong> de <strong>{totalCards}</strong>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-element)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Fechar Revisão (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        {!isFinished && totalCards > 0 && (
          <div
            style={{
              height: '4px',
              width: '100%',
              backgroundColor: 'var(--bg-element)',
              borderRadius: '2px',
              marginBottom: '1.5rem',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: 'var(--color-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}

        {/* Content Area */}
        {isFinished ? (
          /* Finished Screen */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '2rem 1rem',
              gap: '1.25rem',
              margin: 'auto 0',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
              }}
            >
              <Trophy size={36} />
            </div>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-title)' }}>
              {totalCards > 0 ? 'Revisão Concluída!' : 'Nenhum Card Pendente!'}
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '0.95rem' }}>
              {totalCards > 0
                ? 'Parabéns! Você revisou todos os flashcards previstos para esta sessão. Seu cérebro acabou de reforçar conexões neurais essenciais pelo algoritmo SM-2!'
                : 'Não há flashcards devidos para revisão no momento nesta seleção.'}
            </p>

            {/* Session Stats Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.75rem',
                width: '100%',
                maxWidth: '480px',
                marginTop: '0.5rem',
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                  {stats.again}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>ERROS</div>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-warning)' }}>
                  {stats.hard}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>DIFÍCEIS</div>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-success)' }}>
                  {stats.good}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>BONS</div>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
                  {stats.easy}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>FÁCEIS</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mock-btn"
              style={{
                marginTop: '1rem',
                padding: '0.8rem 2rem',
                fontWeight: 700,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={18} /> Concluir Sessão
            </button>
          </div>
        ) : (
          /* Active Review Flow */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1.5rem', justifyContent: 'center' }}>
            {/* Front Card Area (Clickable to reveal answer) */}
            <div
              onClick={() => {
                if (!isAnswerRevealed) setIsAnswerRevealed(true);
              }}
              style={{
                backgroundColor: 'var(--bg-element)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                border: '1px solid var(--border-color)',
                fontSize: '1.15rem',
                color: 'var(--text-title)',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                cursor: !isAnswerRevealed ? 'pointer' : 'default',
              }}
              title={!isAnswerRevealed ? 'Clique para mostrar a resposta (ou tecle Espaço)' : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Frente {!isAnswerRevealed && '• (Clique ou tecle Espaço para virar)'}
                </span>
                {currentCard && currentCard.dueDate > formatLocalDate(new Date()) && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Reforço Livre
                  </span>
                )}
              </div>
              <FormattedText text={currentCard.front} isAnswerRevealed={isAnswerRevealed} />
            </div>

            {/* Answer Revealed Back Area */}
            {isAnswerRevealed && (
              <div
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.04)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  fontSize: '1.1rem',
                  color: 'var(--text-title)',
                  animation: 'fadeInTab 0.25s ease-out',
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-primary)',
                    marginBottom: '0.5rem',
                    display: 'block',
                  }}
                >
                  Verso (Resposta)
                </span>
                <FormattedText text={currentCard.back} isAnswerRevealed={true} />
              </div>
            )}
          </div>
        )}

        {/* Action Controls / Bottom Buttons */}
        {!isFinished && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            {!isAnswerRevealed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAnswerRevealed(true)}
                  className="mock-btn"
                  style={{
                    width: '100%',
                    maxWidth: '380px',
                    padding: '0.9rem 1.5rem',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  Mostrar Resposta
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Atalho: pressione <strong>Espaço</strong> ou <strong>Enter</strong>
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {/* 1. Errei (Again) */}
                  <button
                    type="button"
                    onClick={() => handleRate('again')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1.5px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>[ 1 ]</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>Errei</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '4px' }}>
                      {previews?.again.label}
                    </span>
                  </button>

                  {/* 2. Difícil (Hard) */}
                  <button
                    type="button"
                    onClick={() => handleRate('hard')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1.5px solid rgba(245, 158, 11, 0.4)',
                      color: 'var(--color-warning)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>[ 2 ]</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>Difícil</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '4px' }}>
                      {previews?.hard.label}
                    </span>
                  </button>

                  {/* 3. Bom (Good) */}
                  <button
                    type="button"
                    onClick={() => handleRate('good')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1.5px solid rgba(16, 185, 129, 0.4)',
                      color: 'var(--color-success)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>[ 3 ]</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>Bom</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '4px' }}>
                      {previews?.good.label}
                    </span>
                  </button>

                  {/* 4. Fácil (Easy) */}
                  <button
                    type="button"
                    onClick={() => handleRate('easy')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(14, 165, 233, 0.12)',
                      border: '1.5px solid rgba(14, 165, 233, 0.4)',
                      color: 'var(--color-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>[ 4 ]</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>Fácil</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '4px' }}>
                      {previews?.easy.label}
                    </span>
                  </button>
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Atalhos de teclado: <strong>1</strong> (Errei) • <strong>2</strong> (Difícil) • <strong>3 / Espaço</strong> (Bom) • <strong>4</strong> (Fácil)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
