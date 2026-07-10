import React from 'react';
import { Calendar, Timer, Award, BarChart3, BookOpen } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'planning', label: 'Planejamento', icon: Calendar, description: 'Ciclo & Pesos' },
    { id: 'timer', label: 'Estudo Ativo', icon: Timer, description: 'Cronômetro' },
    { id: 'questions', label: 'Questões', icon: Award, description: 'Desempenho' },
    { id: 'analytics', label: 'Desempenho', icon: BarChart3, description: 'Gráficos' },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <BookOpen className="logo-icon" />
        <div className="logo-text">
          <h1>SaaS Estudos</h1>
          <span>CGU & TCDF</span>
        </div>
      </div>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="nav-icon" />
              <div className="nav-details">
                <span className="nav-label">{item.label}</span>
                <span className="nav-sublabel">{item.description}</span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <p>Modo Local Activo</p>
      </div>
    </aside>
  );
};
