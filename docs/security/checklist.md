# Checklist de segurança — SevenOptimizer (S4)

> Executar em lote antes de qualquer **release público** (desktop ou backend) e
> antes de **subir mudanças de runtime** para produção (Vercel/loja).
> Cada item precisa estar `[x]` para liberar a release.

## 1. Build e integridade

- [ ] `npm run build:app` no `desktop/` regenera `script-manifest.json` (89 scripts hashados);
      o commit inclui o manifest atualizado se scripts estáticos mudaram.
- [ ] `npm audit --omit=dev` no `desktop/`, `backend/`, `web/` sem vulnerabilidades
      **high/critical** (ou com justificativa documentada).
- [ ] Assembly/instalador **assinado** seguindo `docs/security/signing.md` (E1);
      se pendente de certificado, release marcada como "não pública".
- [ ] Release publica o `SHA-256` do instalador no corpo da release (conferência manual).

## 2. SAST / revisão de código

- [ ] `npm run typecheck` no `desktop/` (tsc --noEmit) sem erros.
- [ ] Revisão manual dos pontos de execução externa: `psRunner.js`, `runner.js`,
      `efiVar.js`, `elevation.js`, `updaterService.js`, `securityService.js`
      (PowerShell/`cmd`) — apenas arrays de args ou whitelist regex; sem interpolação
      de entrada do usuário.
- [ ] Validação SHA-256 de scripts ativada em runtime (SEM aviso de dev em build
      de release): `src/security/scriptIntegrity.js` deve conferir coletor de HW,
      coletor de segurança e scripts do catálogo sem lançar.

## 3. Testes de segurança

### 3.1 Backend (OWASP-ish, contra staging)

> **Automatizado**: `cd backend && npm run test:security` (unit + E2E em uma instância
> nova, contra a mesma base do `.env`; exige o banco acessível). Rodar antes de qualquer
> release/runtime. Itens abaixo permanecem para auditoria manual pontual.

- [ ] `npm run test:security` verde: 429 em `store/login` e `admin/login` (brute-force);
      401 em `/admin/*` e `/store/account/*` (sem token e com `typ` errado); corpo
      > 256 KB rejeitado; `../` em URLs neutralizado; headers `nosniff`/`DENY`;
      chaves mascaradas em `access_logs` (unit `mask-key.test.js`).
- [ ] Webhook: com `MERCADOPAGO_WEBHOOK_SECRET` setado, payload com assinatura
      inválida é rejeitado (null); válida processa (unit `payment-signature.test.js`).
- [ ] Respostas têm `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

### 3.2 Desktop (Windows)

- [ ] **Fuzzing leve**: enviar pela UI valores com metacaracteres `& | ^ % " ' ;`
      em busca/perfis/nomes → nada executa comandos adicionais; erros tratados.
- [ ] Alterar manualmente (temporariamente) um `nvidia-smi`/script espelhado ou um
      `.ps1` no `%APPDATA%/sevenoptimizer` → execução recusada com mensagem de
      integridade (defesa ativa).
- [ ] UAC: otimização dispara **uma única** solicitação de elevação; cancelar o UAC
      não fecha o app (fluxo `runner.js` message 1223/marcador `started`).
- [ ] Atualização: relançamento pós-instala abre o app SEM privilégio elevado
      (task has no elevated token); helper `.ps1` não permanece em disco.
- [ ] `s4-media://local/<...>` com caminho fora dos diretórios permitidos → 404
      (não serve arquivo arbitrário).

### 3.3 Créditos de auth

- [ ] Troca de senha/ativação não desloga sessões HMAC antigas (8h) sem invalidar
      token não persistido; logout no app limpa token local (`licenseService.clear`).

## 4. Dados sensíveis

- [ ] Nenhum `.env`, `*.pem`, token de gateway ou chave da Anthropic commitado
      (verificar `git status` antes do commit; `prompt.txt`/`icon.jpeg` permanecem untracked).
- [ ] `access_logs` sem chaves completas; `licencas` continua a única fonte de verdade.
- [ ] Resposta de `/api/v1/sevenia/*` não contém a chave da Anthropic nem tokens.

## 5. Ordem de liberação (desktop)

1. hash-scripts regenerado → 2. typecheck → 3. npm audit → 4. assinatura (signing.md)
→ 5. build NSIS → 6. upload `atualizacoes` + SHA-256 publicado → 7. smoke pós-instalação.