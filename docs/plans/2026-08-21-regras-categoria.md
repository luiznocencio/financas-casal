# Aprender categorização (editar lançamento + regras) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Editar categoria e descrição de um lançamento (inclusive depois de importar a fatura); ao ajustar, o app **aprende** uma regra `descrição normalizada → categoria (+ nome preferido)` do casal, **aplica retroativamente** aos lançamentos existentes com o mesmo nome, e **pré-preenche** nas próximas importações.

**Architecture:** Tabela `category_rules` (migration 0008, já aplicada). Casamento **exato normalizado** (minúsculas, espaços colapsados). Lógica pura `normalizeDescricao` (TDD). `PATCH /api/transactions/[id]` atualiza o lançamento, faz upsert da regra e aplica retroativamente. `analisar` (import) pré-preenche categoria+nome pelas regras. Extrato ganha edição inline por linha.

**Tech Stack:** Next.js 16, Supabase (RLS household), Tailwind, TS, vitest.

## Global Constraints

- **household_id sempre do membro logado** (`getMembroAtual`); RLS já cobre `category_rules` e `transactions`.
- **Casamento = exato normalizado:** `normalizeDescricao(descricao)` (minúsculas, `trim`, `\s+`→" "). Nada de fuzzy/contains.
- **Retroativo:** ao criar/atualizar uma regra, aplicar a TODOS os lançamentos do household cujo `normalizeDescricao(descricao)` bate com a chave (categoria + nome preferido).
- **Revisão obrigatória na importação:** as regras só PRÉ-preenchem a tabela de revisão; o usuário ainda confirma.
- Dinheiro em centavos; cores via `var(--token)`; ícones `@phosphor-icons/react` (client entry).
- Não quebrar fases anteriores; `npx vitest run` verde + novos testes.
- Verificação: `npm run build` + `npx vitest run`; controlador roda /code-review.

## File Structure

```
src/lib/financeiro/descricao.ts          # normalizeDescricao (puro, TDD)
src/lib/financeiro/descricao.test.ts
src/lib/db/tipos.ts                      # CategoryRule (JÁ FEITO pelo controlador)
src/app/api/transactions/[id]/route.ts   # PATCH: edita + aprende regra + retroativo
src/lib/ai/lancamento.ts (não muda)
src/app/api/importar/analisar/route.ts   # aplica regras (prefill categoria + nome)
src/components/lancamentos/LinhaEditavel.tsx # NOVO (edição inline no Extrato)
src/app/(app)/lancamentos/page.tsx       # usa LinhaEditavel + passa categorias
```

---

### Task 1: `normalizeDescricao` (puro, TDD)

**Files:**
- Create: `src/lib/financeiro/descricao.ts`, `src/lib/financeiro/descricao.test.ts`

**Interfaces:** `normalizeDescricao(s: string): string`.

- [ ] **Step 1: Teste que falha**

`src/lib/financeiro/descricao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeDescricao } from "./descricao";

describe("normalizeDescricao", () => {
  it("minúsculas, trim e colapsa espaços", () => {
    expect(normalizeDescricao("  NETFLIX ")).toBe("netflix");
    expect(normalizeDescricao("IFOOD  *  Restaurante")).toBe("ifood * restaurante");
    expect(normalizeDescricao("Mercado\tLivre")).toBe("mercado livre");
  });
  it("lida com vazio/undefined", () => {
    expect(normalizeDescricao("")).toBe("");
    // @ts-expect-error teste de robustez
    expect(normalizeDescricao(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Rodar (falha) e implementar**

Run: `npx vitest run src/lib/financeiro/descricao.test.ts` → FAIL.

`src/lib/financeiro/descricao.ts`:

```ts
export function normalizeDescricao(s: string): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}
```

Run de novo → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro/descricao.ts src/lib/financeiro/descricao.test.ts
git commit -m "feat(regras): normalizeDescricao (casamento exato normalizado)"
```

---

### Task 2: PATCH lançamento + aprende regra + retroativo

**Files:**
- Create: `src/app/api/transactions/[id]/route.ts`

**Interfaces:** `PATCH /api/transactions/[id]` body `{ descricao: string | null, categoria_id: string | null }`.

- [ ] **Step 1: Implementar a rota**

`src/app/api/transactions/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { normalizeDescricao } from "@/lib/financeiro/descricao";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const descricao: string | null = typeof body.descricao === "string" ? body.descricao : null;
  const categoria_id: string | null = body.categoria_id ?? null;
  const supabase = await createServerSupabase();

  // descrição atual (base da regra — o texto que reaparece nas faturas)
  const { data: atual } = await supabase.from("transactions").select("descricao").eq("id", id).maybeSingle();
  if (!atual) return NextResponse.json({ error: "lançamento inexistente" }, { status: 400 });

  // atualiza o próprio lançamento
  const { error: errUp } = await supabase.from("transactions").update({ descricao, categoria_id }).eq("id", id);
  if (errUp) return NextResponse.json({ error: errUp.message }, { status: 500 });

  // aprende a regra e aplica retroativamente
  const chave = normalizeDescricao(atual.descricao ?? descricao ?? "");
  let aplicadas = 0;
  if (categoria_id && chave) {
    await supabase.from("category_rules").upsert(
      { household_id: membro.household_id, chave, categoria_id, descricao_preferida: descricao },
      { onConflict: "household_id,chave" },
    );
    // retroativo: todos os lançamentos do household que casam pela chave
    const { data: todos } = await supabase.from("transactions").select("id, descricao");
    const idsCasando = (todos ?? [])
      .filter((t) => t.id !== id && normalizeDescricao(t.descricao ?? "") === chave)
      .map((t) => t.id);
    if (idsCasando.length > 0) {
      const patch: { categoria_id: string; descricao?: string } = { categoria_id };
      if (descricao) patch.descricao = descricao;
      await supabase.from("transactions").update(patch).in("id", idsCasando);
      aplicadas = idsCasando.length;
    }
  }
  return NextResponse.json({ ok: true, aplicadas });
}
```

- [ ] **Step 2: Verificar + commit**

Run: `npm run build` → conclui.

```bash
git add "src/app/api/transactions/[id]/route.ts"
git commit -m "feat(regras): PATCH lançamento aprende regra + aplica retroativamente"
```

---

### Task 3: Aplicar regras na importação (analisar)

**Files:**
- Modify: `src/app/api/importar/analisar/route.ts`

- [ ] **Step 1: Pré-preencher categoria/nome pelas regras**

Alterar `analisar` para, depois de `interpretarImportacao`, carregar as regras do household e mapear cada linha: se `normalizeDescricao(linha.descricao)` casar com uma regra, setar `categoria_id` (da regra) e trocar `descricao` pela `descricao_preferida` (se houver). Requer auth (já tem). Retornar as linhas com o campo extra `categoria_id`.

```ts
import { NextResponse } from "next/server";
import { interpretarImportacao } from "@/lib/importacao/extrair";
import { chamarModeloJson } from "@/lib/ai/openai";
import { getMembroAtual } from "@/lib/auth/household";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeDescricao } from "@/lib/financeiro/descricao";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    const linhas = await interpretarImportacao(texto, chamarModeloJson);

    // aplica regras aprendidas (casamento exato normalizado)
    const supabase = await createServerSupabase();
    const { data: regras } = await supabase.from("category_rules").select("chave, categoria_id, descricao_preferida");
    const porChave = new Map((regras ?? []).map((r) => [r.chave, r]));

    const comRegra = linhas.map((l) => {
      const regra = porChave.get(normalizeDescricao(l.descricao));
      if (!regra) return { ...l, categoria_id: null as string | null };
      return {
        ...l,
        descricao: regra.descricao_preferida || l.descricao,
        categoria_id: regra.categoria_id as string | null,
      };
    });

    return NextResponse.json({ ok: true, linhas: comRegra });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
```

- [ ] **Step 2: Importador usa o categoria_id retornado**

Em `src/components/importar/Importador.tsx`, no `analisar`, ao montar as linhas de revisão, usar o `categoria_id` retornado em vez de forçar `null`:

trocar `categoria_id: null` por `categoria_id: (l as { categoria_id?: string | null }).categoria_id ?? null` no `.map(...)`. (Só essa linha muda; o resto do fluxo é igual.)

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → verde.

```bash
git add src/app/api/importar/analisar/route.ts src/components/importar/Importador.tsx
git commit -m "feat(regras): importação pré-preenche categoria/nome pelas regras aprendidas"
```

---

### Task 4: Editar lançamento no Extrato (inline)

**Files:**
- Create: `src/components/lancamentos/LinhaEditavel.tsx`
- Modify: `src/app/(app)/lancamentos/page.tsx`

**Interfaces:** `<LinhaEditavel tx categorias membros />` — mostra a linha; um lápis abre edição de descrição + categoria; salva via `PATCH /api/transactions/[id]`.

- [ ] **Step 1: `LinhaEditavel.tsx` (client)**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { Money } from "@/components/ui/Money";
import { PersonChip } from "@/components/ui/PersonChip";
import { Button } from "@/components/ui/Button";

type Tx = {
  id: string; descricao: string | null; data_compra: string; pessoa: string;
  parcela_n: number; total_parcelas: number; tipo: string; valor_centavos: number;
  categoria_id: string | null;
};

export function LinhaEditavel({
  tx, categorias, membros,
}: { tx: Tx; categorias: { id: string; nome: string }[]; membros: string[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(tx.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState(tx.categoria_id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      body: JSON.stringify({ descricao: descricao || null, categoria_id: categoriaId || null }),
    }).then((x) => x.json()).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setAviso("Não foi possível salvar."); return; }
    setEditando(false);
    router.refresh();
  }

  const valorSinal = tx.tipo === "receita" ? tx.valor_centavos : -tx.valor_centavos;

  if (!editando) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
        <div className="flex min-w-0 flex-col gap-1">
          <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 text-left text-[var(--text)]">
            {tx.descricao ?? "(sem descrição)"} <PencilSimple size={13} className="text-[var(--muted)]" />
          </button>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>{tx.data_compra}</span>
            <PersonChip nome={tx.pessoa} membros={membros} />
            {tx.total_parcelas > 1 && <span>{tx.parcela_n}/{tx.total_parcelas}</span>}
          </div>
        </div>
        <Money centavos={valorSinal} sinal />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--border)] py-3 last:border-b-0">
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]" />
      <div className="flex items-center gap-2">
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]">
          <option value="">Sem categoria</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <Button variant="primary" onClick={salvar} disabled={salvando}>Salvar</Button>
        <Button variant="quiet" onClick={() => setEditando(false)}>Cancelar</Button>
      </div>
      {aviso && <p className="text-sm text-[var(--negativo)]">{aviso}</p>}
    </li>
  );
}
```

- [ ] **Step 2: `lancamentos/page.tsx` usa `LinhaEditavel`**

- Adicionar `categoria_id` ao `select` das transações (hoje pega `*`? conferir; garantir que `categoria_id`, `tipo`, `parcela_n`, `total_parcelas`, `pessoa`, `data_compra`, `valor_centavos`, `descricao` venham).
- Buscar `categories` (id, nome) e `members` (nome) além das transações.
- Trocar o `<li>` atual pela renderização `<LinhaEditavel tx={t} categorias={categorias} membros={membros} />` dentro do `<ul>`/`<Card>`. Manter os filtros e o cabeçalho (incl. o link "Importar").

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → verde. Inspecionar `/lancamentos`.

```bash
git add src/components/lancamentos/LinhaEditavel.tsx "src/app/(app)/lancamentos/page.tsx"
git commit -m "feat(regras): editar categoria/descrição do lançamento no Extrato"
```

---

## Self-Review (autor)

**Cobertura:** editar lançamento (categoria+descrição) → Task 4 (UI) + Task 2 (PATCH). Aprender regra → Task 2 (upsert). Retroativo → Task 2 (aplica aos existentes que casam). Pré-preencher na importação → Task 3. Casamento exato normalizado → Task 1 (`normalizeDescricao`) usado em 2 e 3. ✅

**Consistência:** `normalizeDescricao` é a única definição de casamento (usada no PATCH e no analisar). Chave da regra = `normalizeDescricao(descrição original)`. `CategoryRule` no tipos.

**Placeholders:** nenhum; código concreto por passo.

**Riscos:** o retroativo busca todos os lançamentos do household e filtra em JS (ok para o volume de um casal). A chave usa a descrição ATUAL (antes da edição) como base, que é o texto que reaparece nas faturas — então renomear + categorizar ensina `raw → (categoria, nome preferido)` e casa nas próximas.
