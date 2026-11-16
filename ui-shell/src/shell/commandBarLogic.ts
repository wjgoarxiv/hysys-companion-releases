type KeyChord = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean };

export function isFocusShortcut(event: KeyChord): boolean {
  return event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

export function installFocusShortcut(target: EventTarget, focus: () => void): () => void {
  const onKeyDown = (event: Event) => {
    if (!isFocusShortcut(event as KeyboardEvent)) return;
    event.preventDefault();
    focus();
  };
  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}

export function submitCommand(raw: string, onSubmit: (text: string) => void): boolean {
  const text = raw.trim();
  if (!text) return false;
  onSubmit(text);
  return true;
}

export function shouldSubmitOnKey(event: { key: string; shiftKey: boolean; isComposing: boolean }): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
