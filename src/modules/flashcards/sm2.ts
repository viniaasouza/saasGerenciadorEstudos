import type { Flashcard, FlashcardState } from '../../types';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface SM2Result {
  interval: number;
  repetition: number;
  easeFactor: number;
  state: FlashcardState;
  dueDate: string; // YYYY-MM-DD
}

/**
 * Formats a Date instance into local YYYY-MM-DD string without UTC shift.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Human readable interval string for preview badges (e.g. "< 1 dia", "6 dias", "1 mês")
 */
export function formatIntervalPreview(days: number): string {
  if (days <= 0) return '< 1 dia';
  if (days === 1) return '1 dia';
  if (days < 30) return `${days} dias`;
  if (days < 365) {
    const months = (days / 30).toFixed(1).replace('.0', '');
    return `${months} ${Number(months) === 1 ? 'mês' : 'meses'}`;
  }
  const years = (days / 365).toFixed(1).replace('.0', '');
  return `${years} ${Number(years) === 1 ? 'ano' : 'anos'}`;
}

/**
 * Calculates next SM-2 parameters when a card is reviewed with a given rating.
 */
export function calculateSM2(
  card: Flashcard,
  rating: ReviewRating,
  baseDate: Date = new Date()
): SM2Result {
  let interval = card.interval || 0;
  let repetition = card.repetition || 0;
  let easeFactor = card.easeFactor || 2.5;
  let state: FlashcardState = 'review';

  switch (rating) {
    case 'again':
      repetition = 0;
      interval = 1;
      easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
      state = 'learning';
      break;

    case 'hard':
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      easeFactor = Math.max(1.3, Number((easeFactor - 0.15).toFixed(2)));
      state = repetition === 0 ? 'learning' : 'review';
      break;

    case 'good':
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.max(1, Math.round((interval || 1) * easeFactor));
      }
      repetition += 1;
      state = 'review';
      break;

    case 'easy':
      if (repetition === 0) {
        interval = 4;
      } else {
        interval = Math.max(1, Math.round((interval || 1) * easeFactor * 1.3));
      }
      repetition += 1;
      easeFactor = Number((easeFactor + 0.15).toFixed(2));
      state = 'review';
      break;
  }

  const nextDate = new Date(baseDate.getTime());
  nextDate.setDate(nextDate.getDate() + interval);
  const dueDate = formatLocalDate(nextDate);

  return {
    interval,
    repetition,
    easeFactor,
    state,
    dueDate
  };
}

/**
 * Returns next interval predictions for all 4 ratings for UI buttons.
 */
export function getIntervalPreviews(card: Flashcard): Record<ReviewRating, { days: number; label: string }> {
  const again = calculateSM2(card, 'again');
  const hard = calculateSM2(card, 'hard');
  const good = calculateSM2(card, 'good');
  const easy = calculateSM2(card, 'easy');

  return {
    again: { days: again.interval, label: formatIntervalPreview(again.interval) },
    hard: { days: hard.interval, label: formatIntervalPreview(hard.interval) },
    good: { days: good.interval, label: formatIntervalPreview(good.interval) },
    easy: { days: easy.interval, label: formatIntervalPreview(easy.interval) }
  };
}
