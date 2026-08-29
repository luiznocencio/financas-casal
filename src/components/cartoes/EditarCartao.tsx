"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TitularSelect } from "@/components/ui/TitularSelect";
import type { Card } from "@/lib/db/tipos";

export function EditarCartao({ card, membros }: { card: Card; membros: string[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [nome, setNome] = useState(card.nome);
  const [limite, setLimite] = useState((card.limite_centavos / 100).toString());
  const [fechamento, setFechamento] = useState(String(card.dia_fechamento));
  const [vencimento, setVencimento] = useState(String(card.dia_vencimento));
  const [titular, setTitular] = useState(card.titular ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function salvar() {
    setErro(null);
    const f = Number(fechamento), v = Number(vencimento);
    if (!nome.trim() || !(f >= 1 && f <= 31) || !(v >= 1 && v <= 31)) {
      setErro("Preencha nome e dias de fechamento/vencimento (1 a 31).");
      return;
    }
    setSalvando(true);
    const res = await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        nome: nome.trim(), limite_centavos: reaisParaCentavos(limite),
        dia_fechamento: f, dia_vencimento: v, titular: titular.trim() || null,
      }),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Não foi possível salvar as alterações."); return; }
    setEditando(false);
    router.refresh();
  }

  async function excluir() {
    setErro(null);
    setExcluindo(true);
    const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    setExcluindo(false);
    if (!res.ok) { setErro("Não foi possível apagar o cartão."); return; }
    router.refresh();
  }

  if (editando) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Limite (R$)" inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} />
          <TitularSelect value={titular} onChange={setTitular} membros={membros} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Dia de fechamento" type="number" value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
          <Field label="Dia de vencimento" type="number" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Salvar</Button>
          <Button variant="quiet" onClick={() => { setEditando(false); setErro(null); }}>Cancelar</Button>
        </div>
      </div>
    );
  }

  if (confirmandoExclusao) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--negativo)", textAlign: "right" }}>
          Apagar o cartão e TODOS os seus lançamentos e faturas? Não dá pra desfazer.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="danger" onClick={excluir} disabled={excluindo}>Confirmar exclusão</Button>
          <Button variant="quiet" onClick={() => setConfirmandoExclusao(false)}>Cancelar</Button>
        </div>
        {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.8rem" }}>{erro}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Button variant="ghost" onClick={() => setEditando(true)}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><PencilSimple size={14} /> Editar</span>
      </Button>
      <Button variant="danger" onClick={() => setConfirmandoExclusao(true)}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Trash size={14} /> Excluir</span>
      </Button>
    </div>
  );
}
