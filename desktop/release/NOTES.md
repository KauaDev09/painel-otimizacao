# Orion Optimizer v2.1.9

## Segurança e estabilidade (crítico)

- **Tela:** ajustes usam só curva de gama (software). Não grava mais no OSD do monitor (DDC) ao mover sliders / REDEFINIR / ao abrir o app.
- Corrigido bug de brilho DDC (100% virava 50%) e remoção de VCP perigosos (volume/temperatura no monitor).
- Helper de tela pré-compilado no instalador (funciona sem `csc.exe` no PC).
- Overlay de brilho agora aparece de verdade quando o driver bloqueia a gamma ramp.

## Reparo do sistema (SFC / DISM)

- Timeouts longos (até 90 min) — não mata mais o reparo em 30 min.
- Correção rápida sem `pause` e **sem chkdsk**; ordem DISM → SFC.
- Textos da UI alinhados ao que realmente executa.

## Scripts e otimizações

- Scripts de jogos **não removem mais** Calculator, Photos, Maps, OneDrive, etc.
- Windows Balanced **não desativa mais o UAC**.
- Windows Extreme: DNS em adapters conectados (não só "Ethernet").
- Undo da telemetria NVIDIA corrigido (antes reaplicava Disabled).
- Limpeza sem admin não força UAC desnecessário.
- Backup/restauração de registro com múltiplas chaves corrigido.
- Contadores de GPU mais robustos em Windows em português.
- URLs de mídia com espaços/acentos corrigidas.

Reinicie o painel após atualizar. Se o monitor ficou escuro por causa da versão antiga: Menu do monitor → Reset / Factory, depois Tela → REDEFINIR no app.
