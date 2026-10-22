# ISP Manager na Vercel ↔ MikroTik

## Para usar amanhã

1. Ligue o Docker Desktop e as VMs `chr-lab` e `cliente-lab`.
2. Entre no ISP Manager com sua conta administrativa e abra **MikroTik e PPPoE**.
3. Aguarde o estado **Conectado ao MikroTik**. A sessão real de `cliente-teste` deve aparecer na coleta do roteador.
4. Cadastre normalmente seus clientes e planos nas telas já existentes. Em **MikroTik → Criar usuário PPPoE**, selecione cliente e plano, informe login e senha e clique em **Criar e provisionar**.
5. Aguarde **Confirmado no MikroTik** no histórico. “Na fila” não significa que o usuário já existe no roteador.
6. Na lista de vínculos, use **Trocar plano**, **Alterar senha**, **Bloquear**, **Desbloquear** ou **Desconectar**. Ações destrutivas como excluir um usuário não são oferecidas.

Uma conta habilitada pode estar sem sessão: o equipamento do cliente precisa usar o login, senha e serviço PPPoE corretos. O sistema só mostra IP e sessão se realmente existirem no RouterOS.

## Instalar ou refazer a comunicação manualmente

Normalmente isso só é necessário uma vez por roteador/agente.

1. No painel **MikroTik**, cadastre o roteador. Copie a **chave de instalação** exibida uma única vez. Se perdeu a chave, use **Renovar chave**, que invalida a anterior.
2. No Windows, dê dois cliques em `agent\CONFIGURAR-AGENTE.cmd`, nesta pasta do projeto.
3. Informe a URL HTTPS do ISP Manager e cole a chave quando solicitado. A entrada da chave fica oculta. O assistente lê automaticamente o token do gateway local, protege o `.env` e inicia o agente no Docker.
4. Volte ao painel e aguarde até 60 segundos. O agente coleta métricas a cada 30 segundos e busca operações a cada 10 segundos.

Não é necessário abrir portas no roteador de internet, instalar túnel público ou colocar a senha do MikroTik na Vercel. Não envie arquivos `.env`, chaves ou certificados pelo chat.

O assistente pressupõe o gateway já configurado em `C:\mikrotik-lab\mikrotik-gateway`, com HTTPS validado pela CA, e sua rede Docker própria `mikrotik-lab_lab`. Para outro roteador físico, configure um gateway local específico e mantenha um agente e uma chave por roteador e empresa. Não reutilize o mesmo CHR entre empresas distintas sem separação de roteador/gateway.

## Iniciar, verificar, parar e reiniciar

No PowerShell:

```powershell
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "chr-lab" --type headless
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "cliente-lab" --type headless
docker compose -f C:\mikrotik-lab\mikrotik-gateway\docker-compose.yml up -d
docker compose -f C:\mikrotik-lab\isp-manager-vercel\agent\compose.yaml up -d
```

Uma VM já ligada não precisa ser iniciada novamente. No diretório `agent`, os atalhos **INICIAR**, **STATUS** e **PARAR** operam somente o agente, sem parar o ISP Manager ou NetVigia.

```powershell
docker compose -f C:\mikrotik-lab\isp-manager-vercel\agent\compose.yaml restart
docker compose -f C:\mikrotik-lab\isp-manager-vercel\agent\compose.yaml logs --tail 20
```

Para desligar o laboratório, primeiro pare o agente e então envie o desligamento das VMs:

```powershell
docker compose -f C:\mikrotik-lab\isp-manager-vercel\agent\compose.yaml stop
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" controlvm "cliente-lab" acpipowerbutton
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" controlvm "chr-lab" acpipowerbutton
```

## Planos e velocidades

Os planos existentes são reaproveitados: download e upload em Mbps. O perfil RouterOS usa um nome estável `isp-<id do plano>`, independente do nome comercial, com `rate-limit` na ordem **upload/download**. Exemplo: plano de download 200 e upload 100 resulta em `100M/200M`.

Depois de alterar a velocidade no cadastro de planos, clique em **Sincronizar** no painel MikroTik. Isso atualiza o perfil para as próximas autenticações. Para aplicar imediatamente a um cliente conectado, use **Trocar plano**, que atualiza o perfil do secret e força uma nova autenticação. Não confunda a configuração do plano com a vazão da licença gratuita do CHR.

O vínculo mantém seu próprio plano de autenticação. O cadastro e o status financeiro do cliente continuam separados: bloquear PPPoE não muda automaticamente faturas, pagamentos ou o status comercial. A automação por inadimplência permanece desativada.

## Segurança e confirmação das operações

- Credencial RouterOS e token do gateway permanecem no Windows/Docker local. O gateway só publica `127.0.0.1:8088`.
- A chave do agente pertence a um roteador de uma empresa. A Vercel guarda apenas seu hash. Rotação e desativação ficam no painel administrativo.
- Senhas PPPoE em trânsito usam HTTPS; na fila são cifradas com AES-256-GCM e removidas após a confirmação ou expiração.
- Permissões separadas: consultar, cadastrar agentes, provisionar e bloquear/desbloquear. Administradores têm acesso; outros papéis precisam de permissão explícita.
- Os vínculos entre empresa, roteador, cliente e plano têm validação no servidor e chaves compostas no banco.
- Cada solicitação tem uma chave de idempotência. A mesma chave e os mesmos dados não criam uma segunda operação.
- Usuários preexistentes fora da integração não são sobrescritos. A identificação `isp-manager:<id do vínculo>` no secret permite validar a propriedade.
- O agente mantém um arquivo de confirmação persistente. Se cair durante uma escrita, não repete a operação; informa resultado incerto e bloqueia a fila até conferência.

## Resolver problemas

**“MikroTik indisponível — sem dados de monitoramento.”**: confirme as VMs, Docker Desktop, gateway saudável e logs do agente. Após 90 segundos sem dados válidos, o painel oculta as métricas e sessões antigas. Ele não cria números de exemplo.

**“Resultado incerto — conferir”**: consulte o secret, perfil e sessões diretamente no RouterOS. Corrija o estado se necessário. Depois use **Conferi o roteador; liberar fila**. Essa ação não repete nem declara sucesso da operação anterior; apenas registra sua revisão e libera o processamento.

**Usuário já existe**: não tente sobrepor um secret existente. A importação de usuários legados precisa de revisão e não faz parte do cadastro automático desta versão.

**Troca de senha**: a senha anterior não pode ser consultada. Configure a nova no equipamento do cliente para que ele reconecte. O gateway não tem permissão de leitura de senhas.

**Rate limit**: o gateway limita consultas. O coletor evita consultas por usuário individual e reutiliza snapshots. Em testes repetidos, espere a janela de um minuto antes de repetir.

## Backups e rollback

Os backups e as chaves de recuperação ficam fora do Git, em `C:\mikrotik-lab\backups`. Trate essa pasta como informação confidencial. Faça também uma cópia protegida em outro dispositivo: arquivos neste mesmo computador não protegem contra falha do disco.

- `.bundle`: código e histórico Git para rollback.
- `isp-manager-local-*.dump`: backup binário do PostgreSQL local.
- `isp-manager-cloud-*.encrypted.json`: backup lógico cifrado da nuvem, com dados, colunas, índices, constraints e histórico de migrações. A restauração é testada em schema separado antes da migração.
- `mikrotik-cloud-keys.json`: chaves de recuperação; mantenha separado da cópia do backup cifrado.
- Snapshot `antes-integracao-gateway-20261023`: estado anterior à troca da senha do gateway. Restaurá-lo exige sincronizar novamente a credencial local, pois ele contém a senha antiga.

Uma reversão do código pela Vercel pode usar o deployment anterior sem remover as novas tabelas. Não execute exclusões de tabelas nem restaure backup por cima de dados novos sem uma análise e confirmação explícitas. As migrações adicionam tabelas e índices; não apagam registros comerciais.

A base de produção existente não tinha tabela `_prisma_migrations`. Por isso a integração aplicou somente seu SQL aditivo fixo, após backup restaurado e comparação de contagens. Não execute `prisma migrate deploy` contra essa base sem antes estabelecer e conferir um baseline do schema existente. Os tipos temporais reais também diferem do schema Prisma em algumas tabelas; o teste de restauração preservou os tipos e a precisão originais, sem alterar essas tabelas em produção.

O Preview usa uma chave de cifra separada e não permite operações nem conexão do agente. Use sempre o endereço de produção para administrar o roteador.

## Testes para desenvolvimento

```powershell
node --import tsx --test tests\mikrotik-security.test.ts
npm.cmd run build
```

O teste `tests\mikrotik-real.ts` exige `.env.test`, PostgreSQL isolado em `127.0.0.1:55437/isp_test?schema=integration`, aplicação de teste em `127.0.0.1:3099` e gateway real. Ele cria e remove apenas artefatos com prefixo de teste, valida operações no CHR e nunca usa o banco de produção.

Não execute um build e um servidor de desenvolvimento usando a mesma pasta `.next` ao mesmo tempo. A rotina temporária de manutenção de Preview é removida antes da publicação final; ela não faz parte da API normal do produto.
