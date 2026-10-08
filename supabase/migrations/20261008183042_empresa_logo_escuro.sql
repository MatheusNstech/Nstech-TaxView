-- Logo da empresa para o tema escuro (versão negativa); logo_url fica com a positiva.
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logo_url_escuro text;
