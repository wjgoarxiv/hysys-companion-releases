import { useSyncExternalStore } from "react";

export const ROUTES = ["case", "problems", "versions", "new", "settings", "studies", "deliverables"] as const;
export type RouteId = (typeof ROUTES)[number];

export function parseHash(hash: string): RouteId {
  const id = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return ROUTES.find((route) => route === id) ?? "case";
}

export const hashFor = (route: RouteId): string => `#/${route}`;

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function useRoute(): RouteId {
  return parseHash(useSyncExternalStore(subscribe, () => window.location.hash, () => ""));
}
