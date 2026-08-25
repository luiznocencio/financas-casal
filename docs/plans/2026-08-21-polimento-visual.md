# Polimento Visual (ícones, nav, tells, loading, login) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Elevar a camada visual do app (sistema de ícones Phosphor, tab bar com ícones, limpeza de "AI-tells", estados de carregamento, e polish do login/onboarding) SEM tocar em nenhuma lógica de dados.

**Architecture:** `@phosphor-icons/react` (já instalado) para ícones (strokeWidth padrão 1.75, `weight="regular"`). Token `--alerta` (já criado) para o aviso de >85%. Um `Spinner` reutilizável. Mudanças só de apresentação nas telas e componentes existentes.

**Tech Stack:** Next.js 16, Tailwind v4, `@phosphor-icons/react`, TypeScript.

## Global Constraints

- **NÃO alterar lógica.** Nada em `src/lib/**`, `src/app/api/**`, `supabase/**`. Nenhuma query, handler ou tipo muda. `npx vitest run` deve permanecer **57/57**.
- **Uma família de ícones:** só `@phosphor-icons/react`. `size={18}` padrão em rótulos/ações, `size={20}` na tab bar. `weight="regular"`. NUNCA desenhar SVG de ícone à mão.
- **Sem emoji em UI:** remover `💳 🏦 🎉` (trocar por ícone Phosphor ou texto). Exceção: o nome do lar do usuário (dado, não UI) fica como está.
- **Cores via `var(--token)`.** O aviso de >85% usa `var(--alerta)` (não hex cravado). Accent, positivo, negativo inalterados.
- **`·` racionado:** máx. 1 ponto-do-meio por linha em faixas de metadados.
- Verificação: `npm run build` + `npx tsc --noEmit` + `npx vitest run`; o controlador roda /code-review; runtime é conferido pelo usuário (não dá pra screenshot no ambiente).

## File Structure

```
src/components/ui/Spinner.tsx           # NOVO (loading)
src/components/shell/TabBar.tsx         # + ícones por item
src/app/(app)/cartoes/page.tsx          # "Faturas" (drop uppercase), var(--alerta), ícone no header
src/components/cartoes/FaturaBotao.tsx  # ícone
src/app/(app)/orcamento/page.tsx        # var(--alerta) no >85% (tira #f08c00)
src/app/(app)/metas/page.tsx            # troca 🎉 por ícone
src/components/metas/{AporteForm,NovaMetaForm}.tsx # ícones nos botões (opcional leve)
src/app/login/page.tsx                  # marca (ícone R$) + respiro
src/app/onboarding/page.tsx             # marca + respiro
src/components/onboarding/OnboardingForm.tsx
src/components/quick-add/{QuickAdd,FormularioRapido}.tsx # tira `·` extra, tira emoji, Spinner no "Interpretando..."
src/components/importar/Importador.tsx  # Spinner no "Analisando...", tira emoji
```

---

### Task 1: Spinner + TabBar com ícones (a nav)

**Files:**
- Create: `src/components/ui/Spinner.tsx`
- Modify: `src/components/shell/TabBar.tsx`

**Interfaces:**
- Produces: `<Spinner size? />` (CSS spin, respeita reduced-motion).
- TabBar: cada item vira ícone (size 20) + rótulo (0.7rem).

- [ ] **Step 1: `Spinner.tsx`**

```tsx
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block", width: size, height: size,
        border: "2px solid var(--border)", borderTopColor: "var(--accent)",
        borderRadius: "50%", animation: "spin 0.7s linear infinite",
      }}
    />
  );
}
```

E em `globals.css`, adicionar (uma vez): `@keyframes spin { to { transform: rotate(360deg); } }` (fora do bloco reduced-motion; sob reduced-motion a animação já é neutralizada pela regra global `*`).

- [ ] **Step 2: TabBar com ícones**

Em `src/components/shell/TabBar.tsx`, importe de `@phosphor-icons/react` e mapeie um ícone por rota. Cada item vira uma coluna: ícone (size 20) em cima, rótulo (0.7rem) embaixo, ambos com a cor ativa/inativa atual (`var(--accent)`/`var(--muted)`).

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, CreditCard, Wallet, Receipt, ChartPieSlice, Target } from "@phosphor-icons/react";

const ITENS = [
  { href: "/", rotulo: "Início", Icone: House },
  { href: "/cartoes", rotulo: "Cartões", Icone: CreditCard },
  { href: "/contas", rotulo: "Contas", Icone: Wallet },
  { href: "/lancamentos", rotulo: "Extrato", Icone: Receipt },
  { href: "/orcamento", rotulo: "Orçamento", Icone: ChartPieSlice },
  { href: "/metas", rotulo: "Metas", Icone: Target },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-around",
        padding: "6px 4px calc(6px + env(safe-area-inset-bottom))",
      }}>
      {ITENS.map(({ href, rotulo, Icone }) => {
        const ativo = href === "/" ? path === "/" : path.startsWith(href);
        const cor = ativo ? "var(--accent)" : "var(--muted)";
        return (
          <Link key={href} href={href}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: cor, padding: "4px 0" }}>
            <Icone size={20} weight={ativo ? "fill" : "regular"} />
            <span style={{ fontSize: "0.68rem", fontWeight: 600 }}>{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

O container do `(app)/layout.tsx` já tem `paddingBottom: 84`; se ficar apertado, suba para 92 (ajuste só o número, nada mais).

- [ ] **Step 3: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → 57/57.

```bash
git add src/components/ui/Spinner.tsx src/components/shell/TabBar.tsx src/app/globals.css "src/app/(app)/layout.tsx"
git commit -m "feat(ui): tab bar com ícones (Phosphor) + Spinner"
```

---

### Task 2: Tells + ícones + var(--alerta) nas telas

**Files:**
- Modify: `src/app/(app)/cartoes/page.tsx`, `src/components/cartoes/FaturaBotao.tsx`
- Modify: `src/app/(app)/orcamento/page.tsx`
- Modify: `src/app/(app)/metas/page.tsx`

- [ ] **Step 1: Cartões**

- Trocar o eyebrow `<span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Faturas</span>` por um rótulo normal com ícone: `<span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Receipt size={14}/> Faturas</span>` (import `Receipt` de phosphor).
- Na barra de limite, trocar `pct > 85 ? "var(--negativo)" : "var(--accent)"` por `pct > 85 ? "var(--alerta)" : "var(--accent)"` (o vermelho fica pro estouro real, não pro aviso).
- (Opcional leve) ícone `CreditCard size={16}` antes do nome do cartão.

- [ ] **Step 2: FaturaBotao**

Adicionar um ícone ao rótulo: quando não paga, `<Check size={13}/> Marcar paga`; quando paga, `<ArrowCounterClockwise size={13}/> Desfazer`. Manter a lógica intacta (só o conteúdo do botão muda).

- [ ] **Step 3: Orçamento**

Na cor da barra, trocar `usado > 100 ? "var(--negativo)" : usado > 85 ? "#f08c00" : "var(--accent)"` por `usado > 100 ? "var(--negativo)" : usado > 85 ? "var(--alerta)" : "var(--accent)"`.

- [ ] **Step 4: Metas**

Trocar o emoji `🎉` (na linha `{m.concluida ? "🎉" : ...}`) por um ícone: `<Confetti size={16} weight="fill" color="var(--positivo)" />` (import `Confetti` de phosphor). Manter o resto.

- [ ] **Step 5: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → 57/57.

```bash
git add "src/app/(app)/cartoes/page.tsx" src/components/cartoes/FaturaBotao.tsx "src/app/(app)/orcamento/page.tsx" "src/app/(app)/metas/page.tsx"
git commit -m "polish(ui): ícones + var(--alerta) + tira eyebrow/emoji nas telas"
```

---

### Task 3: Quick-add e Importação (dots, emoji, loading)

**Files:**
- Modify: `src/components/quick-add/QuickAdd.tsx`, `src/components/quick-add/FormularioRapido.tsx`
- Modify: `src/components/importar/Importador.tsx`

**Interfaces:** consome `Spinner` (Task 1).

- [ ] **Step 1: QuickAdd (dots + loading + ícone)**

- No painel de revisão da sugestão, a linha `{sugestao.tipo} · {sugestao.descricao}` e a linha `{sugestao.card_id ? "Cartão" : "Conta"} · {sugestao.pessoa}{...}x` concentram vários `·`. Reestruturar: primeira linha só a descrição; segunda linha os metadados em uma faixa com no MÁXIMO um `·` por par (ex.: origem e pessoa em `<span>`s separados por gap, sem `·` empilhado). Evitar 2+ `·` na mesma linha.
- No botão "Interpretando...", mostrar `<Spinner size={14}/>` ao lado do texto enquanto `carregando`.
- (Opcional) ícone `Sparkle size={16}` no botão "Lançar" (modo IA).

- [ ] **Step 2: FormularioRapido (emoji nos selects)**

Nos `<option>` de origem, remover os emojis `💳`/`🏦`. Para manter a distinção cartão/conta sem emoji, prefixar o texto: `Cartão · {nome}` e `Conta · {nome}` (um `·` só por option, aceitável). Manter todo o resto (values `card:`/`acc:` intactos — só o texto visível muda).

- [ ] **Step 3: Importador (emoji + loading)**

- Nos `<option>` de origem, mesmo tratamento (remover emoji, prefixar "Cartão"/"Conta").
- No botão "Analisando...", mostrar `<Spinner size={14}/>` ao lado enquanto `carregando`.

- [ ] **Step 4: Verificar + commit**

Run: `npm run build` → conclui; `npx vitest run` → 57/57.

```bash
git add src/components/quick-add/QuickAdd.tsx src/components/quick-add/FormularioRapido.tsx src/components/importar/Importador.tsx
git commit -m "polish(ui): quick-add e importação (loading, tira emoji, racionaliza pontos)"
```

---

### Task 4: Login + Onboarding (marca + respiro)

**Files:**
- Create: `src/components/ui/Marca.tsx`
- Modify: `src/app/login/page.tsx`, `src/components/onboarding/OnboardingForm.tsx`

**Interfaces:** `<Marca />` — o mesmo desenho do favicon (quadrado duotom com "R$") em ~40px, reutilizável.

- [ ] **Step 1: `Marca.tsx`**

```tsx
export function Marca({ size = 40 }: { size?: number }) {
  return (
    <span aria-hidden style={{ display: "inline-flex" }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs><clipPath id="marca-r"><rect width="64" height="64" rx="15" /></clipPath></defs>
        <g clipPath="url(#marca-r)">
          <rect width="32" height="64" fill="var(--pessoa-a)" />
          <rect x="32" width="32" height="64" fill="var(--pessoa-b)" />
        </g>
        <text x="32" y="44" fontFamily="var(--font-sans), sans-serif" fontSize="34" fontWeight="800" fill="#fff" textAnchor="middle">R$</text>
      </svg>
    </span>
  );
}
```

- [ ] **Step 2: Login com marca**

No topo do `login/page.tsx`, acima do `<h1>Finanças do Casal</h1>`, renderizar `<Marca />` centralizado, com um `gap` maior (a coluna já é `display:grid; gap`). Aumentar levemente o respiro do container (ex.: `margin: "72px auto"`). Nada da lógica muda.

- [ ] **Step 3: Onboarding com marca**

No `OnboardingForm.tsx`, acima do "Bem-vindo(a)!", renderizar `<Marca size={36}/>`. Mantém o resto.

- [ ] **Step 4: Verificar + commit**

Run: `npm run build` → conclui.

```bash
git add src/components/ui/Marca.tsx src/app/login/page.tsx src/components/onboarding/OnboardingForm.tsx
git commit -m "polish(ui): marca do app no login e onboarding"
```

---

## Self-Review (autor)

**Cobertura:** ícones (Phosphor) → Task 1 (tab bar) + Task 2/3 (telas/ações). Nav → Task 1. Tells (eyebrow "Faturas", `·`, emoji, cor de alerta) → Task 2/3. Loading → Task 1 (Spinner) + Task 3. Login/onboarding → Task 4. Nenhuma lógica tocada. ✅

**Consistência:** uma família de ícones (`@phosphor-icons/react`), `var(--alerta)` para aviso em cartões E orçamento, `<Spinner>` e `<Marca>` reutilizados. `weight` fill no ativo da tab bar / regular no resto.

**Placeholders:** nenhum; ícones nomeados e mudanças concretas por passo.
