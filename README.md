# ISP Manager

Plataforma de gestão operacional para provedores de Internet, preparada para personalização por empresa e instaleção em servidor próprio.

## Instaleção simplificada no mini-PC Windows

1. Instale o Docker Desktop e abra-o.
2. Baixe/clona este repositório para o computador.
3. Abra PowerShell na pasta do projeto e execute `Set-ExecutionPolicy -Scope Process Bypass` e depois `./scripts/setup-windows.ps1`.
4. O script cria `.env` com segredos aleatórios, inicia a base de dados e a aplicação, e cria o administrador inicial. Salve a senha que aparece no terminal.
5. Abra `http://localhost:3000`.
6. Para criar um backup, execute `./scripts/backup-windows.ps1` e copie o arquivo para outro local seguro.

## Desenvolvimento manual

Requisitos: Node.js 22+ e Docker Desktop.

1. Copie `.env.example` para `.env` e configure uma senha forte para a base de dados, `SESSION_SECRET` aleatório (mínimo 32 caracteres) e as credenciais iniciais do administrador.
2. Instale dependências: `npm install`.
3. Inicie a base de dados: `docker compose up db -d`.
4. Gere o cliente e aplique a migração: `npx prisma generate` e `npx prisma migrate deploy`.
5. Crie a empresa e o primeiro administrador: `npm run db:seed`.
6. Inicie: `npm run dev`.

## Funcionalidades nesta etapa

- PostgreSQL com modelo multiempresa inicial.
- Login com sessão assinada e cookie HttpOnly.
- Identidade visual e dados da empresa salvos na base de dados.
- Ordens de serviço com persistência, validação e registro de auditoria.
- Perfis Administrador, Atendente e Técnico; a autorização deve ser aplicada em cada API.
- Docker Compose com volume persistente; a porta da base de dados não é publicada.
- Scripts de instaleção inicial e backup PostgreSQL para Windows.

## Segurança antes de produção

Configurar HTTPS e acesso remoto seguro; substituir credenciais iniciais; definir backups fora do servidor e testar restauro; rever permissões e isolamento multiempresa; executar testes de segurança e de recuperação. Não usar dados reais antes dessa validação.
