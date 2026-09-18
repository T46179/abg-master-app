import type { ReactNode } from "react";
import { cn } from "../utils";
import { PublicBackLink } from "../shared/PublicBackLink";

interface PublicPageShellProps {
  children: ReactNode;
  pageClassName?: string;
  articleClassName?: string;
  showEducationalDisclaimer?: boolean;
}

export function PublicPageShell({
  children,
  pageClassName,
  articleClassName,
  showEducationalDisclaimer = false
}: PublicPageShellProps) {
  return (
    <main className={cn("comp-rules-page", "public-page-shell", pageClassName)}>
      <article className={cn("comp-rules-page__article", "public-page-shell__article", articleClassName)}>
        <PublicBackLink />
        {children}
        {showEducationalDisclaimer ? (
          <footer className="comp-rules-page__footer">
            ABG Master · Educational tool. Not a substitute for clinical judgement.
          </footer>
        ) : null}
      </article>
    </main>
  );
}
