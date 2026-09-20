/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sanitizeString, isValidEmail, formatSafeError, safeJsonParse } from '../lib/security';
import { db } from '../db/database';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  isAnonymous?: boolean;
  provider: 'supabase' | 'local';
}

export interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'bug' | 'sugestao' | 'elogio' | 'outro';
  title: string;
  description: string;
  status: 'aberto' | 'em_analise' | 'resolvido';
  createdAt: string;
}

export interface SystemMetrics {
  totalUsers: number;
  totalStudyHours: number;
  totalQuestions: number;
  averageAccuracy: number;
  totalWorkspaces: number;
  totalFeedbacks: number;
  openFeedbacks: number;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  isDemoMode: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  loginAsAdminDemo: () => Promise<void>;
  feedbacks: FeedbackItem[];
  submitFeedback: (feedback: {
    type: FeedbackItem['type'];
    title: string;
    description: string;
    contactEmail?: string;
  }) => Promise<{ success: boolean; message: string }>;
  updateFeedbackStatus: (id: string, status: FeedbackItem['status']) => void;
  deleteFeedback: (id: string) => void;
  allUsers: AppUser[];
  systemMetrics: SystemMetrics;
  syncWithCloud: () => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KEYS = {
  CURRENT_USER: 'estud_ai_auth_user',
  MOCK_USERS: 'estud_ai_mock_users',
  FEEDBACKS: 'estud_ai_feedbacks',
};

const DEFAULT_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@estud.ai').toLowerCase().trim();

// Seed initial mock users if none exist in localStorage
const initializeMockUsers = (): AppUser[] => {
  const existing = safeJsonParse<AppUser[]>(localStorage.getItem(KEYS.MOCK_USERS), []);
  if (existing.length > 0) return existing;

  const initialUsers: AppUser[] = [
    {
      id: 'usr-admin-default',
      email: DEFAULT_ADMIN_EMAIL,
      name: 'Administrador estud.ai',
      role: 'admin',
      createdAt: new Date().toISOString(),
      provider: 'local',
    },
    {
      id: 'usr-demo-student',
      email: 'aluno@estud.ai',
      name: 'Concurseiro Focado',
      role: 'user',
      createdAt: new Date().toISOString(),
      provider: 'local',
    },
  ];

  localStorage.setItem(KEYS.MOCK_USERS, JSON.stringify(initialUsers));
  return initialUsers;
};

// Initial seed feedbacks
const initializeFeedbacks = (): FeedbackItem[] => {
  const existing = safeJsonParse<FeedbackItem[]>(localStorage.getItem(KEYS.FEEDBACKS), []);
  if (existing.length > 0) return existing;

  const initialFeedbacks: FeedbackItem[] = [
    {
      id: 'fb-sample-1',
      userId: 'usr-demo-student',
      userName: 'Concurseiro Focado',
      userEmail: 'aluno@estud.ai',
      type: 'sugestao',
      title: 'Adicionar filtro por Banca no Edital Verticalizado',
      description: 'Adorei a importação automática do edital com IA! Seria ótimo ter filtro rápido por banca Cebraspe/FCC nas questões.',
      status: 'resolvido',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'fb-sample-2',
      userId: 'usr-demo-student',
      userName: 'Concurseiro Focado',
      userEmail: 'aluno@estud.ai',
      type: 'bug',
      title: 'Pequena inconsistência de cores no modo escuro',
      description: 'Em telas menores, o badge de dias restantes estava com contraste baixo no modo escuro.',
      status: 'em_analise',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(initialFeedbacks));
  return initialFeedbacks;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  const isDemoMode = !isSupabaseConfigured();

  // Helper to pull cloud sync data for authenticated user
  const pullFromCloud = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('user_sync_data')
        .select('payload, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.payload) {
        db.setCurrentUserId(userId);
        db.importAllData(JSON.stringify(data.payload));
      }
    } catch {
      // Fallback silently to local cache if network is unavailable
    }
  }, []);

  // Helper to fetch cloud feedbacks for admin and users
  const fetchCloudFeedbacks = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: FeedbackItem[] = data.map((f: any) => ({
          id: f.id,
          userId: f.user_id || 'anon',
          userName: f.user_name || 'Visitante',
          userEmail: f.user_email,
          type: f.type,
          title: f.title,
          description: f.description,
          status: f.status,
          createdAt: f.created_at,
        }));
        setFeedbacks(mapped);
        localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(mapped));
      }
    } catch {}
  }, []);

  // Helper to fetch cloud registered profiles for admin
  const fetchCloudProfiles = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: AppUser[] = data.map((p: any) => ({
          id: p.id,
          email: p.email,
          name: p.name || p.email.split('@')[0],
          role: p.role || 'user',
          createdAt: p.created_at,
          provider: 'supabase',
        }));
        setAllUsers(mapped);
      }
    } catch {}
  }, []);

  // Load initial state
  useEffect(() => {
    const loadedUsers = initializeMockUsers();
    setAllUsers(loadedUsers);

    const loadedFeedbacks = initializeFeedbacks();
    setFeedbacks(loadedFeedbacks);

    // Check existing session
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getSession().then(async ({ data: { session }, error }) => {
        if (!error && session?.user) {
          const email = session.user.email || '';
          const role: 'admin' | 'user' =
            email.toLowerCase() === DEFAULT_ADMIN_EMAIL ||
            session.user.user_metadata?.role === 'admin'
              ? 'admin'
              : 'user';

          const appUser: AppUser = {
            id: session.user.id,
            email,
            name: session.user.user_metadata?.name || email.split('@')[0],
            role,
            createdAt: session.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          await pullFromCloud(appUser.id);
          fetchCloudFeedbacks();
          fetchCloudProfiles();
        } else {
          // Restore local saved session if any
          const savedUser = safeJsonParse<AppUser | null>(localStorage.getItem(KEYS.CURRENT_USER), null);
          if (savedUser) {
            db.setCurrentUserId(savedUser.id);
            setUser(savedUser);
          }
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const email = session.user.email || '';
          const role: 'admin' | 'user' =
            email.toLowerCase() === DEFAULT_ADMIN_EMAIL ||
            session.user.user_metadata?.role === 'admin'
              ? 'admin'
              : 'user';

          const appUser: AppUser = {
            id: session.user.id,
            email,
            name: session.user.user_metadata?.name || email.split('@')[0],
            role,
            createdAt: session.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          await pullFromCloud(appUser.id);
          fetchCloudFeedbacks();
          fetchCloudProfiles();
        } else {
          db.setCurrentUserId(null);
          setUser(null);
          localStorage.removeItem(KEYS.CURRENT_USER);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local demo mode
      const savedUser = safeJsonParse<AppUser | null>(localStorage.getItem(KEYS.CURRENT_USER), null);
      if (savedUser) {
        db.setCurrentUserId(savedUser.id);
        setUser(savedUser);
      } else {
        // Auto-login as demo user by default for instant zero-barrier experience
        const defaultStudent = loadedUsers.find((u) => u.role === 'user') || loadedUsers[0];
        if (defaultStudent) {
          db.setCurrentUserId(defaultStudent.id);
          setUser(defaultStudent);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(defaultStudent));
        }
      }
      setIsLoading(false);
    }
  }, [pullFromCloud, fetchCloudFeedbacks, fetchCloudProfiles]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.role === 'admin' || user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL;
  }, [user]);

  // Sign In
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Por favor, informe um e-mail válido.' };
    }
    if (!password) {
      return { success: false, error: 'Por favor, informe sua senha.' };
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          return { success: false, error: formatSafeError(error.message) };
        }

        if (data.user) {
          const role: 'admin' | 'user' =
            cleanEmail === DEFAULT_ADMIN_EMAIL || data.user.user_metadata?.role === 'admin'
              ? 'admin'
              : 'user';

          const appUser: AppUser = {
            id: data.user.id,
            email: cleanEmail,
            name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
            role,
            createdAt: data.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          await pullFromCloud(appUser.id);
          fetchCloudFeedbacks();
          fetchCloudProfiles();
          return { success: true };
        }
      }

      // Mock Local Auth fallback
      const mockList = safeJsonParse<AppUser[]>(localStorage.getItem(KEYS.MOCK_USERS), []);
      let matched = mockList.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!matched) {
        // Create user on the fly if not existing in mock mode
        const role: 'admin' | 'user' = cleanEmail === DEFAULT_ADMIN_EMAIL ? 'admin' : 'user';
        matched = {
          id: `usr-${Date.now()}`,
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          role,
          createdAt: new Date().toISOString(),
          provider: 'local',
        };
        const updated = [...mockList, matched];
        localStorage.setItem(KEYS.MOCK_USERS, JSON.stringify(updated));
        setAllUsers(updated);
      }

      db.setCurrentUserId(matched.id);
      setUser(matched);
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(matched));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: formatSafeError(err) };
    }
  }, [pullFromCloud, fetchCloudFeedbacks, fetchCloudProfiles]);

  // Sign Up
  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = sanitizeString(name.trim()) || cleanEmail.split('@')[0];

    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Por favor, informe um e-mail válido.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'A senha deve ter no mínimo 6 caracteres.' };
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        const role: 'admin' | 'user' = cleanEmail === DEFAULT_ADMIN_EMAIL ? 'admin' : 'user';
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { name: cleanName, role },
          },
        });

        if (error) {
          return { success: false, error: formatSafeError(error.message) };
        }

        if (data.user) {
          const appUser: AppUser = {
            id: data.user.id,
            email: cleanEmail,
            name: cleanName,
            role,
            createdAt: data.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          fetchCloudProfiles();
          return { success: true };
        }
      }

      // Mock Local Auth fallback
      const mockList = safeJsonParse<AppUser[]>(localStorage.getItem(KEYS.MOCK_USERS), []);
      if (mockList.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return { success: false, error: 'Este e-mail já está cadastrado. Tente entrar.' };
      }

      const role: 'admin' | 'user' = cleanEmail === DEFAULT_ADMIN_EMAIL ? 'admin' : 'user';
      const newUser: AppUser = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        name: cleanName,
        role,
        createdAt: new Date().toISOString(),
        provider: 'local',
      };

      const updated = [...mockList, newUser];
      localStorage.setItem(KEYS.MOCK_USERS, JSON.stringify(updated));
      setAllUsers(updated);
      db.setCurrentUserId(newUser.id);
      setUser(newUser);
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(newUser));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: formatSafeError(err) };
    }
  }, [fetchCloudProfiles]);

  // Sign Out
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    db.setCurrentUserId(null);
    setUser(null);
    localStorage.removeItem(KEYS.CURRENT_USER);
  }, []);

  // One-click demo login
  const loginAsDemo = useCallback(async () => {
    const demoUser: AppUser = {
      id: 'usr-demo-student',
      email: 'aluno@estud.ai',
      name: 'Concurseiro Focado',
      role: 'user',
      createdAt: new Date().toISOString(),
      provider: 'local',
    };
    db.setCurrentUserId(demoUser.id);
    setUser(demoUser);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(demoUser));
  }, []);

  // One-click admin login
  const loginAsAdminDemo = useCallback(async () => {
    const adminUser: AppUser = {
      id: 'usr-admin-default',
      email: DEFAULT_ADMIN_EMAIL,
      name: 'Administrador estud.ai',
      role: 'admin',
      createdAt: new Date().toISOString(),
      provider: 'local',
    };
    db.setCurrentUserId(adminUser.id);
    setUser(adminUser);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(adminUser));
  }, []);

  // Submit Feedback / Bug Report
  const submitFeedback = useCallback(async (feedback: {
    type: FeedbackItem['type'];
    title: string;
    description: string;
    contactEmail?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanTitle = sanitizeString(feedback.title.trim());
    const cleanDesc = sanitizeString(feedback.description.trim());
    const contactEmail = feedback.contactEmail?.trim() || user?.email || 'anonimo@estud.ai';

    if (!cleanTitle || !cleanDesc) {
      return { success: false, message: 'Por favor preencha o título e a descrição do feedback.' };
    }

    const newItem: FeedbackItem = {
      id: `fb-${Date.now()}`,
      userId: user?.id || 'anon',
      userName: user?.name || 'Visitante',
      userEmail: contactEmail,
      type: feedback.type,
      title: cleanTitle,
      description: cleanDesc,
      status: 'aberto',
      createdAt: new Date().toISOString(),
    };

    // Save locally
    const currentList = safeJsonParse<FeedbackItem[]>(localStorage.getItem(KEYS.FEEDBACKS), []);
    const updated = [newItem, ...currentList];
    localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(updated));
    setFeedbacks(updated);

    // If Supabase configured, attempt cloud write
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('feedbacks').insert({
          id: newItem.id,
          user_id: user?.id || null,
          user_email: contactEmail,
          user_name: newItem.userName,
          type: newItem.type,
          title: newItem.title,
          description: newItem.description,
          status: 'aberto',
          created_at: newItem.createdAt,
        });
      } catch {
        // Fallback: already safely saved in localStorage
      }
    }

    return {
      success: true,
      message: 'Obrigado! Seu feedback foi enviado diretamente à equipe do estud.ai e nos ajudará muito!',
    };
  }, [user]);

  const updateFeedbackStatus = useCallback((id: string, status: FeedbackItem['status']) => {
    setFeedbacks((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, status } : f));
      localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured() && supabase) {
      supabase.from('feedbacks').update({ status }).eq('id', id).then(() => {});
    }
  }, []);

  const deleteFeedback = useCallback((id: string) => {
    setFeedbacks((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured() && supabase) {
      supabase.from('feedbacks').delete().eq('id', id).then(() => {});
    }
  }, []);

  // System usage metrics for owner/admin
  const systemMetrics = useMemo<SystemMetrics>(() => {
    const sessions = db.getSessions();
    const questions = db.getQuestions();
    const workspaces = db.getWorkspaces();

    const totalSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

    const totalAttempted = questions.reduce((acc, q) => acc + (q.attempted || 0), 0);
    const totalCorrect = questions.reduce((acc, q) => acc + (q.correct || 0), 0);
    const avgAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    const openCount = feedbacks.filter((f) => f.status === 'aberto').length;

    return {
      totalUsers: Math.max(allUsers.length, 1),
      totalStudyHours: totalHours,
      totalQuestions: totalAttempted,
      averageAccuracy: avgAccuracy,
      totalWorkspaces: workspaces.length,
      totalFeedbacks: feedbacks.length,
      openFeedbacks: openCount,
    };
  }, [allUsers, feedbacks]);

  // Cloud Sync helper for logged in users
  const syncWithCloud = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured() || !supabase || !user) {
      return {
        success: false,
        message: 'Modo Local ativo. Para sincronizar na nuvem, configure o Supabase nas variáveis de ambiente.',
      };
    }

    try {
      const backupJson = db.exportAllData();
      const payload = JSON.parse(backupJson);

      const { error } = await supabase
        .from('user_sync_data')
        .upsert({
          user_id: user.id,
          payload,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        return { success: false, message: `Erro na sincronização: ${error.message}` };
      }

      return { success: true, message: 'Dados sincronizados com a nuvem com sucesso!' };
    } catch (err: unknown) {
      return { success: false, message: formatSafeError(err) };
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isDemoMode,
      isAdmin,
      signIn,
      signUp,
      signOut,
      loginAsDemo,
      loginAsAdminDemo,
      feedbacks,
      submitFeedback,
      updateFeedbackStatus,
      deleteFeedback,
      allUsers,
      systemMetrics,
      syncWithCloud,
    }),
    [
      user,
      isLoading,
      isDemoMode,
      isAdmin,
      signIn,
      signUp,
      signOut,
      loginAsDemo,
      loginAsAdminDemo,
      feedbacks,
      submitFeedback,
      updateFeedbackStatus,
      deleteFeedback,
      allUsers,
      systemMetrics,
      syncWithCloud,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
