import type { ReactNode } from "react";
import { useT, type MessageKey } from "../i18n";

export type SolverState = "converged" | "unconverged" | "solving" | "unknown";
export type CaseInfo = {
  name: string;
  solverState: SolverState;
  unitCount: number;
  streamCount: number;
  unconvergedCount?: number;
  hysys?: { pid: number | null; owned: boolean };
  provider?: { name: string | null; signedIn: boolean };
  busy?: boolean;
  hysysDialog?: { text: string; unresponsive?: boolean };
};

export type HysysDialogInfo = { text: string; unresponsive?: boolean };

export function HysysDialogLine({ dialog, className, live = true }: { dialog: HysysDialogInfo | null; className?: string; live?: boolean }) {
  const t = useT();
  if (!dialog) return null;
  const line = dialog.unresponsive ? t("header.unresponsive.hint") : dialog.text ? t("newcase.waiting", { text: dialog.text }) : t("newcase.waitingGeneric");
  return <p className={`ui-meta${className ? ` ${className}` : ""}`} {...(live ? { role: "status" } : {})} data-wb-hysys-dialog-line>{line}</p>;
}

const SOLVER_LABEL: Record<SolverState, MessageKey> = {
  converged: "solver.converged",
  unconverged: "solver.unconverged",
  solving: "solver.solving",
  unknown: "solver.unknown",
};
const SOLVER_TONE: Record<SolverState, string> = {
  converged: "ui-status--positive",
  unconverged: "ui-status--warning",
  solving: "ui-status--info",
  unknown: "",
};

export function CaseHeader({ info, noCaseAction, dialog = null }: { info: CaseInfo | null; noCaseAction?: ReactNode; dialog?: HysysDialogInfo | null }) {
  const t = useT();
  return (
    <section className="wb-casehead" data-ui-moment="header-detail" aria-label={t("header.label")}>
      {info ? (
        <>
          <strong className="wb-casehead__name" title={info.name}>{info.name}</strong>
          <span className="wb-casehead__facts">
            <span key={info.solverState} className={`ui-status ${SOLVER_TONE[info.solverState]} wb-pop`.trim()} data-live={info.solverState === "solving" ? "" : undefined} title={info.unconvergedCount ? t("header.unconverged", { count: info.unconvergedCount }) : undefined}>
              {t(SOLVER_LABEL[info.solverState])}
              {info.unconvergedCount ? <span className="ui-num">{info.unconvergedCount}</span> : null}
            </span>
            <span className="ui-meta"><span className="ui-num">{info.unitCount}</span> {t("header.units")}</span>
            <span className="ui-meta"><span className="ui-num">{info.streamCount}</span> {t("header.streams")}</span>
            {info.hysysDialog?.unresponsive ? (
              <span className="ui-status ui-status--warning" data-wb-hysys-unresponsive title={t("header.unresponsive.hint")}>
                {t("header.unresponsive")}
              </span>
            ) : info.hysysDialog ? (
              <span className="ui-status ui-status--warning" data-wb-hysys-dialog
                title={[t("header.dialog.hint"), info.hysysDialog.text].filter(Boolean).join("\n")}>
                {t("header.dialog")}
              </span>
            ) : info.busy && <span className="ui-status ui-status--info wb-pop" data-live="" data-wb-busy title={t("header.busy.hint")}>{t("header.busy")}</span>}
          </span>
          <HysysDialogLine dialog={info.hysysDialog ?? null} className="wb-casehead__dialog" />
        </>
      ) : (
        <>
          <strong className="wb-casehead__name wb-casehead__name--none">{t("header.noCase")}</strong>
          {noCaseAction}
          <HysysDialogLine dialog={dialog} className="wb-casehead__dialog" />
        </>
      )}
    </section>
  );
}
