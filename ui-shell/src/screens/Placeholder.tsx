import { useT } from "../i18n";
import { EmptyState, ScreenFrame } from "./Screen";

export function Placeholder({ kind }: { kind: "deliverables" }) {
  const t = useT();
  return (
    <ScreenFrame title={t(`screen.${kind}.title`)}>
      <EmptyState>{t(`screen.${kind}.soon`)}</EmptyState>
    </ScreenFrame>
  );
}
