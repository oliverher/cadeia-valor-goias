# Cadeia de Valor Integrada de Goiás

Painel interativo dos macroprocessos gerenciais, finalísticos e de suporte do Estado de Goiás.

Site de origem: https://cadeia-valor-goias.carlos-hernane-olive.chatgpt.site/
Destino solicitado: https://github.com/oliverher/cadeia-valor-goias

## Origem desta exportação

Cópia local identificada pelo mesmo project_id do site, na pasta painel-2026-08-27. Exportação preparada em 15/10/2026.
Não foi possível comparar esta cópia com a versão 54 publicada: o servidor Git de origem não pôde ser resolvido por DNS.

## Conteúdo

- app/: interface React, estilos e dados processados.
- public/: imagens e ícones.
- data/cadeia-valor.xlsx: planilha usada pelo gerador de dados.
- scripts/generate-process-data.mjs: conversão da planilha em JSON.
- build/, worker/, .openai/ e demais configurações: configuração original Vinext/Cloudflare/Sites.
- tests/: testes originais do template; ainda precisam ser adaptados ao painel.

Requer Node.js >=22.13.0. Instale as dependências com npm ci. Para desenvolvimento, execute npx vinext dev. Para compilar, execute npx vinext build.

Esta exportação preserva a aplicação original. Ela não configura publicação pelo GitHub Pages. A estrutura atual usa Vinext e Cloudflare Workers.

Nenhuma pasta node_modules, credencial, arquivo .env, cache de execução ou histórico Git foi incluído.