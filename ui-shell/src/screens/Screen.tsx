import type { ReactNode } from "react";

export function ScreenFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="wb-screen">
      <h1 className="ui-visually-hidden">{title}</h1>
      {children}
    </div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="wb-skeleton" data-wb-skeleton aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <span key={i} className="wb-skeleton__row" />)}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="wb-empty">{children}</p>;
}
