import React from 'react';
import { Sun, Moon, Clock } from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  weeklyHoursCompleted: number;
  weeklyHoursTarget: number;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  weeklyHoursCompleted,
  weeklyHoursTarget,
}) => {
  return (
    <header className="app-header">
      <div className="header-greeting">
        <h2>Bons estudos, Vinícius!</h2>
        <p>Foco e persistência rumo à aprovação no CGU & TCDF.</p>
      </div>

      <div className="header-actions">
        <div className="cycle-badge">
          <Clock className="badge-icon" />
          <div className="badge-content">
            <span className="badge-title">Ciclo Semanal</span>
            <span className="badge-value">{weeklyHoursCompleted}h / {weeklyHoursTarget}h</span>
          </div>
        </div>

        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="toggle-icon" /> : <Moon className="toggle-icon" />}
        </button>
      </div>
    </header>
  );
};
