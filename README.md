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

## Atualização automática dos dados

Todos os dias às 06:50 (horário de Brasília) a Action baixa a planilha "Cadeia de Valor Integrada de Goiás.xlsx" do Google Drive, regera `app/process-data.json` e, se os dados mudaram, faz commit e publica o site. Se nada mudou, o site fica como está.

- Para atualizar na hora: aba **Actions** → "Atualizar dados e publicar no GitHub Pages" → **Run workflow**.
- Requisito: a planilha precisa continuar compartilhada como "qualquer pessoa com o link pode ver".
- Se a estrutura da planilha mudar (nomes das abas ou colunas), a execução falha, o site continua com os dados anteriores e o GitHub envia um e-mail avisando.

Atualização manual: substitua `data/cadeia-valor.xlsx`, rode `npm run generate-data` e faça commit dos dois arquivos.

## Origem

Os arquivos `worker/`, `db/`, `build/`, `drizzle*`, `vite.config.ts`, `.openai/` e `app/chatgpt-auth.ts` são da estrutura original do Codex/Cloudflare e não entram no build (ver `exclude` no `tsconfig.json`).

Projeto criado no Codex (site original: https://cadeia-valor-goias.carlos-hernane-olive.chatgpt.site/) e migrado para GitHub Pages em outubro de 2026. Detalhes da exportação em `EXPORTACAO.md`.
