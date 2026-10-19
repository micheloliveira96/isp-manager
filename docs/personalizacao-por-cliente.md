# Personalização por cliente — regra do produto

O ISP Manager será preparado como produto multiempresa (multi-tenant). Cada provedor terá configuração própria, armazenada por organização, sem fork ou alteração do código por cliente.

## Opções de personalização previstas
- Nome comercial apresentado na interface e página de login.
- Logótipo principal e favicon.
- Cor primária e cor de destaque.
- Título e mensagem da página de login.
- Email/telefone de suporte.
- Idioma e fuso horário.
- Preferências de módulos disponíveis e dados de contacto.

## Área administrativa
Gestor da empresa > Configurações > Identidade visual:
1. Editar nome da empresa/plataforma.
2. Carregar/substituir logo e favicon.
3. Escolher cores e pré-visualizar a interface.
4. Configurar texto de login e contactos.
5. Guardar, restaurar valores padrão e registar a alteração na auditoria.

## Isolamento e segurança
- As configurações têm uma chave organization_id.
- O servidor identifica a organização pela sessão validada, nunca por um organization_id arbitrário enviado pelo browser.
- Apenas utilizadores com settings:manage podem alterar a identidade visual.
- Uploads precisam de validar formato, tamanho e conteúdo; nunca aceitar SVG arbitrário sem sanitização.
- URLs de imagem devem ser servidas por armazenamento controlado; não confiar num URL fornecido sem validação.
- As opções de personalização não podem permitir alterar permissões, contornar autorização ou executar código.
- Todas as alterações relevantes são registadas no histórico de auditoria.

## Comercialização
O mesmo software poderá servir vários clientes com configurações separadas. Podemos mais tarde adicionar planos/licenças por empresa, ativação de módulos e domínio/subdomínio próprio. Isso não significa que essas funcionalidades estejam implementadas nesta fase.
