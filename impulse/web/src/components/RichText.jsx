import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const markdownComponents = {
  p: ({ children }) => <p className="m-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  img: ({ alt, src }) => (
    <img
      src={src}
      alt={alt || ''}
      className="my-3 max-h-[420px] w-full rounded-2xl border border-border object-contain"
      loading="lazy"
    />
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-4">
      {children}
    </a>
  ),
  code: ({ inline, children, className }) => (
    inline ? (
      <code className={`rounded-md bg-secondary/60 px-1.5 py-0.5 text-[0.95em] ${className || ''}`}>{children}</code>
    ) : (
      <code className={`block overflow-x-auto rounded-2xl bg-secondary/50 p-4 text-sm ${className || ''}`}>{children}</code>
    )
  ),
  pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-2xl bg-secondary/40 p-4 text-sm">{children}</pre>,
  table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
  th: ({ children }) => <th className="border border-border bg-secondary/30 px-3 py-2 text-left align-top font-bold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-border pl-4 italic text-muted-foreground">{children}</blockquote>,
};

function normalizeMarkdown(value = '') {
  const text = String(value);
  const hasDelimiters = /\$[^\$]+\$|\\\\\(|\\\\\)|\\\\\[|\\\\\]/.test(text);
  const looksLikeTeX = /\\(?:text|lim|frac|sum|int|left|right|cdot|sqrt|begin|end|alpha|beta|gamma|theta|pi|infty|rightarrow|leq|geq|cdot|times)/.test(text);

  if (looksLikeTeX && !hasDelimiters) {
    return `$${text}$`;
  }

  // Preserve single-line breaks by converting them to GFM hard breaks (two spaces + newline).
  // Avoid touching text that appears to contain display-math delimiters to reduce risk of
  // breaking multiline math expressions.
  const containsDisplayMath = /\$\$|\\\\\[|\\\\\]/.test(text);
  if (!containsDisplayMath) {
    return text.replace(/\r\n|\r|\n/g, '  \n');
  }

  return text;
}

function RichText({ children, className = '' }) {
  if (children === null || children === undefined || children === '') return null;

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {normalizeMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}

export default RichText;