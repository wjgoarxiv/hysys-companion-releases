import { useLocale, useT } from "../i18n";
import { highlightStore } from "../pfd/highlight";
import { IDLE_PROBLEMS, useProblems } from "../problems/controller";
import { goTo, locateProblem, requestChange, type ProblemItem } from "../problems/model";
import { ProblemsView } from "../problems/ProblemsView";
import { useCase } from "../state/case";
import { ScreenFrame } from "./Screen";

export function Problems() {
  const t = useT();
  const locale = useLocale();
  const { summary, loading, error, refresh } = useCase();
  const attached = summary?.attached ? summary : null;
  const fileSessionId = attached?.file_session_id ?? null;
  const { state, reload } = useProblems(fileSessionId);
  const noCase = summary && !summary.attached ? { reason: locale === "en" ? summary.reason_en : summary.reason_ko } : undefined;
  const caseState = !summary
    ? { ...IDLE_PROBLEMS, status: error && !loading ? ("error" as const) : ("loading" as const), error }
    : state;

  const onLocate = (item: ProblemItem) => locateProblem(item, { highlight: highlightStore, navigate: goTo });;
  const onFix = (item: ProblemItem) => { if (fileSessionId) requestChange(item, fileSessionId, locale); };

  return (
    <ScreenFrame title={t("screen.problems.title")}>
      <ProblemsView state={caseState} onRefresh={summary ? reload : () => void refresh()} onLocate={onLocate} onFix={onFix} noCase={noCase} />
    </ScreenFrame>
  );
}
