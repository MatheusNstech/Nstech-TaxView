INSERT INTO public.responsaveis (nome, ativo) VALUES
('Viviane',true),
('Flá/Glau/Sol',true),
('Flávia',true),
('Solange',true),
('Felipe',true)
ON CONFLICT (nome) DO UPDATE SET ativo = true;