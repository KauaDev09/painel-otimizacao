# Code signing — SevenOptimizer (S4)

> Pipeline para gerar **instalador assinado digitalmente**. A assinatura real é
> executada fora do OpenCode (requer certificado + signtool); aqui está onde o
> certificado entra no processo e como verificar.

## Situação atual

- Target: NSIS x64 único (`SevenOptimizer-Setup-<versão>.exe`), `perMachine`.
- Hoje: instalador **não assinado** (sem `win.sign`, sem certificado). Em
  máquinas com SmartScreen/configurações estritas, o usuário vê aviso "editor
  desconhecido".
- Meta: assinatura Authenticode (recomendado: EV para reputação imediata) e
  publicação do SHA-256 na release.

## Onde o certificado entra

### Opção A — electron-builder (recomendada, nativa)

`electron-builder` assina automaticamente no Windows quando as variáveis estão
presentes no ambiente de release:

| Variável | Valor |
|----------|-------|
| `CSC_LINK` | caminho do `.pfx` (ou `base64:` + conteúdo) |
| `CSC_KEY_PASSWORD` | senha do `.pfx` |

Sem `CSC_*`, o build sai sem assinatura (comportamento atual, não quebra).

Antes do build:

    $env:CSC_LINK="C:\cert\sevenoptimizer.pfx"
    $env:CSC_KEY_PASSWORD="*****"
    npm run dist

Dentro do NSIS o `publisherName` passa a figurar no instalador.

### Opção B — pós-build com signtool (fallback/CI)

1. Build: `npm run dist`.
2. Assinar o EXE gerado:

   node scripts/sign.js "release/SevenOptimizer-Setup-<versão>.exe"

   Requer `SIGN_CERT_PFX` (e opcional `SIGN_PFX_PASS`, `SIGN_TSA`) e `signtool`
   no PATH (Windows SDK). Sem `SIGN_CERT_PFX`, degrada sem assinatura e avisa.

### Opção C — assinatura externa (sem máquina Windows)

Opcional: exportar o `.pfx` → farley de assinatura (ex.: Azure SignTool,
SMIClient): fornecer o blob final e publicar junto ao SHA-256.

## Certificado

- Tipo: **Autenticode** (código), não TLS. EV (Organization) para eliminar
  SmartScreen em novos installs.
- Guarda: cofre/servidor de segredos; `CSC_*` só existem no pipeline, nunca no
  repo. Adicionar `.pfx`/`*.pem` ao `.gitignore`.
- Prazo: renovar antes do vencimento; reinstalar para manter `publisherName`.

## Verificação (pré-release)

1. `Get-AuthenticodeSignature <setup.exe>` → `Status: Valid`.
2. Conferir `Publisher` com a identidade do certificado.
3. Publicar o hash — do arquivo final assinado:

   Get-FileHash <setup.exe> -Algorithm SHA256

   (cole no corpo da release; o desktop baixa e o conferência manual compara).

## Verificação autenticode no inner (desktop)

A verificação de assinatura autenticode **antes** da instalação/execução de
arquivos baixados está **pendente** de certificado (item 1 das Pendências do
`audit.md`). Com o certificado em mãos, adicionar em `updaterService.js` um
cheque por `Get-AuthenticodeSignature` antes de `installUpdate`.

## Nem sempre assinar — quando NÃO

- Builds internos/diários (sem `CSC_*`): sem assinatura, ok para teste.
- Safest: só assinar o artefato que vai para a channel pública.