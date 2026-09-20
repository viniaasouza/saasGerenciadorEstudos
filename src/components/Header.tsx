import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Clock, Calendar, Play, Download, Upload, 
  Sparkles, MessageSquare, LogIn, LogOut, User, Globe
} from 'lucide-react';
import type { ConcursoInfo, RunningTimerState } from '../types';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  weeklyHoursCompleted: number;
  weeklyHoursTarget: number;
  concursoInfo?: ConcursoInfo | null;
  activeTab?: string;
  onNavigateToTimer?: () => void;
  onOpenAuth?: () => void;
  onOpenFeedback?: () => void;
  onOpenAiImport?: () => void;
  onToggleLandingPage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  weeklyHoursCompleted,
  weeklyHoursTarget,
  concursoInfo,
  activeTab,
  onNavigateToTimer,
  onOpenAuth,
  onOpenFeedback,
  onOpenAiImport,
  onToggleLandingPage,
}) => {
  const { user, signOut } = useAuth();
  const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);

  // Live timer polling for header mini-badge
  useEffect(() => {
    const checkTimer = () => {
      const active = db.getActiveTimer();
      setRunningTimer(active);
      if (active && active.isActive) {
        let secs = active.accumulatedSeconds;
        if (!active.isPaused && active.startTime) {
          secs += Math.floor((Date.now() - active.startTime) / 1000);
        }
        setLiveElapsed(secs);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const examDate = concursoInfo?.dataProva || '2027-01-17';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate + 'T00:00:00');
  const daysRemaining = Math.ceil((exam.getTime() - now.getTime()) / 86400000);

  const handleExportBackup = () => {
    try {
      const jsonStr = db.exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `backup-estud-ai-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erro ao exportar backup: ' + (err?.message || err));
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      'Atenção: Restaurar um backup irá substituir todos os dados atuais (ciclos, matérias, sessões e flashcards) pelas informações do arquivo.\n\nDeseja continuar?'
    );
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const res = db.importAllData(content);
        if (res.success) {
          alert(res.message + '\nA página será recarregada para sincronizar todos os dados.');
          window.location.reload();
        } else {
          alert('Erro ao restaurar backup: ' + res.message);
        }
      } catch (err: any) {
        alert('Falha ao processar arquivo: ' + (err?.message || err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const displayName = user?.name || (typeof localStorage !== 'undefined' ? localStorage.getItem('concurso_estudos_user_name') : null);

  return (
    <header className="app-header">
      <div className="header-greeting">
        <h2>{displayName ? `Bons estudos, ${displayName}!` : 'Bons estudos!'}</h2>
        <p className="header-subtitle">
          Foco e persistência rumo à aprovação no {concursoInfo?.concurso || 'Seu Concurso'} • {concursoInfo?.banca || 'Banca Alvo'}.
        </p>
      </div>

      <div className="header-actions">
        {/* Live Active Timer Mini Widget when not on timer tab */}
        {runningTimer?.isActive && activeTab !== 'timer' && (
          <div
            onClick={onNavigateToTimer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: runningTimer.isPaused ? '#f59e0b' : '#22c55e',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(34, 197, 94, 0.35)',
              transition: 'all 0.2s ease',
            }}
            title="Clique para abrir o Cronômetro"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
              }}
            />
            <span>{runningTimer.subjectName}: {formatTime(liveElapsed)}</span>
            <Play size={12} fill="currentColor" style={{ marginLeft: '2px' }} />
          </div>
        )}

        {/* AI Syllabus Quick Import Button */}
        {onOpenAiImport && (
          <button
            onClick={onOpenAiImport}
            className="mock-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Importar Edital Verticalizado com IA"
          >
            <Sparkles size={14} />
            <span className="hide-mobile">Importar com IA</span>
          </button>
        )}

        {/* Landing Page Link Button */}
        {onToggleLandingPage && (
          <button
            onClick={onToggleLandingPage}
            className="header-action-btn"
            title="Ver Landing Page da Plataforma"
            aria-label="Ver Landing Page"
          >
            <Globe size={14} />
            <span className="hide-mobile">Início</span>
          </button>
        )}

        {/* Feedback Button */}
        {onOpenFeedback && (
          <button
            onClick={onOpenFeedback}
            className="header-action-btn"
            title="Enviar Sugestão ou Reportar Bug"
            aria-label="Enviar Feedback"
          >
            <MessageSquare size={14} />
            <span className="hide-mobile">Feedback</span>
          </button>
        )}

        {/* Countdown Badge */}
        <div className="cycle-badge header-countdown-badge" style={{ borderLeft: '3px solid #c8102e' }}>
          <Calendar className="badge-icon" style={{ color: '#c8102e' }} />
          <div className="badge-content">
            <span className="badge-title">Prova {concursoInfo?.concurso || 'Alvo'}</span>
            <span className="badge-value" style={{ color: '#c8102e' }}>
              {daysRemaining > 0 ? `${daysRemaining} dias` : 'Hoje!'}
            </span>
          </div>
        </div>

        <div className="cycle-badge">
          <Clock className="badge-icon" />
          <div className="badge-content">
            <span className="badge-title">Ciclo Semanal</span>
            <span className="badge-value">{weeklyHoursCompleted}h / {weeklyHoursTarget}h</span>
          </div>
        </div>

        {/* Universal JSON Backup & Restore System */}
        <button
          onClick={handleExportBackup}
          className="header-action-btn"
          title="Exportar Backup Completo (JSON)"
          aria-label="Exportar Backup (JSON)"
        >
          <Download size={14} />
          <span className="hide-mobile">Backup</span>
        </button>

        <label
          className="header-action-btn"
          title="Restaurar Backup Completo (JSON)"
          aria-label="Restaurar Backup (JSON)"
          style={{ cursor: 'pointer' }}
        >
          <Upload size={14} />
          <span className="hide-mobile">Restaurar</span>
          <input
            type="file"
            accept=".json"
            onChange={handleRestoreBackup}
            style={{ display: 'none' }}
          />
        </label>

        <button onClick={toggleTheme} className="theme-toggle" aria-label="Alternar tema claro/escuro">
          {theme === 'dark' ? <Sun className="toggle-icon" /> : <Moon className="toggle-icon" />}
        </button>

        {/* User Account / Profile Button */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onOpenAuth}
              className="header-action-btn"
              style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              title={`Conta: ${user.email} (${user.role})`}
            >
              <User size={14} />
              <span className="hide-mobile">{user.name.split(' ')[0]}</span>
            </button>
            <button
              onClick={() => signOut()}
              className="header-action-btn"
              style={{ padding: '6px' }}
              title="Sair da Conta"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="mock-btn"
            style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <LogIn size={14} />
            <span>Entrar</span>
          </button>
        )}
      </div>
    </header>
  );
};
