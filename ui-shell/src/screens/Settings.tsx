import { setLocale, useLocale, useT, type MessageKey, type UiLocale } from "../i18n";
import {
  LAYOUT_CHOICES, THEME_CHOICES, layoutStore, themeStore, useLayoutPref, useTheme, type LayoutPref, type ThemePref,
} from "../state/prefs";
import { LockupLink } from "../brand/LockupLink";
import { WebLookupToggle } from "../newcase/WebLookupToggle";
import { ScreenFrame } from "./Screen";
import { TutorialButton } from "../tutorial/TutorialCoach";

type ChoiceProps<T extends string> = {
  label: MessageKey;
  hint?: MessageKey;
  value: T;
  choices: readonly T[];
  labelOf: (choice: T) => MessageKey;
  onChange: (choice: T) => void;
};

function ChoiceRow<T extends string>({ label, hint, value, choices, labelOf, onChange }: ChoiceProps<T>) {
  const t = useT();
  return (
    <div className="ui-field wb-choice" role="group" aria-label={t(label)}>
      <span className="ui-field__label">{t(label)}</span>
      <div className="ui-segmented">
        {choices.map((choice) => (
          <button key={choice} type="button" data-value={choice} aria-pressed={choice === value} onClick={() => onChange(choice)}>
            {t(labelOf(choice))}
          </button>
        ))}
      </div>
      {hint && <span className="ui-field__hint">{t(hint)}</span>}
    </div>
  );
}

export type SettingsViewProps = {
  theme: ThemePref;
  layoutPref: LayoutPref;
  locale: UiLocale;
  onTheme: (value: ThemePref) => void;
  onLayout: (value: LayoutPref) => void;
  onLocale: (value: UiLocale) => void;
};

export function SettingsView(props: SettingsViewProps) {
  const t = useT();
  return (
    <ScreenFrame title={t("screen.settings.title")}>
      <div className="wb-settings">
        <section className="ui-panel ui-panel--flush" aria-labelledby="wb-set-tutorial" data-wb-settings-tutorial>
          <div className="ui-panel__head"><h2 className="ui-panel__title" id="wb-set-tutorial">{t("tutorial.settings.title")}</h2></div>
          <div className="wb-settings__body">
            <p className="ui-meta">{t("tutorial.settings.hint")}</p>
            <div><TutorialButton className="ui-btn ui-btn--sm" /></div>
          </div>
        </section>

        <section className="ui-panel ui-panel--flush" aria-labelledby="wb-set-prefs">
          <div className="ui-panel__head"><h2 className="ui-panel__title" id="wb-set-prefs">{t("settings.display")}</h2></div>
          <div className="wb-settings__body">
            <ChoiceRow<UiLocale> label="settings.language" hint="settings.language.hint" value={props.locale}
              choices={["ko", "en"]} labelOf={(c) => `choice.${c}`} onChange={props.onLocale} />
            <ChoiceRow<ThemePref> label="settings.theme" value={props.theme}
              choices={THEME_CHOICES} labelOf={(c) => `choice.${c}`} onChange={props.onTheme} />
            <ChoiceRow<LayoutPref> label="settings.layout" hint="settings.layout.hint" value={props.layoutPref}
              choices={LAYOUT_CHOICES} labelOf={(c) => `choice.${c}`} onChange={props.onLayout} />
            <WebLookupToggle />
          </div>
        </section>

        <section className="ui-panel ui-panel--flush" aria-labelledby="wb-set-providers">
          <div className="ui-panel__head"><h2 className="ui-panel__title" id="wb-set-providers">{t("providers.title")}</h2></div>
          <div className="wb-settings__body">
            <ul className="ui-list wb-providers">
              <li data-provider="demo" data-connected="true">
                <div className="wb-providers__name">
                  <strong>Demo AI</strong>
                  <span className="ui-cluster"><span className="ui-status ui-status--positive">{t("providers.demo")}</span></span>
                </div>
              </li>
            </ul>
            <p className="ui-meta">{t("providers.demoHint")}</p>
          </div>
        </section>

        <section className="ui-panel ui-panel--flush" aria-labelledby="wb-set-about">
          <div className="ui-panel__head"><h2 className="ui-panel__title" id="wb-set-about">{t("settings.about")}</h2></div>
          <div className="wb-settings__body wb-about">
            <span className="ui-meta">{t("settings.about.line")}</span>
            <LockupLink />
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}

export function SettingsScreen() {
  const locale = useLocale();
  const theme = useTheme();
  const layoutPref = useLayoutPref();
  return (
    <SettingsView theme={theme} layoutPref={layoutPref} locale={locale}
      onTheme={themeStore.set} onLayout={layoutStore.set} onLocale={setLocale} />
  );
}
