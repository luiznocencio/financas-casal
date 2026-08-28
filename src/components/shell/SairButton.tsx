"use client";
import { useState } from "react";
import { SignOut } from "@phosphor-icons/react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function SairButton({ variant = "sidebar" }: { variant?: "sidebar" | "inline" }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try { await createBrowserSupabase().auth.signOut(); } catch { /* segue pro login mesmo assim */ }
    window.location.assign("/login"); // hard nav limpa o estado do servidor
  }

  if (variant === "inline") {
    return (
      <button onClick={sair} disabled={saindo}
        className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]">
        {saindo ? "Saindo..." : "Sair"}
      </button>
    );
  }
  return (
    <button onClick={sair} disabled={saindo}
      className="mt-auto flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
      <SignOut size={20} aria-hidden />
      {saindo ? "Saindo..." : "Sair"}
    </button>
  );
}
