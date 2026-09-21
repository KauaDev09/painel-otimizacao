# SevenOptimizer v2.1.16

## Paleta profissional e SevenIA com Gemini

- Nova identidade visual profissional aplicada ao painel e ao site (tokens de cor
  unificados: fundo escuro elegante, acento vermelho de marca, cinzas neutros e
  verde/amarelo/roxo reservados a status e IA).
- SevenIA passa a usar Google Gemini (substitui o provedor anterior).
- Ícones da barra lateral em cinza neutro; item ativo em vermelho da marca.
- Status semânticos (licença/suporte) em verde ou vermelho; assistente e mascote
  com acento roxo exclusivo.

---

# SevenOptimizer v2.1.12

## Correção de conectividade da licença

- A URL da API de licenças foi atualizada para o deploy Vercel ativo
  (`orion-optimizer-ten.vercel.app`), resolvendo o erro
  “Falha na validação: Não foi possível conectar ao servidor de licenças”.
- URL da loja/planos ajustada para o projeto correspondente.
- Atualização 2.1.12 publicada e autorizada no servidor.

Instale o instalador 2.1.12 manualmente nesta versão; o self-update fica
disponível a partir dela.

---

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