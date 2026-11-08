import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface FooterAdBannerProps {
  adClient?: string;
  adSlot?: string;
  onOpenPrivacy?: () => void;
  className?: string;
}

const DEFAULT_PUB_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADSENSE_PUB_ID) || 'ca-pub-9810973652333319';
const DEFAULT_SLOT_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADSENSE_FOOTER_SLOT) || '3416652040';
const COOKIE_STORAGE_KEY = 'ixtude_cookie_consent';

export const FooterAdBanner: React.FC<FooterAdBannerProps> = ({
  adClient = DEFAULT_PUB_ID,
  adSlot = DEFAULT_SLOT_ID,
  onOpenPrivacy,
  className = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [consentAllowed, setConsentAllowed] = useState(true);
  const adRef = useRef<HTMLModElement | null>(null);

  // Validate LGPD consent before enabling third-party advertising cookies
  useEffect(() => {
    const checkConsent = () => {
      if (typeof localStorage === 'undefined') return true;
      try {
        const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.status === 'essential_only') {
            return false;
          }
        }
        return true;
      } catch {
        return true;
      }
    };

    const allowed = checkConsent();
    setConsentAllowed(allowed);

    // If storage changes in another component or tab, update consent dynamically
    const handleStorage = (e: StorageEvent) => {
      if (e.key === COOKIE_STORAGE_KEY) {
        setConsentAllowed(checkConsent());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Initialize Google AdSense if script is present, client id is provided, and LGPD allows
  useEffect(() => {
    if (adClient && adSlot && consentAllowed && typeof window !== 'undefined') {
      try {
        // @ts-expect-error Google AdSense global
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        setAdFailed(true);
      }
    }
  }, [adClient, adSlot, consentAllowed]);

  // Fallback observer: if Google AdSense takes too long or returns unfilled, ensure informative banner is visible
  const [adLoaded, setAdLoaded] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      if (adRef.current) {
        const hasIframe = adRef.current.querySelector('iframe') !== null;
        const status = adRef.current.getAttribute('data-ad-status');
        if (hasIframe || (adRef.current.innerHTML.trim().length > 0 && status !== 'unfilled')) {
          setAdLoaded(true);
          clearInterval(timer);
        }
      }
    }, 1500);
    const timeout = setTimeout(() => clearInterval(timer), 6000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [adClient, adSlot]);

  const isAdEligible = Boolean(adClient && adSlot && !adFailed && consentAllowed);

  if (isCollapsed) {
    return (
      <footer
        className={`footer-ad-container ${className}`}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          padding: '4px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          flexShrink: 0,
          margin: 0,
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
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        padding: '10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        position: 'relative',
        zIndex: 5,
        flexShrink: 0,
        margin: 0,
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
      <div
        style={{
          minHeight: '50px',
          maxHeight: '90px',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: (isAdEligible && adLoaded) ? 'block' : 'none', width: '100%', maxHeight: '90px' }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />

        {!adLoaded && (
          /* Graceful Educational & AdSense Status Fallback Banner */
          <div
            style={{
              width: '100%',
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
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Gran Cursos Online & Qconcursos • Parcerias Oficiais</span>
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 600 }}>
                    Google AdSense Ativo (Slot #{adSlot})
                  </span>
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
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span>Acessar Questões</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};
