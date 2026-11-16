import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useT } from "../i18n";
import { fillStep, onCommandFill } from "../agent/suggest";
import { shouldSubmitOnKey, submitCommand } from "./commandBarLogic";

export type CommandBarProps = {
  onSubmit: (text: string) => void;
  focusSignal?: number;
};

export function CommandBar({ onSubmit, focusSignal = 0 }: CommandBarProps) {
  const t = useT();
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);
  const lastFilled = useRef<string | null>(null);
  const textNow = useRef(text);
  textNow.current = text;
  useEffect(() => onCommandFill((next) => {
    const step = fillStep(textNow.current, next, lastFilled.current);
    lastFilled.current = step.lastFilled;
    textNow.current = step.text;
    setText(step.text);
    input.current?.focus();
  }), []);

  const send = () => {
    if (submitCommand(text, onSubmit)) setText("");
  };
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitOnKey({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form className="wb-command" onSubmit={onFormSubmit} data-wb-command-bar>
      <label className="ui-visually-hidden" htmlFor="wb-command-input">{t("agent.label")}</label>
      <textarea
        id="wb-command-input" ref={input} className="ui-textarea wb-command__input" rows={2}
        placeholder={t("agent.placeholder")} value={text}
        onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown}
      />
      <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" disabled={text.trim() === ""}>{t("agent.send")}</button>
    </form>
  );
}
