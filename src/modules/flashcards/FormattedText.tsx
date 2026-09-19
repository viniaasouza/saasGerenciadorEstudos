import React from 'react';

interface FormattedTextProps {
  text: string;
  isAnswerRevealed?: boolean;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  isAnswerRevealed = false,
  className = '',
}) => {
  if (!text) return null;

  // Process text lines
  const lines = text.split('\n');

  const renderInline = (inlineText: string, keyPrefix: string): React.ReactNode[] => {
    // 1. Handle Cloze deletion {{c1::answer}} or {{c1::answer::hint}}
    const clozeRegex = /\{\{c\d+::(.*?)(?:::([^}]*))?\}\}/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = clozeRegex.exec(inlineText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(parseMarkdownSpans(inlineText.substring(lastIndex, match.index), `${keyPrefix}-t-${lastIndex}`));
      }

      const answer = match[1];
      const hint = match[2];

      if (!isAnswerRevealed) {
        parts.push(
          <span
            key={`${keyPrefix}-cloze-${match.index}`}
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--color-primary)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700,
              border: '1px dashed var(--color-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            [{hint ? hint : '...'}]
          </span>
        );
      } else {
        parts.push(
          <span
            key={`${keyPrefix}-cloze-${match.index}`}
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--color-success)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700,
              border: '1px solid var(--color-success)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {parseMarkdownSpans(answer, `${keyPrefix}-cloze-ans-${match.index}`)}
          </span>
        );
      }

      lastIndex = clozeRegex.lastIndex;
    }

    if (lastIndex < inlineText.length) {
      parts.push(parseMarkdownSpans(inlineText.substring(lastIndex), `${keyPrefix}-t-${lastIndex}`));
    }

    return parts.length > 0 ? parts : [parseMarkdownSpans(inlineText, `${keyPrefix}-all`)];
  };

  const parseMarkdownSpans = (raw: string, baseKey: string): React.ReactNode => {
    // Parse bold **text**, italic *text*, code `code`
    const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const elements: React.ReactNode[] = [];
    let cur = 0;
    let tokenMatch: RegExpExecArray | null;

    while ((tokenMatch = tokenRegex.exec(raw)) !== null) {
      if (tokenMatch.index > cur) {
        elements.push(raw.substring(cur, tokenMatch.index));
      }

      const token = tokenMatch[1];
      if (token.startsWith('**') && token.endsWith('**')) {
        elements.push(
          <strong key={`${baseKey}-b-${tokenMatch.index}`} style={{ fontWeight: 700, color: 'var(--text-title)' }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        elements.push(
          <code
            key={`${baseKey}-c-${tokenMatch.index}`}
            style={{
              backgroundColor: 'var(--bg-element)',
              border: '1px solid var(--border-color)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '0.9em',
              fontFamily: 'monospace',
              color: 'var(--color-primary)',
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        elements.push(
          <em key={`${baseKey}-i-${tokenMatch.index}`} style={{ fontStyle: 'italic' }}>
            {token.slice(1, -1)}
          </em>
        );
      }

      cur = tokenRegex.lastIndex;
    }

    if (cur < raw.length) {
      elements.push(raw.substring(cur));
    }

    return <React.Fragment key={baseKey}>{elements}</React.Fragment>;
  };

  return (
    <div className={`formatted-text-content ${className}`} style={{ lineHeight: '1.6', wordBreak: 'break-word' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.6rem 0 0.3rem', color: 'var(--text-title)' }}>
              {renderInline(trimmed.slice(2), `h1-${idx}`)}
            </h2>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.5rem 0 0.25rem', color: 'var(--text-title)' }}>
              {renderInline(trimmed.slice(3), `h2-${idx}`)}
            </h3>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} style={{ fontSize: '1rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: 'var(--text-title)' }}>
              {renderInline(trimmed.slice(4), `h3-${idx}`)}
            </h4>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              style={{
                borderLeft: '4px solid var(--color-primary)',
                paddingLeft: '0.75rem',
                margin: '0.4rem 0',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                backgroundColor: 'var(--bg-element)',
                padding: '0.4rem 0.75rem',
                borderRadius: '0 6px 6px 0',
              }}
            >
              {renderInline(trimmed.slice(2), `quote-${idx}`)}
            </blockquote>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.2rem 0' }}>
              <span style={{ color: 'var(--color-primary)', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
              <div>{renderInline(trimmed.slice(2), `li-${idx}`)}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.2rem 0' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, minWidth: '1.2rem', fontSize: '0.85rem' }}>
                {numMatch[1]}.
              </span>
              <div>{renderInline(numMatch[2], `ol-${idx}`)}</div>
            </div>
          );
        }

        if (!trimmed) {
          return <div key={idx} style={{ height: '0.6rem' }} />;
        }

        return (
          <p key={idx} style={{ margin: '0.2rem 0' }}>
            {renderInline(line, `p-${idx}`)}
          </p>
        );
      })}
    </div>
  );
};
