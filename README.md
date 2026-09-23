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

## Integração desktop (valores de faturamento)

O app desktop (BuscarNFSePortal) envia ISS e PIS/COFINS por empresa/competência.

### 1) Provisionar usuário de integração
```powershell
cd backend
$env:DESKTOP_EMAIL="desktop@nstech.com.br"
$env:DESKTOP_PASSWORD="SenhaForte@123"
$env:DESKTOP_ROLE="diretor"   # admin | diretor
..\.venv\Scripts\python.exe -m scripts.ensure_desktop_integration_user
```

### 2) Login
```http
POST /api/auth/token
Content-Type: application/json

{ "email": "desktop@nstech.com.br", "password": "SenhaForte@123" }
```
Resposta: `access_token` (Bearer).

### 3) Enviar valores (upsert por CNPJ + competência + tipo)
```http
POST /api/valores
Authorization: Bearer <access_token>
Content-Type: application/json
```

ISS:
```json
{
  "competencia": "2026-07-01",
  "tipo": "iss",
  "empresa_cnpj": "21244758000145",
  "empresa_alias": "CT6",
  "empresa_razao": "CT6 TECNOLOGIA LTDA",
  "origem": "desktop",
  "valores": {
    "erp_valor": 949622.04,
    "erp_iss": 18992.39,
    "iss_a_recolher": 18992.39,
    "has_pg": false,
    "has_portal": true,
    "matched": 104
  }
}
```

PIS/COFINS:
```json
{
  "competencia": "2026-07-01",
  "tipo": "pis_cofins",
  "empresa_cnpj": "21244758000145",
  "empresa_alias": "CT6",
  "empresa_razao": "CT6 TECNOLOGIA LTDA",
  "origem": "desktop",
  "valores": {
    "receita_bruta": 949622.04,
    "pis_debito": 6172.54,
    "cofins_debito": 28488.66,
    "pis_retido": 6172.47,
    "cofins_retido": 28488.74,
    "regime": "Cumulativo"
  }
}
```

Resposta inclui `changed` e `action` (`created` | `updated` | `unchanged`).  
Reprocessar o mesmo mês **só altera** se o payload for diferente.

### 4) Listar
```http
GET /api/valores?competencia=2026-07-01&tipo=iss&empresa_cnpj=21244758000145
Authorization: Bearer <access_token>
```

Migrations: `supabase/migrations/20260923120000_valores_faturamento.sql` e
`20260923143000_valores_faturamento_upsert.sql`.
