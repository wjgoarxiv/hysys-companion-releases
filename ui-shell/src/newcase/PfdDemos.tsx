import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "../i18n";
import { PFD_DEMOS, PFD_H, PFD_W, pfdDataUrl, type PfdDemo } from "./pfdDrawings";

export async function pfdPngDataUrl(demo: PfdDemo, scale = 2): Promise<string> {
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("demo PFD did not render"));
  });
  image.src = pfdDataUrl(demo);
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = PFD_W * scale;
  canvas.height = PFD_H * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d canvas");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function PfdDemos({ onUse }: { onUse: (pngDataUrl: string, demo: PfdDemo) => void }) {
  const t = useT();
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "ko";
  const [picked, setPicked] = useState<string>(PFD_DEMOS[0].id);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const demo = PFD_DEMOS.find((d) => d.id === picked) ?? PFD_DEMOS[0];
  const latest = useRef(0);
  useEffect(() => () => { latest.current = -1; }, []);
  const use = async () => {
    const id = ++latest.current;
    setState("busy");
    try {
      const png = await pfdPngDataUrl(demo);
      if (id !== latest.current) return;
      onUse(png, demo);
      setState("idle");
    } catch {
      if (id === latest.current) setState("error");
    }
  };
  return (
    <section className="wb-pfddemo" data-newcase="pfd-demos" aria-labelledby="wb-pfddemo-title">
      <div className="wb-pfddemo__head">
        <h3 className="wb-subhead" id="wb-pfddemo-title">{t("newcase.pfdDemo.title")}</h3>
        <p className="ui-meta">{t("newcase.pfdDemo.hint")}</p>
      </div>
      <ul className="wb-pfddemo__list">
        {PFD_DEMOS.map((item, index) => (
          <li key={item.id}>
            <button
              type="button" className="wb-pfddemo__card" data-pfd-demo={item.id} aria-pressed={item.id === picked}
              onClick={() => { latest.current += 1; setPicked(item.id); setState("idle"); }}
            >
              <img src={pfdDataUrl(item)} alt="" loading="lazy" width={PFD_W} height={PFD_H} />
              <span className="wb-pfddemo__name"><span className="ui-num ui-meta">{String(index + 1).padStart(2, "0")}</span> {item.title[lang]}</span>
            </button>
          </li>
        ))}
      </ul>
      <figure className="wb-pfddemo__view" data-newcase="pfd-demo-view">
        <img src={pfdDataUrl(demo)} alt={t("newcase.pfdDemo.alt", { name: demo.title[lang] })} width={PFD_W} height={PFD_H} />
        <figcaption>
          <strong>{demo.title[lang]}</strong>
          <span className="ui-meta">{demo.about[lang]}</span>
          <button type="button" className="ui-btn ui-btn--sm" data-pfd-demo-use disabled={state === "busy"} onClick={() => void use()}>
            {t("newcase.pfdDemo.use")}
          </button>
          {state === "error" && <span className="ui-field__error" role="alert">{t("newcase.pfdDemo.error")}</span>}
        </figcaption>
      </figure>
    </section>
  );
}
