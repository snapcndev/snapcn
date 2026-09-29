import { Fragment } from "react";

/**
 * The visible half of the FAQPage schema — same list, so they cannot disagree.
 *
 * Inside the prose body so it reads as the page's last section — a category
 * page's, or a component panel's under its documentation (`doc-bodies.tsx`) —
 * and `#faq` is the `@id` the schema points at. Backticks in an answer are inline code.
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
            {answer
              .split("`")
              .map((part, i) =>
                i % 2 ? <code key={part}>{part}</code> : part,
              )}
          </p>
        </Fragment>
      ))}
    </>
  );
}
