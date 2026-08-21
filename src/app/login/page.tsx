"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabase } from "@/lib/supabase/client";

function mensagemErro(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("User already registered")) return "Já existe uma conta com esse e-mail.";
  if (msg.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg || "Não foi possível concluir. Tente novamente.";
}

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      const supabase = createBrowserSupabase();

      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) {
          setErro(mensagemErro(error.message));
          return;
        }
        router.push("/");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) {
        setErro(mensagemErro(error.message));
        return;
      }
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      setAviso("Conta criada. Confirme seu e-mail para entrar.");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>Finanças do Casal</h1>

      <Card>
        <form onSubmit={enviar} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{ padding: 10, borderRadius: 8, border: "1px solid var(--borda)" }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>Senha</span>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••"
              style={{ padding: 10, borderRadius: 8, border: "1px solid var(--borda)" }}
            />
          </label>

          {erro && <p style={{ color: "var(--negativo)", margin: 0 }}>{erro}</p>}
          {aviso && <p style={{ margin: 0 }}>{aviso}</p>}

          <Button type="submit" variant="primary" disabled={carregando}>
            {carregando ? "..." : modo === "entrar" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
      </Card>

      <button
        type="button"
        onClick={() => {
          setModo(modo === "entrar" ? "criar" : "entrar");
          setErro(null);
          setAviso(null);
        }}
        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", textAlign: "center" }}
      >
        {modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
    </main>
  );
}
