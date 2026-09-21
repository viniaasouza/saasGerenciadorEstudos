import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';

// Version-tagged automatic storage wipe for port 5174 (estud_ai_clean_v4)
// Purges any legacy keys in localStorage containing old TCE-GO data, un-scoped cycles, or old admin sessions
const CLEANUP_KEY = 'estud_ai_clean_v4';
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    if (!localStorage.getItem(CLEANUP_KEY)) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('concurso_estudos_') ||
           k.startsWith('estud_ai_fc_') ||
           k === 'estud_ai_auth_user' ||
           k.startsWith('estud_ai_clean_'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(CLEANUP_KEY, 'true');
    }
  } catch {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
