# estud.ai • Ciclo Inteligente & Edital Verticalizado

Plataforma inteligente de preparação para concursos públicos de alta performance, desenvolvida com React 19, TypeScript e Vite.

---

## 🚀 Funcionalidades Principais

- **🎯 Piloto Automático Diário**: Algoritmo inteligente que analisa o ciclo semanal, pendências acumuladas, revisões espaçadas e sugere a meta de estudos exata para o dia.
- **🔄 Ciclo de Estudos Dinâmico**: Distribuição proporcional de horas por peso e complexidade com rebalanceamento automático de blocos não concluídos.
- **📑 Edital Verticalizado Integrado**: Estrutura detalhada de disciplinas, tópicos e subtópicos (Preset completo do TCE-GO Analista de TI / FCC com taxonomia oficial Gran Cursos).
- **🧠 Repetição Espaçada SM-2 (Flashcards estilo Anki)**: Algoritmo de memorização ativa com intervalos adaptativos baseados em recall de qualidade (Errei, Difícil, Bom, Fácil).
- **⏱️ Estudo Ativo com Cronômetro**: Rastreamento de horas líquidas integrado com o ciclo de matérias e persistência contínua.
- **📊 Banco de Questões e Estatísticas**: Registro de acertos/erros, cálculo de aproveitamento por disciplina e links diretos com filtros aplicados para o Gran Questões.
- **📥 Sistema de Backup Universal (JSON)**: Exportação e importação de toda a base em 1 clique (workspaces, histórico de questões, sessões de estudo, flashcards e configurações), garantindo 100% de posse e privacidade dos seus dados.

---

## 🛠️ Instalação e Execução Local

### Pré-requisitos
- Node.js 18+ ou Node.js 20+
- npm ou yarn

### Passo a Passo

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento local
npm run dev

# 3. Executar verificações de código e testes
npm run lint
npm run test:autopilot

# 4. Gerar build de produção
npm run build
```

---

## 🌐 Deploy na Nuvem & Configuração de Domínio (`estud.ai`)

A aplicação é uma SPA (Single-Page Application) estática pronta para ser hospedada gratuitamente e com alta performance nas principais plataformas:

### 1. Vercel
1. Conecte seu repositório no dashboard da [Vercel](https://vercel.com).
2. O arquivo `vercel.json` incluído já configura automaticamente as rotas SPA.
3. Nas configurações do projeto (**Settings > Domains**), adicione `estud.ai`.
4. Configure no seu registrador de domínio (ex: Registro.br, Cloudflare, GoDaddy):
   - **Registro A**: `@` -> `76.76.21.21`
   - **Registro CNAME**: `www` -> `cname.vercel-dns.com`

### 2. Netlify
1. Conecte o repositório no dashboard do [Netlify](https://netlify.com).
2. Os arquivos `netlify.toml` e `public/_redirects` incluídos garantem o roteamento de todas as URLs para `/index.html`.
3. Em **Domain Management**, adicione o domínio customizado `estud.ai`.

### 3. Cloudflare Pages
1. Em **Workers & Pages**, conecte o repositório.
2. Build command: `npm run build`
3. Output directory: `dist`
4. O arquivo `public/_redirects` cuidará dos redirecionamentos SPA.

---

## 🔒 Privacidade dos Dados

Todos os seus dados de estudo (sessões, questões, revisões e anotações) são armazenados localmente no seu navegador via `localStorage`. Nenhum dado sensível é transmitido para servidores de terceiros sem a sua autorização expressa. Utilize o botão **Backup** no cabeçalho para gerar snapshots periódicos da sua evolução.
