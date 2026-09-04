INSERT INTO public.obrigacoes (empresa_id, atividade_id, responsavel_id, competencia, prazo_legal, prazo_fiscal, status)
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '00.708.590/0001-01' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '00.708.590/0001-01' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '00.708.590/0001-01' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '00.708.590/0001-01' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '00.708.590/0001-01' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '00.708.590/0001-01' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.327.872/0001-76' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '29.044.316/0001-67' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.663.651/0001-15' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.663.651/0001-15' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.663.651/0001-15' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.663.651/0001-15' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.663.651/0001-15' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '11.360.896/0001-36' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'Apuração IRPJ/CSLL'
ON CONFLICT (empresa_id, atividade_id, competencia) DO NOTHING;