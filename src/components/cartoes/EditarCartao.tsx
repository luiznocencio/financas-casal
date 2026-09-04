"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { MoneyField } from "@/components/ui/MoneyField";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TitularSelect } from "@/components/ui/TitularSelect";
import { FechamentoPreview } from "@/components/cartoes/FechamentoPreview";
import type { Card } from "@/lib/db/tipos";

export function EditarCartao({ card, membros }: { card: Card; membros: string[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [nome, setNome] = useState(card.nome);
  const [limite, setLimite] = useState(card.limite_centavos);
  const [vencimento, setVencimento] = useState(String(card.dia_vencimento));
  const [diasAntes, setDiasAntes] = useState(String(card.dias_fechamento_antes ?? Math.max(0, card.dia_vencimento - card.dia_fechamento)));
  const [titular, setTitular] = useState(card.titular ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function salvar() {
    setErro(null);
    const v = Number(vencimento), d = Number(diasAntes);
    if (!nome.trim() || !(v >= 1 && v <= 31) || !(d >= 0 && d <= 27)) {
      setErro("Preencha nome, vencimento (1 a 31) e quantos dias antes fecha (0 a 27).");
      return;
    }
    setSalvando(true);
    const res = await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        nome: nome.trim(), limite_centavos: limite,
        dia_vencimento: v, dias_fechamento_antes: d, titular: titular.trim() || null,
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
          <MoneyField label="Limite (R$)" centavos={limite} onCentavos={setLimite} />
          <TitularSelect value={titular} onChange={setTitular} membros={membros} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Dia de vencimento" type="number" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          <Field label="Fecha quantos dias antes" type="number" value={diasAntes} onChange={(e) => setDiasAntes(e.target.value)} />
        </div>
        <FechamentoPreview vencimento={Number(vencimento)} diasAntes={Number(diasAntes)} />
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
