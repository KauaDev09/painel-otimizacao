# Relatório de auditoria de segurança — SevenOptimizer (S4)

> Etapa 1 da Frente 3 (hardening). Data: 2026-09-20.
> Escopo: `desktop/` (Electron), `backend/` (Node puro), infraestrutura de release e build.
> Auditoria read-only; todas as correções priorizadas foram aplicadas em commits próprios.

## Ajustes positivos já presentes (mantidos)

- **Menor privilégio**: app roda `asInvoker` (sem manifest admin); elevação é
  pontual e única (orquestrador `.cmd` + `-Verb RunAs`), nunca o app inteiro.
- **Backend fail-closed**: `APP_SECRET`/`DB_USER`/`DB_PASSWORD` obrigatórios no
  load; opcionais degradam com 503 explícito.
- **Primitivas**: tokens HMAC-SHA256 `base64url` com `timingSafeEqual`;
  senhas com `scrypt`; SQL 100% parametrizado; corpo limitado a 256 KB;
  traversal bloqueado por `path.normalize` + prefixo.
- **TLS na origem**: API default HTTPS; só `SEVEN_ALLOW_HTTP=1` (dev local) usa HTTP.

## Achados e correções aplicadas

| # | Sev. | Achado | Correção |
|---|------|--------|----------|
| H1 | Alta | Scripts do motor espelhados em `%APPDATA%`/scripts executados elevados sem verificação de integridade | Manifest `script-manifest.json` com SHA-256 gerado no build (`scripts/hash-scripts.js`); validação em runtime antes de executar (`scriptIntegrity.js`), aplicada no `runner`, `psRunner` (coletor de HW) e `securityService` (coletor de segurança) |
| H2a | Alta | Nome de variável EFI (`-Name`) e bytes (`-BytesHex`) interpolados sem escapar em linha `cmd` elevada, vindos de `efiOffsets.json`/`pending.json` (graváveis) | Whitelist por regex + citação (`efiVar.js`): `EFI_NAME_RE`, `EFI_GUID_RE`, `EFI_HEX_RE` |
| H2b | Média | Descrição do ponto de restauração sanitizada por *remoção* de aspas — falha com aspas duplas | Escaping correto do PowerShell (`''`) em `restorePoint.js` |
| H2c | Média | `nvidia-smi` resolvido por PATH (`'nvidia-smi'`) → hijack | `findNvidiaSmi()` só retorna caminhos absolutos verificados (`System32`/`NVSMI`); `null` circular é tratado em `monitorService`, `psRunner` e `extraScan` |
| H3a | Alta | Cliente HTTP aceitava `http:` sem exigência de TLS | `apiClient.js`: HTTP recusado por padrão (dev: `SEVEN_ALLOW_HTTP=1`) |
| H3b | Média | Download de update seguia redirect sem revalidar esquema (downgrade para http) | `updaterService.js`: revalidação de protocolo a cada redirect; HTTP recusado |
| H3c | Baixa | Backend sem headers de segurança; health expunha `VERCEL_URL` | `index.js`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `vurl` removido do health |
| M4 | Média | Sem log de auditoria central; `biosLogger.js` gravava só `HH:mm:ss` (sem data) | `auditService.js` → `<userData>/audit.log` (ISO, rotaciona 1MB); `biosLogger.stamp()` agora tem data completa; handlers IPC de mutação registram sucesso/erro |
| D2 | Médio-alta | Token mestre do admin comparado com `===` (não timing-safe); login sem rate limit | `routes-admin.js`: `safeEqualStr` (timing-safe) + rate limit por IP |
| D3 | Média | Sem rate limit em register/login/login-key/checkout/cupom/erase do store | `routes-storefront.js`: rate limit por IP; config `security.storeAuthRateLimit`/`adminLoginRateLimit` |
| D6 | Médio-alta | Chaves de licença completas persistidas em `access_logs` | `accessLog.js`: apenas versão mascarada (`ABCD...WXYZ`); fonte de verdade permanece `licencas` |
| B2 | Média | Webhook Mercado Pago sem validação HMAC (`X-Signature`); `webhookSecret` morto | `paymentProvider.js`: verificação HMAC-SHA256 (algoritmo MP) quando `MERCADOPAGO_WEBHOOK_SECRET` configurado; re-consulta permanece como defesa 2ª |
| B1 | Média | `s4-media` servia arquivos locais arbitrários (base64url do caminho) com `bypassCSP` | `appLibrary.resolveMediaUrl`: allow-list de diretórios (userData, repositório dev, `LOCALAPPDATA/sevenoptimizer`) |
| A1 | Baixa | Relançamento pós-update herdava token elevado (comentário dizia o contrário) | `updaterService.js`: relança via `explorer.exe` (usuário comum) + auto-limpeza do helper |
| E1 | Alta (release) | Instalador NSIS **não assinado**, distribuído de repo público; sem verificação autenticode pré-instalação | Ver `docs/security/signing.md` (pipeline de assinatura documentado + hook); verificação de hash/autenticode pré-instalação pendente de certificado (item do checklist) |

## Pendências documentadas (não bloqueiam, exigem decisão)

1. **Code signing (E1)** — sem certificado validado, não é possível verificar
   assinatura na instalação. Acionar pipeline do `signing.md` antes do próximo
   release público.
2. **Pinning de certificado** — Vercel rotaciona certificados; pinning rígido
   quebraria. Mantém-se HTTPS + validação de assinatura autenticode do instalador.
3. **CI/SAST (F1)** — sem pipeline: rodar `npm audit` + `build:app` + `typecheck`
   nas etapas do `checklist.md`. GitHub Actions sugerido (não implementado nesta etapa).
4. **DPI/proxy** — rate limit em memória é por-instância (documentado para Vercel);
   escala distribuída exigiria Redis.

## Resíduo aceito

- `X-Forwarded-For` confiado no 1º hop (padrão atrás de proxy gerenciado).
- `CORS *` por config padrão — revisar quando a loja pública tiver origem fixa.