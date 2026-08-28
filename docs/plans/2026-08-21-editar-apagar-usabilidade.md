# Editar/apagar cartão, apagar importação, usabilidade + responsivo — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Editar e apagar cartão (apagar cascateia lançamentos/faturas — com confirmação forte); apagar uma importação inteira (lote) e um lançamento avulso; controles com cara de botão de verdade (variante de perigo); e uma passada de responsividade pra nada quebrar no mobile.

**Architecture:** Rotas REST novas (PATCH/DELETE cards, DELETE transaction, DELETE import batch). `transactions.grupo_importacao` (migration 0009, já aplicada) marca cada lote; threaded via `persistirLancamento`/`mapearRegistros`. UI: formulário de edição de cartão, botões de excluir com confirmação, lista de importações recentes. `Button` ganha variante `danger`. Responsivo: layout da tabela de revisão empilha no mobile + auditoria de overflow.

**Tech Stack:** Next.js 16, Supabase (RLS household + FK on delete cascade), Tailwind, TS, `@phosphor-icons/react`.

## Global Constraints

- **household_id/id sempre via RLS** (`getMembroAtual` + policies). DELETE/PATCH por id são RLS-scoped (id de outro household afeta 0 linhas).
- **Apagar cartão é destrutivo:** o FK `transactions.card_id ... on delete cascade` e `invoices.card_id ... on delete cascade` removem os lançamentos e faturas do cartão. A UI DEVE confirmar explicitamente ("isso apaga o cartão e todos os seus lançamentos e faturas").
- **Não alterar** lógica financeira pura. `npx vitest run` deve continuar **59/59** (+ testes novos, se houver).
- Cores via `var(--token)`; ícones `@phosphor-icons/react` (client entry). Dinheiro em centavos.
- Verificação: `npm run build` + `npx vitest run`; controlador roda /code-review; runtime conferido pelo usuário.

## File Structure

```
src/lib/financeiro/tipos.ts            # (sem mudança — grupo vai pelo ctx)
src/lib/financeiro/registros.ts        # ctx ganha grupoImportacao -> grupo_importacao
src/lib/financeiro/persistir.ts        # ctx ganha grupoImportacao (repassa)
src/app/api/importar/confirmar/route.ts# gera batchId e passa no ctx
src/app/api/cards/[id]/route.ts        # NOVO: PATCH (editar) + DELETE (apagar)
src/app/api/transactions/[id]/route.ts # + DELETE (apagar lançamento)
src/app/api/importar/[grupo]/route.ts  # NOVO: DELETE lote de importação
src/components/ui/Button.tsx           # + variante "danger"
src/components/cartoes/EditarCartao.tsx# NOVO: editar/excluir um cartão
src/app/(app)/cartoes/page.tsx         # usa EditarCartao por cartão
src/components/lancamentos/LinhaEditavel.tsx # + excluir lançamento; edit vira botão
src/components/importar/ImportacoesRecentes.tsx # NOVO: lista + apagar lote
src/app/(app)/importar/page.tsx        # mostra ImportacoesRecentes
src/components/orcamento/RendaEditor.tsx # "editar" vira botão
src/components/metas/RemoverMeta.tsx     # vira botões de verdade
src/components/importar/Importador.tsx   # tabela de revisão responsiva
```

---

### Task 1: Threading `grupo_importacao` + variante `danger` do Button

**Files:**
- Modify: `src/lib/financeiro/registros.ts`, `src/lib/financeiro/persistir.ts`, `src/app/api/importar/confirmar/route.ts`
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: `registros.ts` — ctx ganha `grupoImportacao`**

Em `CtxRegistro`, adicionar `grupoImportacao?: string | null`. No objeto retornado por `mapearRegistros`, adicionar `grupo_importacao: ctx.grupoImportacao ?? null`.

- [ ] **Step 2: `persistir.ts` — ctx ganha `grupoImportacao`**

Alterar a assinatura do `ctx` de `persistirLancamento` para `{ householdId: string; criadoPor: string; grupoImportacao?: string | null }`, e ao chamar `mapearRegistros`, repassar `grupoImportacao: ctx.grupoImportacao ?? null`. (Chamadas existentes sem o campo continuam funcionando — fica `null`.)

- [ ] **Step 3: `confirmar/route.ts` — gera o lote**

Antes do loop, `const grupoImportacao = crypto.randomUUID();`. Na chamada `persistirLancamento(supabase, { householdId: ..., criadoPor: ..., grupoImportacao }, novo, diaFechamento)`. (Importar `randomUUID` de `node:crypto` ou usar `crypto.randomUUID()` global — disponível no runtime Node.)

- [ ] **Step 4: `Button.tsx` — variante `danger`**

Adicionar `"danger"` ao union de `variant` e ao objeto `styles`: `danger: { ...base, background: "var(--negativo)", color: "#fff", border: "1px solid transparent" }`.

- [ ] **Step 5: Verificar + commit**

Run: `npx vitest run` → 59/59 (mapearRegistros continua ok — o teste não checa grupo_importacao, mas segue passando); `npm run build` → conclui.

```bash
git add src/lib/financeiro/registros.ts src/lib/financeiro/persistir.ts src/app/api/importar/confirmar/route.ts src/components/ui/Button.tsx
git commit -m "feat: tag grupo_importacao no import + variante danger do Button"
```

---

### Task 2: Rotas — editar/apagar cartão

**Files:**
- Create: `src/app/api/cards/[id]/route.ts`

- [ ] **Step 1: PATCH + DELETE**

`src/app/api/cards/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.nome === "string") patch.nome = b.nome.trim();
  if (b.limite_centavos != null) patch.limite_centavos = Math.max(0, Math.round(Number(b.limite_centavos) || 0));
  if (b.dia_fechamento != null) patch.dia_fechamento = Number(b.dia_fechamento);
  if (b.dia_vencimento != null) patch.dia_vencimento = Number(b.dia_vencimento);
  if ("titular" in b) patch.titular = b.titular || null;
  if ("bandeira" in b) patch.bandeira = b.bandeira || null;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("cards").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const supabase = await createServerSupabase();
  // FK on delete cascade remove os lançamentos e faturas deste cartão
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verificar + commit**

Run: `npm run build` → conclui.

```bash
git add "src/app/api/cards/[id]/route.ts"
git commit -m "feat: API editar/apagar cartão"
```

---

### Task 3: Rotas — apagar lançamento e apagar lote de importação

**Files:**
- Modify: `src/app/api/transactions/[id]/route.ts` (+ DELETE)
- Create: `src/app/api/importar/[grupo]/route.ts`

- [ ] **Step 1: DELETE lançamento**

Em `src/app/api/transactions/[id]/route.ts`, adicionar:

```ts
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

(Manter o PATCH existente; só adicionar o DELETE no mesmo arquivo.)

- [ ] **Step 2: DELETE lote de importação**

`src/app/api/importar/[grupo]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function DELETE(_req: Request, { params }: { params: Promise<{ grupo: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { grupo } = await params;
  const supabase = await createServerSupabase();
  const { error, count } = await supabase
    .from("transactions").delete({ count: "exact" }).eq("grupo_importacao", grupo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, apagadas: count ?? 0 });
}
```

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui.

```bash
git add "src/app/api/transactions/[id]/route.ts" "src/app/api/importar/[grupo]/route.ts"
git commit -m "feat: API apagar lançamento e apagar lote de importação"
```

---

### Task 4: UI — editar/apagar cartão, apagar lançamento, importações recentes; controles com cara de botão

**Files:**
- Create: `src/components/cartoes/EditarCartao.tsx`
- Modify: `src/app/(app)/cartoes/page.tsx`
- Modify: `src/components/lancamentos/LinhaEditavel.tsx`
- Create: `src/components/importar/ImportacoesRecentes.tsx`
- Modify: `src/app/(app)/importar/page.tsx`
- Modify: `src/components/orcamento/RendaEditor.tsx`, `src/components/metas/RemoverMeta.tsx`

- [ ] **Step 1: `EditarCartao.tsx` (client) — editar + excluir**

Client component que recebe o cartão. Mostra dois botões `<Button variant="ghost">Editar</Button>` e `<Button variant="danger">Excluir</Button>` (ícones `PencilSimple`/`Trash`). "Editar" abre um form prefilled (nome, limite R$, dias, titular) que faz `PATCH /api/cards/[id]` e `router.refresh()`. "Excluir" pede **confirmação** ("Apagar o cartão e TODOS os seus lançamentos e faturas? Não dá pra desfazer.") — só então `DELETE /api/cards/[id]` e refresh. Use `reaisParaCentavos`, `Field`, `Button`. Erros inline.

- [ ] **Step 2: Cartões page usa `EditarCartao`**

No header de cada card (`cartoes/page.tsx`), ao lado do "fecha/vence", renderizar `<EditarCartao card={card} />`. Passar os campos do cartão necessários (id, nome, limite_centavos, dia_fechamento, dia_vencimento, titular, bandeira). Não mexer no cálculo/faturas.

- [ ] **Step 3: `LinhaEditavel` — excluir lançamento + botão de editar**

No modo não-edição, trocar o gatilho de edição (hoje texto + lápis) por um `<Button variant="ghost">` pequeno com o lápis, e adicionar um `<Button variant="danger">` (ícone `Trash`) que, com confirmação, faz `DELETE /api/transactions/[id]` e refresh. No modo edição, os botões Salvar/Cancelar já são `<Button>`.

- [ ] **Step 4: `ImportacoesRecentes.tsx` (client) + página**

Na `importar/page.tsx` (server), buscar `transactions` com `grupo_importacao` não nulo (select `grupo_importacao, valor_centavos, created_at`), agrupar em JS por `grupo_importacao` (count, soma, data mais recente), e passar ao componente client `ImportacoesRecentes`. Cada lote: "N lançamentos · <total> · <data>" + `<Button variant="danger">Apagar importação</Button>` que, com confirmação, faz `DELETE /api/importar/[grupo]` e refresh. Mostrar no máx. os 10 mais recentes. Renderizar abaixo do `<Importador/>`.

- [ ] **Step 5: `RendaEditor` e `RemoverMeta` viram botões**

- `RendaEditor`: o gatilho "Definir renda / editar" (hoje `<button>` com `background:none`) vira `<Button variant="ghost">`.
- `RemoverMeta`: os "remover/confirmar/cancelar" (hoje `<button>` texto puro) viram `<Button variant="ghost">Remover</Button>` e, ao confirmar, `<Button variant="danger">Confirmar exclusão</Button>` + `<Button variant="quiet">Cancelar</Button>`.

- [ ] **Step 6: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → 59/59.

```bash
git add src/components/cartoes/EditarCartao.tsx "src/app/(app)/cartoes/page.tsx" src/components/lancamentos/LinhaEditavel.tsx src/components/importar/ImportacoesRecentes.tsx "src/app/(app)/importar/page.tsx" src/components/orcamento/RendaEditor.tsx src/components/metas/RemoverMeta.tsx
git commit -m "feat(ui): editar/apagar cartão, apagar lançamento/importação; controles com cara de botão"
```

---

### Task 5: Responsividade (não quebrar no mobile)

**Files:**
- Modify: `src/components/importar/Importador.tsx` (tabela de revisão)
- Modify: conforme necessário (auditoria de overflow)

- [ ] **Step 1: Tabela de revisão da importação empilha no mobile**

Na lista de linhas do `Importador` (o `linhas.map`), a linha hoje é um `flex flex-wrap` com larguras fixas (`w-20` data, `w-24` valor) + input flex-1 + select — no mobile estoura/embola. Reestruturar cada linha para:
- **Mobile (padrão):** duas linhas — 1ª: checkbox + input de descrição (largura total); 2ª: data + select de categoria + valor (com `flex-wrap`, `gap-2`, textos menores).
- **Desktop (`sm:`):** manter em uma linha.
Use `flex flex-col sm:flex-row sm:items-center` no wrapper e ajuste as larguras (`w-full sm:w-20` etc.). Garantir que nada force overflow horizontal (`min-w-0` nos inputs).

- [ ] **Step 2: Auditoria de overflow**

Revisar cada página `(app)/*` e garantir:
- Nenhum elemento com largura fixa maior que a viewport; usar `max-w-full`, `min-w-0` em inputs dentro de flex.
- O container raiz do `(app)/layout.tsx` já limita a 720px com padding — ok; confirmar que as tabelas/linhas longas quebram ou rolam dentro do próprio container (`overflow-x-auto` onde fizer sentido), sem rolar a página inteira na horizontal.
- Alvos de toque dos botões pequenos ≥ ~36–40px de altura (os `<Button>` já têm padding adequado; conferir os ícones-botão).
Aplicar correções pontuais onde encontrar quebra (ex.: faixas de metadados com muitos itens usam `flex-wrap`).

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui. Inspecionar (dev) em 360px, 768px, 1280px se possível; senão, revisão de código garantindo os breakpoints.

```bash
git add -A
git commit -m "fix(ui): responsividade (tabela de importação empilha no mobile + sem overflow)"
```

---

## Self-Review (autor)

**Cobertura:** editar cartão → Task 2 (PATCH) + Task 4 (UI). Apagar cartão → Task 2 (DELETE, cascade) + Task 4 (confirmação). Apagar importação → Task 1 (tag lote) + Task 3 (DELETE lote) + Task 4 (lista). Apagar lançamento → Task 3 + Task 4. Botões com cara de botão → Task 1 (variante danger) + Task 4 (converter gatilhos de texto). Responsivo → Task 5. ✅

**Consistência:** `grupo_importacao` threaded por ctx (persistir→registros); rotas RLS-scoped; `<Button>` com variantes primary/ghost/quiet/danger usado em todos os controles.

**Placeholders:** o backend (rotas/threading) tem código concreto; a UI/responsivo tem direção precisa (componentes, variantes, breakpoints) seguindo os padrões já existentes no app.

**Risco:** apagar cartão é irreversível (cascade). A UI exige confirmação explícita. Apagar lote de importação remove só as transações daquele `grupo_importacao` (faturas vazias podem sobrar, sem impacto — o total da fatura recalcula a partir das transações).
