let pending: string | null = null;
const listeners = new Set<() => void>();

export function setNewCaseSeed(text: string): void {
  pending = text;
  listeners.forEach((listener) => listener());
}

export function peekNewCaseSeed(): string | null {
  return pending;
}

export function takeNewCaseSeed(): string | null {
  const text = pending;
  pending = null;
  return text;
}

export function subscribeNewCaseSeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
