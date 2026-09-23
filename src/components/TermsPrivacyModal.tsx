import React, { useState } from 'react';
import { X, Shield, Lock, Cookie, Mail, CheckCircle2, FileText, ExternalLink } from 'lucide-react';

interface TermsPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'overview' | 'privacy' | 'cookies' | 'dpo';
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'privacy' | 'cookies' | 'dpo'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="placeholder-card card-primary"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-element)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)', letterSpacing: '-0.3px' }}>
                Termo de Consentimento, Uso & Privacidade
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ixtude.ai • Domínio oficial: <strong>ixtude-ai.com.br</strong> • Em conformidade com a LGPD e Google AdSense
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            padding: '0 1rem',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'overview', label: '1. Termos de Uso', icon: FileText },
            { id: 'privacy', label: '2. LGPD & Dados Pessoais', icon: Lock },
            { id: 'cookies', label: '3. Cookies & Google AdSense', icon: Cookie },
            { id: 'dpo', label: '4. Canal DPO & Direitos', icon: Mail },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '0.85rem 1.1rem',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div
          style={{
            padding: '1.75rem',
            overflowY: 'auto',
            flex: 1,
            lineHeight: 1.7,
            color: 'var(--text-main)',
            fontSize: '0.9rem',
          }}
        >
          {/* TAB 1: OVERVIEW & TERMOS DE USO */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.85rem',
                }}
              >
                <strong>Resumo Transparente:</strong> O <strong>ixtude.ai</strong> (disponível em <code>ixtude-ai.com.br</code>) é uma plataforma educacional gratuita focada na preparação de alta performance para concursos públicos através de ciclos de estudos inteligentes, editais verticalizados e repetição espaçada SM-2.
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                1. Condições de Acesso e Utilização
              </h3>
              <p>
                Ao acessar e utilizar a plataforma <strong>ixtude.ai</strong>, você expressa seu livre consentimento e concordância irrestrita com este Termo de Uso e com as diretrizes de privacidade aqui estabelecidas.
              </p>
              <p>
                O serviço é fornecido sem custos de assinatura para a rotina de estudos, planejamento e revisão. Para viabilizar a infraestrutura e a disponibilização gratuita da plataforma aos concurseiros de todo o Brasil, veiculamos publicidades não invasivas através de parceiros certificados, notadamente o <strong>Google AdSense</strong>.
              </p>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                2. Responsabilidades do Usuário
              </h3>
              <p>
                O usuário é responsável pela exatidão dos dados inseridos (planos de estudos, metas e horários) e pela guarda de suas credenciais de acesso quando optar por criar uma conta de sincronização.
              </p>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                3. Propriedade Intelectual & Ferramentas de Estudo
              </h3>
              <p>
                O algoritmo de ciclo dinâmico, a implementação de repetição espaçada SM-2, as métricas e a interface são de propriedade exclusiva do ixtude.ai. Os editais públicos, bancas examinadoras e legislações citadas pertencem aos seus respectivos entes e órgãos públicos, sendo organizados sob a finalidade estritamente pedagógica de estudo dirigida ao estudante.
              </p>
            </div>
          )}

          {/* TAB 2: LGPD & DADOS PESSOAIS */}
          {activeTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: '0.85rem',
                }}
              >
                <strong>Compromisso LGPD (Lei nº 13.709/2018):</strong> Tratamos seus dados com base nos princípios da finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência e segurança.
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                1. Arquitetura Local-First (Privacidade por Design)
              </h3>
              <p>
                O <strong>ixtude.ai</strong> adota o paradigma <em>Local-First</em>: seus cronogramas de estudo, matérias, revisões espaçadas, decks de flashcards e anotações ficam gravados <strong>diretamente no armazenamento do seu próprio navegador</strong> (LocalStorage / IndexedDB).
              </p>
              <p>
                Quando você não está logado, <strong>nenhum dado pessoal sensível ou identificador é enviado a servidores remotos</strong>. Você possui controle total de seus dados através da ferramenta nativa de Exportação / Backup JSON.
              </p>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                2. Conta de Sincronização em Nuvem (Opcional)
              </h3>
              <p>
                Caso você decida cadastrar uma conta para sincronizar seus estudos entre diferentes computadores ou dispositivos móveis:
              </p>
              <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>Coletamos unicamente: <strong>nome</strong>, <strong>e-mail</strong> e <strong>hash criptográfico da senha</strong> (via Supabase Auth).</li>
                <li>Os dados transmitidos utilizam criptografia de ponta a ponta em trânsito (HTTPS / TLS 1.3) e em repouso.</li>
                <li>Não compartilhamos nem vendemos seus dados de estudo para corretores de dados (data brokers).</li>
              </ul>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                3. Seus Direitos como Titular (Art. 18 da LGPD)
              </h3>
              <p>Você tem o direito de, a qualquer momento e mediante requisição gratuita:</p>
              <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>Confirmar a existência de tratamento de dados;</li>
                <li>Acessar e exportar integralmente todos os seus dados em formato JSON aberto (Portabilidade);</li>
                <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
                <li>Solicitar a eliminação completa da sua conta e de todos os dados vinculados;</li>
                <li>Revogar seu consentimento de forma simples e imediata.</li>
              </ul>
            </div>
          )}

          {/* TAB 3: COOKIES & GOOGLE ADSENSE */}
          {activeTab === 'cookies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.85rem',
                }}
              >
                <strong>Divulgação Obrigatória para Google AdSense:</strong> Para fins de aprovação e conformidade com as Políticas de Editores do Google, informamos com transparência detalhada o uso de cookies de terceiros.
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                1. O que são Cookies?
              </h3>
              <p>
                Cookies são pequenos arquivos de texto armazenados no navegador do usuário quando você visita sites na web. Eles servem para lembrar suas preferências (como o tema escuro/claro e o concurso ativo) e viabilizar a entrega de anúncios relevantes.
              </p>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                2. Divulgação do Google AdSense e Cookies de Terceiros
              </h3>
              <p>
                O <strong>ixtude.ai</strong> veicula anúncios discretos distribuídos pela rede de anúncios do <strong>Google AdSense</strong>.
              </p>
              <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  Fornecedores terceiros, incluindo o <strong>Google</strong>, utilizam cookies (como o cookie DoubleClick DART) para veicular anúncios com base nas visitas anteriores do usuário a este site ou a outros sites na internet.
                </li>
                <li>
                  Com os cookies de publicidade, o Google e seus parceiros podem veicular anúncios para os usuários com base nas visitas feitas ao <code>ixtude-ai.com.br</code> e/ou a outros sites da web.
                </li>
                <li>
                  Os anúncios exibidos no ixtude.ai são restritos estritamente ao rodapé da aplicação, <strong>nunca obstruindo a leitura de matérias, a resolução de questões nem a execução do cronômetro de estudos</strong>.
                </li>
              </ul>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                3. Como Desativar a Publicidade Personalizada (Opt-Out)
              </h3>
              <p>
                Os usuários podem desativar a publicidade personalizada a qualquer momento visitando as Configurações de Anúncios do Google:
              </p>
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mock-btn"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  <span>Google Ads Settings</span>
                  <ExternalLink size={13} />
                </a>

                <a
                  href="https://www.aboutads.info/choices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mock-btn text-muted"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  <span>AboutAds.info (Opt-Out)</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)', marginTop: '0.5rem' }}>
                4. Classificação de Cookies no ixtude.ai
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-element)', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>Cookies Estritamente Necessários</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Armazenam preferências locais essenciais (tema escuro/claro, workspace ativo, estado do cronômetro e consentimento de cookies). Não podem ser desativados sem comprometer a navegação.
                  </p>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-element)', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: 'var(--color-secondary)' }}>Cookies de Publicidade & Desempenho</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Gerenciados pelo Google AdSense para mensurar impressões de anúncios e evitar fraudes ou exibições repetitivas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CANAL DO DPO & CONTATO */}
          {activeTab === 'dpo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <Mail size={24} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                    Canal do Encarregado pelo Tratamento de Dados (DPO)
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Para exercer quaisquer de seus direitos garantidos pela LGPD, solicitar esclarecimentos sobre o tratamento de dados ou reportar qualquer dúvida referente à privacidade:
                  </p>
                  <div style={{ marginTop: '8px' }}>
                    <a
                      href="mailto:admin@ixtude-ai.com.br"
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                        textDecoration: 'underline',
                      }}
                    >
                      admin@ixtude-ai.com.br
                    </a>
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                Prazo e Procedimento de Atendimento
              </h3>
              <p>
                Todas as solicitações de titulares de dados recebidas pelo endereço <code>admin@ixtude-ai.com.br</code> são protocoladas e respondidas em até <strong>15 (quinze) dias úteis</strong>, conforme preconiza o Art. 19 da Lei Geral de Proteção de Dados.
              </p>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                Identificação do Controlador
              </h3>
              <p>
                <strong>Plataforma:</strong> ixtude.ai<br />
                <strong>Domínio Web Oficial:</strong> ixtude-ai.com.br<br />
                <strong>Jurisdição e Foro:</strong> República Federativa do Brasil, com aplicação da legislação civil e de proteção de dados brasileira.
              </p>

              <div
                style={{
                  marginTop: '1rem',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                Última atualização deste documento: <strong>Setembro de 2026</strong>. Versão 2.4 - Adequada às Diretrizes de Monetização e Editores Google AdSense e LGPD.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-element)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-success)' }}>
            <CheckCircle2 size={16} />
            <span>Documento ativo e em conformidade integral com LGPD & AdSense</span>
          </div>

          <button
            onClick={onClose}
            className="mock-btn"
            style={{
              padding: '8px 20px',
              fontSize: '0.85rem',
              fontWeight: 800,
              borderRadius: '8px',
            }}
          >
            Entendido & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
