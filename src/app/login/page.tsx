"use client";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserSupabase();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/` },
    });
    setEnviado(true);
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 16 }}>
      <h1>Finanças do Casal</h1>
      {enviado ? (
        <p>Enviamos um link de acesso para <b>{email}</b>.</p>
      ) : (
        <form onSubmit={entrar}>
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10 }}>Entrar</button>
        </form>
      )}
    </main>
  );
}
