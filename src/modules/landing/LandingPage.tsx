import React, { useState } from 'react';
import { 
  Sparkles, BookOpen, Clock, Brain, CheckCircle2, 
  ArrowRight, Copy, Check, MessageSquare, LogIn, Bot
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
  onOpenFeedback: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const AI_SYLLABUS_PROMPT = `Você é um especialista em estruturação de editais para concursos públicos e alta performance de estudos.
Vou fornecer a lista de disciplinas e o conteúdo programático bruto do meu edital.

Sua tarefa é analisar o texto e transformá-lo em uma estrutura JSON válida e estrita, exatamente no formato exigido pelo ixtude.ai abaixo:

{
  "concursoInfo": {
    "concurso": "Nome do Concurso (ex: Receita Federal, Caixa, PF, etc.)",
    "cargo": "Nome do Cargo (ex: Auditor, Analista de TI, etc.)",
    "banca": "Banca Organizadora (ex: FCC, Cebraspe, FGV, etc.)",
    "dataProva": "YYYY-MM-DD"
  },
  "subjects": [
    {
      "name": "Nome da Disciplina",
      "weight": 3,
      "status": "active",
      "topics": [
        {
          "name": "Nome do Tópico Principal",
          "subtopics": [
            { "name": "Subtópico ou item detalhado 1" },
            { "name": "Subtópico ou item detalhado 2" }
          ]
        }
      ]
    }
  ]
}

Regras Cruciais:
1. Responda APENAS com o bloco de código JSON puro (sem explicações antes ou depois, sem markdown fora do bloco json).
2. O campo "weight" deve ser um número inteiro de 1 a 5 baseado na relevância da disciplina na prova.
3. O campo "status" deve ser "active" para as 4 a 6 matérias iniciais prioritárias, e "backlog" para as demais.
4. Quebre tópicos muito extensos em subtópicos atômicos para permitir estudo em blocos de 60 a 90 minutos.
5. Garanta que o JSON seja 100% válido, estrito (sem comentários // e sem vírgulas sobrando).

Aqui está o conteúdo do meu edital:
[COLE O TEXTO DO SEU EDITAL AQUI]`;

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onOpenAuth,
  onOpenFeedback,
}) => {
  const { user } = useAuth();
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_SYLLABUS_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  return (
    <div className="landing-container" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>
      {/* Top Navbar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 2rem',
          maxWidth: '1280px',
          margin: '0 auto',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.5px' }}>ixtude.ai</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ciclo & Edital Inteligente</div>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a
            href="#problema"
            className="hide-mobile"
            style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}
          >
            O Problema
          </a>
          <a
            href="#como-funciona"
            className="hide-mobile"
            style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}
          >
            Como Funciona
          </a>
          <a
            href="#edital-ia"
            className="hide-mobile"
            style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}
          >
            Edital com IA
          </a>

          <button
            onClick={onOpenFeedback}
            className="mock-btn text-muted"
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <MessageSquare size={14} />
            <span>Feedback</span>
          </button>

          {user ? (
            <button
              onClick={onEnterApp}
              className="mock-btn"
              style={{
                fontSize: '0.85rem',
                padding: '0.55rem 1.25rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Acessar Meu Painel</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => onOpenAuth('login')}
                className="mock-btn text-muted"
                style={{ fontSize: '0.85rem', padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <LogIn size={14} />
                <span>Entrar</span>
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="mock-btn"
                style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem', fontWeight: 700 }}
              >
                Cadastre-se Grátis
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{ maxWidth: '1080px', margin: '0 auto', padding: '4.5rem 1.5rem 3rem', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--color-accent)',
            padding: '6px 16px',
            borderRadius: '24px',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '1.75rem',
          }}
        >
          <Sparkles size={16} />
          <span>100% Gratuito durante a fase de validação • Ajude com seu feedback</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-1.5px',
            color: 'var(--text-main)',
            maxWidth: '920px',
            margin: '0 auto 1.5rem',
          }}
        >
          Chega de perder tempo planejando.{' '}
          <span style={{ color: 'var(--color-accent)' }}>Foque apenas em estudar e ser aprovado.</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            maxWidth: '760px',
            margin: '0 auto 2.5rem',
          }}
        >
          O <strong>estud.ai</strong> resolve a principal dor do concurseiro:{' '}
          <strong style={{ color: 'var(--text-main)' }}>a fadiga de decisão</strong>.
          Seu edital verticalizado, ciclo balanceado e revisões espaçadas funcionam no piloto automático.
          Abra o app, cumpra a meta do dia e avance rumo à vaga.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (user) {
                onEnterApp();
              } else {
                onOpenAuth('signup');
              }
            }}
            className="mock-btn"
            style={{
              fontSize: '1.1rem',
              padding: '1rem 2.2rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span>{user ? 'Acessar Plataforma' : 'Começar Agora — É 100% Grátis'}</span>
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onEnterApp}
            className="mock-btn text-muted"
            style={{
              fontSize: '1.05rem',
              padding: '1rem 1.8rem',
              borderRadius: '12px',
            }}
          >
            Explorar Sem Cadastro (Demo)
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Sem cartão de crédito</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Importação de edital com IA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Algoritmo SM-2 Spaced Repetition</span>
          </div>
        </div>
      </section>

      {/* Problem & Solution Section */}
      <section id="problema" style={{ maxWidth: '1120px', margin: '3rem auto 4rem', padding: '0 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Qual problema o estud.ai resolve?
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '650px', margin: '0.5rem auto 0' }}>
            Estudar para concurso público de alto nível é exaustivo. Veja as dores comuns que eliminamos:
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1 */}
          <div className="card-primary" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                marginBottom: '1.25rem',
              }}
            >
              <Clock size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              1. Fim da Fadiga de Decisão
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <strong>A dor:</strong> Você senta para estudar e gasta 30 a 45 minutos tentando decidir qual matéria estudar, abrindo planilhas desatualizadas ou se sentindo culpado por não saber se está no caminho certo.
              <br /><br />
              <strong>A solução:</strong> O estud.ai entrega sua <strong>Missão do Dia</strong> pronta. Ele calcula pesos, horas semanais e histórico recente para que você apenas aperte "Iniciar Estudo".
            </p>
          </div>

          {/* Card 2 */}
          <div className="card-primary" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                marginBottom: '1.25rem',
              }}
            >
              <Brain size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              2. Retenção Ativa com SM-2
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <strong>A dor:</strong> A curva do esquecimento de Ebbinghaus faz você esquecer até 70% do que estudou em 24h se não houver revisão espaçada estruturada.
              <br /><br />
              <strong>A solução:</strong> Agendamento automático D+1 no Piloto Automático e sistema de <strong>Flashcards estilo Anki SM-2</strong> com cloze deletion para reter a teoria na memória de longo prazo.
            </p>
          </div>

          {/* Card 3 */}
          <div className="card-primary" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
                marginBottom: '1.25rem',
              }}
            >
              <Bot size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              3. Edital Verticalizado em Segundos com IA
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <strong>A dor:</strong> Formatar um edital verticalizado manualmente leva dias inteiros de cópia e cola em tabelas do Excel.
              <br /><br />
              <strong>A solução:</strong> Criamos um <strong>prompt universal</strong> que você pode colar em qualquer IA gratuita (ChatGPT, Gemini, Claude, DeepSeek). Ela estrutura o edital completo e o estud.ai importa em 1 clique!
            </p>
          </div>
        </div>
      </section>

      {/* How it works in 3 steps */}
      <section id="como-funciona" style={{ backgroundColor: 'var(--bg-secondary)', padding: '4rem 1.5rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Como Funciona em 3 Passos Simples
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Sem configurações complicadas. Feito para qualquer estudante começar em 2 minutos.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent)',
                  color: '#ffffff',
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Importe seu Edital
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Copie nosso prompt pronto, passe o texto do seu edital em qualquer IA gratuita e cole o JSON gerado no estud.ai.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent)',
                  color: '#ffffff',
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Defina suas Horas Semanais
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Informe quantas horas você tem para estudar por semana. O sistema calibra os blocos automaticamente de acordo com os pesos das matérias.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent)',
                  color: '#ffffff',
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Cumpra a Missão Diária
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Todo dia ao acordar, sua meta de estudo estará pronta no Piloto Automático: matérias, tempo e quantidade ideal de questões.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free AI Prompt Interactive Section */}
      <section id="edital-ia" style={{ maxWidth: '1080px', margin: '4rem auto', padding: '0 1.5rem' }}>
        <div className="card-primary" style={{ padding: '2.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--color-accent)',
                  marginBottom: '0.5rem',
                }}
              >
                <Bot size={14} />
                <span>Prompt Universal para IA Gratuita</span>
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Transforme qualquer Edital em PDF em 1 Clique
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem', maxWidth: '650px' }}>
                Você não precisa pagar nada por IA. Basta copiar o prompt pronto abaixo e colar no <strong>ChatGPT</strong>, <strong>Claude</strong>, <strong>Google Gemini</strong> ou <strong>DeepSeek</strong> com o texto do seu edital:
              </p>
            </div>

            <button
              onClick={handleCopyPrompt}
              className="mock-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              {copiedPrompt ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedPrompt ? 'Copiado para Área de Transferência!' : 'Copiar Prompt Pronto'}</span>
            </button>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.25rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              maxHeight: '220px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.5',
            }}
          >
            {AI_SYLLABUS_PROMPT}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Depois de copiar a resposta da IA, basta colar dentro do botão "Importar Edital com IA" no aplicativo!
            </span>
            <button
              onClick={onEnterApp}
              className="mock-btn text-muted"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Ver onde colar no App &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* Free Early Access Banner */}
      <section style={{ maxWidth: '980px', margin: '0 auto 5rem', padding: '0 1.5rem', textAlign: 'center' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))',
            borderRadius: '20px',
            padding: '3.5rem 2rem',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '1rem', letterSpacing: '-0.5px' }}>
            Pronto para transformar sua rotina de estudos?
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: '1.6' }}>
            Nenhum plano pago, sem surpresas. A plataforma é gratuita para todos os concurseiros testarem e acelerarem suas aprovações.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (user) {
                  onEnterApp();
                } else {
                  onOpenAuth('signup');
                }
              }}
              className="mock-btn"
              style={{
                fontSize: '1.1rem',
                padding: '0.9rem 2.5rem',
                fontWeight: 800,
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              }}
            >
              {user ? 'Entrar no Meu Painel' : 'Criar Conta Gratuita'}
            </button>

            <button
              onClick={onOpenFeedback}
              className="mock-btn text-muted"
              style={{ fontSize: '1.05rem', padding: '0.9rem 1.8rem', borderRadius: '12px' }}
            >
              Enviar Sugestão / Feedback
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--color-accent)" />
            <strong style={{ color: 'var(--text-main)' }}>ixtude.ai</strong>
            <span>— Ciclo Inteligente, Edital Verticalizado & SM-2</span>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <button
              onClick={onOpenFeedback}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Reportar Bug / Feedback
            </button>
            <button
              onClick={onEnterApp}
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              Acessar Painel
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
