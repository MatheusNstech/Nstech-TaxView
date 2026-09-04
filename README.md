# MsCronograma — Cronograma Fiscal TAX

Stack: **FastAPI** + **React (Vite)** + **Supabase** (Auth/Postgres).

## Setup local

### 1) Supabase
- Schema/migrations em `supabase/migrations/`
- Crie/use usuários em Authentication
- Copie **anon** e **service role** keys (Settings → API) — service role **só no backend**

### 2) Backend
```bash
cd backend
# use o venv do monorepo: ..\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Preencha SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# APP_ENV=development
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002
```

### 3) Frontend
```bash
cd frontend
copy .env.example .env
# VITE_API_URL=http://localhost:8002
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Deploy na Vercel (2 projetos no mesmo repo)

| Projeto | Root Directory | Build | Output / runtime |
|---------|----------------|-------|------------------|
| `mscronograma-web` | `frontend` | `npm run build` | `dist` (SPA + `vercel.json` rewrite) |
| `mscronograma-api` | `backend` | auto (Python/FastAPI) | `app/main.py` → `app` |

### Env — API (`mscronograma-api`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (**obrigatória** em produção)
- `CORS_ORIGINS` = URL do front (ex. `https://mscronograma-web.vercel.app`)
- `APP_ENV=production` (desliga `/docs`, `/redoc`, OpenAPI e `bootstrap-admin`)

### Env — Web (`mscronograma-web`) — build-time
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` = URL da API (ex. `https://mscronograma-api.vercel.app`) — **obrigatória** no build de produção

### Checklist Supabase Auth (Dashboard)
1. Authentication → URL Configuration
2. **Site URL** = URL do frontend Vercel
3. **Redirect URLs** = mesma URL (+ `http://localhost:5173` para dev)
4. Confirme que a **service role** não está em nenhum env do frontend

### Segurança (resumo)
- RLS least-privilege (PostgREST direto não vê obrigações de outros)
- Viewers (`is_viewer`) são somente leitura na API
- `must_change_password` em `app_metadata` (não confiar só em `user_metadata`)
- Senha mínima 12 caracteres
- Storage `recibos` sem policy para `authenticated` (acesso via service role / API)

### Rotacionar senhas padrão
Com service role no `.env`:
```bash
cd backend
python scripts/rotate_default_passwords.py
```
Entregue as senhas temporárias fora do git; no próximo login o usuário troca a senha.

## API (dev)
- `GET /api/health`
- Docs em `/docs` apenas se `APP_ENV` ≠ production

## Rate limits
Login/Auth: limites nativos do Supabase Auth. Mutações pesadas: preferir plano Pro + spend cap se o tráfego crescer.
