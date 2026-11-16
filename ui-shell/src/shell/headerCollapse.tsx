import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useT } from "../i18n";

export const HEADER_COLLAPSE_PX = 420;
export const headerCollapsed = (width: number): boolean => width < HEADER_COLLAPSE_PX;

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export function useHeaderCollapsed(): boolean {
  return useSyncExternalStore(subscribe, () => headerCollapsed(window.innerWidth), () => false);
}

export function HeaderActions({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!collapsed) return <>{children}</>;
  return (
    <details className="wb-more wb-headmenu" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="ui-btn ui-btn--sm ui-btn--quiet" aria-label={t("versions.more")}>···</summary>
      <div className="wb-more__menu" onClick={() => setOpen(false)}>{children}</div>
    </details>
  );
}
