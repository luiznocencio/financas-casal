# Fase 4 — Importação (texto/CSV via GPT) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Importar lançamentos em lote a partir de texto/CSV colado (extrato ou fatura): o GPT extrai a lista, o usuário escolhe a origem (cartão/conta), revisa numa tabela (com aviso de duplicados) e confirma — criando as transações em lote (reusando a lógica de parcelas/fatura). PDF fica para uma leva futura.

**Architecture:** Sem tabela nova (importação só cria `transactions`). Lógica pura em `src/lib/importacao/` (extração via GPT com modelo injetável + detecção de duplicados). Refatoração: extrair `persistirLancamento` da rota `/api/transactions` para `src/lib/financeiro/persistir.ts`, reusado pela rota single E pelo import em lote. API em `src/app/api/importar/*`. Tela `/importar` (link a partir do Extrato).

**Tech Stack:** Next.js 16, Supabase, OpenAI (`chamarModeloJson` já existe), Tailwind, TypeScript, vitest.

## Global Constraints

- **Dinheiro em centavos** (int). **IA opcional com fallback:** se o GPT falhar, a análise retorna erro amigável (a tela mostra e permite tentar de novo) — nunca 500 silencioso.
- **household_id sempre do membro logado** (`getMembroAtual`), nunca do body. RLS já cobre `transactions`.
- **Revisão obrigatória:** nada é gravado sem o usuário confirmar na tabela de revisão.
- **Reuso:** o import em lote DEVE reusar a mesma persistência de um lançamento (parcelas/fatura) — extrair `persistirLancamento` e usar nos dois lugares (não duplicar a lógica de invoice-upsert).
- **Testes de IA são offline:** `interpretarImportacao` recebe a função de modelo por injeção; os testes usam um fake, sem chamada real à OpenAI.
- Não alterar Fases 1–3. `npx vitest run` deve permanecer verde + novos testes.
- Verificação: `npm run build` + `npx vitest run`; o controlador roda /code-review antes do push.

## File Structure

```
src/lib/importacao/extrair.ts          # interpretarImportacao(texto, ctx, chamarModelo) (puro, injetável)
src/lib/importacao/extrair.test.ts
src/lib/importacao/duplicados.ts       # marcarDuplicados(linhas, existentes) (puro)
src/lib/importacao/duplicados.test.ts
src/lib/financeiro/persistir.ts        # persistirLancamento(supabase, ctx, novo) — extraído da rota
src/lib/financeiro/persistir.test.ts   # (mapearRegistros já testa o mapeamento; aqui só o plano de linhas)
src/app/api/transactions/route.ts      # passa a usar persistirLancamento (refactor)
src/app/api/importar/analisar/route.ts # POST: texto -> lista extraída (GPT)
src/app/api/importar/confirmar/route.ts# POST: array -> cria em lote (persistirLancamento)
src/app/(app)/importar/page.tsx        # tela (server: carrega cartões/contas/categorias/membros)
src/components/importar/Importador.tsx # client: colar/upload, analisar, revisar, confirmar
src/app/(app)/lancamentos/page.tsx     # + link "Importar"
```

---

### Task 1: Extração via GPT + detecção de duplicados (puro, TDD)

**Files:**
- Create: `src/lib/importacao/extrair.ts`, `src/lib/importacao/extrair.test.ts`
- Create: `src/lib/importacao/duplicados.ts`, `src/lib/importacao/duplicados.test.ts`

**Interfaces:**
- Produces: `type LinhaImportada = { data: string; descricao: string; valor_centavos: number; tipo: "despesa" | "receita"; total_parcelas: number }`
- Produces: `interpretarImportacao(texto: string, chamarModelo: (prompt: string) => Promise<string>): Promise<LinhaImportada[]>`
- Produces: `marcarDuplicados(linhas: LinhaImportada[], existentes: { data_compra: string; valor_centavos: number }[]): (LinhaImportada & { duplicada: boolean })[]`

- [ ] **Step 1: Teste de `interpretarImportacao` (modelo fake)**

`src/lib/importacao/extrair.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { interpretarImportacao } from "./extrair";

describe("interpretarImportacao", () => {
  it("mapeia os lançamentos do JSON do modelo para centavos", async () => {
    const modeloFake = async () => JSON.stringify({
      lancamentos: [
        { data: "2026-03-05", descricao: "Mercado X", valor_reais: 250.5, tipo: "despesa", total_parcelas: 1 },
        { data: "2026-03-06", descricao: "Tênis 3x", valor_reais: 300, tipo: "despesa", total_parcelas: 3 },
        { data: "2026-03-10", descricao: "Salário", valor_reais: 4200, tipo: "receita", total_parcelas: 1 },
      ],
    });
    const linhas = await interpretarImportacao("qualquer texto", modeloFake);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toEqual({ data: "2026-03-05", descricao: "Mercado X", valor_centavos: 25050, tipo: "despesa", total_parcelas: 1 });
    expect(linhas[1].total_parcelas).toBe(3);
    expect(linhas[2].tipo).toBe("receita");
  });

  it("ignora linhas sem valor ou data válidos", async () => {
    const modeloFake = async () => JSON.stringify({
      lancamentos: [
        { data: "2026-03-05", descricao: "ok", valor_reais: 10, tipo: "despesa", total_parcelas: 1 },
        { data: "", descricao: "sem data", valor_reais: 10, tipo: "despesa", total_parcelas: 1 },
        { data: "2026-03-06", descricao: "sem valor", valor_reais: 0, tipo: "despesa", total_parcelas: 1 },
      ],
    });
    const linhas = await interpretarImportacao("x", modeloFake);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].descricao).toBe("ok");
  });

  it("lança erro quando o modelo devolve JSON inválido", async () => {
    await expect(interpretarImportacao("x", async () => "nao é json")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/importacao/extrair.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `extrair.ts`**

```ts
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";

export type LinhaImportada = {
  data: string;
  descricao: string;
  valor_centavos: number;
  tipo: "despesa" | "receita";
  total_parcelas: number;
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function montarPrompt(texto: string): string {
  return [
    "Extraia os lançamentos financeiros deste extrato/fatura (texto colado, pode ser CSV).",
    "Responda APENAS JSON no formato:",
    '{"lancamentos":[{"data":"YYYY-MM-DD","descricao":string,"valor_reais":number,"tipo":"despesa|receita","total_parcelas":number}]}',
    "Regras: valor_reais sempre positivo; tipo 'receita' para créditos/entradas, 'despesa' para o resto;",
    "se a descrição indicar parcela (ex.: '3/12'), total_parcelas = 12, senão 1; data no formato YYYY-MM-DD.",
    "Texto:",
    texto,
  ].join("\n");
}

export async function interpretarImportacao(
  texto: string,
  chamarModelo: (prompt: string) => Promise<string>,
): Promise<LinhaImportada[]> {
  const bruto = await chamarModelo(montarPrompt(texto));
  let obj: { lancamentos?: unknown };
  try {
    obj = JSON.parse(bruto);
  } catch {
    throw new Error("resposta do modelo não é JSON válido");
  }
  const lista = Array.isArray(obj.lancamentos) ? obj.lancamentos : [];
  const linhas: LinhaImportada[] = [];
  for (const item of lista as Record<string, unknown>[]) {
    const data = typeof item.data === "string" ? item.data : "";
    const valorReais = typeof item.valor_reais === "number" ? item.valor_reais : 0;
    if (!DATA_ISO.test(data) || valorReais <= 0) continue;
    linhas.push({
      data,
      descricao: typeof item.descricao === "string" ? item.descricao : "",
      valor_centavos: reaisParaCentavos(valorReais),
      tipo: item.tipo === "receita" ? "receita" : "despesa",
      total_parcelas: typeof item.total_parcelas === "number" && item.total_parcelas >= 1
        ? Math.floor(item.total_parcelas) : 1,
    });
  }
  return linhas;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/importacao/extrair.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste de `marcarDuplicados`**

`src/lib/importacao/duplicados.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { marcarDuplicados } from "./duplicados";

const linhas = [
  { data: "2026-03-05", descricao: "Mercado", valor_centavos: 25000, tipo: "despesa" as const, total_parcelas: 1 },
  { data: "2026-03-06", descricao: "Uber", valor_centavos: 3000, tipo: "despesa" as const, total_parcelas: 1 },
];

describe("marcarDuplicados", () => {
  it("marca linha que bate data+valor com um existente", () => {
    const r = marcarDuplicados(linhas, [{ data_compra: "2026-03-05", valor_centavos: 25000 }]);
    expect(r[0].duplicada).toBe(true);
    expect(r[1].duplicada).toBe(false);
  });
  it("sem existentes, nada é duplicado", () => {
    const r = marcarDuplicados(linhas, []);
    expect(r.every((l) => !l.duplicada)).toBe(true);
  });
});
```

- [ ] **Step 6: Rodar (falha) e implementar `duplicados.ts`**

Run: `npx vitest run src/lib/importacao/duplicados.test.ts` → FAIL.

```ts
import type { LinhaImportada } from "./extrair";

export function marcarDuplicados(
  linhas: LinhaImportada[],
  existentes: { data_compra: string; valor_centavos: number }[],
): (LinhaImportada & { duplicada: boolean })[] {
  const chaves = new Set(existentes.map((e) => `${e.data_compra}|${e.valor_centavos}`));
  return linhas.map((l) => ({ ...l, duplicada: chaves.has(`${l.data}|${l.valor_centavos}`) }));
}
```

Run: `npx vitest run src/lib/importacao/duplicados.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/importacao
git commit -m "feat(importacao): extração via GPT + detecção de duplicados (puro, TDD)"
```

---

### Task 2: Extrair `persistirLancamento` (reuso entre single e lote)

**Files:**
- Create: `src/lib/financeiro/persistir.ts`
- Modify: `src/app/api/transactions/route.ts` (usar a função extraída)

**Interfaces:**
- Consumes: `planejarLinhas`, `mapearRegistros` (já existem), tipo `NovoLancamento`.
- Produces: `persistirLancamento(supabase, ctx: { householdId: string; criadoPor: string }, l: NovoLancamento): Promise<{ error: string | null }>`.

- [ ] **Step 1: Criar `persistir.ts` com a lógica hoje inline na rota**

`src/lib/financeiro/persistir.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { planejarLinhas } from "./planejar";
import { mapearRegistros } from "./registros";
import type { NovoLancamento } from "./tipos";

export async function persistirLancamento(
  supabase: SupabaseClient,
  ctx: { householdId: string; criadoPor: string },
  l: NovoLancamento,
): Promise<{ error: string | null }> {
  // dia de fechamento do cartão (se for cartão)
  let diaFechamento: number | null = null;
  if (l.card_id) {
    const { data: card } = await supabase.from("cards").select("dia_fechamento").eq("id", l.card_id).single();
    if (!card) return { error: "cartão inexistente" };
    diaFechamento = card.dia_fechamento;
  }
  if (l.account_id) {
    const { data: conta } = await supabase.from("accounts").select("id").eq("id", l.account_id).maybeSingle();
    if (!conta) return { error: "conta inexistente" };
  }

  const linhas = planejarLinhas(l, diaFechamento);

  const invoiceIdPorComp = new Map<string, string>();
  for (const linha of linhas) {
    if (!linha.invoiceCompetencia || !l.card_id) continue;
    const chave = `${linha.invoiceCompetencia.ano}-${linha.invoiceCompetencia.mes}`;
    if (invoiceIdPorComp.has(chave)) continue;
    const { data: inv, error: invoiceError } = await supabase
      .from("invoices")
      .upsert(
        {
          household_id: ctx.householdId, card_id: l.card_id,
          competencia_ano: linha.invoiceCompetencia.ano,
          competencia_mes: linha.invoiceCompetencia.mes,
        },
        { onConflict: "card_id,competencia_ano,competencia_mes" },
      )
      .select("id").single();
    if (invoiceError || !inv) return { error: "falha ao gerar fatura" };
    invoiceIdPorComp.set(chave, inv.id);
  }

  const registros = mapearRegistros(linhas, invoiceIdPorComp, {
    householdId: ctx.householdId, criadoPor: ctx.criadoPor, origemIa: l.origem_ia ?? false,
  });
  const { error } = await supabase.from("transactions").insert(registros);
  return { error: error ? error.message : null };
}
```

- [ ] **Step 2: Refatorar `route.ts` para usar `persistirLancamento`**

Substituir o corpo de persistência (do `planejarLinhas` até o insert) por:

```ts
const { error } = await persistirLancamento(supabase, { householdId: membro.household_id, criadoPor: membro.user_id }, l);
if (error) {
  const status = error.includes("inexistente") ? 400 : 500;
  return NextResponse.json({ error }, { status });
}
return NextResponse.json({ ok: true });
```

Mantenha as validações de topo (membro, clamp de total_parcelas, valor > 0) que já existem. Importar `persistirLancamento` de `@/lib/financeiro/persistir`. Remover imports não usados (planejarLinhas/mapearRegistros) da rota.

- [ ] **Step 3: Verificar (nada quebra) + commit**

Run: `npx vitest run` → segue verde; `npm run build` → conclui.

```bash
git add src/lib/financeiro/persistir.ts src/app/api/transactions/route.ts
git commit -m "refactor: extrai persistirLancamento (reuso p/ import em lote)"
```

---

### Task 3: API — analisar (GPT) e confirmar (lote)

**Files:**
- Create: `src/app/api/importar/analisar/route.ts`
- Create: `src/app/api/importar/confirmar/route.ts`

**Interfaces:**
- Consumes: `interpretarImportacao`, `chamarModeloJson` (`@/lib/ai/openai`), `getMembroAtual`, `persistirLancamento`.
- Produces: `POST /api/importar/analisar` {texto} → `{ ok: true, linhas } | { ok: false }`. `POST /api/importar/confirmar` {origem, linhas[]} → `{ criadas, falhas }`.

- [ ] **Step 1: Rota de análise (GPT)**

`src/app/api/importar/analisar/route.ts`:

```ts
import { NextResponse } from "next/server";
import { interpretarImportacao } from "@/lib/importacao/extrair";
import { chamarModeloJson } from "@/lib/ai/openai";

export async function POST(req: Request) {
  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    const linhas = await interpretarImportacao(texto, chamarModeloJson);
    return NextResponse.json({ ok: true, linhas });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
```

- [ ] **Step 2: Rota de confirmação (lote)**

`src/app/api/importar/confirmar/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import type { NovoLancamento } from "@/lib/financeiro/tipos";

type ItemImport = {
  data: string; descricao: string; valor_centavos: number;
  tipo: "despesa" | "receita"; total_parcelas: number;
  categoria_id: string | null; pessoa: string;
};

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const origem: { card_id?: string; account_id?: string } = body.origem ?? {};
  const itens: ItemImport[] = Array.isArray(body.linhas) ? body.linhas : [];
  if (!origem.card_id && !origem.account_id) return NextResponse.json({ error: "origem inválida" }, { status: 400 });

  const supabase = await createServerSupabase();
  let criadas = 0;
  const falhas: string[] = [];
  for (const it of itens) {
    if (!(it.valor_centavos > 0)) { falhas.push(it.descricao || "(sem descrição)"); continue; }
    const novo: NovoLancamento = {
      tipo: it.tipo, valor_centavos: it.valor_centavos, data_compra: it.data,
      categoria_id: it.categoria_id ?? null, pessoa: it.pessoa,
      account_id: origem.account_id ?? null, card_id: origem.card_id ?? null,
      total_parcelas: origem.card_id ? Math.min(72, Math.max(1, it.total_parcelas || 1)) : 1,
      descricao: it.descricao, origem_ia: true,
    };
    const { error } = await persistirLancamento(supabase, { householdId: membro.household_id, criadoPor: membro.user_id }, novo);
    if (error) falhas.push(it.descricao || "(sem descrição)");
    else criadas++;
  }
  return NextResponse.json({ criadas, falhas });
}
```

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui.

```bash
git add src/app/api/importar
git commit -m "feat(importacao): API analisar (GPT) e confirmar (lote)"
```

---

### Task 4: Tela `/importar` + link no Extrato

**Files:**
- Create: `src/app/(app)/importar/page.tsx`
- Create: `src/components/importar/Importador.tsx`
- Modify: `src/app/(app)/lancamentos/page.tsx` (link "Importar")

**Interfaces:**
- Consumes: `Money`, `Card`, `Button`, `Field`; `POST /api/importar/analisar`, `POST /api/importar/confirmar`.

- [ ] **Step 1: Página (server) carrega origens e categorias**

`src/app/(app)/importar/page.tsx`:

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { Importador } from "@/components/importar/Importador";

export default async function ImportarPage() {
  const supabase = await createServerSupabase();
  const [{ data: cartoes }, { data: contas }, { data: categorias }, { data: membros }] = await Promise.all([
    supabase.from("cards").select("id, nome").order("nome"),
    supabase.from("accounts").select("id, nome").order("nome"),
    supabase.from("categories").select("id, nome"),
    supabase.from("members").select("nome"),
  ]);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Importar lançamentos</h1>
      <Importador
        cartoes={cartoes ?? []} contas={contas ?? []}
        categorias={categorias ?? []} membros={(membros ?? []).map((m) => m.nome)}
      />
    </main>
  );
}
```

- [ ] **Step 2: Componente client `Importador`**

`src/components/importar/Importador.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Linha = {
  data: string; descricao: string; valor_centavos: number;
  tipo: "despesa" | "receita"; total_parcelas: number;
  categoria_id: string | null; pessoa: string; incluir: boolean; duplicada?: boolean;
};

export function Importador({
  cartoes, contas, categorias, membros,
}: {
  cartoes: { id: string; nome: string }[]; contas: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[]; membros: string[];
}) {
  const router = useRouter();
  const [origem, setOrigem] = useState(cartoes[0] ? `card:${cartoes[0].id}` : contas[0] ? `acc:${contas[0].id}` : "");
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(setTexto);
  }

  async function analisar() {
    setErro(null); setCarregando(true); setLinhas(null);
    try {
      const r = await fetch("/api/importar/analisar", { method: "POST", body: JSON.stringify({ texto }) }).then((x) => x.json());
      if (!r.ok) { setErro("Não consegui ler os lançamentos desse texto. Confira e tente de novo."); return; }
      setLinhas((r.linhas as Omit<Linha, "incluir" | "categoria_id" | "pessoa">[]).map((l) => ({
        ...l, incluir: true, categoria_id: null, pessoa: membros[0] ?? "conjunto",
      })));
    } catch {
      setErro("Falha ao analisar. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizar(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls!.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function confirmar() {
    if (!linhas) return;
    const [prefixo, id] = origem.split(":");
    const selecionadas = linhas.filter((l) => l.incluir).map((l) => ({
      data: l.data, descricao: l.descricao, valor_centavos: l.valor_centavos,
      tipo: l.tipo, total_parcelas: l.total_parcelas, categoria_id: l.categoria_id, pessoa: l.pessoa,
    }));
    setCarregando(true);
    const r = await fetch("/api/importar/confirmar", {
      method: "POST",
      body: JSON.stringify({ origem: { [prefixo === "card" ? "card_id" : "account_id"]: id }, linhas: selecionadas }),
    }).then((x) => x.json());
    setCarregando(false);
    setResultado(`Importados ${r.criadas ?? 0} lançamentos${r.falhas?.length ? `, ${r.falhas.length} falharam` : ""}.`);
    setLinhas(null); setTexto("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Origem dos lançamentos</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]">
              {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.nome}</option>)}
              {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>🏦 {c.nome}</option>)}
            </select>
          </label>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder="Cole aqui o extrato/fatura (ou o conteúdo do CSV)..."
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-sm text-[var(--text)]" />
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv,.txt,.ofx,text/plain" onChange={lerArquivo} className="text-sm text-[var(--muted)]" />
            <Button variant="primary" onClick={analisar} disabled={carregando || !texto}>
              {carregando ? "Analisando..." : "Analisar"}
            </Button>
          </div>
          {erro && <p className="text-sm text-[var(--negativo)]">{erro}</p>}
          {resultado && <p className="text-sm text-[var(--positivo)]">{resultado}</p>}
        </div>
      </Card>

      {linhas && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-[var(--text)]">{linhas.length} lançamentos encontrados</span>
            <Button variant="primary" onClick={confirmar} disabled={carregando}>
              Importar {linhas.filter((l) => l.incluir).length}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {linhas.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <input type="checkbox" checked={l.incluir} onChange={(e) => atualizar(i, { incluir: e.target.checked })} />
                <span className="w-20 text-[var(--muted)]">{l.data}</span>
                <input value={l.descricao} onChange={(e) => atualizar(i, { descricao: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]" />
                <select value={l.categoria_id ?? ""} onChange={(e) => atualizar(i, { categoria_id: e.target.value || null })}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-1 text-[var(--text)]">
                  <option value="">—</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <span className="mono w-24 text-right">{centavosParaReais(l.valor_centavos)}</span>
                {l.duplicada && <span className="text-xs text-[var(--negativo)]">possível duplicado</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

> Nota: a marcação de duplicados (`duplicada`) é opcional no MVP da tela — a rota `analisar` pode não retornar `duplicada`; o campo já está previsto no tipo para quando for ligado. Não bloquear a task por isso.

- [ ] **Step 3: Link "Importar" no Extrato**

Em `src/app/(app)/lancamentos/page.tsx`, no cabeçalho, adicionar um `<Link href="/importar" className="text-sm text-[var(--accent)]">Importar</Link>` ao lado do título.

- [ ] **Step 4: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → verde. Inspecionar `/importar`.

```bash
git add "src/app/(app)/importar/page.tsx" src/components/importar/Importador.tsx "src/app/(app)/lancamentos/page.tsx"
git commit -m "feat(importacao): tela de importar (colar/upload, revisar, confirmar)"
```

---

## Self-Review (autor)

**Cobertura:** GPT extrai do texto → `interpretarImportacao` + rota analisar. Escolha de origem + revisão editável + confirmar em lote → `Importador` + rota confirmar. Reuso da lógica de parcelas/fatura → `persistirLancamento` (extraído, usado por single e lote). Duplicados → `marcarDuplicados` (pronto; fiação na tela é opcional no MVP). Sem PDF (deferido). Sem tabela nova. ✅

**Placeholders:** nenhum; código completo por passo.

**Consistência de tipos:** `LinhaImportada`, `interpretarImportacao(texto, chamarModelo)`, `marcarDuplicados(linhas, existentes)`, `persistirLancamento(supabase, ctx, l)`, `NovoLancamento` — consistentes entre lógica, API e tela.

**Riscos:** (1) a rota `analisar` usa a OpenAI real — depende de `OPENAI_API_KEY` no ambiente (já configurada). (2) textos muito grandes podem estourar o contexto do modelo — aceitável no MVP; o usuário cola em partes se precisar.
