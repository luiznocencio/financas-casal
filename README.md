This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Testes E2E (Playwright)

Os testes ficam em `tests/e2e/` e usam `playwright.config.ts` (`testDir: "./tests/e2e"`).
Como o login do app é feito por magic link (sem senha), o Playwright não consegue autenticar
sozinho — os testes assumem uma sessão já salva em `tests/e2e/.auth/state.json`
(arquivo ignorado pelo git, nunca commitado).

Para gerar esse `storageState` localmente:

1. Suba o app (`npm run dev`) e faça login normalmente pelo navegador com um usuário de teste
   que já pertença a um household com pelo menos 1 cartão e categorias cadastradas.
2. Rode um script pontual (ou use `npx playwright codegen http://localhost:3000` já logado) que,
   após o login concluído, chame `context.storageState({ path: "tests/e2e/.auth/state.json" })`
   para salvar cookies/local storage da sessão autenticada.
3. Garanta que o arquivo fique em `tests/e2e/.auth/state.json` — é o caminho lido por
   `playwright.config.ts` (`use.storageState`).
4. Rode `npx playwright test` com o dev server ativo (o config já sobe `npm run dev`
   automaticamente via `webServer`, reaproveitando um servidor já rodando).

Sem esse `storageState` válido, `npx playwright test` falha nos passos que dependem de estar
autenticado — a suíte não é executada em ambientes sem esse setup manual.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
