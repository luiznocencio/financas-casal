"use client";
// Input de valor com máscara "centavos primeiro": o usuário digita só números
// (ex.: 125000) e vê "1.250,00" — sem precisar pontuar. Expõe o valor em centavos.

function formata(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MoneyInput({
  centavos, onCentavos, autoFocus, placeholder = "0,00", style, className,
}: {
  centavos: number;
  onCentavos: (v: number) => void;
  autoFocus?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12); // evita overflow
    onCentavos(digits ? parseInt(digits, 10) : 0);
  }
  return (
    <input
      inputMode="numeric"
      value={centavos ? formata(centavos) : ""}
      onChange={onChange}
      autoFocus={autoFocus}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
}
