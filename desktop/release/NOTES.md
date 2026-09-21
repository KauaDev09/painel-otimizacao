# SevenOptimizer v2.1.17

## Correções

- **SevenIA (assistente de IA) estabilizada** — o modelo em uso no plano gratuito
  retornava erros 429/503 e demorava demais, o que resultava nas mensagens
  *"não foi possível conectar ao servidor de licenças"* e *"A IA está instável"*.
  - Novo modelo padrão: `gemini-3.5-flash-lite` (estável e rápido no plano free).
  - Timeout da chamada ajustado para caber no limite de execução do servidor na Vercel
    (antes a conexão era encerrada no meio da resposta).
- **Mensagens de erro claras na SevenIA** — cada falha agora mostra o motivo correto
  (sem conexão, serviço sem cota, indisponível), em vez de culpar o servidor de licenças.
- **Conexão com o servidor** — função da API com tempo máximo de 60s, eliminando
  quedas durante chamadas da IA.

## Instalação

Baixe o instalador abaixo e execute. Atualização preserva sua licença.