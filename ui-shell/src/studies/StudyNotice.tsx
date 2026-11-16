import { hashFor } from "../router";
import { useT } from "../i18n";
import type { StudyNotice as Notice } from "./store";

export function StudyNotice({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const t = useT();
  if (!notice) return null;
  const allOk = notice.kind === "dynamics" ? "studies.notice.doneDynamics" : "studies.notice.doneAll";
  const key = notice.state === "done" ? (notice.failed ? "studies.notice.done" : allOk) : notice.state === "failed" ? "studies.notice.failed" : "studies.notice.interrupted";
  return (
    <div className="wb-dock-notice wb-study-notice" role="status" data-wb-study-notice={notice.state}>
      <span>{t(key, { name: notice.name, failed: notice.failed, total: notice.total })}</span>
      <a className="ui-btn ui-btn--sm" href={hashFor("studies")}>{t("studies.notice.show")}</a>
      <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" aria-label={t("studies.notice.dismiss")} onClick={onDismiss}>×</button>
    </div>
  );
}
