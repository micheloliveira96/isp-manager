# Cadastro, instalação e acesso PPPoE

## Operação diária

1. Em **Clientes → Novo cliente**, preencha o cadastro, plano, roteador, login e senha PPPoE. O perfil é derivado do plano (`isp-<id>`). A senha tem mostrar/ocultar e fica cifrada no servidor. Salvar **não cria secret nem libera internet**. É possível salvar sem PPPoE e completar o vínculo depois.
2. Na ficha, **Confirmar instalação** registra a conclusão manual por usuário autorizado, com motivo/referência da OS e auditoria. A data prevista não confirma instalação. Finalizar uma OS não ativa internet.
3. **Ativar cliente** provisiona e confirma o resultado real. Um secret novo nasce desabilitado antes de receber a configuração e ser habilitado. Um existente só pode ser alterado se o comentário de propriedade corresponder ao vínculo.
4. **Desativar cliente** pede confirmação, desabilita o secret e encerra todas as sessões do login. Cadastro, senha e histórico permanecem.
5. Para cliente instalado e suspenso, **Conceder 3 dias de carência** pede confirmação explícita. O prazo é de **72 horas a partir da confirmação** no servidor. Cliques repetidos não estendem a concessão. Uma nova concessão exige nova suspensão confirmada e nova confirmação do operador.
6. **Ativar definitivamente / regularizar** cancela a expiração após confirmar o acesso definitivo. Não registra pagamento automaticamente.
7. Plano e senha provisionados mudam pela ação explícita **Alterar plano / senha PPPoE**. Salvar o cadastro não altera o roteador. Mensalidade é mantida até edição contratual explícita.

**Ativo** significa acesso comercial liberado. **Conectado** exige sessão real. Instalação, último acesso comercial confirmado, sincronização, autenticação observada no roteador e sessão são exibidos separadamente. Falhas preservam o último estado confirmado e indicam possível aplicação parcial. Senha salva só é consultável com permissão específica, sem cache e com auditoria.

## Clientes antigos

A migração não ativa, suspende ou importa acessos antigos. `installationState=LEGACY` e `managedLifecycle=false` são os padrões para os registros existentes. A revisão explícita exige roteador online, perfil correspondente e comentário `isp-manager:<subscriberId>` já existente. Coincidência de login não transfere propriedade. O operador informa a senha atual, que não é recuperável pela conta restrita do roteador. Confirmar a revisão armazena a senha, sem executar comandos no MikroTik. Depois é necessária a confirmação de instalação para liberar as ações de ativação.

Vínculos com vários roteadores precisam de revisão especializada. Transferir login/roteador de um vínculo existente é recusado para não deixar um acesso antigo liberado inadvertidamente. O painel MikroTik continua atendendo vínculos antigos; os gerenciados pelo novo fluxo são direcionados à ficha do cliente e protegidos também no backend.

## Expiração e recuperação

O agente Docker com `restart: unless-stopped` consulta a fila a cada 10 segundos. Em cada consulta, o servidor procura carências vencidas, com prazos UTC persistidos no PostgreSQL. Não depende do navegador ou de timers de uma função da Vercel. Horários e contagem restante são exibidos no fuso do navegador.

Sem comunicação, o vencimento aparece como atrasado e a suspensão permanece pendente. Falhas conhecidas durante a expiração geram retry com atraso crescente até cinco minutos. A volta da comunicação retoma o processamento. **Não há garantia de corte no segundo exato com Windows, Docker, agente ou roteador desligados.** Conflito de propriedade/RADIUS exige correção; não é repetido indefinidamente.

Comandos usam chave de idempotência, revisão por vínculo, trava por roteador, journal persistente do agente, verificação de autorização antes de cada escrita e serialização de escritas por login no gateway. Expiração antiga pendente é cancelada ao receber uma ativação definitiva. Uma ação em execução ou incerta bloqueia comandos posteriores até conclusão/revisão. Uma confirmação repetida não reinicia a carência. O gateway termina uma escrita do mesmo login antes de iniciar a seguinte.

Em resultado incerto após interrupção: confira o agente, a autenticação e as sessões no roteador; use a revisão no **Histórico de operações** do painel MikroTik e então repita explicitamente a ação desejada. A revisão sozinha não confirma nem executa a operação.

## Configuração e segurança

A Vercel não acessa a rede privada diretamente. O agente local usa HTTPS de saída para a URL de produção e token exclusivo do roteador. O gateway fica na rede Docker privada, publicado apenas em `127.0.0.1:8088`, e acessa REST RouterOS por HTTPS com CA validada e timeout. Não abra portas de administração na internet.

Neste laboratório: RouterOS **7.23.8 long-term**, CHR `10.77.0.2`, autenticação local confirmada por `/ppp/aaa` (`use-radius=false`) e sessão com `radius=false`. A nova verificação do gateway recusa fonte RADIUS/desconhecida, evitando provisionamento local ineficaz. Roteadores com RADIUS precisam de integração própria com o servidor de autenticação, não implementada para este laboratório de secrets locais. Referência: [PPP AAA — MikroTik](https://help.mikrotik.com/docs/spaces/ROS/pages/132350049/PPP%2BAAA).

Para cada roteador, instale um par gateway/agente separado, com endereço/porta, CA, usuário e senha em arquivo local privado e token exclusivo do roteador. Não compartilhe tokens entre empresas. Os scripts `CONFIGURAR-AGENTE.cmd` e `INICIAR-LAB-ISP.cmd` permanecem válidos. Para atualizar este par existente:

```powershell
cd C:\mikrotik-lab\mikrotik-gateway
docker compose up -d --build
cd C:\mikrotik-lab\isp-manager-vercel
docker compose -f agent/compose.yaml up -d --build
```

As chaves `MIKROTIK_ENCRYPTION_KEY` existentes foram preservadas. A produção mantém a chave AES-256-GCM somente no servidor; Preview tem chave separada e não aceita mutações/comandos nem consulta de senhas. Faça backup protegido das chaves junto com o banco. Nunca versione `.env`, credenciais ou backups confidenciais.

Permissões individuais no servidor: `clients.view`, `clients.manage`, `clients.credentials`, `clients.install`, `clients.activate`, `clients.suspend`, `clients.grace`. Administrador possui todas; atendente mantém consulta, sem alterações PPPoE por padrão. Técnico só pode acessar essas rotas com as permissões concedidas. Rotas validam sessão ativa e empresa ativa. Cada cliente, plano, roteador e job é validado na mesma empresa. Auditoria registra ator (ou worker), cliente, roteador, revisão, ação, resultado e prazo, sem senhas.

## Migração e evidências de validação

`20261023070000_client_access_lifecycle` acrescenta somente colunas em Client, MikrotikSubscriber e MikrotikJob. Não há exclusões nem conversão automática de acessos antigos. Como o banco existente não tinha histórico `_prisma_migrations`, foi aplicado somente o SQL aditivo desta versão em transação, depois de backup cifrado, restauração e comparação registro a registro. Não rode todo o histórico de migrations em produção sem estabelecer o baseline desse banco preexistente.

Backup anterior: `C:\mikrotik-lab\backups\isp-manager-cloud-2026-10-23T08-44-50-989Z.encrypted.json` — 21 tabelas, 141 registros restaurados e comparados. O SQL também foi testado sobre essa restauração, preservando todos os campos anteriores. Snapshots `antes-ciclo-clientes-20261023` nas VMs chr-lab e cliente-lab; bundles Git e demais evidências ficam na mesma pasta privada de backups.

`tests/client-access-real.ts` usa exclusivamente PostgreSQL isolado `127.0.0.1:55437/isp_test?schema=integration`, HTTP da aplicação, operações reais do agente e CHR. Verificou cadastro sem secret, recusa antes da instalação, ativação, credencial cifrada, concorrência/idempotência, permissões, isolamento entre empresas, revisão explícita, suspensão com queda de sessão real do cliente-lab, concessão de 72 horas, expiração, falha/retry e cancelamento de tarefa antiga na ativação definitiva. O prazo foi antecipado **somente no banco isolado** para testar expiração; a política de produção permanece 72 horas.

O teste usa `testeips` somente como cliente de laboratório explicitamente autorizado, com vínculo espelhado no banco isolado. Não altera o cadastro de produção desse cliente. Ao terminar, restaura seu perfil original e acesso habilitado. Não foram realizados cortes em clientes reais. Evidência estruturada: `C:\mikrotik-lab\backups\client-access-real-result.json`. Testes do gateway e agente cobrem conflito de propriedade, RADIUS, criação idempotente, concorrência e ausência de senhas na auditoria.
