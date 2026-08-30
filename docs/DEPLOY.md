# Deploy — ORION OPTIMIZER (Vercel + TiDB Cloud + GitHub)

Guia passo a passo para colocar a API (licenciamento) e o painel admin no ar
com banco de dados online, sem precisar do Railway.

Arquitetura final:

```
        ┌────────────┐
GitHub ──►  Vercel   │  (backend + painel admin, serverless)
        │            │
        └─────┬──────┘
              │  MySQL (TLS)
        ┌─────▼──────┐
        │ TiDB Cloud │  (banco online, plano free)
        └────────────┘

   Desktop (Electron) ──► https://<seu-projeto>.vercel.app
```

## 1. Banco de dados — TiDB Cloud (free tier)

1. Crie uma conta em https://tidbcloud.com e acesse o console.
2. **Create Cluster** → tipo **Serverless** (gratuito, Hobby) → escolha região.
3. Aguarde o cluster ficar *Ready* e clique em **Connect**.
4. Copie o **connection string**:
   ```
   mysql://<USER>@tcp(<HOST>:4000)/<DATABASE>?ssl-mode=VERIFY_IDENTITY
   ```
   Anote: `HOST`, `PORT` (4000), `USER` (ex.: `xxxx.root`), `PASSWORD` e o nome do `DATABASE`.
5. No **SQL Editor** do console, cole e execute o conteúdo de `database/schema.sql`
   (deve rodar sem erros — é MySQL puro, compatível com TiDB).

Pronto, o banco está no ar.

## 2. GitHub — repositório central

`git push` este repositório para um repo no GitHub. Já existem commits; o remote
ainda não está configurado neste ambiente. Exemplo:

```bash
git remote add origin git@github.com:<seu-usuario>/orion-optimizer.git
git push -u origin main
```

> Não commite `backend/.env`/`.env.local` (já estão no `.gitignore`).

## 3. Vercel — deploy do backend

1. Acesse https://vercel.com → **Add New Project** → importe o repositório GitHub.
2. **Root Directory**: selecione `backend`.
3. Framework Preset: **Other** (não precisa). O `vercel.json` já define os rewrites.
4. Em **Environment Variables**, adicione (use os valores do passo anterior):
   ```
   APP_SECRET=<chave forte>
   DB_HOST=<HOST do TiDB>
   DB_PORT=4000
   DB_USER=<USER do TiDB>
   DB_PASSWORD=<PASSWORD do TiDB>
   DB_NAME=bios_optimizer
   CORS_ORIGIN=*
   ```
5. Clique **Deploy**.

A URL será algo como `https://<nome-do-projeto>.vercel.app`.
- API: `https://<nome>.vercel.app/api/v1/health`
- Painel admin: `https://<nome>.vercel.app/admin`

### Criar o administrador do painel
Com o banco online, crie o primeiro admin via script local (rode na máquina):

```bash
cd backend
node scripts/create-admin.js admin sua-senha
```

> Esse script usa as credenciais de `backend/.env` — preencha `.env` com as
> credenciais do TiDB na sua máquina antes de rodar.

Alternativa sem criar no banco: defina a variável `ADMIN_TOKEN` na Vercel e use-a
como `Authorization: Bearer <ADMIN_TOKEN>`, ou deixe o painel logar pelo login
normal criado acima.

## 4. Desktop apontando para produção

O app já usa `https://orion-optimizer-six.vercel.app` como API padrão
(`desktop/src/config/appConfig.js` → `DEFAULT_API_URL`). Ajuste para a URL
final do seu projeto na Vercel e redistribua o instalador:

```bash
cd desktop
npm run dist
```

## 5. Verificação final

- `GET /api/v1/health` → deve responder `{ ok: true, ... }` (sem conectar no banco).
- `POST /api/v1/admin/login` com o admin criado → retorna `token`.
- `GET /api/v1/admin/licenses` com `Authorization: Bearer <token>` → lista licenças.

## Quando NÃO usar Railway?

Não foi necessário: a Vercel já cobre backend+painel (serverless) e o TiDB Cloud
substitui o banco. Railway só faria sentido se você quisesse um processo Node
sempre ligado em vez de serverless — desnecessário para este volume.
