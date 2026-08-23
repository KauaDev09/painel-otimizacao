# MAINSTREET BIOS OPTIMIZER

Produto único composto por três partes:

| Pasta      | O que é |
|------------|---------|
| `desktop/` | Aplicativo Windows (Electron) — análise de BIOS/hardware, motor de otimização, monitor, benchmark, rede, inicialização, processos, configurações e suporte. |
| `backend/` | API Node puro (sem framework) + painel administrativo — licenças, dispositivos, histórico sincronizado, logs, estatísticas e publicação de atualizações. Requer MySQL. |
| `database/` | `schema.sql` (MySQL 8) com todas as tabelas. |

## Desenvolvimento

### Desktop (requer Windows + Node 18+)

```bash
cd desktop
npm install
npm start
```

Testes utilitários (sem abrir janela):

```bash
node scripts/test-detect.js        # detecção de hardware/BIOS
node scripts/test-services.js      # relatórios + histórico
node scripts/test-new-modules.js   # settings, monitor, startup, processos, rede
```

Gerar instalador Windows (NSIS):

```bash
cd desktop
npm run dist
# saída: desktop/release/"MAINSTREET BIOS OPTIMIZER Setup-<versão>.exe"
```

Ícone: `desktop/build/icon.ico` (gerado a partir de `image/iconinstaller.png`).

### Backend

```bash
cd backend
cp .env.example .env     # preencha APP_SECRET, DB_USER, DB_PASSWORD...
npm install
npm start                # http://localhost:8787  ·  painel em /admin
node scripts/create-admin.js <usuario> <senha>
```

### Banco de dados

Aplique `database/schema.sql` no MySQL 8. A tabela `atualizacoes`
alimenta o aviso de nova versão dentro do aplicativo.

## Painel administrativo

Abas: **Painel** (estatísticas), **Licenças**, **Usuários**, **Dispositivos**,
**Histórico**, **Atualizações** (publicar versão X.Y.Z + changelog +
obrigatória) e **Logs**.

Login por usuário/senha criado via `create-admin.js`, ou token mestre
(`ADMIN_TOKEN`) deixando a senha vazia.

## Atualização automática do app

O desktop consulta `GET /api/v1/app/updates/latest` ao iniciar e a cada 6 h.
Quando existe versão ativa maior que a instalada, mostra o banner/toast com
changelog e botão "ATUALIZAR AGORA" (abre a URL publicada no painel).
Versões marcadas como obrigatórias permanecem visíveis por mais tempo.

## Endpoints principais

Público:
- `GET  /api/v1/health`
- `GET  /api/v1/app/updates/latest`

Licença (app):
- `POST /api/v1/license/activate | validate | heartbeat`
- `POST /api/v1/history/sync`

Admin (Bearer token):
- `POST /api/v1/admin/login`
- CRUD licenças/usuários/dispositivos/histórico/logs
- `GET|POST /api/v1/admin/updates`, `POST /api/v1/admin/updates/:id/toggle`
- `GET  /api/v1/admin/stats`
