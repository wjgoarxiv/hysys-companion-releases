import { useT } from "../i18n";
import { NewCaseView } from "../newcase/NewCaseView";
import { ScreenFrame } from "./Screen";

export function NewCase() {
  const t = useT();
  return (
    <ScreenFrame title={t("screen.new.title")}>
      <NewCaseView />
    </ScreenFrame>
  );
}
