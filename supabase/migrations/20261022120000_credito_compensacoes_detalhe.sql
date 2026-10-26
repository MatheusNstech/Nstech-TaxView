-- Lançamento de compensação espelhando as colunas U–AB das abas 1–4 da planilha:
-- Data Compensação, Principal (valor), Multa, Juros, Total, Nº Dcomp, Cód Receita, Débito Compensado.
-- `competencia` (dia 1) continua sendo a chave do SUMIF do ledger; `data_compensacao` guarda o dia real.

ALTER TABLE public.credito_compensacoes
  ADD COLUMN IF NOT EXISTS data_compensacao date,
  ADD COLUMN IF NOT EXISTS numero_dcomp text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cod_receita text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS debito_compensado text NOT NULL DEFAULT '';

UPDATE public.credito_compensacoes
SET data_compensacao = competencia
WHERE data_compensacao IS NULL;
