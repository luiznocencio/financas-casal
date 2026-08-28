// Tag colorida da categoria: pílula com um leve tom da cor + ponto sólido + nome.
// A cor identifica a categoria num relance; o texto fica em --text pra passar
// contraste em qualquer tom (o tom saturado vai só no fundo suave e no ponto).
export function CategoriaTag({
  nome, cor, tamanho = "md",
}: { nome: string; cor: string; tamanho?: "sm" | "md" }) {
  const dim = tamanho === "sm" ? "px-1.5 py-0.5 text-[0.7rem]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full font-medium ${dim}`}
      style={{ background: `${cor}1f`, color: "var(--text)" }}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cor }} />
      {nome}
    </span>
  );
}

// Só o ponto colorido, pra usar ao lado de um nome que já está estilizado.
export function CategoriaPonto({ cor }: { cor: string }) {
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />;
}
