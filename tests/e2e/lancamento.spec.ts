import { test, expect } from "@playwright/test";

test("lançar despesa no cartão pelo formulário rápido reflete no extrato", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Novo lançamento").click();
  await page.getByText("Preencher manualmente").click();

  await page.getByPlaceholder("Valor (R$)").fill("123,45");
  // seleciona o primeiro cartão (option com 💳)
  await page.locator("select").first().selectOption({ index: 0 });
  await page.getByRole("button", { name: "Salvar" }).click();

  await page.goto("/lancamentos");
  await expect(page.getByText("R$ 123,45")).toBeVisible();
});
