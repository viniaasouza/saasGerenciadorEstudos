import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Calendar, Timer, Award, BarChart3, BookOpen, 
  FileText, RotateCcw, Layers, ChevronLeft, ChevronRight,
  Shield, Globe, MessageSquare, User, LogIn, LogOut
} from 'lucide-react';
import type { ConcursoInfo } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  concursoInfo?: ConcursoInfo | null;
  onOpenFeedback?: () => void;
  onToggleLandingPage?: () => void;
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  concursoInfo,
  onOpenFeedback,
  onToggleLandingPage,
  onOpenAuth,
}) => {
  const { user, signOut, isAdmin } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 960) return true;
    const saved = localStorage.getItem('concurso_estudos_sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('concurso_estudos_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    let prevWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (prevWidth >= 960 && currentWidth < 960) {
        setIsCollapsed(true);
      }
      prevWidth = currentWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const baseMenuItems = [
    { id: 'autopilot', label: 'Piloto Automático', icon: Sparkles, description: 'Missão de Hoje' },
    { id: 'planning', label: 'Planejamento', icon: Calendar, description: 'Ciclo & Pesos' },
    { id: 'syllabus', label: 'Edital', icon: FileText, description: 'Verticalizado' },
    { id: 'timer', label: 'Estudo Ativo', icon: Timer, description: 'Cronômetro' },
    { id: 'reviews', label: 'Revisões', icon: RotateCcw, description: 'Espaçadas' },
    { id: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Anki SM-2' },
    { id: 'questions', label: 'Questões', icon: Award, description: 'Desempenho' },
    { id: 'analytics', label: 'Desempenho', icon: BarChart3, description: 'Gráficos' },
  ];

  const menuItems = (user && isAdmin)
    ? [...baseMenuItems, { id: 'admin', label: 'Administrador', icon: Shield, description: 'Métricas & Bugs' }]
    : baseMenuItems;

  const hasExamDate = Boolean(concursoInfo?.concurso && concursoInfo?.dataProva);
  let daysRemaining = 0;
  if (hasExamDate && concursoInfo?.dataProva) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exam = new Date(concursoInfo.dataProva + 'T00:00:00');
    daysRemaining = Math.ceil((exam.getTime() - now.getTime()) / 86400000);
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="logo-area" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        padding: isCollapsed ? '1.25rem 0.5rem' : '1.5rem 1.25rem',
        gap: '0.5rem'
      }}>
        {!isCollapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
              <BookOpen className="logo-icon" />
              <div className="logo-text">
                <h1>estud.ai</h1>
                <span>Ciclo Inteligente & Edital</span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleCollapse}
              className="sidebar-toggle-btn"
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen className="logo-icon" />
            <button
              type="button"
              onClick={toggleCollapse}
              className="sidebar-toggle-btn"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* EXAM COUNTDOWN CARD */}
      {hasExamDate && concursoInfo?.dataProva && (!isCollapsed ? (
        <div className="countdown-full" style={{
          margin: '0.75rem 1rem 0.25rem',
          background: 'linear-gradient(135deg, #c8102e, #8e0b1f)',
          borderRadius: '12px',
          padding: '12px 14px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(200, 16, 46, 0.25)'
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85 }}>
              {concursoInfo?.banca ? concursoInfo.banca.split(' ')[0] : 'Prova'} • Alvo
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '2px' }}>
              {new Date(concursoInfo.dataProva + 'T00:00:00').toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 }}>
              {daysRemaining > 0 ? daysRemaining : 0}
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>dias</div>
          </div>
        </div>
      ) : (
        <div
          className="countdown-compact"
          style={{
            margin: '0.5rem 0.4rem 0.25rem',
            background: 'linear-gradient(135deg, #c8102e, #8e0b1f)',
            borderRadius: '10px',
            padding: '8px 2px',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            boxShadow: '0 4px 10px rgba(200, 16, 46, 0.25)',
            cursor: 'pointer'
          }}
          title={`Prova ${concursoInfo?.concurso || 'Alvo'}: ${daysRemaining} dias restantes`}
        >
          <div style={{ fontSize: '1.15rem', fontWeight: 900, lineHeight: 1 }}>
            {daysRemaining > 0 ? daysRemaining : 0}
          </div>
          <div style={{ fontSize: '0.6rem', opacity: 0.85, textTransform: 'uppercase', fontWeight: 700 }}>
            dias
          </div>
        </div>
      ))}

      <nav className="nav-menu" style={{ padding: isCollapsed ? '1rem 0.35rem' : '1.25rem 0.75rem' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (typeof window !== 'undefined' && window.innerWidth < 960) {
                  setIsCollapsed(true);
                }
              }}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={isCollapsed ? `${item.label} - ${item.description}` : undefined}
            >
              <Icon className="nav-icon" />
              {!isCollapsed && (
                <div className="nav-details">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-sublabel">{item.description}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* QUICK LINKS SECTION (Landing Page & Feedback) */}
      {!isCollapsed && (
        <div style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {onToggleLandingPage && (
            <button
              onClick={onToggleLandingPage}
              className="mock-btn text-muted"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'flex-start',
              }}
              title="Acessar Landing Page"
            >
              <Globe size={14} />
              <span>Ver Landing Page</span>
            </button>
          )}

          {onOpenFeedback && (
            <button
              onClick={onOpenFeedback}
              className="mock-btn text-muted"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'flex-start',
              }}
              title="Enviar Feedback ou Relatar Bug"
            >
              <MessageSquare size={14} />
              <span>Enviar Feedback</span>
            </button>
          )}
        </div>
      )}

      {/* USER ACCOUNT FOOTER */}
      {!isCollapsed ? (
        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div
                onClick={onOpenAuth}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', overflow: 'hidden' }}
                title="Clique para gerenciar conta"
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: user.role === 'admin' ? '#ef4444' : 'var(--color-accent)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {user.role === 'admin' ? 'Administrador' : 'Concurseiro'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => signOut()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                title="Sair da Conta"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="mock-btn"
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <LogIn size={14} />
              <span>Entrar / Cadastrar</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '0.75rem 0.25rem', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={onOpenAuth}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
            title={user ? `Logado como: ${user.name}` : 'Fazer Login'}
          >
            <User size={18} />
          </button>
        </div>
      )}

      {/* Backdrop overlay when sidebar is expanded in multitasking drawer mode */}
      {!isCollapsed && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsCollapsed(true)}
          style={{
            display: typeof window !== 'undefined' && window.innerWidth < 960 ? 'block' : 'none',
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
        />
      )}
    </aside>
  );
};
