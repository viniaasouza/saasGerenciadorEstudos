import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface FooterAdBannerProps {
  adClient?: string;
  adSlot?: string;
  onOpenPrivacy?: () => void;
  className?: string;
}

export const FooterAdBanner: React.FC<FooterAdBannerProps> = ({
  adClient,
  adSlot,
  onOpenPrivacy,
  className = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const adRef = useRef<HTMLModElement | null>(null);

  // Initialize Google AdSense if script is present and client id is provided
  useEffect(() => {
    if (adClient && adSlot && typeof window !== 'undefined') {
      try {
        // @ts-expect-error Google AdSense global
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        setAdFailed(true);
      }
    }
  }, [adClient, adSlot]);

  const hasRealAd = Boolean(adClient && adSlot && !adFailed);

  if (isCollapsed) {
    return (
      <footer
        className={`footer-ad-container ${className}`}
        style={{
          width: '100%',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          padding: '4px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '1px 5px',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-element)',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Publicidade
          </span>
          <span>Anúncios discretos apoiam a manutenção do ixtude.ai 100% gratuito.</span>
        </div>

        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--color-primary)',
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Expandir anúncio"
        >
          <span>Exibir</span>
          <ChevronUp size={12} />
        </button>
      </footer>
    );
  }

  return (
    <footer
      className={`footer-ad-container ${className}`}
      style={{
        width: '100%',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        padding: '10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        position: 'relative',
        zIndex: 5,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top micro bar: label + transparency links + collapse */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-element)',
              fontWeight: 800,
              fontSize: '0.62rem',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Publicidade
          </span>
          <span>Google AdSense & Parceiros Educacionais</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onOpenPrivacy && (
            <button
              onClick={onOpenPrivacy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                color: 'var(--text-muted)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              title="Transparência de Cookies e LGPD"
            >
              <Info size={11} />
              <span>Privacidade & Cookies</span>
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              cursor: 'pointer',
            }}
            title="Ocultar anúncio temporariamente"
          >
            <span>Ocultar</span>
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Main Ad Banner Area */}
      {hasRealAd ? (
        <div
          style={{
            minHeight: '50px',
            maxHeight: '90px',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', maxHeight: '90px' }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        /* Graceful Affiliate / Educational Fallback Banner */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '8px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-element)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Gran Cursos Online & Qconcursos • Recursos Oficiais de Estudo
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Turbine sua preparação com videoaulas, PDFs sintetizados e milhares de questões comentadas.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <a
              href="https://questoes.grancursosonline.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="mock-btn"
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                textDecoration: 'none',
              }}
            >
              <span>Conferir Questões</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </footer>
  );
};
