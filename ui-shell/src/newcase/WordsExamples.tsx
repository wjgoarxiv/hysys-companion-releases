import { useState } from "react";
import { useLocale, useT, type MessageKey } from "../i18n";
import { EXAMPLE_CATEGORIES, WORDS_EXAMPLES, filterExamples, type ExampleCategory } from "./examples";

const countOf = (id: ExampleCategory) => WORDS_EXAMPLES.filter((example) => example.category === id).length;

export function WordsExamples({ onPick, initialCategory = EXAMPLE_CATEGORIES[0] }: { onPick: (text: string) => void; initialCategory?: ExampleCategory }) {
  const t = useT();
  const locale = useLocale();
  const [category, setCategory] = useState<ExampleCategory>(initialCategory);
  const [query, setQuery] = useState("");
  const shown = filterExamples(query, category);
  const searching = query.trim() !== "";
  return (
    <section className="wb-examples" data-newcase="examples" aria-labelledby="wb-examples-title">
      <div className="wb-examples__head">
        <h3 className="wb-subhead" id="wb-examples-title">{t("newcase.examples.title")}</h3>
        <label className="wb-examples__filter">
          <span className="ui-visually-hidden">{t("newcase.examples.filter")}</span>
          <input type="search" className="ui-input" placeholder={t("newcase.examples.filterHint")} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <ul className="wb-examples__cats" aria-label={t("newcase.examples.categories")}>
        {EXAMPLE_CATEGORIES.map((id) => (
          <li key={id}>
            <button
              type="button" className="wb-examples__cat" data-example-category={id}
              aria-pressed={!searching && id === category} onClick={() => { setCategory(id); setQuery(""); }}
            >
              <span>{t(`newcase.cat.${id}` as MessageKey)}</span>
              <span className="wb-examples__count ui-num" aria-hidden="true">{countOf(id)}</span>
            </button>
          </li>
        ))}
      </ul>
      {searching && shown.length > 0 && <p className="ui-meta" role="status" data-examples-count>{t("newcase.examples.found", { count: String(shown.length) })}</p>}
      {shown.length === 0 ? (
        <p className="ui-meta" role="status">{t("newcase.examples.none")}</p>
      ) : (
        <ul className="wb-examples__list">
          {shown.map((example, index) => {
            const text = locale === "en" ? example.en : example.ko;
            return (
              <li key={example.id}>
                <button type="button" className="wb-excard" data-example={example.id} onClick={() => onPick(text)}>
                  <span className="wb-excard__top">
                    <span className="wb-excard__no ui-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    {example.baseCase && <span className="ui-tag" title={t("newcase.examples.baseCaseHint")}>{t("newcase.examples.baseCase")}</span>}
                  </span>
                  <span className="wb-excard__text">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
