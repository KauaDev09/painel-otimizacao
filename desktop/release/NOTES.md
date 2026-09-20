# SevenOptimizer v2.1.11

## Hardening e confiabilidade

- **TLS obrigatório no backend**: a API rejeita conexões HTTP em produção (barreira `SEVEN_ALLOW_HTTP` só para dev).
- **Integridade dos scripts**: execução conferida por SHA-256 contra o manifest do build — script adulterado é recusado com mensagem clara e a otimização não é executada.
- **Anti brute-force**: `store/login` e `admin/login` limitados por IP (retry com `Retry-After`).
- **Máscara de chaves**: chaves de licença em `access_logs` agora aparecem truncadas/mascaradas.

## Manutenção, limpeza e visual

- Correção de falha falsa em limpezas rápidas (“Não foi possível concluir este passo”) — race no runner resolvida.
- Limpeza de `%TEMP%` em processo adiado (não derruba o PowerShell do passo).
- Nova paleta **navy + cyan** no painel, site e admin.

## Compatibilidade máxima

- **Modo econômico automático**: sem GPU/renderização por software, o painel reduz blur/glow/animações para manter o app fluido (também via `--s4-disable-effects`).
- Janela mínima 960×600 e `asInvoker` explícito — roda sem administrador no dia a dia.

Atualize pelo app: **Configurações → Atualizações → Verificar**.