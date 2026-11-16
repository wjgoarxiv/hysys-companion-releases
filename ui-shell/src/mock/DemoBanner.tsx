import { useLocale } from "../i18n";

const TEXT = {
  ko: "화면 데모예요. 미리 만든 예시 데이터로 움직이고, 실제 HYSYS나 AI에는 연결하지 않아요.",
  en: "Screen demo on sample data. It connects to no HYSYS and no AI.",
} as const;

const CSS = `
.demo-banner { box-sizing: border-box; min-height: 32px; padding: 6px 16px; font-size: 13px; line-height: 20px; text-align: center;
  background: var(--c-surface); color: var(--c-ink); border-bottom: 1px solid var(--c-frame); }
@media (min-width: 861px) {
  .ui-app__nav { height: calc(100vh - 33px); }
}
`;

export function DemoBanner() {
  const locale = useLocale();
  return (
    <>
      <style>{CSS}</style>
      <div role="note" className="demo-banner" data-demo-banner>{TEXT[locale === "en" ? "en" : "ko"]}</div>
    </>
  );
}
