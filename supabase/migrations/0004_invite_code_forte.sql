-- Endurece o código de convite: de 32-bit (gen_random_bytes(4)) para 64-bit,
-- tornando brute-force inviável mesmo antes do 2o membro entrar (o cap de 2
-- membros da 0003 já bloqueia juntar-se a um lar cheio; isto fecha a janela).
-- Afeta apenas lares criados a partir daqui.
alter table households alter column invite_code set default encode(gen_random_bytes(8), 'hex');
