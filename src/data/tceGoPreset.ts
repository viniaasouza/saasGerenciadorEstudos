import type { ConcursoInfo, Subject } from '../types';

export const TCE_GO_CONCURSO_INFO: ConcursoInfo = {
  concurso: 'TCE-GO',
  cargo: 'Técnico de Controle Externo - TI',
  banca: 'Fundação Carlos Chagas (FCC)',
  dataProva: '2027-01-17',
};

/**
 * Official Gran Questões Banca numeric IDs.
 * Gran Questões rejects string names like 'banca=FCC' and requires numeric IDs.
 */
export const GRAN_BANCA_IDS: Record<string, number> = {
  'FCC': 92,
  'Fundação Carlos Chagas (FCC)': 92,
  'Fundação Carlos Chagas': 92,
  'CEBRASPE': 27,
  'CESPE': 27,
  'Centro de Seleção e de Promoção de Eventos UnB': 27,
  'FGV': 102,
  'Fundação Getúlio Vargas': 102,
  'VUNESP': 252,
  'Fundação para o Vestibular da Universidade Estadual Paulista': 252,
  'QUADRIX': 286,
  'Instituto Quadrix': 286,
};

/**
 * Official Gran Questões Disciplina numeric IDs.
 */
export const GRAN_DISCIPLINA_IDS = {
  TI: 14,
  PORTUGUES: 403587,
  RLM: 404257,
  DIREITO_ADM: 404335,
  DIREITO_CONST: 402090,
  CONTROLE_EXTERNO: 408103,
  INGLES: 403588,
};

export interface GranFilterOptions {
  query?: string;
  assuntoId?: number | number[];
  disciplinaId?: number;
  banca?: string | number;
  filterBanca?: boolean;
}

/**
 * Builds a direct, surgical filtered search link on Gran Questões.
 * Supports:
 * - Specific Assunto IDs (single or comma-separated list)
 * - Scoped Disciplina IDs (prevents cross-discipline leakage)
 * - Official Banca numeric IDs (FCC = 92)
 * - Outdated/Annulled questions filtered out
 */
export function buildGranQuestoesUrl(
  input: string | GranFilterOptions,
  banca: string = 'FCC',
  filterBanca: boolean = true
): string {
  const baseUrl = 'https://questoes.grancursosonline.com.br/questoes?desatualizada=0&anulada=0';
  let url = baseUrl;

  let query: string | undefined;
  let assuntoId: number | number[] | undefined;
  let disciplinaId: number | undefined;
  let shouldUseBanca = filterBanca;
  let bancaVal: string | number = banca;

  if (typeof input === 'object' && input !== null) {
    query = input.query;
    assuntoId = input.assuntoId;
    disciplinaId = input.disciplinaId;
    if (input.filterBanca !== undefined) {
      shouldUseBanca = input.filterBanca;
    }
    if (input.banca !== undefined) {
      bancaVal = input.banca;
    }
  } else {
    query = input;
  }

  // 1. Scoped Disciplina ID
  if (disciplinaId) {
    url += `&disciplina=${disciplinaId}`;
  }

  // 2. High-precision Assunto ID(s)
  if (assuntoId) {
    const ids = Array.isArray(assuntoId)
      ? assuntoId.filter((id) => typeof id === 'number' && id > 0).join(',')
      : String(assuntoId);
    if (ids) {
      url += `&assunto=${ids}`;
    }
  }

  // 3. Fallback targeted query (only if no specific assuntoId or if explicit query requested)
  if (!assuntoId && query) {
    let clean = query.split(';')[0].split(',')[0].replace(/[()[\]{}]/g, '').trim();
    if (clean.length > 35) clean = clean.slice(0, 35).trim();
    if (clean) {
      url += `&query=${encodeURIComponent(clean)}`;
    }
  }

  // 4. Official Banca Numeric ID (FCC = 92)
  if (shouldUseBanca) {
    let resolvedBancaId: number | undefined;
    if (typeof bancaVal === 'number') {
      resolvedBancaId = bancaVal;
    } else if (typeof bancaVal === 'string') {
      resolvedBancaId = GRAN_BANCA_IDS[bancaVal] || GRAN_BANCA_IDS[bancaVal.toUpperCase()];
    }
    if (resolvedBancaId) {
      url += `&banca=${resolvedBancaId}`;
    }
  }

  return url;
}

/**
 * Full preset of the 14 TCE-GO IT subjects with groups, subtopics, and Gran Questões taxonomy IDs.
 */
export const TCE_GO_SUBJECTS_PRESET: Subject[] = [
  {
    "id": "sub-engenharia-de-software",
    "name": "Engenharia de Software",
    "weight": 5,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 7988,
    "granQuery": "Engenharia de Software",
    "topics": [
      {
        "id": "top-engenharia-de-software-0",
        "name": "Processos, Ciclo de Vida e Métodos Ágeis",
        "disciplinaId": 14,
        "assuntoId": [
          428797,
          428799,
          428800
        ],
        "granQuery": "Métodos Ágeis Scrum Kanban",
        "subtopics": [
          {
            "id": "subtop-engenharia-de-software-0-0",
            "name": "Fundamentos da engenharia de software; ciclo de vida de software; abordagens preditiva, iterativa, incremental e adaptativa/ágil",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7988,
            "granQuery": "Ciclo de vida de software"
          },
          {
            "id": "subtop-engenharia-de-software-0-1",
            "name": "Abordagens, métodos e frameworks ágeis: Scrum, Kanban, Lean Software Development e Extreme Programming (XP)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              428797,
              428799
            ],
            "granQuery": "Scrum Kanban"
          },
          {
            "id": "subtop-engenharia-de-software-0-2",
            "name": "Levantamento, especificação, análise, validação e gerenciamento de requisitos; histórias de usuário e critérios de aceite",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              428791,
              428792
            ],
            "granQuery": "Engenharia de Requisitos"
          }
        ]
      },
      {
        "id": "top-engenharia-de-software-1",
        "name": "Arquitetura, Projeto e Modelagem de Software",
        "disciplinaId": 14,
        "assuntoId": [
          400724,
          428814,
          402081
        ],
        "granQuery": "Arquitetura de Software",
        "subtopics": [
          {
            "id": "subtop-engenharia-de-software-1-0",
            "name": "Arquitetura de software: padrões arquiteturais, camadas, SOA, microsserviços e orientada a eventos; SOLID, DRY, KISS e YAGNI",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 400724,
            "granQuery": "Microsserviços SOLID"
          },
          {
            "id": "subtop-engenharia-de-software-1-1",
            "name": "Modelagem de sistemas e processos com UML e BPMN",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              428814,
              402081
            ],
            "granQuery": "UML BPMN"
          },
          {
            "id": "subtop-engenharia-de-software-1-2",
            "name": "Padrões de projeto de software (Design Patterns): criacionais, estruturais e comportamentais",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8032,
            "granQuery": "Design Patterns"
          }
        ]
      },
      {
        "id": "top-engenharia-de-software-2",
        "name": "Qualidade, Testes e Manutenção",
        "disciplinaId": 14,
        "assuntoId": [
          428830,
          428831
        ],
        "granQuery": "Qualidade e Testes de Software",
        "subtopics": [
          {
            "id": "subtop-engenharia-de-software-2-0",
            "name": "Qualidade de software: desempenho, escalabilidade, disponibilidade, confiabilidade e manutenibilidade; métricas de qualidade",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428830,
            "granQuery": "Qualidade de Software"
          },
          {
            "id": "subtop-engenharia-de-software-2-1",
            "name": "Testes de software: unidade, integração, sistema, aceitação, regressão, desempenho e carga; conceitos de TDD e BDD",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428831,
            "granQuery": "Testes de Software TDD"
          },
          {
            "id": "subtop-engenharia-de-software-2-2",
            "name": "Manutenção de software: corretiva, adaptativa, perfectiva e preventiva; refatoração e dívida técnica",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7988,
            "granQuery": "Refatoração Dívida Técnica"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-desenvolvimento-de-sistemas",
    "name": "Desenvolvimento de Sistemas",
    "weight": 5,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": [
      7979,
      404814,
      7980,
      7985
    ],
    "granQuery": "Desenvolvimento de Sistemas",
    "topics": [
      {
        "id": "top-desenvolvimento-de-sistemas-0",
        "name": "Linguagens Backend e Orientação a Objetos",
        "disciplinaId": 14,
        "assuntoId": [
          7979,
          404814,
          7985
        ],
        "granQuery": "Java Python POO",
        "subtopics": [
          {
            "id": "subtop-desenvolvimento-de-sistemas-0-0",
            "name": "Linguagem Java: sintaxe, coleções, concorrência, streams, tratamento de exceções e ecossistema Spring Boot",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7979,
            "granQuery": "Java Spring Boot"
          },
          {
            "id": "subtop-desenvolvimento-de-sistemas-0-1",
            "name": "Linguagem Python: sintaxe, estruturas de dados nativas, manipulação de arquivos e automação",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 404814,
            "granQuery": "Python"
          },
          {
            "id": "subtop-desenvolvimento-de-sistemas-0-2",
            "name": "Programação Orientada a Objetos: classes, objetos, encapsulamento, herança, polimorfismo, abstração e interfaces",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7985,
            "granQuery": "Programação Orientada a Objetos"
          }
        ]
      },
      {
        "id": "top-desenvolvimento-de-sistemas-1",
        "name": "Desenvolvimento Web, Frontend e APIs",
        "disciplinaId": 14,
        "assuntoId": [
          7980,
          428742
        ],
        "granQuery": "JavaScript Web API REST",
        "subtopics": [
          {
            "id": "subtop-desenvolvimento-de-sistemas-1-0",
            "name": "JavaScript moderno (ES6+) e conceitos de TypeScript: tipos estáticos, interfaces e assincronia (Promises, async/await)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7980,
            "granQuery": "JavaScript TypeScript"
          },
          {
            "id": "subtop-desenvolvimento-de-sistemas-1-1",
            "name": "Frontend moderno: fundamentos de React, componentes funcionais, hooks, ciclo de vida e estado",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7980,
            "granQuery": "React"
          },
          {
            "id": "subtop-desenvolvimento-de-sistemas-1-2",
            "name": "APIs RESTful e Web Services: verbos HTTP, status codes, JSON, autenticação JWT, OAuth2 e documentação Swagger/OpenAPI",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429146,
            "granQuery": "API REST JSON"
          }
        ]
      },
      {
        "id": "top-desenvolvimento-de-sistemas-2",
        "name": "Estruturas de Dados e Algoritmos",
        "disciplinaId": 14,
        "assuntoId": [
          428980,
          429000
        ],
        "granQuery": "Estruturas de Dados Algoritmos",
        "subtopics": [
          {
            "id": "subtop-desenvolvimento-de-sistemas-2-0",
            "name": "Estruturas de dados lineares e não-lineares: vetores, listas encadeadas, pilhas, filas, tabelas hash e árvores binárias",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428980,
            "granQuery": "Estruturas de Dados"
          },
          {
            "id": "subtop-desenvolvimento-de-sistemas-2-1",
            "name": "Algoritmos de busca (sequencial, binária) e de ordenação (QuickSort, MergeSort, HeapSort)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429000,
            "granQuery": "Algoritmos Busca Ordenação"
          },
          {
            "id": "subtop-desenvolvimento-de-sistemas-2-2",
            "name": "Análise de complexidade temporal e espacial: notação assintótica Big-O",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429000,
            "granQuery": "Complexidade Big-O"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-devops-plataformas-de-entrega-e-conteinerizacao",
    "name": "DevOps, Plataformas de Entrega e Conteinerização",
    "weight": 5,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": [
      428855,
      429104,
      429105,
      429106,
      429107,
      429109,
      429110,
      428853,
      428854
    ],
    "granQuery": "DevOps Docker Kubernetes",
    "topics": [
      {
        "id": "top-devops-plataformas-de-entrega-e-conteinerizacao-0",
        "name": "Cultura DevOps e Pipelines CI/CD",
        "disciplinaId": 14,
        "assuntoId": [
          428855,
          428853,
          428854
        ],
        "granQuery": "DevOps Integração Contínua",
        "subtopics": [
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-0-0",
            "name": "Conceitos e cultura DevOps: integração, comunicação, automação e colaboração entre desenvolvimento e operações",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428855,
            "granQuery": "DevOps"
          },
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-0-1",
            "name": "Integração Contínua (CI) e Entrega Contínua (CD): pipelines de build, testes automatizados e deploy contínuo (GitLab CI, GitHub Actions, Jenkins)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              428853,
              428854
            ],
            "granQuery": "Integração Contínua CI CD"
          },
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-0-2",
            "name": "Gerenciamento de configuração e versionamento de código: Git, branching strategies (GitFlow, Trunk-based) e repositórios remotos",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428740,
            "granQuery": "Git Versionamento"
          }
        ]
      },
      {
        "id": "top-devops-plataformas-de-entrega-e-conteinerizacao-1",
        "name": "Conteinerização e Orquestração (Docker e Kubernetes)",
        "disciplinaId": 14,
        "assuntoId": [
          429104,
          429105,
          429106,
          429107,
          429109,
          429110
        ],
        "granQuery": "Docker Kubernetes Containers",
        "subtopics": [
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-1-0",
            "name": "Tecnologia de containers vs virtualização tradicional; arquitetura do Docker (Engine, Daemon, imagens e containers)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              429104,
              429105
            ],
            "granQuery": "Docker Containers"
          },
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-1-1",
            "name": "Criação de imagens (Dockerfile, multi-stage build), gerenciamento de volumes, redes e orquestração local com Docker Compose",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              429106,
              429107
            ],
            "granQuery": "Docker Compose"
          },
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-1-2",
            "name": "Orquestração com Kubernetes: arquitetura (Control Plane e Workers), Pods, Deployments, Services, Ingress, ConfigMaps, Secrets e Namespaces",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429110,
            "granQuery": "Kubernetes"
          }
        ]
      },
      {
        "id": "top-devops-plataformas-de-entrega-e-conteinerizacao-2",
        "name": "Infraestrutura como Código e Observabilidade",
        "disciplinaId": 14,
        "assuntoId": [
          428855,
          429104
        ],
        "granQuery": "Infraestrutura como Código",
        "subtopics": [
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-2-0",
            "name": "Infraestrutura como Código (IaC): conceitos, benefícios e ferramentas (Terraform, Ansible)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428855,
            "granQuery": "Infraestrutura como Código Terraform"
          },
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-2-1",
            "name": "Observabilidade e monitoramento: coleta de métricas, logs centralizados, traces distribuídos (Prometheus, Grafana, ELK/OpenSearch)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428855,
            "granQuery": "Observabilidade Prometheus Grafana"
          },
          {
            "id": "subtop-devops-plataformas-de-entrega-e-conteinerizacao-2-2",
            "name": "Práticas de DevSecOps: segurança em esteiras de entrega, análise estática (SAST), dinâmica (DAST) e varredura de vulnerabilidades em imagens",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              428855,
              8150
            ],
            "granQuery": "DevSecOps SAST DAST"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-banco-de-dados-e-engenharia-de-dados",
    "name": "Banco de Dados e Engenharia de Dados",
    "weight": 5,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 8026,
    "granQuery": "Banco de Dados",
    "topics": [
      {
        "id": "top-banco-de-dados-e-engenharia-de-dados-0",
        "name": "Modelagem e Bancos de Dados Relacionais",
        "disciplinaId": 14,
        "assuntoId": [
          8026,
          8027
        ],
        "granQuery": "Modelagem Relacional SQL",
        "subtopics": [
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-0-0",
            "name": "Modelagem de dados conceitual (Entidade-Relacionamento), lógica e física; mapeamento ER para relacional",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8027,
            "granQuery": "Modelagem Conceitual ER"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-0-1",
            "name": "Normalização de dados: primeira, segunda, terceira forma normal e Boyce-Codd; anomalias de atualização",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8027,
            "granQuery": "Normalização de Dados"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-0-2",
            "name": "Linguagem SQL: DDL, DML, DQL e DCL; consultas complexas, junções (INNER, LEFT, RIGHT, FULL), subconsultas, funções analíticas e agregação",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              8098,
              8026
            ],
            "granQuery": "SQL Consultas Joins"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-0-3",
            "name": "Sistemas de Gerenciamento de Bancos de Dados (SGBD): PostgreSQL e Oracle; transações, propriedades ACID, concorrência e isolamento",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8026,
            "granQuery": "PostgreSQL Transações ACID"
          }
        ]
      },
      {
        "id": "top-banco-de-dados-e-engenharia-de-dados-1",
        "name": "Bancos Não Relacionais (NoSQL) e Big Data",
        "disciplinaId": 14,
        "assuntoId": [
          428570,
          428634
        ],
        "granQuery": "NoSQL Big Data",
        "subtopics": [
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-1-0",
            "name": "Bancos de dados NoSQL: modelos chave-valor, documentos (MongoDB), colunares (Cassandra) e grafos (Neo4j)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428570,
            "granQuery": "NoSQL MongoDB"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-1-1",
            "name": "Teorema CAP (Consistência, Disponibilidade e Tolerância ao Particionamento) e modelo BASE",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428570,
            "granQuery": "Teorema CAP BASE"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-1-2",
            "name": "Conceitos de Big Data: características (volume, velocidade, variedade, veracidade e valor); ecossistema distribuído (Hadoop HDFS e Apache Spark)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428634,
            "granQuery": "Big Data Spark Hadoop"
          }
        ]
      },
      {
        "id": "top-banco-de-dados-e-engenharia-de-dados-2",
        "name": "Data Warehousing e Engenharia de Dados",
        "disciplinaId": 14,
        "assuntoId": [
          428659,
          428634
        ],
        "granQuery": "Data Warehouse ETL",
        "subtopics": [
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-2-0",
            "name": "Data Warehouse e Data Marts: arquiteturas, modelagem dimensional, tabelas de fatos e dimensões; esquemas estrela (star schema) e floco de neve (snowflake)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428659,
            "granQuery": "Data Warehouse Modelagem Dimensional"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-2-1",
            "name": "Processos de ETL/ELT: extração, transformação e carga de dados; pipelines de dados em lote (batch) e em tempo real (streaming)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428659,
            "granQuery": "ETL Pipelines"
          },
          {
            "id": "subtop-banco-de-dados-e-engenharia-de-dados-2-2",
            "name": "Conceitos de Data Lake e Lakehouse; formatos abertos de armazenamento (Parquet, Delta Lake)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428634,
            "granQuery": "Data Lake Parquet"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-arquitetura-de-nuvem-e-infraestrutura",
    "name": "Arquitetura de Nuvem e Infraestrutura",
    "weight": 4,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 420162,
    "granQuery": "Computação em Nuvem Infraestrutura",
    "topics": [
      {
        "id": "top-arquitetura-de-nuvem-e-infraestrutura-0",
        "name": "Computação em Nuvem e Provedores",
        "disciplinaId": 14,
        "assuntoId": 420162,
        "granQuery": "Cloud Computing AWS Azure",
        "subtopics": [
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-0-0",
            "name": "Conceitos de computação em nuvem: características essenciais (NIST), modelos de serviço (IaaS, PaaS, SaaS) e de implantação (pública, privada, híbrida e multi-cloud)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 420162,
            "granQuery": "IaaS PaaS SaaS NIST"
          },
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-0-1",
            "name": "Serviços em nuvem pública (AWS e Microsoft Azure): computação, armazenamento, banco de dados gerenciado, redes virtuais e segurança",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 420162,
            "granQuery": "AWS Azure Computação Nuvem"
          },
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-0-2",
            "name": "Arquitetura serverless e computação orientada a eventos (AWS Lambda, Azure Functions)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 420162,
            "granQuery": "Serverless Lambda Functions"
          }
        ]
      },
      {
        "id": "top-arquitetura-de-nuvem-e-infraestrutura-1",
        "name": "Sistemas Operacionais e Virtualização",
        "disciplinaId": 14,
        "assuntoId": [
          7970,
          429104
        ],
        "granQuery": "Linux Windows Server Virtualização",
        "subtopics": [
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-1-0",
            "name": "Sistemas operacionais Linux: gerenciamento de processos, memória, sistema de arquivos, permissões, usuários e shell scripting (Bash)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7970,
            "granQuery": "Linux Shell Script"
          },
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-1-1",
            "name": "Sistemas operacionais Windows Server: conceitos de Active Directory (AD DS), DNS integrado, GPO e PowerShell",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7970,
            "granQuery": "Windows Server Active Directory"
          },
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-1-2",
            "name": "Virtualização tradicional: hipervisores Tipo 1 e Tipo 2 (VMware ESXi, Hyper-V, KVM); migração a frio e a quente (vMotion)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429104,
            "granQuery": "Virtualização Hipervisor"
          }
        ]
      },
      {
        "id": "top-arquitetura-de-nuvem-e-infraestrutura-2",
        "name": "Armazenamento, Backup e Alta Disponibilidade",
        "disciplinaId": 14,
        "assuntoId": [
          429251,
          7975
        ],
        "granQuery": "Storage Backup Alta Disponibilidade",
        "subtopics": [
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-2-0",
            "name": "Tecnologias de armazenamento (Storage): DAS, NAS, SAN (Fibre Channel e iSCSI); tipos de RAID (0, 1, 5, 6, 10)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429251,
            "granQuery": "Storage SAN NAS RAID"
          },
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-2-1",
            "name": "Estratégias e políticas de backup e restore: backup completo, incremental e diferencial; regras de retenção e regra 3-2-1",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 7975,
            "granQuery": "Backup Incremental Completo"
          },
          {
            "id": "subtop-arquitetura-de-nuvem-e-infraestrutura-2-2",
            "name": "Alta disponibilidade e tolerância a falhas: clusters ativos/passivos e ativos/ativos; balanceamento de carga e continuidade de negócios (RPO e RTO)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 420162,
            "granQuery": "Alta Disponibilidade RPO RTO"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-redes-de-computadores-e-comunicacao-de-dados",
    "name": "Redes de Computadores e Comunicação de Dados",
    "weight": 4,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 8174,
    "granQuery": "Redes de Computadores",
    "topics": [
      {
        "id": "top-redes-de-computadores-e-comunicacao-de-dados-0",
        "name": "Arquitetura e Modelos de Referência",
        "disciplinaId": 14,
        "assuntoId": [
          8174,
          429280
        ],
        "granQuery": "Modelo OSI TCP IP",
        "subtopics": [
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-0-0",
            "name": "Modelo de referência OSI/ISO e arquitetura TCP/IP: camadas, funções, PDUs e encapsulamento de dados",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429280,
            "granQuery": "Modelo OSI Camadas"
          },
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-0-1",
            "name": "Topologias de rede (físicas e lógicas); padrões IEEE 802.3 (Ethernet) e meios físicos de transmissão (par trançado, fibra óptica e sem fio)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8174,
            "granQuery": "Topologia Redes Ethernet"
          }
        ]
      },
      {
        "id": "top-redes-de-computadores-e-comunicacao-de-dados-1",
        "name": "Protocolos de Redes e Transporte",
        "disciplinaId": 14,
        "assuntoId": [
          429165,
          429364
        ],
        "granQuery": "Protocolos TCP IP DNS",
        "subtopics": [
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-1-0",
            "name": "Protocolo IP (IPv4 e IPv6): endereçamento, classes, máscaras de sub-rede, CIDR, VLSM e fragmentação de pacotes",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8174,
            "granQuery": "IPv4 IPv6 Sub-redes CIDR"
          },
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-1-1",
            "name": "Protocolos da camada de transporte: TCP (handshake em 3 vias, controle de fluxo e congestionamento) e UDP",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8174,
            "granQuery": "Protocolo TCP UDP Handshake"
          },
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-1-2",
            "name": "Protocolos da camada de aplicação: DNS, DHCP, HTTP/HTTPS, FTP, SSH, SMTP, SNMP e NTP",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": [
              429165,
              429364
            ],
            "granQuery": "DNS DHCP HTTP SSH SNMP"
          }
        ]
      },
      {
        "id": "top-redes-de-computadores-e-comunicacao-de-dados-2",
        "name": "Equipamentos, Roteamento e Tecnologias de Conexão",
        "disciplinaId": 14,
        "assuntoId": 8174,
        "granQuery": "Roteamento Switches VLAN",
        "subtopics": [
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-2-0",
            "name": "Equipamentos de interconexão: repetidores, hubs, bridges, switches (camadas 2 e 3) e roteadores",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8174,
            "granQuery": "Switches Roteadores Camada 2 3"
          },
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-2-1",
            "name": "VLANs (IEEE 802.1Q), troncos, protocolo Spanning Tree (STP/RSTP) e agregação de enlaces (LACP)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8174,
            "granQuery": "VLAN 802.1Q Spanning Tree"
          },
          {
            "id": "subtop-redes-de-computadores-e-comunicacao-de-dados-2-2",
            "name": "Roteamento estático e dinâmico: protocolos de roteamento interno (OSPF, RIP) e externo (BGP); NAT e PAT",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8174,
            "granQuery": "Roteamento OSPF BGP NAT"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-seguranca-da-informacao-e-ciberseguranca",
    "name": "Segurança da Informação e Cibersegurança",
    "weight": 5,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 8150,
    "granQuery": "Segurança da Informação",
    "topics": [
      {
        "id": "top-seguranca-da-informacao-e-ciberseguranca-0",
        "name": "Fundamentos de Segurança e Criptografia",
        "disciplinaId": 14,
        "assuntoId": [
          8150,
          8170
        ],
        "granQuery": "Criptografia Segurança Informação",
        "subtopics": [
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-0-0",
            "name": "Conceitos fundamentais e princípios básicos: confidencialidade, integridade, disponibilidade, autenticidade e não-repúdio",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8150,
            "granQuery": "Confidencialidade Integridade Disponibilidade"
          },
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-0-1",
            "name": "Criptografia simétrica (AES, DES) e assimétrica (RSA, Curvas Elípticas); funções hash criptográficas (SHA-256, SHA-3) e colisões",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8170,
            "granQuery": "Criptografia Simétrica Assimétrica Hash"
          },
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-0-2",
            "name": "Assinatura digital, infraestrutura de chaves públicas (PKI / ICP-Brasil), certificados digitais (X.509) e carimbo de tempo",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8154,
            "granQuery": "Assinatura Digital ICP-Brasil X.509"
          }
        ]
      },
      {
        "id": "top-seguranca-da-informacao-e-ciberseguranca-1",
        "name": "Ameaças, Ataques e Defesas em Redes/Sistemas",
        "disciplinaId": 14,
        "assuntoId": 8150,
        "granQuery": "Ameaças Firewall IDS IPS",
        "subtopics": [
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-1-0",
            "name": "Códigos maliciosos (malware): vírus, worms, trojans, ransomwares, spywares, rootkits e botnets",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8150,
            "granQuery": "Malware Ransomware Phishing"
          },
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-1-1",
            "name": "Ataques cibernéticos: DoS/DDoS, man-in-the-middle, spoofing, phishing, engenharia social, injeção de SQL (SQLi) e Cross-Site Scripting (XSS)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8150,
            "granQuery": "DDoS SQL Injection XSS Phishing"
          },
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-1-2",
            "name": "Mecanismos e dispositivos de segurança: Firewalls (stateless, stateful, NGFW), sistemas de detecção/prevenção de intrusão (IDS/IPS), WAF, VPNs e DMZ",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8150,
            "granQuery": "Firewall IDS IPS WAF"
          }
        ]
      },
      {
        "id": "top-seguranca-da-informacao-e-ciberseguranca-2",
        "name": "Gestão de Segurança, Normas e LGPD",
        "disciplinaId": 14,
        "assuntoId": [
          429569,
          428149
        ],
        "granQuery": "ISO 27001 27002 LGPD",
        "subtopics": [
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-2-0",
            "name": "Normas ABNT NBR ISO/IEC 27001 (Sistema de Gestão de Segurança da Informação), 27002 (Controles de segurança) e 27005 (Gestão de riscos)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429569,
            "granQuery": "ISO 27001 ISO 27002 27005"
          },
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-2-1",
            "name": "Política de Segurança da Informação (PSI): elaboração, implementação, classificação da informação e controle de acesso (RBAC, ABAC)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 429569,
            "granQuery": "Política de Segurança da Informação"
          },
          {
            "id": "subtop-seguranca-da-informacao-e-ciberseguranca-2-2",
            "name": "Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018): conceitos, dados sensíveis, bases legais, direitos do titular e papel do DPO",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428149,
            "granQuery": "LGPD Lei 13709"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-inteligencia-artificial-e-ciencia-de-dados",
    "name": "Inteligência Artificial e Ciência de Dados",
    "weight": 4,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 428630,
    "granQuery": "Inteligência Artificial Ciência de Dados",
    "topics": [
      {
        "id": "top-inteligencia-artificial-e-ciencia-de-dados-0",
        "name": "Conceitos de IA e Aprendizado de Máquina (Machine Learning)",
        "disciplinaId": 14,
        "assuntoId": 428630,
        "granQuery": "Machine Learning Aprendizado de Máquina",
        "subtopics": [
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-0-0",
            "name": "Fundamentos de Inteligência Artificial: tipos de aprendizado (supervisionado, não supervisionado, semi-supervisionado e por reforço)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "Aprendizado Supervisionado Não Supervisionado"
          },
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-0-1",
            "name": "Algoritmos clássicos de classificação e regressão: regressão linear/logística, árvores de decisão, Random Forest, SVM e k-NN",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "Random Forest SVM Regressão"
          },
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-0-2",
            "name": "Algoritmos de agrupamento (clustering): k-Means e agrupamento hierárquico",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "Clustering k-Means"
          },
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-0-3",
            "name": "Métricas de avaliação de modelos: acurácia, precisão, revocação (recall), F1-score, curva ROC e AUC; overfitting e underfitting",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "Métricas Avaliação ROC F1-Score"
          }
        ]
      },
      {
        "id": "top-inteligencia-artificial-e-ciencia-de-dados-1",
        "name": "Processamento de Linguagem Natural e IA Generativa",
        "disciplinaId": 14,
        "assuntoId": 428630,
        "granQuery": "PLN IA Generativa",
        "subtopics": [
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-1-0",
            "name": "Fundamentos de Processamento de Linguagem Natural (PLN): tokenização, lematização, stemming, TF-IDF e embeddings",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "Processamento de Linguagem Natural Tokenização"
          },
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-1-1",
            "name": "Conceitos de Modelos de Linguagem de Grande Porte (LLMs), arquitetura Transformer (atenção) e IA generativa aplicada ao setor público",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "LLM Transformer IA Generativa"
          }
        ]
      },
      {
        "id": "top-inteligencia-artificial-e-ciencia-de-dados-2",
        "name": "Visualização de Dados e Business Intelligence",
        "disciplinaId": 14,
        "assuntoId": 428659,
        "granQuery": "Power BI Business Intelligence",
        "subtopics": [
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-2-0",
            "name": "Construção de relatórios e painéis interativos com Power BI: DAX básico, relacionamentos de dados e melhores práticas de storytelling",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428659,
            "granQuery": "Power BI DAX Dashboards"
          },
          {
            "id": "subtop-inteligencia-artificial-e-ciencia-de-dados-2-1",
            "name": "Análise exploratória de dados (EDA) e detecção de outliers e dados faltantes",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428630,
            "granQuery": "Análise Exploratória Dados Outliers"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-governanca-de-tecnologia-da-informacao",
    "name": "Governança de Tecnologia da Informação",
    "weight": 3,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 14,
    "granQuery": "Governança de TI",
    "topics": [
      {
        "id": "top-governanca-de-tecnologia-da-informacao-0",
        "name": "Modelos de Referência e Gestão Estratégica de TI",
        "disciplinaId": 14,
        "assuntoId": 14,
        "granQuery": "COBIT ITIL PMBOK",
        "subtopics": [
          {
            "id": "subtop-governanca-de-tecnologia-da-informacao-0-0",
            "name": "Conceitos de governança vs gestão de TI; alinhamento estratégico entre TI e objetivos de negócio",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Governança Gestão TI"
          },
          {
            "id": "subtop-governanca-de-tecnologia-da-informacao-0-1",
            "name": "Planejamento Estratégico de TI (PDTI): alinhamento com a Estratégia Nacional de TIC do Poder Judiciário/Tribunais",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "PDTI Planejamento Estratégico TI"
          },
          {
            "id": "subtop-governanca-de-tecnologia-da-informacao-0-2",
            "name": "Boas práticas e modelos de referência: COBIT 2019 (princípios, sistema e componentes de governança), ITIL v4 (Sistema de Valor de Serviço e práticas de serviço)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "COBIT 2019 ITIL v4"
          },
          {
            "id": "subtop-governanca-de-tecnologia-da-informacao-0-3",
            "name": "Gestão de projetos: fundamentos do PMBOK (áreas de conhecimento, grupos de processos e abordagem ágil/híbrida)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "PMBOK Gestão de Projetos"
          }
        ]
      },
      {
        "id": "top-governanca-de-tecnologia-da-informacao-1",
        "name": "Contratações de TIC e Governo Digital",
        "disciplinaId": 14,
        "assuntoId": 14,
        "granQuery": "Contratações de TIC Governo Digital",
        "subtopics": [
          {
            "id": "subtop-governanca-de-tecnologia-da-informacao-1-0",
            "name": "Contratação de soluções de TIC na administração pública: Instrução Normativa SGD/ME nº 94/2022 (fases de planejamento, seleção de fornecedor e gestão contratual)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Contratações de TIC IN 94"
          },
          {
            "id": "subtop-governanca-de-tecnologia-da-informacao-1-1",
            "name": "Governo digital e transformação digital no setor público: Lei nº 14.129/2021 (princípios, interoperabilidade e serviços digitais)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Governo Digital Lei 14129"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-legislacao-aplicada-a-tecnologia-da-informacao",
    "name": "Legislação Aplicada à TI",
    "weight": 3,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 14,
    "assuntoId": 14,
    "granQuery": "Legislação TI Marco Civil",
    "topics": [
      {
        "id": "top-legislacao-aplicada-a-tecnologia-da-informacao-0",
        "name": "Legislação Federal de TI, Privacidade e Proteção de Dados",
        "disciplinaId": 14,
        "assuntoId": 14,
        "granQuery": "Marco Civil LGPD LAI",
        "subtopics": [
          {
            "id": "subtop-legislacao-aplicada-a-tecnologia-da-informacao-0-0",
            "name": "Aplicação técnica da Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) no desenvolvimento e gestão de banco de dados",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 428149,
            "granQuery": "LGPD Desenvolvimento"
          },
          {
            "id": "subtop-legislacao-aplicada-a-tecnologia-da-informacao-0-1",
            "name": "Marco Civil da Internet (Lei nº 12.965/2014): neutralidade de rede, guarda de registros de conexão e de aplicações",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Marco Civil da Internet Lei 12965"
          },
          {
            "id": "subtop-legislacao-aplicada-a-tecnologia-da-informacao-0-2",
            "name": "Requisitos de segurança da informação em contratações de TIC na Administração Pública",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Segurança da Informação Contratações TIC"
          },
          {
            "id": "subtop-legislacao-aplicada-a-tecnologia-da-informacao-0-3",
            "name": "Certificação digital e sua aplicação em sistemas informatizados públicos (Medida Provisória nº 2.200-2/2001)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 8154,
            "granQuery": "Certificação Digital MP 2200-2"
          }
        ]
      },
      {
        "id": "top-legislacao-aplicada-a-tecnologia-da-informacao-1",
        "name": "Normativos do Estado de Goiás e do TCE-GO",
        "disciplinaId": 14,
        "assuntoId": 14,
        "granQuery": "Normativos TCE-GO TI",
        "subtopics": [
          {
            "id": "subtop-legislacao-aplicada-a-tecnologia-da-informacao-1-0",
            "name": "Lei Complementar estadual nº 205/2025 (disposições aplicadas à modernização tecnológica)",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Lei Complementar Goiás TI"
          },
          {
            "id": "subtop-legislacao-aplicada-a-tecnologia-da-informacao-1-1",
            "name": "Normativos do TCE-GO: Resolução Normativa nº 13/2016 (CETI); Portarias sobre gestão de acessos e segurança da informação institucional",
            "completed": false,
            "disciplinaId": 14,
            "assuntoId": 14,
            "granQuery": "Resolução Normativa TCE-GO TI"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-lingua-portuguesa",
    "name": "Língua Portuguesa",
    "weight": 3,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 403587,
    "assuntoId": 403587,
    "granQuery": "Língua Portuguesa",
    "topics": [
      {
        "id": "top-lingua-portuguesa-0",
        "name": "Compreensão e Interpretação de Textos",
        "disciplinaId": 403587,
        "assuntoId": 403587,
        "granQuery": "Interpretação de Texto",
        "subtopics": [
          {
            "id": "subtop-lingua-portuguesa-0-0",
            "name": "Redação Oficial:Manual de Redação da Presidência da República (3ª edição, revista e atualizada)",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403750,
            "granQuery": "Redação Oficial"
          },
          {
            "id": "subtop-lingua-portuguesa-0-1",
            "name": "Compreensão e interpretação de textos de gêneros variados",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403590,
            "granQuery": "Compreensão Interpretação Texto"
          },
          {
            "id": "subtop-lingua-portuguesa-0-2",
            "name": "Reconhecimento de tipos e gêneros textuais",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403592,
            "granQuery": "Tipologia Textual Gêneros"
          },
          {
            "id": "subtop-lingua-portuguesa-0-3",
            "name": "Denotação e conotação; Figuras de linguagem; Sinonímia e antonímia",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403595,
            "granQuery": "Figuras de Linguagem Sinonímia"
          }
        ]
      },
      {
        "id": "top-lingua-portuguesa-1",
        "name": "Gramática e Morfossintaxe",
        "disciplinaId": 403587,
        "assuntoId": [
          403613,
          409299,
          403666,
          403658,
          403657
        ],
        "granQuery": "Gramática Morfossintaxe",
        "subtopics": [
          {
            "id": "subtop-lingua-portuguesa-1-0",
            "name": "Ortografia e acentuação gráfica oficial",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403613,
            "granQuery": "Ortografia Acentuação Gráfica"
          },
          {
            "id": "subtop-lingua-portuguesa-1-1",
            "name": "Emprego do sinal indicativo de crase",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 409299,
            "granQuery": "Crase"
          },
          {
            "id": "subtop-lingua-portuguesa-1-2",
            "name": "Morfossintaxe e processos de formação de palavras; Classes gramaticais",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403640,
            "granQuery": "Morfologia Classes de Palavras"
          },
          {
            "id": "subtop-lingua-portuguesa-1-3",
            "name": "Pontuação; Pronomes; Concordância nominal e verbal",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": [
              403666,
              403658
            ],
            "granQuery": "Pontuação Concordância Verbal"
          },
          {
            "id": "subtop-lingua-portuguesa-1-4",
            "name": "Regência nominal e verbal; Coordenação e subordinação",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": [
              403657,
              409479
            ],
            "granQuery": "Regência Verbal Nominal"
          }
        ]
      },
      {
        "id": "top-lingua-portuguesa-2",
        "name": "Redação e Reescrita de Frases",
        "disciplinaId": 403587,
        "assuntoId": 403587,
        "granQuery": "Reescrita de Frases",
        "subtopics": [
          {
            "id": "subtop-lingua-portuguesa-2-0",
            "name": "Redação e reescrita de frases; equivalência e transformação de estruturas; coesão e coerência",
            "completed": false,
            "disciplinaId": 403587,
            "assuntoId": 403587,
            "granQuery": "Reescrita de Frases Paráfrase"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-matematica-e-raciocinio-logico",
    "name": "Matemática e Raciocínio Lógico",
    "weight": 3,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 404257,
    "assuntoId": 404257,
    "granQuery": "Raciocínio Lógico Matemático",
    "topics": [
      {
        "id": "top-matematica-e-raciocinio-logico-0",
        "name": "Matemática Básica e Razão/Proporção",
        "disciplinaId": 404257,
        "assuntoId": 403825,
        "granQuery": "Matemática Básica Proporção",
        "subtopics": [
          {
            "id": "subtop-matematica-e-raciocinio-logico-0-0",
            "name": "Números inteiros e racionais: operações, múltiplos e divisores, MMC e MDC",
            "completed": false,
            "disciplinaId": 404257,
            "assuntoId": 403825,
            "granQuery": "Números Inteiros Racionais MMC MDC"
          },
          {
            "id": "subtop-matematica-e-raciocinio-logico-0-1",
            "name": "Números e grandezas proporcionais: razões e proporções; divisão proporcional; regra de três simples e composta; porcentagem",
            "completed": false,
            "disciplinaId": 404257,
            "assuntoId": 403825,
            "granQuery": "Razão Proporção Regra de Três Porcentagem"
          }
        ]
      },
      {
        "id": "top-matematica-e-raciocinio-logico-1",
        "name": "Raciocínio Lógico",
        "disciplinaId": 404257,
        "assuntoId": 404257,
        "granQuery": "Raciocínio Lógico Proposições",
        "subtopics": [
          {
            "id": "subtop-matematica-e-raciocinio-logico-1-0",
            "name": "Estrutura lógica de relações arbitrárias; dedução de novas informações e avaliação de condições",
            "completed": false,
            "disciplinaId": 404257,
            "assuntoId": 425310,
            "granQuery": "Proposições Lógicas Conectivos"
          },
          {
            "id": "subtop-matematica-e-raciocinio-logico-1-1",
            "name": "Tabela-verdade, equivalências lógicas, tautologias, contradições e negação de proposições",
            "completed": false,
            "disciplinaId": 404257,
            "assuntoId": 425315,
            "granQuery": "Tabela Verdade Equivalências Negação"
          },
          {
            "id": "subtop-matematica-e-raciocinio-logico-1-2",
            "name": "Lógica de argumentação, diagramas lógicos, análise combinatória e probabilidade básica",
            "completed": false,
            "disciplinaId": 404257,
            "assuntoId": [
              403868,
              403870
            ],
            "granQuery": "Análise Combinatória Probabilidade"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-legislacao-institucional",
    "name": "Legislação Institucional e Controle Externo",
    "weight": 2,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 408103,
    "assuntoId": 408103,
    "granQuery": "Controle Externo Tribunal de Contas",
    "topics": [
      {
        "id": "top-legislacao-institucional-0",
        "name": "Normas Constitucionais e Estaduais",
        "disciplinaId": 408103,
        "assuntoId": 408103,
        "granQuery": "Controle Externo CF 88",
        "subtopics": [
          {
            "id": "subtop-legislacao-institucional-0-0",
            "name": "Constituição Federal de 1988: Administração Pública; controle interno e controle externo (arts. 70 a 75)",
            "completed": false,
            "disciplinaId": 408103,
            "assuntoId": 427869,
            "granQuery": "Controle Externo Fiscalização CF 88"
          },
          {
            "id": "subtop-legislacao-institucional-0-1",
            "name": "Constituição do Estado de Goiás: disposições sobre o TCE-GO e fiscalização orçamentária estadual",
            "completed": false,
            "disciplinaId": 408103,
            "assuntoId": 408103,
            "granQuery": "Constituição Goiás TCE-GO"
          },
          {
            "id": "subtop-legislacao-institucional-0-2",
            "name": "Lei Orgânica do TCE-GO (Lei Estadual nº 16.168/2007) e Regimento Interno do TCE-GO (Resolução nº 22/2008)",
            "completed": false,
            "disciplinaId": 408103,
            "assuntoId": 408103,
            "granQuery": "Lei Orgânica TCE-GO Regimento"
          },
          {
            "id": "subtop-legislacao-institucional-0-3",
            "name": "Lei nº 14.133/2021 (Licitações e Contratos Administrativos): princípios, fases, modalidades e contratações",
            "completed": false,
            "disciplinaId": 404335,
            "assuntoId": 404360,
            "granQuery": "Lei 14.133 Licitações e Contratos"
          }
        ]
      },
      {
        "id": "top-legislacao-institucional-1",
        "name": "Regime de Pessoal e Ética do TCE-GO",
        "disciplinaId": 404335,
        "assuntoId": 404335,
        "granQuery": "Regime Jurídico Ética Servidores",
        "subtopics": [
          {
            "id": "subtop-legislacao-institucional-1-0",
            "name": "Plano de Cargos, Carreiras e Remuneração dos Servidores do TCE-GO",
            "completed": false,
            "disciplinaId": 408103,
            "assuntoId": 408103,
            "granQuery": "Cargos e Remuneração TCE-GO"
          },
          {
            "id": "subtop-legislacao-institucional-1-1",
            "name": "Regime Jurídico dos Servidores Públicos Civis de Goiás (Lei Estadual nº 20.756/2020)",
            "completed": false,
            "disciplinaId": 404335,
            "assuntoId": 404335,
            "granQuery": "Estatuto Servidores Goiás Lei 20756"
          },
          {
            "id": "subtop-legislacao-institucional-1-2",
            "name": "Código de Ética dos Servidores do TCE-GO e Lei de Improbidade Administrativa (Lei nº 8.429/1992)",
            "completed": false,
            "disciplinaId": 404335,
            "assuntoId": 404335,
            "granQuery": "Improbidade Administrativa Ética"
          }
        ]
      }
    ]
  },
  {
    "id": "sub-lingua-inglesa-leitura-tecnica",
    "name": "Língua Inglesa (Leitura Técnica)",
    "weight": 2,
    "targetHours": 0,
    "status": "active",
    "disciplinaId": 403588,
    "assuntoId": 403588,
    "granQuery": "Língua Inglesa TI",
    "topics": [
      {
        "id": "top-lingua-inglesa-leitura-tecnica-0",
        "name": "Compreensão e Interpretação Técnica em Inglês",
        "disciplinaId": 403588,
        "assuntoId": 403588,
        "granQuery": "Inglês Instrumental TI",
        "subtopics": [
          {
            "id": "subtop-lingua-inglesa-leitura-tecnica-0-0",
            "name": "Compreensão de textos técnicos e científicos de TI em língua inglesa",
            "completed": false,
            "disciplinaId": 403588,
            "assuntoId": 403588,
            "granQuery": "Interpretação Texto Inglês TI"
          },
          {
            "id": "subtop-lingua-inglesa-leitura-tecnica-0-1",
            "name": "Vocabulário técnico da área de TI (software, nuvem, segurança, redes e hardware)",
            "completed": false,
            "disciplinaId": 403588,
            "assuntoId": 403588,
            "granQuery": "Vocabulário Inglês Técnico Informática"
          },
          {
            "id": "subtop-lingua-inglesa-leitura-tecnica-0-2",
            "name": "Interpretação de manuais, documentação oficial de linguagens e especificações de sistemas",
            "completed": false,
            "disciplinaId": 403588,
            "assuntoId": 403588,
            "granQuery": "Manual Documentação Inglês TI"
          }
        ]
      }
    ]
  }
];

function normalizeText(str?: string): string {
  if (!str) return '';
  return str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface ResolvedTaxonomy {
  assuntoId?: number | number[];
  disciplinaId?: number;
  granQuery?: string;
  matchedSubjectName?: string;
  matchedTopicName?: string;
  matchedSubtopicName?: string;
}

/**
 * Resolves Gran Questões official taxonomy (assuntoId and disciplinaId)
 * from any subject, topic, and subtopic name or ID, with fuzzy and semantic fallback.
 */
export function resolveGranTaxonomy(
  subjectNameOrId?: string,
  topicNameOrId?: string,
  subtopicNameOrId?: string
): ResolvedTaxonomy {
  const normSub = normalizeText(subjectNameOrId);
  const normTop = normalizeText(topicNameOrId);
  const normSt = normalizeText(subtopicNameOrId);

  // 1. Try finding matching subject in preset
  let matchedSub = TCE_GO_SUBJECTS_PRESET.find(
    (s) => s.id === subjectNameOrId || normalizeText(s.name) === normSub
  );

  // Fallback: Partial/keyword matching for subject
  if (!matchedSub && normSub) {
    matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => {
      const pNorm = normalizeText(s.name);
      return pNorm.includes(normSub) || normSub.includes(pNorm);
    });
  }

  // Fallback: Common subject aliases if not matched yet
  if (!matchedSub && normSub) {
    if (normSub.includes('software') || normSub.includes('engenharia')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-engenharia-de-software');
    } else if (normSub.includes('desenvolvimento') || normSub.includes('programacao') || normSub.includes('sistemas')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-desenvolvimento-de-sistemas');
    } else if (normSub.includes('devops') || normSub.includes('docker') || normSub.includes('kubernetes')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-devops-plataformas-de-entrega-e-conteinerizacao');
    } else if (normSub.includes('banco') || normSub.includes('dados') || normSub.includes('sql')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-banco-de-dados-e-engenharia-de-dados');
    } else if (normSub.includes('nuvem') || normSub.includes('cloud') || normSub.includes('infraestrutura')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-arquitetura-de-nuvem-e-infraestrutura');
    } else if (normSub.includes('rede') || normSub.includes('tcp') || normSub.includes('osi')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-redes-de-computadores-e-comunicacao-de-dados');
    } else if (normSub.includes('seguranca') || normSub.includes('ciber') || normSub.includes('criptografia')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-seguranca-da-informacao-e-ciberseguranca');
    } else if (normSub.includes('ia') || normSub.includes('inteligencia') || normSub.includes('ciencia')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-inteligencia-artificial-e-ciencia-de-dados');
    } else if (normSub.includes('governanca') || normSub.includes('itil') || normSub.includes('cobit')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-governanca-de-tecnologia-da-informacao');
    } else if (normSub.includes('portugues') || normSub.includes('lingua')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-lingua-portuguesa');
    } else if (normSub.includes('logico') || normSub.includes('matematica') || normSub.includes('rlm')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-matematica-e-raciocinio-logico');
    } else if (normSub.includes('controle') || normSub.includes('tce') || normSub.includes('institucional')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-legislacao-institucional');
    } else if (normSub.includes('ingles') || normSub.includes('english')) {
      matchedSub = TCE_GO_SUBJECTS_PRESET.find((s) => s.id === 'sub-lingua-inglesa-leitura-tecnica');
    }
  }

  // If still no subject matched in preset, check standard general subjects
  if (!matchedSub) {
    if (normSub.includes('administrativo')) {
      return { assuntoId: 404335, disciplinaId: 404335, granQuery: 'Direito Administrativo' };
    }
    if (normSub.includes('constitucional')) {
      return { assuntoId: 402090, disciplinaId: 402090, granQuery: 'Direito Constitucional' };
    }
    if (normSub.includes('administracao') || normSub.includes('gestao')) {
      return { assuntoId: 404335, disciplinaId: 404335, granQuery: 'Administração Pública' };
    }
    return {};
  }

  // Preset subject matched
  let matchedTop: any;
  let matchedSt: any;

  // Search topic
  if (normTop && matchedSub.topics) {
    matchedTop = matchedSub.topics.find(
      (t) => t.id === topicNameOrId || normalizeText(t.name) === normTop
    );
    if (!matchedTop) {
      matchedTop = matchedSub.topics.find((t) => {
        const tNorm = normalizeText(t.name);
        return tNorm.includes(normTop) || normTop.includes(tNorm);
      });
    }
  }

  // Search subtopic in matched topic, or across all topics of the subject
  const topicsToSearch = matchedTop ? [matchedTop] : (matchedSub.topics || []);

  if (normSt) {
    // 1. Exact or prefix match
    for (const top of topicsToSearch) {
      for (const st of top.subtopics || []) {
        const stNorm = normalizeText(st.name);
        if (
          st.id === subtopicNameOrId ||
          stNorm === normSt ||
          (normSt.length >= 10 && (stNorm.startsWith(normSt.slice(0, 25)) || normSt.startsWith(stNorm.slice(0, 25))))
        ) {
          matchedSt = st;
          if (!matchedTop) matchedTop = top;
          break;
        }
      }
      if (matchedSt) break;
    }

    // 2. Keyword-based subtopic match if not found yet
    if (!matchedSt) {
      for (const top of topicsToSearch) {
        for (const st of top.subtopics || []) {
          const stNorm = normalizeText(st.name);
          const keywords = (subtopicNameOrId || '')
            .toLowerCase()
            .split(/[\s,;.-]+/)
            .filter((w) => w.length >= 4);

          const matchCount = keywords.filter((kw) => stNorm.includes(normalizeText(kw))).length;
          if (matchCount >= 2 || (keywords.length === 1 && matchCount === 1)) {
            matchedSt = st;
            if (!matchedTop) matchedTop = top;
            break;
          }
        }
        if (matchedSt) break;
      }
    }
  }

  // Determine hierarchy of return
  const disciplinaId = matchedSt?.disciplinaId || matchedTop?.disciplinaId || matchedSub.disciplinaId;
  const assuntoId = matchedSt?.assuntoId || matchedTop?.assuntoId || matchedSub.assuntoId;
  const granQuery = matchedSt?.granQuery || matchedTop?.granQuery || matchedSub.granQuery;

  return {
    assuntoId,
    disciplinaId,
    granQuery,
    matchedSubjectName: matchedSub.name,
    matchedTopicName: matchedTop?.name,
    matchedSubtopicName: matchedSt?.name,
  };
}
