import { isTauriRuntime } from "../api/client";
import { useT } from "../i18n";
import type { NewCaseClient } from "./client";
import { linkParts, openSourceLink, type AssumptionItem } from "./sources";

const EXCERPT_SHORT = 160;

function SourceLink({ url, label, client }: { url: string; label: string; client: Pick<NewCaseClient, "postJson"> }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" data-newcase-source
      onClick={(event) => void openSourceLink(event, url, { isTauri: () => isTauriRuntime(), client })}>{label}</a>
  );
}

export function AssumptionList({ items, client }: { items: AssumptionItem[]; client: Pick<NewCaseClient, "postJson"> }) {
  const t = useT();
  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${index}-${item.text}`}>
          {item.source ? item.text : linkParts(item.text).map((part, i) => (part.url
            ? <SourceLink key={i} url={part.url} label={part.text} client={client} />
            : <span key={i}>{part.text}</span>))}
          {item.source && (
            <div className="wb-assume__source">
              <SourceLink url={item.source.url} label={item.source.title} client={client} />
              {!item.source.verified && <span className="ui-meta" data-newcase-unverified> · {t("newcase.sourceUnverified")}</span>}
              {item.source.excerpt && (item.source.excerpt.length <= EXCERPT_SHORT
                ? <blockquote className="wb-assume__quote">{item.source.excerpt}</blockquote>
                : (
                  <details className="wb-assume__quote">
                    <summary>{item.source.excerpt.slice(0, EXCERPT_SHORT)}…</summary>
                    <blockquote>{item.source.excerpt}</blockquote>
                  </details>
                ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
