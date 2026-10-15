# Cadeia de Valor Integrada de Goiás

Painel interativo dos macroprocessos gerenciais, finalísticos e de suporte do Estado de Goiás.

Site: https://oliverher.github.io/cadeia-valor-goias/

## Executar localmente

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

## Publicação

Cada push na branch `main` gera o site estático (`next build`, pasta `out/`) e publica no GitHub Pages pela Action `.github/workflows/deploy.yml`.

## Atualizar os dados

1. Substitua `data/cadeia-valor.xlsx` pela planilha atualizada.
2. Rode `npm run generate-data` para regerar `app/process-data.json`.
3. Faça commit dos dois arquivos.

## Origem

Os arquivos `worker/`, `db/`, `build/`, `drizzle*`, `vite.config.ts`, `.openai/` e `app/chatgpt-auth.ts` são da estrutura original do Codex/Cloudflare e não entram no build (ver `exclude` no `tsconfig.json`).

Projeto criado no Codex (site original: https://cadeia-valor-goias.carlos-hernane-olive.chatgpt.site/) e migrado para GitHub Pages em outubro de 2026. Detalhes da exportação em `EXPORTACAO.md`.
