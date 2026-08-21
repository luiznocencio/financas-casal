"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function OnboardingForm({ nomeSugerido }: { nomeSugerido: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<"criar" | "entrar">("criar");
  const [nome, setNome] = useState(nomeSugerido);
  const [nomeLar, setNomeLar] = useState("Nosso lar");
  const [inviteCode, setInviteCode] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setCarregando(true);
    try {
      const body =
        modo === "criar"
          ? { nome, nome_lar: nomeLar }
          : { nome, invite_code: inviteCode.trim() };
      const res = await fetch("/api/household/bootstrap", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j.error ?? "Não foi possível concluir. Confira os dados.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: "48px auto", padding: 16, display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Bem-vindo(a)!</h1>
        <p style={{ color: "var(--muted)" }}>
          Vamos configurar o lar de vocês. Crie um novo, ou entre no lar do seu parceiro(a) com o código de convite.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant={modo === "criar" ? "primary" : "ghost"} onClick={() => setModo("criar")}>
          Criar um lar
        </Button>
        <Button variant={modo === "entrar" ? "primary" : "ghost"} onClick={() => setModo("entrar")}>
          Entrar com código
        </Button>
      </div>

      <Card>
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />

          {modo === "criar" ? (
            <Field label="Nome do lar" value={nomeLar} onChange={(e) => setNomeLar(e.target.value)} />
          ) : (
            <Field
              label="Código de convite"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="ex.: 27065952"
            />
          )}

          {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.875rem" }}>{erro}</p>}

          <Button variant="primary" onClick={enviar} disabled={carregando} style={{ width: "100%" }}>
            {carregando ? "..." : modo === "criar" ? "Criar lar" : "Entrar no lar"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
