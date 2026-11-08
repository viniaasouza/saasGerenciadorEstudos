import React from 'react';

interface OwlLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const OwlLogo: React.FC<OwlLogoProps> = ({
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
      aria-label="ixtude.ai - Coruja da Aprovação"
    >
      <defs>
        <linearGradient id="owlLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
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
        stroke="url(#owlLogoGrad)"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      {/* Minimalist Owl Geometry */}
      <g transform="translate(24, 20)">
        {/* Ears & Brow Line */}
        <path
          d="M6 24 L24 8 L40 22 L56 8 L74 24"
          fill="none"
          stroke="url(#owlLogoGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Eyes */}
        <circle cx="25" cy="40" r="14" fill="none" stroke="url(#owlLogoGrad)" strokeWidth="5" />
        <circle cx="55" cy="40" r="14" fill="none" stroke="url(#owlLogoGrad)" strokeWidth="5" />
        {/* Pupils (Cyan Intelligence) */}
        <circle cx="25" cy="40" r="5" fill="#38bdf8" />
        <circle cx="55" cy="40" r="5" fill="#38bdf8" />
        {/* Beak */}
        <polygon points="40,46 34,56 46,56" fill="#facc15" />
        {/* Chest Outline */}
        <path
          d="M14 54 C14 74 26 84 40 84 C54 84 66 74 66 54"
          fill="none"
          stroke="url(#owlLogoGrad)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

// Backward-compatible alias for InfiniteBookLogo
export const InfiniteBookLogo = OwlLogo;
