import { useT } from "../i18n";
import { useWebLookupPref, webLookupStore, type WebLookupStore } from "./webLookup";

export function WebLookupToggle({ store = webLookupStore }: { store?: WebLookupStore }) {
  const t = useT();
  const pref = useWebLookupPref(store);
  return (
    <div className="ui-field wb-choice" role="group" aria-label={t("settings.webLookup")}>
      <span className="ui-field__label">{t("settings.webLookup")}</span>
      <div className="ui-segmented">
        {(["on", "off"] as const).map((value) => (
          <button
            key={value} type="button" data-value={value}
            aria-pressed={value === pref} onClick={() => store.set(value)}
          >
            {t(value === "on" ? "choice.on" : "choice.off")}
          </button>
        ))}
      </div>
      <span className="ui-field__hint">{t("settings.webLookup.hint")}</span>
    </div>
  );
}
