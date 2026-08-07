import type { ReactNode } from "react";

interface TranslationSafeInlineProps {
  identity: string;
  children: ReactNode;
}

export function TranslationSafeInline({ identity, children }: TranslationSafeInlineProps) {
  return (
    <span key={identity} data-translation-safe-inline="true">
      {children}
    </span>
  );
}
