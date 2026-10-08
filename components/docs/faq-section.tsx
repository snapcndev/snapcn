import { Fragment } from "react";

/**
 * The visible half of the FAQPage schema — same list, so they cannot disagree.
 *
 * Inside the prose body so it reads as the page's last section — a category
 * page's, or a component panel's under its documentation (`doc-bodies.tsx`) —
 * and `#faq` is the `@id` the schema points at. Backticks in an answer are
 * inline code; `[text](url)` is a link to the source it names.
 */
export function FaqSection({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  if (questions.length === 0) return null;
  return (
    <>
      <h2 id="faq">Frequently asked questions</h2>
      {questions.map(({ question, answer }) => (
        <Fragment key={question}>
          <h3>{question}</h3>
          <p>
            {answer.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/).map((part) => {
              if (part.startsWith("`")) {
                return <code key={part}>{part.slice(1, -1)}</code>;
              }
              const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
              return link ? (
                <a key={part} href={link[2]} target="_blank" rel="noreferrer">
                  {link[1]}
                </a>
              ) : (
                part
              );
            })}
          </p>
        </Fragment>
      ))}
    </>
  );
}
