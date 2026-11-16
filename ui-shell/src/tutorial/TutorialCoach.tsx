import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useT } from "../i18n";
import { hashFor, useRoute } from "../router";
import { TUTORIAL_STEPS, pickTarget, stepBodyKey, stepTitleKey, tutorialStore, useTutorial, type TutorialStore } from "./steps";

type Box = { top: number; left: number; width: number; height: number };
const CARD_W = 360;
const GAP = 12;
const EDGE = 16;

function visibleMatch(selector: string): Element | null {
  for (const element of Array.from(document.querySelectorAll(selector))) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}

export function cardPosition(target: Box | null, card: { width: number; height: number }, view: { width: number; height: number }): { top: number; left: number } {
  const corner = { top: view.height - card.height - EDGE, left: view.width - card.width - EDGE };
  const onScreen = target && target.top < view.height && target.top + target.height > 0 && target.left < view.width && target.left + target.width > 0;
  if (!target || !onScreen) return corner;
  const left = Math.min(Math.max(EDGE, target.left), Math.max(EDGE, view.width - card.width - EDGE));
  if (target.top + target.height + GAP + card.height <= view.height - EDGE) return { top: target.top + target.height + GAP, left };
  if (target.top - GAP - card.height >= EDGE) return { top: target.top - GAP - card.height, left };
  const top = Math.max(EDGE, Math.min(target.top, view.height - card.height - EDGE));
  if (target.left + target.width + GAP + card.width <= view.width - EDGE) return { top, left: target.left + target.width + GAP };
  if (target.left - GAP - card.width >= EDGE) return { top, left: target.left - GAP - card.width };
  return corner;
}

export function TutorialCoach({ store = tutorialStore }: { store?: TutorialStore }) {
  const t = useT();
  const route = useRoute();
  const state = useTutorial(store);
  const step = TUTORIAL_STEPS[state.index];
  const [box, setBox] = useState<Box | null>(null);
  const [done, setDone] = useState(false);
  const [cardH, setCardH] = useState(240);
  const [view, setView] = useState(() => (typeof window === "undefined" ? { width: 1280, height: 800 } : { width: window.innerWidth, height: window.innerHeight }));
  const scrolledFor = useRef<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!state.open) return;
    const look = () => {
      const selector = pickTarget(step, (s) => visibleMatch(s) !== null);
      const target = selector ? visibleMatch(selector) : null;
      const rect = target?.getBoundingClientRect();
      const next = rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
      setBox((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setDone(step.done ? step.done({ route, has: (selector) => visibleMatch(selector) !== null }) : false);
      if (card.current) setCardH(card.current.offsetHeight);
      setView((prev) => (prev.width === window.innerWidth && prev.height === window.innerHeight ? prev : { width: window.innerWidth, height: window.innerHeight }));
      if (target && scrolledFor.current !== `${step.id} ${selector}`) {
        scrolledFor.current = `${step.id} ${selector}`;
        target.scrollIntoView?.({ block: "center", inline: "nearest" });
      }
    };
    look();
    const timer = window.setInterval(look, 400);
    window.addEventListener("resize", look);
    window.addEventListener("scroll", look, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", look);
      window.removeEventListener("scroll", look, true);
    };
  }, [state.open, step, route]);

  useEffect(() => {
    if (!state.open) return;
    title.current?.focus({ preventScroll: true });
  }, [state.open, state.index]);

  useEffect(() => {
    if (!state.open) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const back = before?.isConnected ? before : document.querySelector<HTMLElement>("[data-wb-tutorial-open]");
      back?.focus({ preventScroll: true });
    };
  }, [state.open]);

  const onCardKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    event.preventDefault();
    store.close();
  };

  if (!state.open) {
    if (state.seen) return null;
    return (
      <aside className="wb-coach wb-coach--invite" data-wb-tutorial="invite" aria-labelledby="wb-coach-invite" onKeyDown={onCardKey}>
        <p className="wb-coach__kicker">{t("tutorial.kicker")}</p>
        <h2 className="wb-coach__title" id="wb-coach-invite">{t("tutorial.invite.title")}</h2>
        <p className="wb-coach__body">{t("tutorial.invite.body")}</p>
        <div className="wb-coach__actions">
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => store.close()}>{t("tutorial.invite.later")}</button>
          <button type="button" className="ui-btn ui-btn--sm ui-btn--primary" data-wb-tutorial-start onClick={() => store.start(true)}>{t("tutorial.invite.start")}</button>
        </div>
      </aside>
    );
  }

  const width = Math.min(CARD_W, view.width - EDGE * 2);
  const pos = cardPosition(step.dock ? null : box, { width, height: cardH }, view);
  const elsewhere = step.route !== undefined && step.route !== route;
  const last = state.index === TUTORIAL_STEPS.length - 1;
  const spot: CSSProperties | undefined = box ? { top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 } : undefined;
  return (
    <>
      {spot && <div className="wb-coach-spot" style={spot} aria-hidden="true" data-wb-tutorial-spot />}
      <div
        ref={card} className="wb-coach" role="dialog" aria-modal="false" aria-labelledby="wb-coach-title" aria-describedby="wb-coach-body"
        data-wb-tutorial="step" data-step={step.id} style={{ top: pos.top, left: pos.left, width }} onKeyDown={onCardKey}
      >
        <div className="wb-coach__head">
          <p className="wb-coach__kicker"><span className="ui-num">{state.index + 1}</span> / <span className="ui-num">{TUTORIAL_STEPS.length}</span> · {t("tutorial.kicker")}</p>
          <button type="button" className="wb-coach__close" aria-label={t("tutorial.close")} onClick={() => store.close()}>×</button>
        </div>
        <div className="wb-coach__track" aria-hidden="true">
          {TUTORIAL_STEPS.map((item, index) => <span key={item.id} data-state={index < state.index ? "done" : index === state.index ? "now" : "next"} />)}
        </div>
        <h2 className="wb-coach__title" id="wb-coach-title" ref={title} tabIndex={-1}>{t(stepTitleKey(step))}</h2>
        <p className="wb-coach__body" id="wb-coach-body">{t(stepBodyKey(step), { count: TUTORIAL_STEPS.length })}</p>
        {step.done && (
          <p className={`wb-coach__check${done ? " is-done" : ""}`} role="status" data-wb-tutorial-done={done ? "true" : "false"}>
            <span aria-hidden="true">{done ? "✓" : "○"}</span> {t(done ? "tutorial.done" : "tutorial.todo")}
          </p>
        )}
        {elsewhere && step.route && (
          <a className="ui-btn ui-btn--sm" href={hashFor(step.route)} data-wb-tutorial-go>{t("tutorial.goThere")}</a>
        )}
        {step.target && !box && !elsewhere && !done && <p className="ui-meta">{t("tutorial.notOnScreen")}</p>}
        <div className="wb-coach__actions">
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" disabled={state.index === 0} onClick={() => store.prev()}>{t("tutorial.prev")}</button>
          <button type="button" className="ui-btn ui-btn--sm ui-btn--primary" data-wb-tutorial-next onClick={() => store.next()}>
            {last ? t("tutorial.finishButton") : done || !step.done ? t("tutorial.next") : t("tutorial.skip")}
          </button>
        </div>
      </div>
    </>
  );
}

export function TutorialButton({ className = "" }: { className?: string }) {
  const t = useT();
  const state = useTutorial();
  const label = state.finished ? t("tutorial.again") : state.index > 0 ? t("tutorial.resume") : t("tutorial.open");
  return (
    <button type="button" className={className} data-wb-tutorial-open onClick={() => tutorialStore.start(state.finished)}>{label}</button>
  );
}
