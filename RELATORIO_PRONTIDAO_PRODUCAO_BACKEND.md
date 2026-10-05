# Relatório de prontidão para produção — Backend TaxView (MsCronograma)

**Data:** 2026-09-25
**Escopo:** `backend/` (FastAPI em Vercel + Supabase), com leitura das migrations em `supabase/migrations/` relacionadas à segurança.
**Base analisada:** a working tree local na branch `main`, com cerca de 30 arquivos modificados e ainda sem commit. Os arquivos mudaram enquanto a análise estava em andamento: `requirements.txt` ganhou `tzdata`, a listagem de usuários passou a ser paginada e o timeout do httpx caiu para 25s. As referências de linha valem para o estado do código às 15h30 de 25/09.

---

## 1. Veredito

### 🟡 **APTO COM RESSALVAS: pode subir depois que os bloqueadores da seção 3 forem resolvidos**

A base é sólida para um app interno:
- a autenticação é feita pelo Supabase;
- os papéis vêm de `app_metadata`, que só o servidor consegue alterar;
- há guarda de configuração no deploy;
- `/docs` fica desligado em produção;
- escopo por responsável, paginação contra o limite de 1000 linhas e fuso horário de Brasília estão tratados.

Mesmo assim, há **3 bloqueadores** e alguns riscos altos que precisam ser resolvidos antes de liberar o uso em produção.

| Área | Situação |
|---|---|
| Autenticação e autorização | 🟢 Boa, com 1 falha de regra de negócio |
| Segurança do banco (funções SECURITY DEFINER) | 🔴 Correção crítica **ainda sem commit/aplicação confirmada** |
| Validação de entrada | 🟡 Razoável |
| Confiabilidade e desempenho (limite de 60s no Vercel) | 🟡 Risco com o crescimento dos dados |
| Observabilidade (logs, erros, métricas) | 🔴 Quase inexistente |
| Testes e CI | 🟡 32 testes passando, sem CI |
| Build reproduzível (dependências) | 🟡 Versões sem pin |

---

## 2. Pontos fortes

- **Guarda de deploy** (`app/main.py:27-46`): no Vercel, a aplicação não sobe sem `APP_ENV=production`, sem service role e sem `CORS_ORIGINS` de produção.
- **Docs e OpenAPI desligados em produção**, e o `bootstrap-admin` fica bloqueado em produção (`usuarios.py`).
- **Papéis e flags lidos só de `app_metadata`**, nunca de `user_metadata`, que o próprio usuário pode editar (`core/auth.py`).
- **Escopo por responsável correto**: um usuário comum sem responsável vinculado recebe lista vazia, não os dados da organização inteira. Isso vale para `obrigacoes.py`, `tarefas.py`, `dashboard.py` e os checks por id em `services/scope.py`.
- **Todas as rotas de escrita usam alguma dependência de autorização**: `require_admin`, `require_not_viewer`, `require_*_editor` ou `assert_password_changed`. Nenhum endpoint de negócio ficou sem autenticação.
- **Paginação contra o limite de 1000 linhas do PostgREST** (`services/db.py: fetch_all`).
- **Fuso de Brasília centralizado** (`core/clock.py`). Não há `date.today()` nem `datetime.now()` sem fuso em `app/`.
- **Erros do banco não vazam para o cliente**: as rotas registram a exceção no log e devolvem mensagem genérica.
- **Upload limitado a 4 MB** e restrito a admin (`importacao.py`).
- **Login do desktop** (`auth_token.py`): a chamada ao GoTrue não guarda estado e a sessão é revogada se o papel não for admin ou diretor.
- **Segredos fora do git**: `backend/.env` e `frontend/.env` estão no `.gitignore` e nunca foram commitados.
- **Testes**: 32 passando (`pytest`), cobrindo upsert de valores, edição de tarefa pelo responsável e PER/DCOMP.

---

## 3. 🔴 Bloqueadores (resolver antes de produção)

### B1. Função `_seed_auth_user` explorável por `anon`: correção ainda não versionada
A migration `supabase/migrations/20260925181826_harden_security_definer_functions.sql` está **untracked**. O próprio comentário dela descreve o problema: `_seed_auth_user` era `SECURITY DEFINER`, **podia ser executada por `anon` e não checava se o chamador era admin**. Na prática, qualquer pessoa com a anon key (que é pública, vai no bundle do front) conseguia **trocar a senha ou o papel de qualquer conta**.

**Ações:**
1. Fazer commit da migration e **confirmar que ela foi aplicada no projeto Supabase de produção**, com `supabase migration list` ou `select proname from pg_proc where proname = '_seed_auth_user'`, que deve voltar vazio.
2. Como a janela de exposição existiu, **revisar os logs de Auth e de Postgres** e considerar **rotacionar as senhas** e os papéis de todas as contas, incluindo a conta de integração do desktop.
3. Conferir se não sobrou outra função `SECURITY DEFINER` com `EXECUTE` para `anon` ou `PUBLIC`:
   ```sql
   select p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef;
   ```

### B2. Mudanças da release sem commit, e migration PER/DCOMP pendente
Há cerca de 30 arquivos alterados, um arquivo apagado (`services/atrasos_job.py`) e vários arquivos novos: `perdcomp.py`, `clock.py`, `db.py`, `requirements-dev.txt` e duas migrations. O deploy da Vercel é feito a partir do git, então **o que está sendo avaliado aqui não é o que está em produção**. A rota `perdcomp` depende de `20260924155622_perdcomp_processos.sql`, que também está untracked.

**Ação:** fazer commit, aplicar as migrations **antes** do deploy da API e fazer um smoke test depois do deploy (existe `scripts/smoke_perdcomp.py`).

### B3. Obrigação pode ir para "Entregue" sem passar pela revisão
`app/api/routes/obrigacoes.py:396-414`: um usuário comum consegue mandar `PATCH {"status": "ENTREGUE"}` direto e pular `EM_REVISAO` e `/aprovar`, que é exclusiva de admin (`:484`). `ObrigacaoUpdate` aceita qualquer status, e para não-admin o código só remove os campos de responsável, empresa e prazos.

**Ação:** se a revisão é obrigatória, limitar o não-admin às transições permitidas (por exemplo, até `EM_REVISAO`) e deixar `ENTREGUE` só para o fluxo `/aprovar`.

---

## 4. 🟠 Riscos altos

### A1. Mojibake em `perdcomp.py`
Os bytes UTF-8 foram gravados em dupla codificação: linhas 26 (`"JÃ¡ existe…"`), 47 (`"nÃºmero"`), 224 (`"â€”"`), 363 e 375 (`"nÃ£o encontrado"`). Com isso, as mensagens de erro aparecem corrompidas para o usuário, e o traço usado para empresa vazia no resumo `por_empresa` vira `â€”`.
**Ação:** regravar o arquivo em UTF-8 e corrigir essas strings.

### A2. Observabilidade quase inexistente
- Não há tratador global de exceções, correlação de requisição nem log estruturado. Só 14 pontos do código usam `logging`.
- Não há Sentry nem outro rastreador de erros. Um 500 no Vercel só aparece nos logs da função, que têm retenção curta.
- `/api/health` não testa o Supabase.

**Ação:** adicionar Sentry (ou similar) com `APP_ENV`, um middleware com request-id e um health check "profundo" (um `select 1` via PostgREST), protegido ou separado do liveness.

### A3. Consultas que crescem com o histórico e podem passar do limite de 60s
- `list_obrigacoes` sem `competencia` (`obrigacoes.py:120-141`), os exports Excel e PPTX (`:256`, `:294`), `perdcomp._fetch_all` (`perdcomp.py:281-312`) e o dashboard sem competência trazem **todo o histórico** com joins (`empresas(*)`, `atividades_modelo(*)`, `responsaveis(*)`). As páginas de 1000 linhas vêm em série, e os filtros `bu` e `q` são aplicados **em Python**.
- O calendário (`obrigacoes.py:171-172`) aceita `de` e `ate` sem limite de intervalo e sem checar `de <= ate`.

**Ação:** exigir competência ou intervalo (por exemplo, no máximo 12 meses) nos exports e listagens, levar os filtros para o PostgREST e selecionar só as colunas necessárias em vez de `*`.

### A4. Importação Excel sem transação e com carga total das tabelas
Em `services/csv_import.py`:
- `_upsert_map` (`:345-360`) carrega as tabelas inteiras de empresas, atividades e responsáveis;
- `_insert_tarefas` (`:670-674`) carrega **toda a tabela `tarefas`** só para deduplicar;
- os upserts vão em lotes de 100, em série.

Se o processo falhar no meio (erro ou timeout de 60s), a gravação fica **parcial**, e o usuário recebe apenas "Falha ao importar Excel". Além disso, `empresa_ids[spec["cnpj"]]` (`:559-560`) pode levantar `KeyError` quando o banco normaliza CNPJ ou nome.

**Ação:** mover a gravação para uma RPC transacional no Postgres, ou pelo menos tornar a importação idempotente e devolver um relatório por linha. Carregar só as chaves necessárias, com `.in_()` sobre os CNPJs e ids da planilha.

---

## 5. 🟡 Riscos médios

| # | Problema | Local | Sugestão |
|---|---|---|---|
| M1 | **Entregas depois das 21h (Brasília) aparecem como "em atraso"**: `entregue_em` é gravado em UTC, e os exports cortam a data com `str(v)[:10]` | `excel_export.py:80-91`, `pptx_export.py:95,195-202` | Converter para `BR_TZ` antes de `.date()` |
| M2 | `competencia_destino` de `/obrigacoes/gerar` não é normalizada para o dia 1, então as obrigações geradas não casam com os filtros `eq("competencia")` | `schemas/models.py:229-231`, `services/competencia.py` | `field_validator` com `.replace(day=1)`, como já é feito em `valores.py` |
| M3 | Totais do painel fiscal fixos no código (`CADASTRO_TOTAL_EMPRESAS = 34`, `EMPRESAS_BAIXADAS`) | `painel_fiscal.py:48-55,259` | Calcular a partir da tabela `empresas` ou de uma configuração |
| M4 | **Sem rate limit** em `POST /api/auth/token`, que fica exposto à internet e aceita força bruta, limitada só pelo GoTrue | `auth_token.py` | Confirmar os limites do Supabase Auth. Considerar um firewall da Vercel ou um limite por IP |
| M5 | Senha mínima de **8** caracteres, mas o README promete 12. Não há regra de complexidade, e só `senha@123` está bloqueada | `me.py:28`, `schemas/models.py:100` | Subir para 12 e aplicar a mesma política no Supabase Auth |
| M6 | Senha padrão conhecida (`Senha@123`) está em scripts versionados. Ela fica bloqueada na troca, mas é a senha inicial | `scripts/ensure_danilo_painel_fiscal.py`, `scripts/smoke_usuarios.py` | Gerar senha aleatória por usuário (já existe `rotate_default_passwords.py`) |
| M7 | Conta de integração do desktop (papel `diretor`) é criada com `must_change_password=False` e com uma senha de exemplo no README | `scripts/ensure_desktop_integration_user.py:68`, `README.md` | Senha forte e exclusiva, guardada em cofre, com rotação periódica |
| M8 | Dependências só com `>=`: cada deploy pode pegar uma versão nova com mudança incompatível. Por exemplo, o Starlette 1.x já avisa que `HTTP_422_UNPROCESSABLE_ENTITY` está obsoleto | `requirements.txt` | Pin exato (lock com `pip-compile` ou `uv`) e `pip-audit` no CI |
| M9 | Sem CI: os testes não rodam automaticamente antes do deploy | — | GitHub Actions com `pytest` e `ruff` como gate do merge na `main` |
| M10 | Rebaixar ou desativar um usuário só vale depois de até 60s, porque o cache de `AuthUser` é por instância e `invalidate_auth_cache` só limpa a instância local. Um access token de usuário banido continua válido até expirar | `core/auth.py:51,162` | Aceitável para uso interno. Documentar, ou reduzir o TTL do JWT no Supabase |
| M11 | Toda a autorização está na API, porque o service role ignora o RLS. Um bug de escopo na API expõe dados, e o RLS não serve de segunda barreira | `core/auth.py: get_db_client` | Manter os testes de escopo, ou usar o cliente do usuário (RLS) nas leituras |

---

## 6. 🔵 Baixo / melhorias

- `can_edit_painel_fiscal` ignora `is_viewer` e o papel `diretor` (`auth.py`). Um viewer com a flag `painel_fiscal_editor` consegue escrever no painel e no PER/DCOMP.
- `GET /responsaveis` expõe `email`, `auth_user_id` e `capacidade_max` para qualquer usuário autenticado, incluindo viewers.
- O PATCH de tarefa não valida `empresa_id` (o create valida). Uma FK inválida vira 500.
- Faltam `max_length` em `ReprovarRequest.motivo`, `ComentarioCreate.texto`, `Tarefa*.descricao` e nos textos do painel e do PER/DCOMP.
- O `ilike` do painel fiscal usa `%{empresa}%` sem escapar `%`, `_` e `*`. Não é injeção, mas os caracteres viram curinga.
- Há vários `except Exception: pass/return` sem log: `tarefas.py:115-124`, `pptx_export.py:322` e o calendário, que engole erro de tarefas (`obrigacoes.py:231-241`).
- `list_comentarios` e `list_audit` não paginam e cortam em 1000 linhas sem aviso. `audit_diff` faz um INSERT por campo alterado.
- Na importação, os aliases de status com espaço (`"EM REVISÃO"`) nunca casam (`csv_import.py:285-291`), e a busca aproximada de coluna pode confundir "Responsável" com "E-mail responsável" (`:417-421`).
- O zip-bomb no openpyxl fica como risco residual (`list(ws.iter_rows())`), atenuado pelo limite de 4 MB e pelo acesso só de admin.
- Sobrou lixo no repositório: `main.py` na raiz (template do PyCharm), `Acompanhamento PERDCOMP (1).xlsx` untracked, dezenas de `.sql` de seed em `backend/scripts/` e o comentário de `obrigacoes.py:115`, que ainda cita o job Python removido.
- CORS usa `allow_methods=["*"]` e `allow_headers=["*"]` com `allow_credentials=True`. As origens são explícitas, então está OK, mas vale restringir métodos e headers.
- Não há headers de segurança (HSTS e afins). Na API JSON o impacto é pequeno, e a Vercel já força HTTPS.

---

## 7. Testes executados

```
cd backend && pytest -q
```

- **Primeira execução:** falhou na coleta com `ZoneInfoNotFoundError: 'America/Sao_Paulo'`. Faltava o `tzdata`, que é obrigatório no Windows e em imagens Linux mínimas. Entretanto, o `tzdata>=2024.1` foi adicionado ao `requirements.txt` na working tree. **Confirme que essa mudança entra no commit.**
- **Com `tzdata`:** **32 passed**. Numa rodada intermediária, 1 teste falhou (`test_list_filtra_status_e_empresa`, fake sem `.range()`), mas ele já tinha sido corrigido na execução final.
- Não há testes de autorização por papel (viewer, diretor, user fora do escopo) para todas as rotas de escrita, nem testes de contrato do import.

---

## 8. Checklist de go-live

- [ ] **B1:** fazer commit e aplicar `harden_security_definer_functions.sql` em produção; auditar as funções `SECURITY DEFINER`; rotacionar as credenciais
- [ ] **B2:** fazer commit de toda a working tree; aplicar a migration PER/DCOMP antes do deploy; rodar smoke test depois do deploy
- [ ] **B3:** bloquear a transição direta para `ENTREGUE` por não-admin
- [ ] **A1:** corrigir o encoding de `perdcomp.py`
- [ ] **A2:** configurar Sentry ou rastreador de erros e health check com o banco
- [ ] **A3 e A4:** limitar o intervalo das consultas e exports e tornar a importação transacional ou idempotente
- [ ] **M1:** corrigir o fuso de `entregue_em` nos exports
- [ ] **M8 e M9:** fixar as versões das dependências e criar CI com pytest e pip-audit
- [ ] Na Vercel: `APP_ENV=production`, `CORS_ORIGINS` com o domínio real e service role **somente** no projeto da API
- [ ] No Supabase: backups (PITR) ativos, política de senha igual à do app, e Site URL e Redirect URLs de produção
