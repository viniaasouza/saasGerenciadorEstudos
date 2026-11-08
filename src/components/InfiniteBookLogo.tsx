import React from 'react';

interface InfiniteBookLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const InfiniteBookLogo: React.FC<InfiniteBookLogoProps> = ({
  size = 32,
  className = '',
  style = {},
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      aria-label="ixtude.ai - Livro Infinito"
    >
      <defs>
        <linearGradient id="infiniteBookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="#0f172a" />
      <rect
        x="2"
        y="2"
        width="124"
        height="124"
        rx="26"
        fill="none"
        stroke="url(#infiniteBookGrad)"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      {/* Open Book Wings Forming Infinity and Growth */}
      <g transform="translate(14, 28)">
        {/* Left Wing/Page */}
        <path
          d="M50 56 C32 20 8 32 6 52 C4 66 18 70 34 62 C44 57 48 54 50 52 Z"
          fill="url(#infiniteBookGrad)"
          opacity="0.9"
        />
        {/* Right Wing/Page */}
        <path
          d="M50 56 C68 20 92 32 94 52 C96 66 82 70 66 62 C56 57 52 54 50 52 Z"
          fill="url(#infiniteBookGrad)"
        />
        {/* Central Spine / Core */}
        <line
          x1="50"
          y1="20"
          x2="50"
          y2="60"
          stroke="#f8fafc"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Rising Sparkle */}
        <circle cx="50" cy="12" r="5" fill="#facc15" />
      </g>
    </svg>
  );
};
