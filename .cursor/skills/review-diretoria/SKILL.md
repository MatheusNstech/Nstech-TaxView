---
name: review-diretoria
description: >-
  Reviews and critiques the MsCronograma director (diretor) experience — role
  permissions, /diretoria executive charts, landing/nav, and read-only org-wide
  scope. Use when the user asks to review, validate, or critique visão diretor,
  /diretoria, role diretor, or executive dashboard work.
---

# Review Visão Diretoria

## When to use

Apply this skill after implementing or changing:

- Role `diretor` / `isDiretor` / `canWrite`
- Route `/diretoria` and director landing
- Director nav or read-only drawers
- Charts por tipo de serviço / BU / pendências
- RLS / API scope for org-wide read

## How to review

1. Read the relevant files (do not trust memory alone):
   - `frontend/src/pages/Diretoria.tsx`
   - `frontend/src/components/diretoria/*`
   - `frontend/src/lib/diretoriaAggregates.ts`
   - `frontend/src/context/AuthContext.tsx`
   - `frontend/src/components/Layout.tsx`
   - `frontend/src/App.tsx`
   - `backend/app/core/auth.py`
   - `backend/app/services/scope.py`
   - Latest RLS migration for `is_app_diretor`
2. Walk the checklist below. Mark each item Pass / Fail / N/A with evidence (file + reason).
3. Produce a verdict and prioritized findings.

## Checklist (mandatory)

### Auth and scope

- [ ] `role=diretor` is recognized in backend `_extract_role` and frontend `AuthContext`
- [ ] Landing after login is `/diretoria` (not Minhas tarefas / Analytics ops)
- [ ] Diretor sees **org-wide** data (`org_wide` / `effective_responsavel_id` → None)
- [ ] Diretor **cannot write**: PATCH obrigação / comments → 403 (`require_not_viewer` / `canWrite`)
- [ ] Admin-only routes stay blocked (empresas, usuários, importação, etc.)

### Product / UX executivo

- [ ] Copy **técnica** only (no informal labels like “onde dói” / “atenção agora”)
- [ ] First screen: KPIs consolidação + **volume por tipo de serviço** + **status por tipo de serviço**
- [ ] Matriz **Distribuição por BU e status** + **Pendências críticas**
- [ ] Drill-down por serviço/BU/risco sem poluir a home
- [ ] No operational chrome: gerar competência, importação, CRUD masters, kanban edits
- [ ] Filters stay executive (competência + BU); avoid noisy search/status as primary
- [ ] Read-only drawer/list clearly non-editable

### Data honesty

- [ ] KPI numbers match the same filter scope as charts/matrix/list
- [ ] Service charts aggregate by `atividade.nome` (ex.: Apuração PIS e COFINS)
- [ ] Top N + “Outros” does not drop totals silently
- [ ] Pendências: atrasadas / ≤7d / sobrecarga with clear labels
- [ ] Empty states are honest (no fake zeros pretending health)

### Quality bar

- [ ] Mobile: charts stack; matrix scrolls; header does not break
- [ ] Contrast of status colors works in light and dark
- [ ] No over-engineering (extra endpoints/APIs only if justified)

## Output format

```markdown
## Veredito
aprovado | ajustar

## Checklist
- item: Pass/Fail — evidence

## Achados (priorizados)
1. [alto|médio|baixo] Título — impacto — correção sugerida

## Gaps de produto (não bloqueantes)
- ...
```

Be critical. Prefer fewer high-signal findings over praise. If something fails auth/read-only/org-wide, or informal copy remains, verdict must be **ajustar**.
