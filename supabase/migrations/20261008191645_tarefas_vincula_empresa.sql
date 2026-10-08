-- Tarefas criadas sem empresa, mas que são de uma empresa (nome no título): vincula à matriz.
update public.tarefas set empresa_id = '4502ea98-8a40-464c-806a-83a3cf641a71' -- KMM
where empresa_id is null and id in (
  'f3e068a7-4534-4ce6-a566-77f19c25a602', -- KMM
  'd9b04e2c-c579-4030-89b1-84d2f0f1fe33', -- Extração Relatórios Contábeis KMM
  '3fc1476c-4282-4ff3-b94d-af322ca8830e', -- Padronizador KMM
  '66fece1f-e37c-4803-b281-aacd7621ae17'  -- Cruzamento NF × KMM
);

update public.tarefas set empresa_id = '2cacd4d2-1b46-40e3-a5f5-e2e301cb814d' -- Opentech
where empresa_id is null and id = '5fa79ecc-ef06-4d0b-bb14-9522c3cbb3a1';

update public.tarefas set empresa_id = 'cac62d15-bc98-49aa-9a39-7ca6ff3577f2' -- Buonny
where empresa_id is null and id = '3c669855-dca8-4f74-a6e4-16373f9f17dc';

update public.tarefas set empresa_id = 'a06e2a16-85a6-4feb-9e54-266cb992c2c6' -- BRK
where empresa_id is null and id = 'cd808205-ae4f-4b4d-bb80-b7670b3f5a05';
