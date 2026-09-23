import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Zap,
  ChevronRight,
} from 'lucide-react';
import type { GamificationProfile, LeaderboardEntry } from '../../types';
import {
  getLevelInfo,
  getDailyLeaderboard,
  getUserLeaderboardStanding,
} from './gamification';

interface GamificationWidgetProps {
  profile: GamificationProfile;
  userName?: string;
  userConcursoTarget?: string;
  todayStr: string;
  recentXpAward?: {
    amount: number;
    description: string;
    id: number;
  } | null;
}

export const GamificationWidget: React.FC<GamificationWidgetProps> = ({
  profile,
  userName = 'Você',
  userConcursoTarget,
  todayStr,
  recentXpAward,
}) => {
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [floatingBadge, setFloatingBadge] = useState<{ amount: number; key: number } | null>(null);

  // Trigger floating badge animation on recent XP gain
  useEffect(() => {
    if (recentXpAward && recentXpAward.amount > 0) {
      setFloatingBadge({ amount: recentXpAward.amount, key: recentXpAward.id });
      const timer = setTimeout(() => {
        setFloatingBadge(null);
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [recentXpAward]);

  const levelInfo = getLevelInfo(profile.totalXp);
  const todayPoints = profile.dailyXp?.[todayStr] || 0;
  const leaderboard: LeaderboardEntry[] = getDailyLeaderboard(
    todayPoints,
    profile.currentStreak || 1,
    userName,
    todayStr,
    profile.totalXp,
    userConcursoTarget
  );
  const standing = getUserLeaderboardStanding(leaderboard);

  const displayedList = showFullLeaderboard ? leaderboard : leaderboard.slice(0, 5);

  const getRankBadge = (rank?: number) => {
    if (rank === 1) return { icon: '🥇', label: '1º', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    if (rank === 2) return { icon: '🥈', label: '2º', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
    if (rank === 3) return { icon: '🥉', label: '3º', color: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' };
    return { icon: null, label: `${rank}º`, color: 'var(--text-muted)', bg: 'var(--bg-element)' };
  };

  return (
    <div style={{ position: 'relative', marginBottom: '2rem' }}>
      {/* FLOATING XP BADGE ANIMATION */}
      {floatingBadge && (
        <div
          key={floatingBadge.key}
          style={{
            position: 'absolute',
            top: '-20px',
            right: '20px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1rem',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.5)',
            pointerEvents: 'none',
            animation: 'floatUpAndFade 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          }}
        >
          <Zap size={18} fill="#ffffff" />
          <span>+{floatingBadge.amount} XP!</span>
        </div>
      )}

      {/* GAMIFICATION GRID: LEVEL CARD + LEADERBOARD CARD */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* CARD 1: PROGRESSÃO DE NÍVEL & ESTEIRA DE ESTUDOS */}
        <div
          className="placeholder-card"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.09), rgba(168, 85, 247, 0.06))',
            borderColor: 'rgba(99, 102, 241, 0.25)',
            padding: '1.5rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top Banner Row */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}
                  title={`Nível ${levelInfo.level}: ${levelInfo.title}`}
                >
                  {levelInfo.badge}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-primary-glow)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Nível {levelInfo.level}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Total: <strong>{profile.totalXp} XP</strong>
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-title)', marginTop: '2px' }}>
                    {levelInfo.title}
                  </h3>
                </div>
              </div>

              {/* Streak Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#d97706',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
                title="Dias consecutivos de estudo ativo"
              >
                <Flame size={16} fill="#f59e0b" color="#d97706" />
                <span>{profile.currentStreak || 1} dia{profile.currentStreak > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Level Progress Bar */}
            <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Progresso para o próximo nível</span>
                <strong style={{ color: 'var(--text-title)' }}>
                  {levelInfo.xpForNextLevel > 0
                    ? `${levelInfo.xpForNextLevel} XP restantes`
                    : 'Nível Máximo Atingido!'}
                </strong>
              </div>
              <div
                style={{
                  height: '10px',
                  width: '100%',
                  backgroundColor: 'var(--bg-element)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${levelInfo.progressPct}%`,
                    background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                    borderRadius: '9999px',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>{levelInfo.minXp} XP</span>
                <span>{levelInfo.progressPct}%</span>
                <span>{levelInfo.maxXp === Infinity ? '4000+ XP' : `${levelInfo.maxXp} XP`}</span>
              </div>
            </div>
          </div>

          {/* Bottom XP Metrics Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="var(--color-success)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ganho hoje:</span>
              <strong style={{ color: 'var(--color-success)', fontSize: '0.95rem' }}>
                +{todayPoints} XP
              </strong>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Recorde:</span>
              <strong>{profile.longestStreak || 1} dias</strong>
            </div>
          </div>
        </div>

        {/* CARD 2: RANKING DE HOJE - TOP CONCURSEIROS */}
        <div
          className="placeholder-card"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(14, 165, 233, 0.05))',
            borderColor: 'rgba(16, 185, 129, 0.25)',
            padding: '1.5rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Header */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-title)' }}>
                  Ranking de Hoje • Top Concurseiros
                </h3>
              </div>

              {/* User Standing Pill */}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  backgroundColor: standing.rank <= 3 ? 'rgba(251, 191, 36, 0.2)' : 'var(--bg-element)',
                  color: standing.rank <= 3 ? '#b45309' : 'var(--text-main)',
                  border: standing.rank <= 3 ? '1px solid rgba(251, 191, 36, 0.4)' : '1px solid var(--border-color)',
                }}
              >
                Sua posição: <strong>{standing.rank}º lugar</strong>
              </span>
            </div>

            {/* Motivational sub-text */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {standing.rank === 1 ? (
                <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                  🏆 Fantástico! Você está liderando o ranking dos concurseiros hoje!
                </span>
              ) : standing.aheadUser ? (
                <span>
                  Faltam apenas <strong>+{standing.diffToNext} XP</strong> para ultrapassar {standing.aheadUser.name.split(' ')[0]} e assumir o {standing.rank - 1}º lugar!
                </span>
              ) : (
                <span>Dê checks em teoria, resolva questões e suba no ranking diário.</span>
              )}
            </div>

            {/* Leaderboard Entries List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {displayedList.map((entry) => {
                const badge = getRankBadge(entry.rank);
                const isUser = entry.isCurrentUser;

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: isUser ? '8px 12px' : '6px 10px',
                      borderRadius: '10px',
                      backgroundColor: isUser
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'var(--bg-element)',
                      border: isUser
                        ? '1.5px solid var(--color-success)'
                        : '1px solid var(--border-color)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                      {/* Rank badge */}
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {badge.icon || badge.label}
                      </div>

                      {/* Avatar pill */}
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: isUser ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                          color: isUser ? 'var(--color-success)' : 'var(--color-primary)',
                          border: isUser ? '1.5px solid var(--color-success)' : '1px solid rgba(99, 102, 241, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                        title={entry.name}
                      >
                        {entry.avatar}
                      </div>

                      {/* Avatar & Name */}
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: isUser ? 800 : 600,
                              color: isUser ? 'var(--color-success)' : 'var(--text-title)',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                            }}
                          >
                            {entry.name}
                          </span>
                          {isUser && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--color-success)',
                                color: '#ffffff',
                                fontWeight: 800,
                              }}
                            >
                              VOCÊ
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: isUser ? 'var(--color-success)' : 'var(--color-primary)' }}>
                            Nv.{entry.level}
                          </span>
                          <span>•</span>
                          <span>{entry.concursoTarget}</span>
                        </div>
                      </div>
                    </div>

                    {/* Points & Streak */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                        }}
                        title={`${entry.streakDays} dias de ofensiva`}
                      >
                        <Flame size={12} color="#f59e0b" />
                        <span>{entry.streakDays}d</span>
                      </div>

                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: isUser ? 'var(--color-success)' : 'var(--text-title)',
                        }}
                      >
                        {entry.pointsToday} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toggle Full Leaderboard Footer */}
          <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <button
              onClick={() => setShowFullLeaderboard(!showFullLeaderboard)}
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-primary)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span>{showFullLeaderboard ? 'Ver Menos' : `Ver Ranking Completo (${leaderboard.length} concurseiros)`}</span>
              <ChevronRight size={14} style={{ transform: showFullLeaderboard ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
