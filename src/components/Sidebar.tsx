import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Calendar, Timer, Award, BarChart3, BookOpen, 
  FileText, RotateCcw, Layers, ChevronLeft, ChevronRight 
} from 'lucide-react';
import type { ConcursoInfo } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  concursoInfo?: ConcursoInfo | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, concursoInfo }) => {
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

  const menuItems = [
    { id: 'autopilot', label: 'Piloto Automático', icon: Sparkles, description: 'Missão de Hoje' },
    { id: 'planning', label: 'Planejamento', icon: Calendar, description: 'Ciclo & Pesos' },
    { id: 'syllabus', label: 'Edital', icon: FileText, description: 'Verticalizado' },
    { id: 'timer', label: 'Estudo Ativo', icon: Timer, description: 'Cronômetro' },
    { id: 'reviews', label: 'Revisões', icon: RotateCcw, description: 'Espaçadas' },
    { id: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Anki SM-2' },
    { id: 'questions', label: 'Questões', icon: Award, description: 'Desempenho' },
    { id: 'analytics', label: 'Desempenho', icon: BarChart3, description: 'Gráficos' },
  ];

  const examDate = concursoInfo?.dataProva || '2027-01-17';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate + 'T00:00:00');
  const daysRemaining = Math.ceil((exam.getTime() - now.getTime()) / 86400000);

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
      {!isCollapsed ? (
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
              {concursoInfo?.banca ? concursoInfo.banca.split(' ')[0] : 'FCC'} • Prova
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '2px' }}>
              {new Date(examDate + 'T00:00:00').toLocaleDateString('pt-BR')}
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
          title={`Prova ${concursoInfo?.concurso || 'TCE-GO'} (${concursoInfo?.banca || 'FCC'}): ${daysRemaining} dias restantes`}
        >
          <div style={{ fontSize: '1.15rem', fontWeight: 900, lineHeight: 1 }}>
            {daysRemaining > 0 ? daysRemaining : 0}
          </div>
          <div style={{ fontSize: '0.6rem', opacity: 0.85, textTransform: 'uppercase', fontWeight: 700 }}>
            dias
          </div>
        </div>
      )}

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

      {!isCollapsed && (
        <div className="sidebar-footer">
          <p>Modo Local • {concursoInfo?.concurso || 'TCE-GO'}</p>
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
