# ISP Manager

Base inicial para uma plataforma de gestão operacional de provedores de Internet (ISP), preparada para evoluir por módulos e ser instalada num mini-PC/computador dedicado.

## Estado atual

Esta entrega é uma **primeira estrutura visual demonstrativa**. O painel usa dados fictícios. Ainda não existe autenticação real, permissões server-side, persistência funcional de ordens, auditoria de produção ou configuração segura para utilização por um cliente real.

## Stack

- Next.js + React + TypeScript
- PostgreSQL 16 (Docker Compose)
- Docker para facilitar a instalação
- Migrações SQL versionadas em `database/migrations`

## Desenvolvimento local

Requisitos: Node.js 22+ e Docker Desktop (para testar também a base de dados).

1. Copie `.env.example` para `.env`.
2. Altere `POSTGRES_PASSWORD` para uma palavra-passe local forte e atualize `DATABASE_URL` com a mesma palavra-passe.
3. Instale dependências: `npm install`
4. Inicie a interface: `npm run dev`
5. Abra `http://localhost:3000`.

Para iniciar a aplicação e PostgreSQL em contentores, depois de configurar `.env`:
`docker compose up --build -d`

## Diretrizes de arquitetura

- Todas as tabelas operacionais devem incluir `organization_id` quando aplicável, para preparar isolamento entre empresas.
- Verificar permissões no servidor e na base de dados; esconder botões na interface não é controlo de segurança.
- Auditoria é append-only para utilizadores da aplicação; ações sensíveis devem ser registadas.
- Nunca guardar segredos reais no GitHub.
- A base de dados não deve ser exposta diretamente à Internet.
- Preparar backups automáticos e testar a restauração antes de instalar num cliente.
- O acesso remoto deve usar VPN ou uma solução de acesso seguro e HTTPS.

## Próximos passos

1. Confirmar o ambiente e executar a aplicação.
2. Implementar autenticação real e criação do primeiro gestor.
3. Criar empresas, utilizadores, papéis e permissões granulares.
4. Implementar auditoria server-side.
5. Implementar ordens de serviço e o fluxo de aprovação.
6. Adicionar testes, backups e documentação de instalação.

## Estrutura

- `src/app`: páginas e layouts
- `src/components`: componentes da interface
- `database/migrations`: esquema inicial versionado
- `public`: recursos estáticos


## Personalização por cliente (white-label)
A direção do produto é multiempresa, com configurações separadas por provedor. Está prevista uma área **Gestor > Configurações > Identidade visual** onde utilizadores autorizados poderão editar nome comercial, logótipo, favicon, cores, textos e contactos. O esquema inicial para armazenar estas preferências encontra-se em `database/migrations/0002_organization_branding.sql`; o ecrã e as operações seguras ainda serão desenvolvidos.
