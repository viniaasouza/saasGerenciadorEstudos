import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';

interface CookieConsentBannerProps {
  onOpenTerms: () => void;
}

const STORAGE_KEY = 'ixtude_cookie_consent';

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onOpenTerms }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Small delay so it transitions smoothly after initial render
        const timer = setTimeout(() => setIsVisible(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleAcceptAll = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'accepted', date: new Date().toISOString() }));
    }
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'essential_only', date: new Date().toISOString() }));
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de Cookies e Privacidade"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        padding: '1.25rem 1.5rem',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Cookie size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-title)' }}>
                Privacidade & Cookies no ixtude.ai
              </h4>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-success)',
                  fontWeight: 700,
                }}
              >
                LGPD Compliant
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Utilizamos cookies próprios e de terceiros (incluindo a rede de anúncios Google AdSense) para personalizar conteúdos, mensurar métricas de tráfego e viabilizar a gratuidade da plataforma para todos os concurseiros, em estrita conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
            </p>
          </div>
        </div>

        <button
          onClick={handleAcceptEssential}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title="Fechar e manter apenas essenciais"
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button
          onClick={onOpenTerms}
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
            padding: '6px 12px',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Ver Termos & Política Completa
        </button>

        <button
          onClick={handleAcceptEssential}
          className="mock-btn text-muted"
          style={{
            fontSize: '0.8rem',
            padding: '7px 14px',
            borderRadius: '8px',
            fontWeight: 700,
          }}
        >
          Apenas Essenciais
        </button>

        <button
          onClick={handleAcceptAll}
          className="mock-btn"
          style={{
            fontSize: '0.8rem',
            padding: '7px 18px',
            borderRadius: '8px',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ShieldCheck size={14} />
          <span>Aceitar Todos</span>
        </button>
      </div>
    </div>
  );
};
