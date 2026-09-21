# Home como dois termômetros: Plano × Caixa

**Data:** 2026-09-20
**Objetivo:** deixar a tela inicial mais útil, respondendo num relance as duas
perguntas do casal — "quanto ainda dá pra gastar" e "como estamos vs. o planejado" —
e reduzir a "sopa de números" atual.

## Contexto

A home hoje mostra 4 tiles (Saldo, Faturas abertas, Despesas do mês, Receitas do
mês) + um card de Orçamento + uma faixa de projeção + 2 cards (Cartão de cada um,
Categorias do mês). É informação demais e repetida, e mistura as duas réguas que o
app passou a ter: **consumo** (o que gastamos, pela data da compra) e **caixa** (o
que entra/sai da conta, cartão saindo no vencimento).

## Decisão

Reorganizar a home em **4 cards**: `[Plano] [Caixa]` no topo (os "termômetros") e
`[Cartão de cada um] [Categorias do mês]` embaixo (o panorama). O navegador de mês
continua no topo e tudo respeita o mês selecionado (`ref`).

### Card "Plano" (orçamento do mês — régua de consumo)
- **Herói:** Sobra do orçamento = `totalOrcado − resumo.totalDespesas` (gasto
  realizado). Cor: verde quando há folga; âmbar quando o gasto passou de 85% do
  orçado; vermelho quando estourou o total.
- Barra fina Gasto × Orçado (componente `BarraOrcamento`).
- **Placar** das categorias com orçamento (limite > 0): quantas *no azul* (usado
  ≤ 85%), *perto* (85–100%), *estourou* (> 100%).
- **Alertas:** lista só das categorias perto/estouradas, clicáveis → extrato do mês
  (`/lancamentos?categoria=<id>&mes=<ref>`).
- Link "Ver orçamento". Sem orçamento definido → convite para definir.

### Card "Caixa" (dinheiro real — régua de caixa)
- **Herói:** Folga de caixa = `saldoRef` (a mesma projeção "dá pra pagar": saldo +
  rendas a entrar − faturas/contas a pagar). Cor: verde (≥ 0), vermelho (< 0).
- Linha de detalhe (mês atual): "Saldo RX + renda a entrar RY − a pagar RZ
  (faturas + contas)". Meses futuros/passados: texto de projeção/histórico atual
  ("Deve sobrar até…", "Saldo no fim de…").
- Linha discreta "recebido no mês" = `resumo.totalReceitas`.

### Panorama (embaixo, 2 cards, como já são hoje)
- **Cartão de cada um** (`SplitBar` por titular, competência de consumo).
- **Categorias do mês** (top categorias por gasto — todas, inclusive sem orçamento).

## Removido (absorvido pelos termômetros)

| Removido | Vai para |
|---|---|
| Tile Saldo | linha de detalhe do Caixa |
| Tile Faturas abertas | "a pagar" do Caixa (total nos cartões fica na aba Cartões) |
| Tile Despesas do mês | barra Gasto × Orçado do Plano |
| Tile Receitas do mês | linha "recebido no mês" do Caixa |
| Card Orçamento atual | substituído pelo card Plano |
| Faixa de projeção | absorvida pelo card Caixa |

Consequência de coerência: **contas a pagar pendentes** deixam de somar em "Despesas
do mês" (tile que some) e passam a viver só no **Caixa**, como obrigação a pagar —
gasto realizado no Plano, o que falta pagar no Caixa.

## Escopo

- Muda apenas `src/app/(app)/page.tsx` (apresentação) e reusa
  `resumoOrcamento`/`BarraOrcamento` já existentes. Sem mudança de lógica de dinheiro.
- Sem novos componentes obrigatórios; se o JSX dos cards ficar grande, extrair
  `CardPlano`/`CardCaixa` como componentes de apresentação.

## Fora de escopo

- "Dá pra gastar por dia" (avaliado e cortado).
- Faturas por mês futuro (opção não escolhida).
- Mudanças na aba Orçamento ou no cálculo de competência/projeção.

## Verificação

- `npm run build` + `npx vitest run` (sem novos testes; é apresentação).
- Conferir mês atual, mês futuro (projeção) e mês passado (histórico) nos dois cards.
- Placar bate com a aba Orçamento (mesmas categorias no azul/perto/estouradas).
