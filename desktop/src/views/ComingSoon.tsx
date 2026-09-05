import React from 'react';
import { Hammer } from 'lucide-react';
import { viewTitle } from '@/app/nav';

export function ComingSoon({ view }: { view: string }) {
  return (
    <div className="view-appear flex h-full items-center justify-center">
      <div className="w-[min(520px,92vw)] rounded-lg bg-[var(--orion-surface)] p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15">
          <Hammer className="orion-icon-active h-6 w-6" />
        </div>
        <h2 className="m-0 text-xl font-bold text-foreground">{viewTitle(view)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Esta tela está sendo migrada para o novo painel React com shadcn/ui. Em breve ela estará disponível aqui
          com o mesmo conteúdo e funcionalidades de antes.
        </p>
      </div>
    </div>
  );
}