export type SubjectStatus = 'backlog' | 'active' | 'maintenance';

export interface CicloWorkspace {
  id: string;
  name: string;
  createdAt: string;
}

export interface Subtopic {
  id: string;
  name: string;
  completed: boolean;
}

export interface Topic {
  id: string;
  name: string;
  subtopics: Subtopic[];
}

export interface Subject {
  id: string;
  name: string;
  weight: number; // 1 to 5
  targetHours: number; // calculated hours
  status: SubjectStatus; // backlog, active, maintenance
  topics: Topic[];
}

export interface StudyBlock {
  id: string;
  subjectId: string;
  subjectName: string;
  durationMinutes: number;
  completed: boolean;
  order: number;
  dayAllocated?: string; // e.g. 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  subtopicName?: string;
  durationSeconds: number;
  date: string; // ISO string
  notes?: string;
  workspaceId?: string; // linked workspace context
  workspaceName?: string; // linked workspace name for filters
}

export interface QuestionSession {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  attempted: number;
  correct: number;
  banca: string;
  date: string; // ISO string
  adicionarParaRevisao?: boolean; // flag error review caderno de erros
  insightAncoragem?: string; // revision short text
  workspaceId?: string; // linked workspace context
  workspaceName?: string; // linked workspace name for filters
  tipo?: 'treino' | 'simulado'; // tipo de registro
}

export interface StudyCycleConfig {
  weeklyHours: number;
  cycleDurationWeeks: number;
  dailyHours?: { [day: string]: number }; // Monday to Sunday hours allocation
}
