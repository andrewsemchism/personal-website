import { MDXComponents } from 'mdx/types';
import Callout from './Callout';
import PostImage from './PostImage';

export const mdxComponents: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="font-sans font-bold text-[#fbfcff] text-3xl mt-8 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-mono text-[#d0ccd0] text-xl mt-8 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-mono text-[#d0ccd0] text-base mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="font-sans text-[#888e9e] leading-7 mb-4">{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-[#7796cb] hover:text-[#fbfcff] transition-colors">
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="text-[#fbfcff] font-semibold">{children}</strong>
  ),
  code: ({ children }) => (
    <code className="text-[#7796cb] bg-[#fbfcff]/8 font-mono text-sm px-1.5 py-0.5 rounded">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-[#1a2f3f] border border-[#7796cb]/20 rounded p-4 overflow-x-auto my-6 font-mono text-sm text-[#d0ccd0]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#7796cb] pl-4 italic text-[#888e9e] my-4">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-[#888e9e] mb-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-[#888e9e] mb-4 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="text-[#888e9e]">{children}</li>,
  hr: () => <hr className="border-[#7796cb]/20 my-8" />,
  Callout,
  PostImage,
};
