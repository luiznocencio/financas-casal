# Redesign Visual "Fintech Clean + Duotom do Casal" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar uma identidade visual "fintech clean e sóbrio" a todo o app Finanças do Casal, com a assinatura duotom do casal (cor por pessoa) e valores monetários em monospace, sem alterar nenhuma lógica de negócio.

**Architecture:** Um design system em tokens CSS (`globals.css`) + fontes via `next/font/google` (Inter + IBM Plex Mono), consumido por um conjunto pequeno de primitivos em `src/components/ui/`. Todas as telas passam a compor esses primitivos com utilitários Tailwind e as cores via `var(--token)`. Nenhuma rota de API, migration, tipo de dados ou função de `src/lib/**` muda — é redesign de apresentação apenas.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, `next/font/google`, TypeScript.

## Global Constraints

- **NÃO alterar lógica:** nada em `src/lib/**`, `src/app/api/**`, `supabase/**` muda. A suíte `npx vitest run` deve permanecer **40/40** o tempo todo.
- **Money sempre em centavos** e formatado por `centavosParaReais` (não reimplementar formatação).
- **Fontes via `next/font/google`** (self-host automático) — NUNCA `<link>` a CDN externo.
- **Theme-aware:** definir a paleta completa em `:root` (claro) e sobrescrever no bloco `@media (prefers-color-scheme: dark)`. Cor sempre via `var(--token)`, nunca hex solto em componente.
- **Cores do casal (duotom) só para IDENTIDADE de pessoa** (quem gastou / quem lançou / iniciais). NUNCA para ações ou texto comum. Verde/vermelho semânticos SÓ em valores.
- **Mobile-first**, responsivo até 360px de largura; foco de teclado visível; `prefers-reduced-motion` respeitado.
- **Verificação de cada task:** `npm run build` conclui + inspeção visual no navegador (screenshot). Sem testes unitários novos (é visual).
- **Valores monetários** renderizados na fonte mono (`var(--font-mono)`), `font-variant-numeric: tabular-nums`.
- Diretório do projeto: `E:\CODE\financas` (repo git em `main`).

---

## File Structure

```
src/app/
  layout.tsx            # wiring das fontes (Inter + IBM Plex Mono) → vars CSS
  globals.css           # tokens do design system (Task 1)
  (app)/layout.tsx      # shell: TabBar + FAB (Task 4)
  (app)/page.tsx        # dashboard (Task 5)
  (app)/cartoes/page.tsx    # (Task 6)
  (app)/contas/page.tsx     # (Task 7)
  (app)/lancamentos/page.tsx# (Task 7)
  login/page.tsx        # (Task 8)
  onboarding/page.tsx (server) + components/onboarding/OnboardingForm.tsx  # (Task 8)
src/components/ui/
  Money.tsx             # restyle mono (Task 2)
  Card.tsx              # restyle (Task 2)
  Button.tsx            # restyle + tamanhos (Task 2)
  Field.tsx             # NOVO input rotulado (Task 3)
  StatTile.tsx          # NOVO tile de métrica (Task 3)
  PersonChip.tsx        # NOVO avatar/chip por pessoa (Task 3)
  SplitBar.tsx          # NOVO barra duotom "quem gastou" — ASSINATURA (Task 3)
src/components/shell/
  TabBar.tsx            # NOVO navegação inferior + FAB (Task 4)
src/lib/ui/
  pessoas.ts            # NOVO: cor por pessoa (helper puro) (Task 3)
```

---

### Task 1: Fontes + tokens do design system

**Files:**
- Modify: `src/app/layout.tsx` (wiring das fontes)
- Modify: `src/app/globals.css` (tokens)

**Interfaces:**
- Produces (CSS vars no `:root`): `--bg --surface --surface-2 --text --muted --border --accent --accent-weak --positivo --negativo --pessoa-a --pessoa-b --pessoa-conjunto --radius --radius-sm --shadow --font-sans --font-mono`.

- [ ] **Step 1: Wiring das fontes em `src/app/layout.tsx`**

Importe as fontes e exponha como variáveis CSS no `<body>`. Substitua o bloco de fontes atual (Geist) por:

```tsx
import { Inter, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono", display: "swap" });
```

E no JSX aplique `className={`${inter.variable} ${mono.variable}`}` no `<html>` (mantenha `lang="pt-BR"`). Remova imports de Geist se existirem.

- [ ] **Step 2: Substituir os tokens em `src/app/globals.css`**

Mantenha o `@import "tailwindcss";` (ou o que o projeto já usa no topo). Substitua o bloco de tokens/`:root` atual por:

```css
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #f1f3f6;
  --text: #0e1116;
  --muted: #6b7280;
  --border: #e6e8ec;
  --accent: #3b5bdb;
  --accent-weak: #eaeefd;
  --positivo: #12915b;
  --negativo: #d23b3b;
  --pessoa-a: #0e9aa7;   /* 1º membro */
  --pessoa-b: #e8833a;   /* 2º membro */
  --pessoa-conjunto: #8a94a6;
  --radius: 14px;
  --radius-sm: 10px;
  --shadow: 0 1px 2px rgba(16,17,22,.05), 0 6px 20px rgba(16,17,22,.05);
  --font-sans: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
  --font-mono: var(--font-mono, ui-monospace, monospace);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0c0e12;
    --surface: #14171d;
    --surface-2: #1a1e25;
    --text: #eaecef;
    --muted: #98a1ae;
    --border: #242832;
    --accent: #6b86ff;
    --accent-weak: #1b2740;
    --positivo: #3ecf8e;
    --negativo: #ff6b6b;
    --pessoa-a: #35c4cf;
    --pessoa-b: #f2a35f;
    --pessoa-conjunto: #9aa4b2;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 6px 20px rgba(0,0,0,.35);
  }
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
.tabular { font-variant-numeric: tabular-nums; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(ui): fontes Inter/IBM Plex Mono + tokens do design system"
```

---

### Task 2: Restyle dos primitivos base (Money, Card, Button)

**Files:**
- Modify: `src/components/ui/Money.tsx`
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/Button.tsx`

**Interfaces:**
- Consumes: `centavosParaReais` (inalterado).
- Produces: `<Money centavos sinal? tamanho?>`, `<Card>`, `<Button variant tamanho>`.

- [ ] **Step 1: `Money.tsx` em monospace**

```tsx
import { centavosParaReais } from "@/lib/financeiro/dinheiro";

export function Money({
  centavos, sinal = false, tamanho = "md",
}: { centavos: number; sinal?: boolean; tamanho?: "sm" | "md" | "lg" | "xl" }) {
  const cor = !sinal ? "var(--text)" : centavos < 0 ? "var(--negativo)" : "var(--positivo)";
  const sizes = { sm: "0.8125rem", md: "0.95rem", lg: "1.5rem", xl: "2.25rem" } as const;
  return (
    <span className="mono" style={{ color: cor, fontWeight: 600, fontSize: sizes[tamanho], letterSpacing: "-0.01em" }}>
      {centavosParaReais(centavos)}
    </span>
  );
}
```

- [ ] **Step 2: `Card.tsx`**

```tsx
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        padding: "18px",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `Button.tsx` com variantes e tamanhos**

```tsx
export function Button({
  children, variant = "primary", tamanho = "md", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet"; tamanho?: "md" | "lg";
}) {
  const pad = tamanho === "lg" ? "12px 18px" : "9px 14px";
  const base: React.CSSProperties = {
    borderRadius: "var(--radius-sm)", padding: pad, fontWeight: 600,
    fontSize: tamanho === "lg" ? "1rem" : "0.9rem", cursor: "pointer",
    transition: "background .15s, border-color .15s, opacity .15s",
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
    ghost: { ...base, background: "transparent", color: "var(--text)", border: "1px solid var(--border)" },
    quiet: { ...base, background: "transparent", color: "var(--muted)", border: "1px solid transparent" },
  };
  return <button style={styles[variant]} {...props}>{children}</button>;
}
```

- [ ] **Step 4: Verificar + commit**

Run: `npm run build` → conclui. `npx vitest run` → 40/40.

```bash
git add src/components/ui/Money.tsx src/components/ui/Card.tsx src/components/ui/Button.tsx
git commit -m "feat(ui): primitivos base (Money mono, Card, Button) no novo sistema"
```

---

### Task 3: Primitivos-assinatura (pessoas, PersonChip, SplitBar) + StatTile + Field

**Files:**
- Create: `src/lib/ui/pessoas.ts`
- Create: `src/components/ui/PersonChip.tsx`
- Create: `src/components/ui/SplitBar.tsx`
- Create: `src/components/ui/StatTile.tsx`
- Create: `src/components/ui/Field.tsx`
- Test: `src/lib/ui/pessoas.test.ts`

**Interfaces:**
- Produces: `corDaPessoa(nome, membros): string` (retorna `var(--pessoa-a|b|conjunto)`).
- Produces: `<PersonChip nome membros>`, `<SplitBar itens={{nome,centavos}[]} membros>`, `<StatTile rotulo valorCentavos sinal? hint?>`, `<Field label ...inputProps>`.

- [ ] **Step 1: Teste puro de `corDaPessoa`**

`src/lib/ui/pessoas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { corDaPessoa } from "./pessoas";

const membros = ["Luiz", "Ana"];
describe("corDaPessoa", () => {
  it("1º membro → pessoa-a, 2º → pessoa-b", () => {
    expect(corDaPessoa("Luiz", membros)).toBe("var(--pessoa-a)");
    expect(corDaPessoa("Ana", membros)).toBe("var(--pessoa-b)");
  });
  it("conjunto ou desconhecido → cor de conjunto", () => {
    expect(corDaPessoa("conjunto", membros)).toBe("var(--pessoa-conjunto)");
    expect(corDaPessoa("Fulano", membros)).toBe("var(--pessoa-conjunto)");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/ui/pessoas.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/lib/ui/pessoas.ts`**

```ts
/** Cor de identidade da pessoa: 1º membro=a, 2º=b, resto/conjunto=conjunto. */
export function corDaPessoa(nome: string, membros: string[]): string {
  const idx = membros.indexOf(nome);
  if (idx === 0) return "var(--pessoa-a)";
  if (idx === 1) return "var(--pessoa-b)";
  return "var(--pessoa-conjunto)";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/ui/pessoas.test.ts`
Expected: PASS.

- [ ] **Step 5: `PersonChip.tsx` (avatar com inicial)**

```tsx
import { corDaPessoa } from "@/lib/ui/pessoas";

export function PersonChip({ nome, membros }: { nome: string; membros: string[] }) {
  const cor = corDaPessoa(nome, membros);
  const inicial = (nome?.[0] ?? "?").toUpperCase();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--muted)" }}>
      <span aria-hidden style={{
        width: 20, height: 20, borderRadius: 999, background: cor, color: "#fff",
        display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 700,
      }}>{inicial}</span>
      {nome}
    </span>
  );
}
```

- [ ] **Step 6: `SplitBar.tsx` — a ASSINATURA (barra duotom "quem gastou")**

```tsx
import { corDaPessoa } from "@/lib/ui/pessoas";
import { Money } from "./Money";

export function SplitBar({
  itens, membros,
}: { itens: { nome: string; centavos: number }[]; membros: string[] }) {
  const total = itens.reduce((s, i) => s + i.centavos, 0);
  if (total <= 0) {
    return <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>Nenhum gasto este mês.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
        {itens.map((i) => (
          <div key={i.nome} title={i.nome}
            style={{ width: `${(i.centavos / total) * 100}%`, background: corDaPessoa(i.nome, membros) }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {itens.map((i) => (
          <span key={i.nome} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: corDaPessoa(i.nome, membros) }} />
            <span style={{ color: "var(--muted)" }}>{i.nome}</span>
            <Money centavos={i.centavos} tamanho="sm" />
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `StatTile.tsx`**

```tsx
import { Money } from "./Money";

export function StatTile({
  rotulo, valorCentavos, sinal = false, hint,
}: { rotulo: string; valorCentavos: number; sinal?: boolean; hint?: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "14px 16px", display: "grid", gap: 4,
    }}>
      <span style={{ fontSize: "0.78rem", color: "var(--muted)", letterSpacing: "0.01em" }}>{rotulo}</span>
      <Money centavos={valorCentavos} sinal={sinal} tamanho="lg" />
      {hint && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{hint}</span>}
    </div>
  );
}
```

- [ ] **Step 8: `Field.tsx`**

```tsx
export function Field({
  label, ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{label}</span>
      <input {...props} style={{
        padding: "11px 12px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
        fontSize: "1rem", ...(props.style ?? {}),
      }} />
    </label>
  );
}
```

- [ ] **Step 9: Verificar + commit**

Run: `npx vitest run` → 42/42 (40 + 2 novos de pessoas). `npm run build` → conclui.

```bash
git add src/lib/ui/pessoas.ts src/lib/ui/pessoas.test.ts src/components/ui/PersonChip.tsx src/components/ui/SplitBar.tsx src/components/ui/StatTile.tsx src/components/ui/Field.tsx
git commit -m "feat(ui): assinatura duotom (SplitBar, PersonChip) + StatTile + Field"
```

---

### Task 4: Shell do app — TabBar inferior + FAB

**Files:**
- Create: `src/components/shell/TabBar.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `QuickAdd` (inalterado funcionalmente).
- Produces: `<TabBar>` (nav fixa inferior no mobile, topo no desktop).

- [ ] **Step 1: `TabBar.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Início" },
  { href: "/cartoes", rotulo: "Cartões" },
  { href: "/contas", rotulo: "Contas" },
  { href: "/lancamentos", rotulo: "Extrato" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-around", padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
      }}
      className="tabbar">
      {ITENS.map((it) => {
        const ativo = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href}
            style={{
              flex: 1, textAlign: "center", fontSize: "0.78rem", fontWeight: 600,
              color: ativo ? "var(--accent)" : "var(--muted)", padding: "6px 0",
            }}>
            {it.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Integrar no `(app)/layout.tsx`**

Mantenha TODAS as guardas de auth e os fetches existentes (não mexa neles). Troque a `<nav>` de texto atual por `<TabBar />` no fim, ajuste o container para dar respiro embaixo (a TabBar é fixa) e mantenha o `<QuickAdd>`:

- Remova o `<nav>` de links no topo.
- No container raiz, use `paddingBottom: 84` (espaço pra TabBar + FAB).
- Antes de `</div>` final, renderize `<TabBar />` e o `<QuickAdd ... />` já existente.

Deixe o `QuickAdd` (FAB) posicionado acima da TabBar: no `QuickAdd.tsx`, o botão "+" fixo deve ter `bottom: 76px` em vez de `20px` (ajuste só o `bottom` do botão flutuante para não colidir com a TabBar; não altere a lógica do modal).

- [ ] **Step 3: Verificar (mobile) + commit**

Run: `npm run build` → conclui. Depois, no navegador em viewport mobile (375px), `/` deve mostrar a TabBar embaixo com "Início" ativo e o "+" acima dela.

```bash
git add src/components/shell/TabBar.tsx "src/app/(app)/layout.tsx" src/components/quick-add/QuickAdd.tsx
git commit -m "feat(ui): shell com TabBar inferior e FAB reposicionado"
```

---

### Task 5: Dashboard redesenhado

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `StatTile`, `SplitBar`, `Card`, `Money` (mantém `saldoConta`, `limiteDisponivel`, `resumoDoMes`, `getMembroAtual`/queries inalterados).

- [ ] **Step 1: Redesenhar o dashboard**

Mantenha EXATAMENTE a lógica de dados atual (fetches, `saldoTotal`, `comprometido`, `resumo`, `nomeCat`, `porPessoa`, `topCategorias`, ordenações). Troque só a apresentação:

- **Cabeçalho:** o mês atual em Inter bold grande (ex.: "Agosto") + subtítulo "Visão do casal".
- **Faixa de tiles:** grid responsivo (2 colunas no mobile, 4 no desktop) de `<StatTile>`: "Saldo em contas" (`saldoTotal`, sinal), "Faturas abertas" (`comprometido`), "Despesas do mês" (`resumo.totalDespesas`), "Receitas do mês" (`resumo.totalReceitas`).
- **Assinatura — "Quem gastou":** um `<Card>` com título "Quem gastou este mês" e `<SplitBar itens={porPessoa.map(([nome,centavos])=>({nome,centavos}))} membros={membros} />`. Busque `membros` via `supabase.from("members").select("nome")` (adicione ao `Promise.all` existente, tratando `error` como as outras leituras — lançar em erro).
- **Top categorias:** `<Card>` com lista `nome … <Money>` e uma barrinha proporcional (largura = valor/maiorCategoria*100%) na cor `var(--accent)` com fundo `var(--surface-2)`.

Use utilitários Tailwind + `var(--token)` para cor (ex.: `text-[var(--muted)]`), grid com `gap`. Números sempre via `<Money>`.

- [ ] **Step 2: Verificar (visual) + build + commit**

Run: `npm run build` → conclui; `npx vitest run` → segue verde. Inspecione `/` no navegador (mobile e desktop): tiles alinhados, SplitBar duotom visível.

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat(ui): dashboard redesenhado (tiles + SplitBar do casal)"
```

---

### Task 6: Cartões redesenhado

**Files:**
- Modify: `src/app/(app)/cartoes/page.tsx`

**Interfaces:**
- Consumes: `Card`, `Money`, `Button`, `FaturaBotao` (inalterado), `agruparFaturas`, `limiteDisponivel` (inalterados).

- [ ] **Step 1: Redesenhar mantendo a lógica**

Mantenha TODA a lógica (fetch cards/txs/invoices, `linhas`, `agruparFaturas`, tratamento de erro). Apresentação:

- Cada cartão num `<Card>`: topo com nome (Inter semibold) + `titular` (muted) à esquerda, e "fecha dia X · vence dia Y" (muted, pequeno) à direita.
- **Limite:** barra fina (`h-2 rounded-full`, fundo `var(--surface-2)`, preenchimento `var(--accent)` — ou `var(--negativo)` se `pct > 85`). Abaixo, duas colunas: "Usado <Money>" e "Disponível <Money tamanho='lg'>".
- **Faturas:** lista separada por `border-top` `var(--border)`; cada linha: mês/ano + (se paga) selo "paga" em `var(--positivo)`; à direita `<Money>` + `<FaturaBotao>` (inalterado).
- Empty state consistente (Card com texto muted).

- [ ] **Step 2: Verificar + commit**

Run: `npm run build` → conclui. Inspecione `/cartoes`.

```bash
git add "src/app/(app)/cartoes/page.tsx"
git commit -m "feat(ui): cartões redesenhados (limite + faturas)"
```

---

### Task 7: Contas + Extrato redesenhados

**Files:**
- Modify: `src/app/(app)/contas/page.tsx`
- Modify: `src/app/(app)/lancamentos/page.tsx`

**Interfaces:**
- Consumes: `Card`, `Money`, `PersonChip`, `saldoConta` (inalterado).

- [ ] **Step 1: Contas**

Mantenha a lógica (fetch accounts/txs, `saldoConta`, tratamento de erro). Apresentação: título "Contas"; cada conta num `<Card>` com nome + tipo (muted) à esquerda e `<Money sinal tamanho="lg">` à direita. Grid `gap`. Empty state consistente.

- [ ] **Step 2: Extrato**

Mantenha a lógica (query + filtros por querystring + `filtrosAtivos`). Apresentação: título "Extrato"; lista de lançamentos em `<Card>` único ou linhas separadas por `border-bottom` `var(--border)`. Cada linha: à esquerda descrição (Inter) + segunda linha muted com `data_compra`, `<PersonChip nome={t.pessoa} membros={membros}/>` e (se parcelado) `n/total`; à direita `<Money sinal>` com valor negativo pra despesa, positivo pra receita. Para `membros`, busque `supabase.from("members").select("nome")` (trate `error`). Mantenha os chips de filtros ativos no topo, estilizados com `var(--accent-weak)`/`var(--accent)`.

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` verde. Inspecione `/contas` e `/lancamentos`.

```bash
git add "src/app/(app)/contas/page.tsx" "src/app/(app)/lancamentos/page.tsx"
git commit -m "feat(ui): contas e extrato redesenhados"
```

---

### Task 8: Login + Onboarding redesenhados

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/onboarding/OnboardingForm.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Field` (novo). Mantém TODA a lógica de auth (signIn/signUp) e de bootstrap (criar/entrar lar) inalterada.

- [ ] **Step 1: Login**

Mantenha os handlers `enviar`, estados, `mensagemErro` e o fluxo (signInWithPassword/signUp, push/refresh). Apresentação: centralizado, `<Card>` com marca "Finanças do Casal" (Inter bold), os inputs trocados por `<Field label="E-mail" type="email" .../>` e `<Field label="Senha" type="password" .../>`, erro em `var(--negativo)`, `<Button variant="primary" tamanho="lg">` de largura total, e o toggle criar/entrar como `<Button variant="quiet">`.

- [ ] **Step 2: Onboarding**

Mantenha TODA a lógica de `OnboardingForm` (modos criar/entrar, `enviar`, chamada a `/api/household/bootstrap`, push). Apresentação: usar `<Card>`, `<Field>` para nome/nome-do-lar/código, os dois modos como `<Button>` (primary quando ativo, ghost quando não), erro em `var(--negativo)`. Copy mantida.

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui. Inspecione `/login` (e o onboarding, se tiver sessão de teste).

```bash
git add src/app/login/page.tsx src/components/onboarding/OnboardingForm.tsx
git commit -m "feat(ui): login e onboarding redesenhados"
```

---

### Task 9: Quick-Add redesenhado

**Files:**
- Modify: `src/components/quick-add/QuickAdd.tsx`
- Modify: `src/components/quick-add/FormularioRapido.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Money` (mantém TODA a lógica: parse NL, fallback, confirmar, criar).

- [ ] **Step 1: Restyle do modal e do formulário**

NÃO altere a lógica (interpretar, confirmar, salvar, estados, tratamento de erro `res.ok`). Apenas apresentação:

- **QuickAdd (sheet):** o bottom-sheet com `background: var(--surface)`, `border-top-radius: 18px`, handle (barrinha) no topo, padding generoso. O input NL grande com `var(--font-sans)`. Botões via `<Button>`. A revisão da sugestão: valor em `<Money tamanho="xl">`, tipo/origem/pessoa em muted, erro em `var(--negativo)`.
- **FormularioRapido:** valor em input grande centralizado (mono, tabular); chips de tipo (Despesa/Receita) com `aria-pressed` estilizados (`var(--accent-weak)` quando ativo); selects e parcelas com borda `var(--border)`; erro em `var(--negativo)`; `<Button>` salvar.
- Mantenha o `bottom` do FAB coerente com a TabBar (Task 4).

- [ ] **Step 2: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` verde. No navegador, abrir o "+" e conferir o sheet.

```bash
git add src/components/quick-add/QuickAdd.tsx src/components/quick-add/FormularioRapido.tsx
git commit -m "feat(ui): quick-add redesenhado (sheet + formulário)"
```

---

### Task 10: Polimento final — responsivo, foco, dark, revisão visual

**Files:**
- Modify: conforme necessário (ajustes finos nas telas já tocadas)

- [ ] **Step 1: Revisão em 3 viewports**

No navegador, capturar/inspecionar `/login`, `/`, `/cartoes`, `/contas`, `/lancamentos` e o "+" aberto em **375px (mobile)**, **768px (tablet)** e **1280px (desktop)**. Corrigir: overflow horizontal (nada pode estourar a largura), TabBar não cobrindo conteúdo (padding-bottom ok), toques com alvo ≥ 40px.

- [ ] **Step 2: Foco e dark**

Garantir foco de teclado visível nos inputs/botões (adicionar `outline` via `:focus-visible` global em `globals.css` se necessário: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`). Alternar o tema do SO para dark e confirmar que todas as telas continuam legíveis (as vars já cobrem; corrigir qualquer cor solta que tenha escapado).

- [ ] **Step 3: Título da aba**

Em `src/app/layout.tsx`, garantir `metadata.title = "Finanças do Casal"` (hoje está "Create Next App").

- [ ] **Step 4: Build + suíte + commit**

Run: `npm run build` → conclui; `npx vitest run` → verde.

```bash
git add -A
git commit -m "polish(ui): responsivo, foco, dark e título"
```

---

## Self-Review (autor do plano)

**1. Cobertura:** direção "fintech clean + duotom" → Task 1 (tokens/fontes). Assinatura duotom → Task 3 (SplitBar/PersonChip/pessoas) + uso em Task 5 (dashboard) e Task 7 (extrato). Valores em mono → Task 2 (Money). Telas: login/onboarding (8), dashboard (5), cartões/faturas (6), contas/extrato (7), quick-add (9). Shell/TabBar → Task 4. Responsivo/foco/dark/título → Task 10. ✅

**2. Placeholders:** nenhum "TBD"; cada task traz código concreto dos primitivos e direção precisa por tela (as telas já existem — o plano manda preservar a lógica e trocar apresentação, com os primitivos e tokens exatos a usar).

**3. Consistência de tipos:** `corDaPessoa(nome, membros)`, `<SplitBar itens membros>`, `<StatTile rotulo valorCentavos sinal? hint?>`, `<Money centavos sinal? tamanho?>`, `<Field label ...>`, `<Button variant tamanho>` — usados de forma consistente entre as tasks que produzem e consomem.

**Nota de execução:** por ser redesign, a verificação é `npm run build` + inspeção visual no navegador (screenshots) a cada task, e a suíte `npx vitest run` deve permanecer verde (nenhuma lógica muda; só a Task 3 adiciona 2 testes puros de `corDaPessoa`).
