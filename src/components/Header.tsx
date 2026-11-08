import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Clock, Calendar, Play, Download, Upload, 
  Sparkles, MessageSquare, LogIn, LogOut, User, Globe,
  Cloud, CloudOff, RefreshCw, AlertCircle, Menu, Check, Copy, X
} from 'lucide-react';
import type { ConcursoInfo, RunningTimerState } from '../types';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import { InfiniteBookLogo } from './InfiniteBookLogo';

const SUPABASE_SYNC_SQL = `-- 1. Criar tabela de sincronização de estudos
create table if not exists public.user_sync_data (
  user_id uuid references auth.users on delete cascade primary key,
  payload jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Ativar Row-Level Security (Segurança por Usuário)
alter table public.user_sync_data enable row level security;

-- 3. Permitir leitura e gravação segura para o próprio usuário
create policy "user_sync_data_policy" on public.user_sync_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

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
  onToggleMobileMenu?: () => void;
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
  onToggleMobileMenu,
}) => {
  const { user, signOut, syncStatus, syncWithCloud } = useAuth();
  const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

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

  const hasConfiguredExam = Boolean(concursoInfo?.concurso && concursoInfo?.dataProva);
  let daysRemaining = 0;
  if (hasConfiguredExam && concursoInfo?.dataProva) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exam = new Date(concursoInfo.dataProva + 'T00:00:00');
    daysRemaining = Math.ceil((exam.getTime() - now.getTime()) / 86400000);
  }

  const handleExportBackup = () => {
    try {
      const jsonStr = db.exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `backup-ixtude-ai-${dateStr}.json`;
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

  const handleManualSync = async () => {
    setSyncResultMsg(null);
    setIsCloudModalOpen(true);
  };

  const displayName = user?.name || (typeof localStorage !== 'undefined' ? localStorage.getItem('concurso_estudos_user_name') : null);

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="mobile-menu-btn"
            title="Abrir menu de navegação"
            aria-label="Abrir menu de navegação"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="mobile-header-brand mobile-only" style={{ alignItems: 'center', gap: '0.5rem' }}>
          <InfiniteBookLogo size={26} />
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-title)' }}>ixtude.ai</span>
        </div>
        <div className="header-greeting hide-mobile-brand">
          <h2>{displayName ? `Bons estudos, ${displayName}!` : 'Bons estudos!'}</h2>
          {hasConfiguredExam && concursoInfo && (
            <p className="header-subtitle">
              Foco e persistência rumo à aprovação no {concursoInfo.concurso} {concursoInfo.banca ? `• ${concursoInfo.banca}` : ''}.
            </p>
          )}
        </div>
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
        {hasConfiguredExam && concursoInfo && (
          <div className="cycle-badge header-countdown-badge" title={`Prova ${concursoInfo.concurso}: ${daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Hoje!'}`}>
            <Calendar className="badge-icon" />
            <div className="badge-content">
              <span className="badge-title">Prova {concursoInfo.concurso}</span>
              <span className="badge-value">
                {daysRemaining > 0 ? `${daysRemaining} dias` : 'Hoje!'}
              </span>
            </div>
          </div>
        )}

        <div className="cycle-badge">
          <Clock className="badge-icon" />
          <div className="badge-content">
            <span className="badge-title">Ciclo Semanal</span>
            <span className="badge-value">{weeklyHoursCompleted}h / {weeklyHoursTarget}h</span>
          </div>
        </div>

        {/* Supabase Cloud Auto-Sync Status Badge */}
        {user && (
          <button
            onClick={handleManualSync}
            className="cycle-badge header-sync-badge"
            style={{
              cursor: 'pointer',
              border: syncStatus === 'error' ? '1px solid #ef4444' : undefined,
              transition: 'all 0.2s ease',
            }}
            title={
              syncStatus === 'syncing'
                ? 'Sincronizando com a nuvem...'
                : syncStatus === 'synced'
                ? 'Nuvem sincronizada (Zero Data Loss). Clique para sincronizar agora.'
                : syncStatus === 'offline'
                ? 'Modo Offline: alterações salvas localmente no dispositivo. Serão enviadas ao reconectar.'
                : syncStatus === 'error'
                ? 'Erro ao sincronizar com a nuvem. Seus dados estão seguros localmente. Clique para tentar novamente.'
                : 'Clique para sincronizar com a nuvem'
            }
          >
            {syncStatus === 'syncing' && (
              <>
                <RefreshCw size={13} className="badge-icon animate-spin text-blue-500" style={{ animation: 'spin 1s linear infinite' }} />
                <div className="badge-content hide-mobile">
                  <span className="badge-title">Nuvem</span>
                  <span className="badge-value text-blue-500">Salvando...</span>
                </div>
              </>
            )}
            {syncStatus === 'synced' && (
              <>
                <Cloud size={13} className="badge-icon text-emerald-500" />
                <div className="badge-content hide-mobile">
                  <span className="badge-title">Nuvem</span>
                  <span className="badge-value text-emerald-500">Sincronizado</span>
                </div>
              </>
            )}
            {syncStatus === 'offline' && (
              <>
                <CloudOff size={13} className="badge-icon text-amber-500" />
                <div className="badge-content hide-mobile">
                  <span className="badge-title">Nuvem</span>
                  <span className="badge-value text-amber-500">Offline</span>
                </div>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <AlertCircle size={13} className="badge-icon text-rose-500" />
                <div className="badge-content hide-mobile">
                  <span className="badge-title">Nuvem</span>
                  <span className="badge-value text-rose-500">Reconectar</span>
                </div>
              </>
            )}
            {syncStatus === 'idle' && (
              <>
                <Cloud size={13} className="badge-icon text-emerald-500" />
                <div className="badge-content hide-mobile">
                  <span className="badge-title">Nuvem</span>
                  <span className="badge-value text-emerald-500">Ativa</span>
                </div>
              </>
            )}
          </button>
        )}

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

      {/* Supabase Cloud Connection & Sync Modal */}
      {isCloudModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setIsCloudModalOpen(false)}
        >
          <div
            className="app-modal-card"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              maxWidth: '560px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    backgroundColor: syncStatus === 'synced' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: syncStatus === 'synced' ? '#22c55e' : '#ef4444',
                    display: 'flex',
                  }}
                >
                  {syncStatus === 'synced' ? <Cloud size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                    Sincronização em Nuvem (Supabase)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {syncStatus === 'synced'
                      ? 'Seus dados estão 100% sincronizados na nuvem'
                      : 'Configuração da tabela de sincronização necessária'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(false)}
                className="modal-close-btn"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content based on syncStatus */}
            {syncStatus === 'synced' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: 'var(--text-main)',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: '#22c55e', marginBottom: '4px' }}>
                    Tudo certo com a sua conta!
                  </p>
                  <p style={{ margin: 0 }}>
                    Seus ciclos de estudo, matérias, cronômetro e flashcards estão salvos com segurança no Supabase.
                    Ao fazer login em outro navegador ou celular, todos os dados carregarão automaticamente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncingNow(true);
                    const res = await syncWithCloud();
                    setIsSyncingNow(false);
                    setSyncResultMsg(res.success ? 'Sincronizado agora com sucesso!' : res.message);
                  }}
                  disabled={isSyncingNow}
                  className="mock-btn"
                  style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <RefreshCw size={16} className={isSyncingNow ? 'animate-spin' : ''} />
                  <span>{isSyncingNow ? 'Sincronizando...' : 'Forçar Sincronização Agora'}</span>
                </button>
                {syncResultMsg && (
                  <p style={{ fontSize: '0.8rem', color: '#22c55e', textAlign: 'center', margin: 0 }}>
                    {syncResultMsg}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    padding: '0.875rem',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: '#38bdf8' }}>Fique 100% tranquilo:</strong> Seus estudos já estão salvos e preservados com segurança na memória deste navegador.
                </div>

                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-title)', fontWeight: 600, margin: '0 0 6px 0' }}>
                    Por que está aparecendo "Nuvem Reconectar"?
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    O seu projeto no Supabase ainda não possui a tabela <code style={{ color: 'var(--color-primary)', background: 'var(--bg-element)', padding: '2px 4px', borderRadius: '4px' }}>user_sync_data</code> criada. Por isso o login não consegue carregar os dados em outros navegadores ou no celular.
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-title)', fontWeight: 600, margin: '0 0 6px 0' }}>
                    Como ativar em 1 minuto:
                  </p>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px 18px', padding: 0, lineHeight: 1.6 }}>
                    <li>Acesse o painel do seu Supabase (<strong>supabase.com/dashboard</strong>)</li>
                    <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong> &gt; <strong>New Query</strong></li>
                    <li>Cole o comando SQL abaixo e clique no botão verde <strong>Run</strong></li>
                  </ol>

                  <div style={{ position: 'relative' }}>
                    <pre
                      style={{
                        backgroundColor: '#090d16',
                        color: '#a5f3fc',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        overflowX: 'auto',
                        border: '1px solid var(--border-color)',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      {SUPABASE_SYNC_SQL}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SUPABASE_SYNC_SQL);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 3000);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: copiedSql ? '#10b981' : 'var(--bg-element)',
                        color: '#ffffff',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSyncingNow(true);
                      setSyncResultMsg(null);
                      const res = await syncWithCloud();
                      setIsSyncingNow(false);
                      if (res.success) {
                        setSyncResultMsg('Conexão restabelecida e dados sincronizados com sucesso!');
                      } else {
                        setSyncResultMsg('Ainda não detectamos a tabela criada. Verifique se clicou em Run no Supabase.');
                      }
                    }}
                    disabled={isSyncingNow}
                    className="mock-btn"
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <RefreshCw size={16} className={isSyncingNow ? 'animate-spin' : ''} />
                    <span>{isSyncingNow ? 'Verificando Nuvem...' : 'Já executei o SQL, Sincronizar Agora!'}</span>
                  </button>
                </div>
                {syncResultMsg && (
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: syncResultMsg.includes('sucesso') ? '#22c55e' : '#f59e0b',
                      textAlign: 'center',
                      margin: 0,
                      fontWeight: 600,
                    }}
                  >
                    {syncResultMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
