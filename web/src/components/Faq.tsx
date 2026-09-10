import { useState, type ReactNode } from 'react';
import Reveal from './Reveal';

export type FaqItem = {
  question: string;
  answer: ReactNode;
};

type FaqProps = {
  items: FaqItem[];
};

export default function Faq({ items }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <div className="faq">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <Reveal key={item.question} as="div" className={`faq-item${open ? ' open' : ''}`}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={open}
              onClick={() => toggle(i)}
            >
              {item.question}
              <span className="faq-icon" aria-hidden="true" />
            </button>
            <div className="faq-a">
              <p>{item.answer}</p>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
