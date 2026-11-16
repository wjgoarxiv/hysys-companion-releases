import { useLocale, useT } from "../i18n";
import { detachedReason, useCase } from "../state/case";
import type { Layout } from "../state/prefs";
import { VersionsView } from "../versions/VersionsView";
import { useVersionBrowser } from "../versions/useVersions";

export function Versions({ layout = "wide" }: { layout?: Layout }) {
  const locale = useLocale();
  const t = useT();
  const { summary, loading, error, switching, refresh } = useCase();
  const attached = summary?.attached ? summary : null;
  const sessionId = attached && attached.file_session_id ? attached.file_session_id : null;
  const browser = useVersionBrowser(sessionId, refresh);
  const caseStatus = attached ? "ready" : loading && !summary ? "loading" : error && !summary ? "error" : "detached";
  const caseMessage = summary && !summary.attached
    ? detachedReason(summary, locale, switching, t("casehome.switching"))
    : null;

  return (
    <VersionsView
      {...browser}
      caseStatus={caseStatus}
      caseMessage={caseMessage}
      layout={layout}
      openFile={attached ? attached.case_name : null}
      onRetryCase={() => { void refresh(); }}
    />
  );
}
