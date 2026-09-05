# Orion Reactive Core — Especificação Técnica

## 0. O que mudou nesta revisão (e por quê)

O prompt original funcionava como especificação funcional, mas tinha três problemas que
comprometem o resultado "premium" que ele pede:

1. **Paleta genérica.** `#7C3AED / #8B5CF6 / #A855F7` são exatamente os stops 600/500/400
   da escala violet padrão do Tailwind — a cor que sai sem ninguém decidir nada. Substituída
   abaixo por uma escala customizada, com um tom de fundo levemente mais quente que preto puro.
2. **Composição "kit de peças" de landing page de IA.** Grade pontilhada perfeitamente uniforme +
   anéis concêntricos perfeitos centralizados é a fórmula mais repetida de hero section
   "AI SaaS" desde 2023. Ajustada para composição assimétrica, com textura de grão sutil
   (quebra a "limpeza" excessiva que entrega gradientes gerados) e anéis elípticos, não circulares.
3. **Repetição e critérios vagos.** O prompt original repete a mesma instrução (performance,
   pointer-events, preservar funcionalidades) em várias seções. Consolidado em um único
   checklist de "Definition of Done" no final, com números concretos em vez de "sutil"/"leve".

Tudo abaixo é auto-contido — não depende do documento original.

---

## 1. Objetivo

Componente visual reutilizável, presente no `/login` e nas telas principais do painel,
com um núcleo energético central que reage à posição do cursor via parallax, inclinação e glow.
Fundo preto profundo com campo de luz roxo customizado. Efeito discreto o suficiente para não
competir com o conteúdo da interface.

## 2. Paleta (customizada — não usar stops padrão de framework)

```css
--orion-bg:          #07060A;   /* preto levemente quente, não #000 nem stop de framework */
--orion-core-1:      #6B3FA0;   /* núcleo — roxo dessaturado, não o violet-600 padrão */
--orion-core-2:      #9163D4;   /* anel interno */
--orion-core-3:      #5A3480;   /* anel externo, mais escuro que o núcleo */
--orion-ambient:     rgba(107, 63, 160, 0.08); /* glow ambiente, bem discreto */
```

Regra: nenhum valor pode ser copiado de uma escala de design system conhecida
(Tailwind, Radix, Chakra). Se for ajustar, mude também a saturação, não só a luminosidade.

## 2.1 Linguagem cromática global do painel (não só o núcleo reativo)

Esta seção se aplica a **todo o painel**, não apenas ao componente `OrionReactiveCore`.
Regra geral: fundo preto em todas as telas, violeta como cor funcional dominante
(ícones, estados interativos, hover) — mantendo o texto de corpo legível.

```css
--orion-bg:              #07060A;   /* fundo de toda a aplicação, não só do hero */
--orion-surface:         #0E0C14;   /* cards, painéis, sidebar — leve elevação sobre o bg */

/* Texto: violeta-branco, não branco puro nem violeta saturado — mantém contraste AA em preto */
--orion-text-primary:    #E4DDF2;
--orion-text-secondary:  #A99BC4;

/* Ícones e elementos funcionais: violeta saturado como cor padrão, não neutro/cinza */
--orion-icon-default:    #9163D4;
--orion-icon-active:     #B48FE0;

/* Hover: todo elemento interativo (botão, item de menu, card, link) reage em violeta */
--orion-hover-fg:        #C7AEEF;                       /* texto/ícone no hover, mais claro */
--orion-hover-glow:      rgba(145, 99, 212, 0.22);       /* box-shadow sutil no hover */
--orion-hover-border:    #6B3FA0;
```

Regras de aplicação:

- **Ícones**: cor padrão `--orion-icon-default` em todo lugar do painel — não usar cinza/branco
  como cor neutra de ícone. Isso vale para sidebar, cards de tweak, badges, botões de ação.
- **Hover universal**: qualquer elemento clicável (item de sidebar, card, botão, checkbox,
  link) transiciona no `:hover`/`:focus-visible` para `--orion-hover-fg` no texto/ícone,
  `--orion-hover-border` na borda e `box-shadow: 0 0 0 1px var(--orion-hover-border), 0 4px 16px var(--orion-hover-glow)`.
  Transição de 150–200ms, `ease-out` — nunca instantânea, nunca mais lenta que isso.
- **Texto de corpo** usa `--orion-text-primary`/`--orion-text-secondary` (violeta-branco),
  não violeta saturado — preserva legibilidade e ainda assim mantém a identidade cromática.
- **Títulos e destaques pontuais** (score, valores numéricos, título de seção) podem usar
  o violeta saturado (`--orion-core-2` / `--orion-icon-active`) para dar ênfase, com moderação —
  se tudo for saturado, nada se destaca.
- Contraste mínimo: `--orion-text-primary` sobre `--orion-bg` deve manter razão ≥ 7:1
  (AAA) já que é texto claro sobre fundo quase preto; `--orion-text-secondary` ≥ 4.5:1 (AA).

## 3. Componente

```
src/components/orion-reactive-core.tsx
```

```tsx
type OrionReactiveCoreProps = {
  className?: string;
  compact?: boolean;
};

export function OrionReactiveCore(props: OrionReactiveCoreProps): JSX.Element;
```

Único componente, reutilizado em todas as telas — não criar variações por página.

## 4. Estrutura visual

```
OrionReactiveCore
├── .orion-reactive-field        (container, pointer-events: none)
│   ├── .orion-grain              (textura de ruído sutil — via SVG feTurbulence, opacity ~0.03)
│   ├── .orion-grid               (linhas finas, espaçamento NÃO uniforme, opacity ~0.05)
│   ├── .orion-pointer-light      (glow radial que segue o cursor com inércia)
│   └── .orion-core               (posicionado fora do centro geométrico, não dead-center)
│       ├── .orion-core-ring-outer   (elíptico, não circular)
│       ├── .orion-core-ring-inner   (elíptico, excentricidade diferente do externo)
│       ├── .orion-core-orbitals     (2–3 detalhes pequenos, posições assimétricas)
│       └── .orion-core-center       (núcleo luminoso)
```

Composição assimétrica: o núcleo não fica no centro exato do viewport. No desktop,
deslocado ~15–20% do centro (ex: 58% horizontal, 45% vertical) — evita a composição
"hero centralizado" reconhecível de template.

## 5. Comportamento do cursor

### 5.1 Suavização (obrigatório usar interpolação, não CSS transition simples)

```js
// lerp a cada frame — dá a sensação de inércia física que transition: ease-out não dá
current += (target - current) * 0.08; // fator entre 0.06–0.10
```

Implementar com um único `requestAnimationFrame` global por instância do componente,
cancelado no `useEffect` cleanup. Nunca múltiplos listeners de `pointermove` empilhados.

### 5.2 Variáveis CSS atualizadas via `style` (não via classe — evita reflow de CSSOM)

```css
--pointer-x, --pointer-y        /* posição do glow, com lerp */
--core-shift-x, --core-shift-y  /* parallax do núcleo — máx ±12px */
--core-rotate-x, --core-rotate-y /* inclinação — máx ±2.5deg */
--core-glow                      /* 0.85 a 1.15 conforme distância do cursor ao núcleo */
--ring-speed                     /* 0.85x a 1.1x da velocidade base */
```

### 5.3 Pulso ambiente (independente do cursor)

`@keyframes orion-core-pulse`, 6–8s de duração, `--core-glow` variando ±8%. Cursor próximo
soma-se ao pulso, não substitui.

## 6. Performance (contrato mensurável, não "deve ser leve")

- Apenas `transform` e `opacity` animados — zero `width/height/top/left` em loop
- `will-change: transform` só nos elementos animados, removido quando fora de viewport
- Orçamento: **sem novos frames acima de 8ms** na aba Performance do DevTools durante
  movimento contínuo do mouse por 5s
- Zero elementos DOM novos por frame (nada de partículas geradas dinamicamente)
- Sem bibliotecas novas (framer-motion, gsap, etc.) — CSS + `requestAnimationFrame` puro

## 7. Acessibilidade e interação

```css
pointer-events: none; /* em .orion-reactive-field e todos os filhos */
```

```css
@media (prefers-reduced-motion: reduce) {
  .orion-core-ring, .orion-core, .orion-pointer-light, .orion-grid {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

Nenhum elemento clicável, focável ou com `z-index` acima do conteúdo real.

## 8. Z-index

```
z-0   OrionReactiveCore
z-10  conteúdo da aplicação
z-20  header
z-30+ menus, overlays, modais
```

## 9. Modo compact (uso no dashboard, não no login)

- Núcleo ~40% menor, `opacity: 0.7` no total do componente
- Grade e grão desligados (ruído visual desnecessário atrás de UI densa)
- Posicionado no canto, nunca atrás do conteúdo central da tela

## 10. Integração

```tsx
// layout/shell global
<div className="relative isolate min-h-screen bg-[--orion-bg]">
  <OrionReactiveCore />
  <div className="relative z-10">{children}</div>
</div>

// /login
<OrionReactiveCore className="absolute inset-0" />

// dashboard
<OrionReactiveCore compact className="fixed inset-0" />
```

## 11. Restrições (não-negociável)

- Não alterar backend: APIs, banco, autenticação, licenciamento, permissões, variáveis de ambiente
- Não remover funcionalidades existentes (sidebar, header, forms, hooks, chamadas de API)
- Se já existir uma implementação parcial do núcleo reativo, **consolidar nela**, não criar
  uma segunda em paralelo
- Corrigir apenas duplicações diretamente relacionadas a esta implementação (imports duplicados,
  JSX duplicado no shell/login) — não refatorar código não relacionado

## 12. Definition of Done

- [ ] Build/typecheck sem erros
- [ ] Zero imports duplicados, zero JSX duplicado introduzido por esta mudança
- [ ] `/login` e `/` renderizam o núcleo sem sobrepor cliques em botões, inputs, sidebar, menus
- [ ] Reduced motion testado e confirmado (animações realmente param)
- [ ] Teste de performance: sem frames >8ms durante 5s de movimento contínuo do mouse
- [ ] Nenhuma chamada de API, rota de auth ou schema alterado
- [ ] Paleta confere com a seção 2 (nenhum hex igual a stop padrão de framework)
- [ ] Composição confere com a seção 4 (núcleo fora do centro, anéis elípticos)
- [ ] Fundo preto (`--orion-bg`) aplicado em todas as telas, não só no shell do reactive core
- [ ] Ícones do painel inteiro usam `--orion-icon-default`, não cinza/branco neutro
- [ ] Hover de todo elemento interativo (sidebar, cards, botões, checkboxes) reage em violeta
      conforme seção 2.1, com transição de 150–200ms
- [ ] Contraste de texto conferido: `--orion-text-primary` ≥ 7:1, `--orion-text-secondary` ≥ 4.5:1

## 13. Relatório final esperado

Ao concluir, reportar: arquivos criados, arquivos modificados, duplicações corrigidas,
confirmação de que o backend não foi tocado, resultado do build, resultado dos testes
(incluindo o de performance da seção 6), e problemas restantes, se houver.
