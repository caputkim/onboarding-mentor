import ReactMarkdown from "react-markdown";

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`md text-sm leading-relaxed ${className}`}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
