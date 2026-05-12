import { memo } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const components: Partial<Components> = {
  p: ({ children, ...props }) => (
    <p className="my-0 leading-7" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-2 ml-5 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1 leading-7" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-white" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, href, ...props }) => (
    <a className="font-medium text-sky-300 underline decoration-sky-300/40 underline-offset-4 hover:text-sky-200" href={href} rel="noreferrer" target="_blank" {...props}>
      {children}
    </a>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`${className} block overflow-x-auto rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm leading-6 text-slate-100`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md border border-white/10 bg-white/[0.08] px-1.5 py-0.5 text-[0.92em] text-slate-100" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <div className="my-3">{children}</div>,
  h1: ({ children, ...props }) => (
    <h1 className="mb-2 mt-4 text-xl font-semibold leading-7 text-white" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold leading-7 text-white" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold leading-7 text-white" {...props}>
      {children}
    </h3>
  ),
};

const remarkPlugins = [remarkGfm, remarkBreaks];

function urlTransform(url: string) {
  return defaultUrlTransform(url);
}

function NonMemoizedMarkdownMessage({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-7">
      <ReactMarkdown components={components} remarkPlugins={remarkPlugins} urlTransform={urlTransform}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(
  NonMemoizedMarkdownMessage,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
