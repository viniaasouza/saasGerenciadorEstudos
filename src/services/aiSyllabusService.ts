/**
 * Open LLM Syllabus Importer Service (F10 / R8)
 * 
 * Supports OpenAI-compatible endpoints (Groq, OpenRouter, OpenAI, vLLM, Ollama):
 * - VITE_OPEN_LLM_API_KEY
 * - VITE_OPEN_LLM_ENDPOINT (default: 'https://api.groq.com/openai/v1/chat/completions')
 * - VITE_OPEN_LLM_MODEL (default: 'llama-3.3-70b-versatile')
 * 
 * When no API key is provided, gracefully falls back to an intelligent local heuristic
 * parser so test suites and demo users can test the UI with 100% fidelity without failure.
 */

import { extractAndParseJson, sanitizeObject, sanitizeString } from '../lib/security';

export interface RawSyllabusSubtopic {
  id?: string;
  name: string;
}

export interface RawSyllabusTopic {
  id?: string;
  name: string;
  subtopics: (RawSyllabusSubtopic | string)[];
}

export interface RawSyllabusSubject {
  id?: string;
  name: string;
  weight?: number; // 1 to 5
  topics: RawSyllabusTopic[];
}

export interface RawConcursoInfo {
  concurso?: string;
  cargo?: string;
  banca?: string;
  dataProva?: string;
}

export interface AiParsedSyllabus {
  concursoInfo?: RawConcursoInfo;
  subjects: RawSyllabusSubject[];
  source?: 'llm' | 'fallback' | 'json';
}

const SYSTEM_PROMPT = `Você é um especialista em estruturação de editais para concursos públicos e vestibulares de alta performance.
Sua tarefa é analisar o texto do edital/conteúdo programático fornecido pelo usuário e convertê-lo rigorosamente em uma estrutura JSON válida.

Estrutura JSON obrigatória:
{
  "concursoInfo": {
    "concurso": "Nome do Concurso ou Órgão (ex: Receita Federal, TJ-SP, PF)",
    "cargo": "Nome do Cargo (ex: Auditor Fiscal, Analista Judiciário)",
    "banca": "Nome da Banca Organizadora (ex: FGV, Cebraspe, FCC, VUNESP)",
    "dataProva": "YYYY-MM-DD (se informada no texto, ou vazio)"
  },
  "subjects": [
    {
      "name": "Nome da Disciplina (ex: Direito Constitucional)",
      "weight": 3, // número inteiro de 1 a 5 sugerido de acordo com relevância
      "topics": [
        {
          "name": "Nome do Tópico Principal (ex: Direitos Fundamentais)",
          "subtopics": [
            "Subtópico específico 1 (ex: Direitos individuais e coletivos)",
            "Subtópico específico 2 (ex: Remédios constitucionais)"
          ]
        }
      ]
    }
  ]
}

Regras:
1. Responda ESTRITAMENTE em formato JSON puro, sem introduções ou explicações fora do JSON.
2. Cada disciplina deve conter seus respectivos tópicos e subtópicos atômicos.
3. Se um tópico não tiver subtópicos explícitos, crie ao menos 1 subtópico com o próprio nome do tópico.
4. O peso (weight) deve ser um inteiro entre 1 e 5.`;

/**
 * Intelligent local fallback parser for offline/demo use or when no API key is set.
 */
export function parseSyllabusFallback(text: string): AiParsedSyllabus {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('O texto do edital está vazio.');
  }

  // 1. Try parsing directly as JSON first
  const directJson = extractAndParseJson<any>(trimmed);
  if (directJson.success && directJson.data) {
    const data = directJson.data;
    const rawSubjects = Array.isArray(data.subjects)
      ? data.subjects
      : Array.isArray(data.disciplinas)
      ? data.disciplinas
      : Array.isArray(data)
      ? data
      : null;

    if (rawSubjects && rawSubjects.length > 0) {
      return {
        concursoInfo: sanitizeObject(data.concursoInfo || data.concurso_info || {}),
        subjects: normalizeSubjectsArray(rawSubjects),
        source: 'json',
      };
    }
  }

  // 2. Intelligent outline text parser
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  
  const concursoInfo: RawConcursoInfo = {};
  const subjects: RawSyllabusSubject[] = [];

  let currentSubject: RawSyllabusSubject | null = null;
  let currentTopic: RawSyllabusTopic | null = null;

  for (const line of lines) {
    // Check for header metadata
    const concursoMatch = line.match(/^(?:concurso|orgao|órgão)\s*[:=-]\s*(.+)$/i);
    if (concursoMatch) {
      concursoInfo.concurso = sanitizeString(concursoMatch[1]);
      continue;
    }

    const cargoMatch = line.match(/^cargo\s*[:=-]\s*(.+)$/i);
    if (cargoMatch) {
      concursoInfo.cargo = sanitizeString(cargoMatch[1]);
      continue;
    }

    const bancaMatch = line.match(/^banca\s*[:=-]\s*(.+)$/i);
    if (bancaMatch) {
      concursoInfo.banca = sanitizeString(bancaMatch[1]);
      continue;
    }

    const dataMatch = line.match(/^(?:data\s+da\s+prova|prova)\s*[:=-]\s*(.+)$/i);
    if (dataMatch) {
      concursoInfo.dataProva = sanitizeString(dataMatch[1]);
      continue;
    }

    // Check if line looks like a subject heading:
    // e.g.: "DIREITO CONSTITUCIONAL", "PORTUGUÊS (Peso 4)", "DISCIPLINA: Informática", "1. LÍNGUA PORTUGUESA"
    const isExplicitSubject = /^(?:disciplina|matéria|materia)\s*[:=-]\s*(.+)$/i.test(line);
    const weightMatch = line.match(/peso\s*[:=-]?\s*(\d)/i);
    const extractedWeight = weightMatch ? Math.min(5, Math.max(1, parseInt(weightMatch[1], 10))) : 3;

    const cleanLineName = line.replace(/^(?:disciplina|matéria|materia)\s*[:=-]\s*/i, '')
                              .replace(/\(peso\s*\d\)/i, '')
                              .trim();

    const isAllCapsSubject = (
      cleanLineName.length > 3 &&
      cleanLineName === cleanLineName.toUpperCase() &&
      !cleanLineName.match(/^\d+\.\d+/) &&
      !cleanLineName.startsWith('-') &&
      !cleanLineName.startsWith('•')
    );

    if (isExplicitSubject || isAllCapsSubject) {
      currentSubject = {
        name: sanitizeString(cleanLineName),
        weight: extractedWeight,
        topics: [],
      };
      subjects.push(currentSubject);
      currentTopic = null;
      continue;
    }

    // Ensure we have at least one active subject
    if (!currentSubject) {
      currentSubject = {
        name: 'Conhecimentos Gerais',
        weight: 3,
        topics: [],
      };
      subjects.push(currentSubject);
    }

    // Check if line is a subtopic (e.g. "1.1 ...", "1.2 ...", "- ...", "* ...")
    const isSubtopicMatch = line.match(/^(?:\d+\.\d+|-|\*|•|[a-z]\))\s*(.+)$/i);
    if (isSubtopicMatch) {
      const subName = sanitizeString(isSubtopicMatch[1]);
      if (!currentTopic) {
        currentTopic = {
          name: 'Tópico Geral',
          subtopics: [],
        };
        currentSubject.topics.push(currentTopic);
      }
      currentTopic.subtopics.push(subName);
      continue;
    }

    // Check if line is a topic (e.g. "1. ...", "2. ...", or short section title)
    const topicMatch = line.match(/^(?:\d+[.)]\s*)(.+)$/);
    if (topicMatch) {
      currentTopic = {
        name: sanitizeString(topicMatch[1]),
        subtopics: [],
      };
      currentSubject.topics.push(currentTopic);
      continue;
    }

    // Default item handling: treat as subtopic under current topic, or create new topic
    if (!currentTopic) {
      currentTopic = {
        name: sanitizeString(line),
        subtopics: [sanitizeString(line)],
      };
      currentSubject.topics.push(currentTopic);
    } else {
      currentTopic.subtopics.push(sanitizeString(line));
    }
  }

  // Ensure every topic has at least 1 subtopic
  for (const s of subjects) {
    if (s.topics.length === 0) {
      s.topics.push({
        name: s.name,
        subtopics: [s.name],
      });
    } else {
      for (const t of s.topics) {
        if (!t.subtopics || t.subtopics.length === 0) {
          t.subtopics = [t.name];
        }
      }
    }
  }

  if (subjects.length === 0) {
    subjects.push({
      name: 'Conteúdo Programático',
      weight: 3,
      topics: [
        {
          name: 'Módulo 1',
          subtopics: ['Introdução e Fundamentos'],
        },
      ],
    });
  }

  return {
    concursoInfo,
    subjects,
    source: 'fallback',
  };
}

function normalizeSubjectsArray(rawList: any[]): RawSyllabusSubject[] {
  return rawList.map((s, sIdx) => {
    const name = sanitizeString(s.name || s.disciplina || s.materia || s.titulo || `Disciplina ${sIdx + 1}`);
    const rawWeight = s.weight ?? s.peso;
    const weight = typeof rawWeight === 'number' && rawWeight >= 1 && rawWeight <= 5 ? rawWeight : 3;

    const rawTopics = Array.isArray(s.topics)
      ? s.topics
      : Array.isArray(s.topicos)
      ? s.topicos
      : Array.isArray(s.conteudo)
      ? s.conteudo
      : [];

    const topics: RawSyllabusTopic[] = rawTopics.map((t: any, tIdx: number) => {
      const isString = typeof t === 'string';
      const topName = sanitizeString(isString ? t : (t.name || t.topico || t.titulo || t.nome || `Tópico ${tIdx + 1}`));

      const rawSubtopics = !isString && Array.isArray(t.subtopics)
        ? t.subtopics
        : !isString && Array.isArray(t.subtopicos)
        ? t.subtopicos
        : !isString && Array.isArray(t.itens)
        ? t.itens
        : [];

      const subtopics: string[] = rawSubtopics.map((st: any) =>
        sanitizeString(typeof st === 'string' ? st : (st.name || st.subtopico || st.item || st.titulo || 'Item'))
      );

      if (subtopics.length === 0) {
        subtopics.push(topName);
      }

      return {
        name: topName,
        subtopics,
      };
    });

    if (topics.length === 0) {
      topics.push({
        name,
        subtopics: [name],
      });
    }

    return {
      name,
      weight,
      topics,
    };
  });
}

/**
 * Main AI Syllabus parsing entrypoint:
 * - If VITE_OPEN_LLM_API_KEY is defined, calls OpenAI-compatible endpoint (Groq / OpenRouter).
 * - Otherwise gracefully invokes the local fallback parser.
 */
export async function parseSyllabusWithOpenLLM(syllabusText: string): Promise<AiParsedSyllabus> {
  const trimmed = (syllabusText || '').trim();
  if (!trimmed) {
    throw new Error('Nenhum texto de edital foi fornecido para importação.');
  }

  const apiKey = import.meta.env?.VITE_OPEN_LLM_API_KEY;
  const endpoint = import.meta.env?.VITE_OPEN_LLM_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
  const model = import.meta.env?.VITE_OPEN_LLM_MODEL || 'llama-3.3-70b-versatile';

  // If no API key configured, use local parser
  if (!apiKey) {
    return parseSyllabusFallback(trimmed);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.warn(`[aiSyllabusService] LLM API returned status ${response.status}. Using fallback parser.`);
      return parseSyllabusFallback(trimmed);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return parseSyllabusFallback(trimmed);
    }

    const parsed = extractAndParseJson<any>(content);
    if (!parsed.success || !parsed.data) {
      return parseSyllabusFallback(trimmed);
    }

    const rawSubjects = Array.isArray(parsed.data.subjects)
      ? parsed.data.subjects
      : Array.isArray(parsed.data.disciplinas)
      ? parsed.data.disciplinas
      : Array.isArray(parsed.data)
      ? parsed.data
      : [];

    if (rawSubjects.length === 0) {
      return parseSyllabusFallback(trimmed);
    }

    return {
      concursoInfo: sanitizeObject(parsed.data.concursoInfo || {}),
      subjects: normalizeSubjectsArray(rawSubjects),
      source: 'llm',
    };
  } catch (err) {
    console.warn('[aiSyllabusService] Error during LLM request. Gracefully falling back to heuristic parser:', err);
    return parseSyllabusFallback(trimmed);
  }
}
