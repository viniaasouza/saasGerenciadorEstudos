import type { Flashcard } from '../../types';
import { formatLocalDate } from './sm2';

/**
 * Converts markdown formatting to HTML compatible with Anki #html:true.
 */
export function formatMarkdownToAnkiHtml(text: string): string {
  if (!text) return '';
  return text
    // Replace tabs to 4 spaces so they don't break TSV columns
    .replace(/\t/g, '    ')
    // Headings
    .replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
    // Blockquotes
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    // Bullet lists
    .replace(/^[-*]\s+(.*)$/gm, '• $1<br>')
    // Numbered lists (e.g. 1. text)
    .replace(/^(\d+)\.\s+(.*)$/gm, '<b>$1.</b> $2<br>')
    // Bold: **text**
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    // Italic: *text*
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    // Inline code: `code`
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Line breaks to <br>
    .replace(/\r\n/g, '<br>')
    .replace(/\n/g, '<br>');
}

/**
 * Exports flashcards to a UTF-8 Anki-compatible TXT/TSV format.
 * Format: Front \t Back \t Tags
 */
export function exportCardsToAnki(cards: Flashcard[], workspaceName = 'concurso'): number {
  if (!cards || cards.length === 0) {
    return 0;
  }

  const header = [
    '#separator:tab',
    '#html:true',
    '#tags column:3',
  ];

  const rows = cards.map((card) => {
    // Convert markdown to clean HTML for Anki
    const sanitizedFront = formatMarkdownToAnkiHtml(card.front);
    const sanitizedBack = formatMarkdownToAnkiHtml(card.back);

    // Combine subject, topic, and custom tags into tag list
    const tagsList = [
      ...(card.tags || []),
      card.subjectName ? card.subjectName.trim() : '',
      card.topicName ? card.topicName.trim() : '',
    ]
      .filter(Boolean)
      .map((t) => t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, ''))
      .filter((t, i, arr) => arr.indexOf(t) === i);

    const tagsString = tagsList.join(' ');

    return `${sanitizedFront}\t${sanitizedBack}\t${tagsString}`;
  });

  const fileContent = [...header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + fileContent], {
    type: 'text/tab-separated-values;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeWsName = workspaceName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 20);
  const today = formatLocalDate(new Date());

  anchor.href = url;
  anchor.download = `flashcards_anki_${safeWsName}_${today}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return cards.length;
}
