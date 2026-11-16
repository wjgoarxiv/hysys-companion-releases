import { useT } from "../i18n";
import { Lockup } from "./Lockup";

export const OWNER_URL = "https://github.com/wjgoarxiv";

export function LockupLink() {
  const t = useT();
  return (
    <a className="wb-lockup-link" href={OWNER_URL} target="_blank" rel="noopener noreferrer" aria-label={t("settings.about.ciLink")}>
      <Lockup />
    </a>
  );
}
