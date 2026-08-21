# Fase 2 — Orçamento por % da renda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Orçamento do casal por **porcentagem da renda mensal**: define-se a renda mensal esperada e um % por categoria de despesa; o app calcula o limite (R$ = % × renda), acompanha o gasto do mês vs limite (barras de progresso) e mostra quanto da renda está alocado x é reserva.

**Architecture:** Nova tabela `budgets` (household, categoria, percentual) + coluna `households.renda_mensal_centavos` (migration 0006, já aplicada). Lógica pura testável em `src/lib/financeiro/orcamento.ts`. API REST em `src/app/api/orcamento/*`. Nova tela `/orcamento` (server component) na tab bar, com editores client inline.

**Tech Stack:** Next.js 16, Supabase (RLS já cobre budgets/households via membro), Tailwind, TypeScript, vitest.

## Global Constraints

- **Dinheiro em centavos** (int); `percentual` é `numeric(5,2)` (0–100).
- **Compartilhado (casal):** orçamento é do household; soma os gastos dos dois. Sem por-pessoa.
- **Base = renda esperada** definida pelo casal (`households.renda_mensal_centavos`), NÃO as receitas lançadas.
- **RLS:** budgets e households já têm policy household-scoped; o usuário É membro, então CRUD via cliente funciona (sem security definer). `household_id` sempre do membro logado, nunca do body.
- **Gasto por categoria** = soma das `transactions` tipo `despesa` da categoria no mês corrente.
- **Não alterar** Fase 1: `npx vitest run` deve continuar verde + os novos testes.
- Cores via `var(--token)`; valores via `<Money>`; primitivos existentes (`Card`, `Button`, `Field`, `Money`).
- Verificação: `npm run build` + `npx vitest run` + inspeção (o controlador revisa por code-review; runtime confirmado pelo usuário).

## File Structure

```
src/lib/financeiro/orcamento.ts        # limiteCategoria + resumoOrcamento (puro)
src/lib/financeiro/orcamento.test.ts
src/lib/db/tipos.ts                    # Budget + renda em Household (JÁ FEITO pelo controlador)
src/app/api/orcamento/renda/route.ts   # POST renda mensal
src/app/api/orcamento/categoria/route.ts # POST upsert % de uma categoria
src/app/(app)/orcamento/page.tsx       # tela (server component)
src/components/orcamento/RendaEditor.tsx     # client: edita renda
src/components/orcamento/PercentualEditor.tsx# client: edita % de uma categoria
src/components/shell/TabBar.tsx        # + item Orçamento
```

---

### Task 1: Lógica pura de orçamento (TDD)

**Files:**
- Create: `src/lib/financeiro/orcamento.ts`
- Test: `src/lib/financeiro/orcamento.test.ts`

**Interfaces:**
- Produces: `limiteCategoria(rendaCentavos: number, percentual: number): number`
- Produces: `type ItemOrcamento`, `type ResumoOrcamento`, `resumoOrcamento(params): ResumoOrcamento`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/financeiro/orcamento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { limiteCategoria, resumoOrcamento } from "./orcamento";

describe("limiteCategoria", () => {
  it("limite = % da renda, arredondado em centavos", () => {
    expect(limiteCategoria(1000000, 15)).toBe(150000); // 15% de R$10.000 = R$1.500
    expect(limiteCategoria(1000000, 0)).toBe(0);
    expect(limiteCategoria(333300, 33.33)).toBe(111079); // round(333300*0.3333)
  });
});

describe("resumoOrcamento", () => {
  const params = {
    rendaCentavos: 1000000,
    budgets: [
      { categoria_id: "mercado", percentual: 15 },
      { categoria_id: "lazer", percentual: 10 },
    ],
    gastoPorCategoria: { mercado: 120000, lazer: 130000 },
  };

  it("calcula limite, gasto, restante e pctUsado por categoria", () => {
    const r = resumoOrcamento(params);
    const mercado = r.itens.find((i) => i.categoria_id === "mercado")!;
    expect(mercado.limiteCentavos).toBe(150000);
    expect(mercado.gastoCentavos).toBe(120000);
    expect(mercado.restanteCentavos).toBe(30000);
    expect(mercado.pctUsado).toBeCloseTo(80, 5);
    const lazer = r.itens.find((i) => i.categoria_id === "lazer")!;
    expect(lazer.restanteCentavos).toBe(-30000); // estourou (130k > 100k)
    expect(lazer.pctUsado).toBeCloseTo(130, 5);
  });

  it("totais e alocação", () => {
    const r = resumoOrcamento(params);
    expect(r.totalPercentual).toBe(25);
    expect(r.totalOrcadoCentavos).toBe(250000);
    expect(r.totalGastoCentavos).toBe(250000);
    expect(r.naoAlocadoPercentual).toBe(75);
    expect(r.reservaCentavos).toBe(750000); // renda - orçado
  });

  it("categoria sem gasto conta como 0; não-alocado nunca negativo", () => {
    const r = resumoOrcamento({
      rendaCentavos: 1000000,
      budgets: [{ categoria_id: "x", percentual: 120 as number }], // acima de 100 no total
      gastoPorCategoria: {},
    });
    expect(r.itens[0].gastoCentavos).toBe(0);
    expect(r.naoAlocadoPercentual).toBe(0); // max(0, 100-120)
  });

  it("pctUsado é 0 quando limite é 0 (evita divisão por zero)", () => {
    const r = resumoOrcamento({ rendaCentavos: 0, budgets: [{ categoria_id: "x", percentual: 10 }], gastoPorCategoria: { x: 5000 } });
    expect(r.itens[0].limiteCentavos).toBe(0);
    expect(r.itens[0].pctUsado).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/financeiro/orcamento.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `orcamento.ts`**

```ts
export function limiteCategoria(rendaCentavos: number, percentual: number): number {
  return Math.round((rendaCentavos * percentual) / 100);
}

export type ItemOrcamento = {
  categoria_id: string;
  percentual: number;
  limiteCentavos: number;
  gastoCentavos: number;
  restanteCentavos: number;
  pctUsado: number;
};

export type ResumoOrcamento = {
  itens: ItemOrcamento[];
  totalPercentual: number;
  totalOrcadoCentavos: number;
  totalGastoCentavos: number;
  naoAlocadoPercentual: number;
  reservaCentavos: number;
};

export function resumoOrcamento(params: {
  rendaCentavos: number;
  budgets: { categoria_id: string; percentual: number }[];
  gastoPorCategoria: Record<string, number>;
}): ResumoOrcamento {
  const itens: ItemOrcamento[] = params.budgets.map((b) => {
    const limiteCentavos = limiteCategoria(params.rendaCentavos, b.percentual);
    const gastoCentavos = params.gastoPorCategoria[b.categoria_id] ?? 0;
    return {
      categoria_id: b.categoria_id,
      percentual: b.percentual,
      limiteCentavos,
      gastoCentavos,
      restanteCentavos: limiteCentavos - gastoCentavos,
      pctUsado: limiteCentavos > 0 ? (gastoCentavos / limiteCentavos) * 100 : 0,
    };
  });
  const totalPercentual = params.budgets.reduce((s, b) => s + b.percentual, 0);
  const totalOrcadoCentavos = itens.reduce((s, i) => s + i.limiteCentavos, 0);
  const totalGastoCentavos = itens.reduce((s, i) => s + i.gastoCentavos, 0);
  return {
    itens,
    totalPercentual,
    totalOrcadoCentavos,
    totalGastoCentavos,
    naoAlocadoPercentual: Math.max(0, 100 - totalPercentual),
    reservaCentavos: params.rendaCentavos - totalOrcadoCentavos,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/financeiro/orcamento.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financeiro/orcamento.ts src/lib/financeiro/orcamento.test.ts
git commit -m "feat(orcamento): lógica pura (limiteCategoria + resumoOrcamento)"
```

---

### Task 2: API — renda e percentuais

**Files:**
- Create: `src/app/api/orcamento/renda/route.ts`
- Create: `src/app/api/orcamento/categoria/route.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `getMembroAtual`, `reaisParaCentavos` (para a renda, se vier em reais).
- Produces: `POST /api/orcamento/renda` {renda_mensal_centavos}; `POST /api/orcamento/categoria` {categoria_id, percentual}.

- [ ] **Step 1: Rota da renda**

`src/app/api/orcamento/renda/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const renda = Math.max(0, Math.round(Number(body.renda_mensal_centavos) || 0));
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("households").update({ renda_mensal_centavos: renda }).eq("id", membro.household_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, renda_mensal_centavos: renda });
}
```

- [ ] **Step 2: Rota do percentual (upsert)**

`src/app/api/orcamento/categoria/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const categoria_id: string = body.categoria_id;
  const percentual = Math.min(100, Math.max(0, Number(body.percentual) || 0));
  if (!categoria_id) return NextResponse.json({ error: "categoria inválida" }, { status: 400 });
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { household_id: membro.household_id, categoria_id, percentual },
      { onConflict: "household_id,categoria_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui.

```bash
git add src/app/api/orcamento/renda/route.ts src/app/api/orcamento/categoria/route.ts
git commit -m "feat(orcamento): API de renda e percentuais"
```

---

### Task 3: Tela `/orcamento` + editores + tab bar

**Files:**
- Create: `src/app/(app)/orcamento/page.tsx`
- Create: `src/components/orcamento/RendaEditor.tsx`
- Create: `src/components/orcamento/PercentualEditor.tsx`
- Modify: `src/components/shell/TabBar.tsx` (adicionar item Orçamento)

**Interfaces:**
- Consumes: `resumoOrcamento`, `limiteCategoria`, `Money`, `Card`, `Field`, `Button`, `centavosParaReais`, `reaisParaCentavos`, `resumoDoMes` (para gasto por categoria) ou cálculo direto.

- [ ] **Step 1: Adicionar Orçamento à TabBar**

Em `src/components/shell/TabBar.tsx`, no array `ITENS`, adicionar `{ href: "/orcamento", rotulo: "Orçamento" }` após o item de Extrato (5 itens no total).

- [ ] **Step 2: Editor de renda (client)**

`src/components/orcamento/RendaEditor.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos, centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";

export function RendaEditor({ rendaCentavos }: { rendaCentavos: number }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState((rendaCentavos / 100).toString());
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const res = await fetch("/api/orcamento/renda", {
      method: "POST",
      body: JSON.stringify({ renda_mensal_centavos: reaisParaCentavos(valor) }),
    });
    setSalvando(false);
    if (res.ok) { setEditando(false); router.refresh(); }
  }

  if (!editando) {
    return (
      <button onClick={() => setEditando(true)}
        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.85rem" }}>
        {rendaCentavos > 0 ? `Renda: ${centavosParaReais(rendaCentavos)} · editar` : "Definir renda mensal"}
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Renda (R$)"
        className="mono" style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", width: 140 }} />
      <Button onClick={salvar} disabled={salvando}>Salvar</Button>
    </div>
  );
}
```

- [ ] **Step 3: Editor de percentual (client)**

`src/components/orcamento/PercentualEditor.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PercentualEditor({ categoriaId, percentual }: { categoriaId: string; percentual: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(String(percentual));
  const [salvando, setSalvando] = useState(false);

  async function salvar(novo: string) {
    const p = Math.min(100, Math.max(0, Number(novo) || 0));
    setSalvando(true);
    const res = await fetch("/api/orcamento/categoria", {
      method: "POST",
      body: JSON.stringify({ categoria_id: categoriaId, percentual: p }),
    });
    setSalvando(false);
    if (res.ok) router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input type="number" min={0} max={100} value={valor} disabled={salvando}
        onChange={(e) => setValor(e.target.value)}
        onBlur={(e) => salvar(e.target.value)}
        className="mono"
        style={{ width: 56, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textAlign: "right" }} />
      <span style={{ color: "var(--muted)" }}>%</span>
    </span>
  );
}
```

- [ ] **Step 4: Página `/orcamento`**

`src/app/(app)/orcamento/page.tsx`:

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { resumoOrcamento } from "@/lib/financeiro/orcamento";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { RendaEditor } from "@/components/orcamento/RendaEditor";
import { PercentualEditor } from "@/components/orcamento/PercentualEditor";

export default async function OrcamentoPage() {
  const supabase = await createServerSupabase();
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const [hhRes, catsRes, budgetsRes, txsRes] = await Promise.all([
    supabase.from("households").select("renda_mensal_centavos").maybeSingle(),
    supabase.from("categories").select("id, nome, cor").eq("tipo", "despesa").order("nome"),
    supabase.from("budgets").select("categoria_id, percentual"),
    supabase.from("transactions").select("categoria_id, tipo, valor_centavos, data_compra"),
  ]);
  const erro = hhRes.error ?? catsRes.error ?? budgetsRes.error ?? txsRes.error;
  if (erro) throw new Error(`Falha ao carregar o orçamento: ${erro.message}`);

  const renda = hhRes.data?.renda_mensal_centavos ?? 0;
  const cats = catsRes.data ?? [];
  const budgets = budgetsRes.data ?? [];

  // gasto por categoria (despesas do mês corrente)
  const gastoPorCategoria: Record<string, number> = {};
  for (const t of txsRes.data ?? []) {
    if (t.tipo !== "despesa" || !t.categoria_id) continue;
    const [a, m] = t.data_compra.split("-").map(Number);
    if (a !== ano || m !== mes) continue;
    gastoPorCategoria[t.categoria_id] = (gastoPorCategoria[t.categoria_id] ?? 0) + t.valor_centavos;
  }

  const resumo = resumoOrcamento({ rendaCentavos: renda, budgets, gastoPorCategoria });
  const pctPorCat = new Map(budgets.map((b) => [b.categoria_id, b.percentual]));
  const itemPorCat = new Map(resumo.itens.map((i) => [i.categoria_id, i]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[var(--text)]">Orçamento</h1>
        <RendaEditor rendaCentavos={renda} />
      </header>

      {/* resumo do mês: alocado x reserva, orçado x gasto */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><div className="text-xs text-[var(--muted)]">Alocado</div><div className="mono text-lg font-semibold">{resumo.totalPercentual}%</div></div>
          <div><div className="text-xs text-[var(--muted)]">Reserva</div><div className="text-lg"><Money centavos={resumo.reservaCentavos} sinal /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Orçado</div><div className="text-lg"><Money centavos={resumo.totalOrcadoCentavos} /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Gasto</div><div className="text-lg"><Money centavos={resumo.totalGastoCentavos} /></div></div>
        </div>
      </Card>

      {/* categorias */}
      <div className="flex flex-col gap-3">
        {cats.map((c) => {
          const pct = pctPorCat.get(c.id) ?? 0;
          const item = itemPorCat.get(c.id);
          const limite = item?.limiteCentavos ?? 0;
          const gasto = gastoPorCategoria[c.id] ?? 0;
          const usado = item?.pctUsado ?? 0;
          const cor = usado > 100 ? "var(--negativo)" : usado > 85 ? "#f08c00" : "var(--accent)";
          return (
            <Card key={c.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-medium text-[var(--text)]">{c.nome}</span>
                <PercentualEditor categoriaId={c.id} percentual={pct} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, usado)}%`, background: cor }} />
              </div>
              <div className="mt-2 flex justify-between text-sm text-[var(--muted)]">
                <span>Gasto <Money centavos={gasto} tamanho="sm" /> de <Money centavos={limite} tamanho="sm" /></span>
                <span>{limite > 0 ? <>Resta <Money centavos={limite - gasto} tamanho="sm" sinal /></> : "sem limite"}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → verde. Inspecionar `/orcamento`.

```bash
git add "src/app/(app)/orcamento/page.tsx" src/components/orcamento/RendaEditor.tsx src/components/orcamento/PercentualEditor.tsx src/components/shell/TabBar.tsx
git commit -m "feat(orcamento): tela de orçamento com renda, % por categoria e progresso"
```

---

## Self-Review (autor)

**Cobertura:** renda base → `households.renda_mensal_centavos` + RendaEditor + API renda. % por categoria → `budgets` + PercentualEditor + API categoria. Limite = %×renda → `limiteCategoria`. Progresso/alocado/reserva → `resumoOrcamento` + tela. Tab bar → Task 3 Step 1. Compartilhado (casal) → RLS household-scoped, sem por-pessoa. ✅

**Placeholders:** nenhum; código completo em cada passo.

**Consistência de tipos:** `limiteCategoria(rendaCentavos, percentual)`, `resumoOrcamento({rendaCentavos, budgets, gastoPorCategoria})`, `ItemOrcamento`, `ResumoOrcamento`, `Budget` — consistentes entre lógica, API e tela.

**Nota:** migration 0006 e os tipos (`Budget`, renda em `Household`) já foram aplicados/escritos pelo controlador; a Task 1 começa direto pela lógica.
