INSERT INTO public.atividades_modelo (nome, requer_apuracao, dia_prazo_legal, dia_prazo_fiscal, recorrencia, ativa) VALUES
('Apuração Importação',true,20,15,'mensal',true),
('Apuração CPRB',true,20,15,'mensal',true),
('Apuração IRPJ/CSLL',true,20,15,'mensal',true),
('Apuração PIS e COFINS',true,20,15,'mensal',true),
('DIRBI',true,20,15,'mensal',true),
('EFD Contribuições',true,20,15,'mensal',true),
('MIT / DCFTWEB',true,20,15,'mensal',true),
('REINF',true,20,15,'mensal',true),
('Apuração ISS Prestados',true,20,15,'mensal',true),
('Apuração ICMS',true,20,15,'mensal',true),
('SPED ICMS',true,20,15,'mensal',true)
ON CONFLICT (nome) DO UPDATE SET requer_apuracao = EXCLUDED.requer_apuracao, ativa = true;