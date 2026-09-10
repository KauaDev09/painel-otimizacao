# Orion Optimizer v2.1.10

## Correção crítica — Limpeza

- Corrige falha falsa em **Arquivos temporários do usuário** e outras limpezas rápidas (“Não foi possível concluir este passo”).
- Causa: race no runner (STEP_END no log era ignorado em sequências rápidas).
- Limpeza de `%TEMP%` agora agenda remoção em processo adiado (não derruba o PowerShell do passo).

## Visual — System Intelligence

- Nova paleta **navy + cyan** (inspirada em painel técnico / KernelGuard), sem roxo de template.
- Dashboard com badge “System Secure” e cards reforçados.
- Site, landing e admin alinhados ao mesmo perfil.

Atualize pelo app: **Configurações → Atualizações → Verificar**.
