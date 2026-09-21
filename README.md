# ixtude.ai • Ciclo Inteligente & Edital Verticalizado
**Domínio Oficial:** [https://ixtude-ai.com.br](https://ixtude-ai.com.br)

Plataforma inteligente de preparação para concursos públicos de alta performance, desenvolvida com React 19, TypeScript, Supabase e Vite.

---

## 🚀 Funcionalidades Principais

- **🎯 Piloto Automático Diário**: Algoritmo inteligente que analisa o ciclo semanal, pendências acumuladas, revisões espaçadas e sugere a meta de estudos exata para o dia.
- **🔄 Ciclo de Estudos Dinâmico**: Distribuição proporcional de horas por peso e complexidade com rebalanceamento automático de blocos não concluídos.
- **🤖 Importador de Edital com IA**: Prompt cirúrgico compatível com ChatGPT, Claude, Gemini e DeepSeek para estruturação instantânea de qualquer edital.
- **🧠 Repetição Espaçada SM-2 (Flashcards estilo Anki)**: Algoritmo de memorização ativa com intervalos adaptativos baseados em recall de qualidade (Errei, Difícil, Bom, Fácil).
- **⏱️ Estudo Ativo com Cronômetro**: Rastreamento de horas líquidas integrado com o ciclo de matérias e persistência contínua.
- **📊 Banco de Questões e Estatísticas**: Registro de acertos/erros, cálculo de aproveitamento por disciplina e links cirúrgicos para Gran Questões.
- **📥 Sistema de Backup Universal (JSON)**: Exportação e importação de toda a base em 1 clique, garantindo 100% de posse e privacidade dos seus dados.
- **🛡️ Painel de Administrador Restrito**: Monitoramento de métricas, saúde do sistema e gestão de feedbacks.

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
npm test

# 4. Gerar build de produção
npm run build
```

---

## 🌐 Deploy na Nuvem & Configuração de Domínio (`ixtude-ai.com.br`)

A aplicação é uma SPA estática otimizada para deploy na **Vercel** ou **Netlify**:

### 1. Vercel (Recomendado)
1. Conecte o repositório GitHub `saasGerenciadorEstudos` no dashboard da [Vercel](https://vercel.com).
2. O arquivo `vercel.json` incluído já configura automaticamente as rotas SPA.
3. Nas configurações do projeto (**Settings > Domains**), adicione `ixtude-ai.com.br` e `www.ixtude-ai.com.br`.
4. No **Registro.br**, acesse o painel de **DNS** de `ixtude-ai.com.br` e adicione:
   - **Registro A**: nome `@` (ou em branco) -> `76.76.21.21`
   - **Registro CNAME**: nome `www` -> `cname.vercel-dns.com`

### 2. Netlify
1. Conecte o repositório no dashboard do [Netlify](https://netlify.com).
2. Os arquivos `netlify.toml` e `public/_redirects` incluídos garantem o roteamento de todas as URLs para `/index.html`.
3. Em **Domain Management**, adicione o domínio customizado `ixtude-ai.com.br`.
4. No **Registro.br**, aponte os registros DNS fornecidos pelo Netlify.

---

## 🔒 Privacidade dos Dados

Todos os seus dados de estudo (sessões, questões, revisões e anotações) são armazenados localmente no seu navegador via `localStorage`. Nenhum dado sensível é transmitido para servidores de terceiros sem a sua autorização expressa. Utilize o botão **Backup** no cabeçalho para gerar snapshots periódicos da sua evolução.
