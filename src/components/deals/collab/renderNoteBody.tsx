import React from 'react';

type PMNode = { type?: string; text?: string; attrs?: Record<string, any>; marks?: Array<{ type: string; attrs?: Record<string, any> }>; content?: PMNode[] };

const MENTION_CLASS = 'mention-chip rounded bg-blue-100 px-1 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';

const renderChildren = (n: PMNode): React.ReactNode[] => (n.content ?? []).map((c, i) => renderNode(c, i));

function renderNode(n: PMNode, key: number): React.ReactNode {
  switch (n.type) {
    case 'text': {
      let el: React.ReactNode = n.text ?? '';
      for (const m of n.marks ?? []) {
        if (m.type === 'bold') el = <strong>{el}</strong>;
        else if (m.type === 'italic') el = <em>{el}</em>;
        else if (m.type === 'strike') el = <s>{el}</s>;
        else if (m.type === 'code') el = <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">{el}</code>;
      }
      return <React.Fragment key={key}>{el}</React.Fragment>;
    }
    case 'mention':
      return <span key={key} data-testid="mention-chip" data-id={n.attrs?.id} className={MENTION_CLASS}>@{n.attrs?.label}</span>;
    case 'hardBreak': return <br key={key} />;
    case 'paragraph': return <p key={key} className="my-1">{renderChildren(n)}</p>;
    case 'heading': return <p key={key} className="my-1 font-semibold">{renderChildren(n)}</p>;
    case 'bulletList': return <ul key={key} className="my-1 list-disc pl-5">{renderChildren(n)}</ul>;
    case 'orderedList': return <ol key={key} className="my-1 list-decimal pl-5">{renderChildren(n)}</ol>;
    case 'listItem': return <li key={key}>{renderChildren(n)}</li>;
    case 'blockquote': return <blockquote key={key} className="my-1 border-l-2 border-gray-300 pl-3 text-gray-600 dark:text-gray-400">{renderChildren(n)}</blockquote>;
    case 'codeBlock': return <pre key={key} className="my-1 overflow-x-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">{renderChildren(n)}</pre>;
    default: return <React.Fragment key={key}>{renderChildren(n)}</React.Fragment>;
  }
}

/** Read-only render of a Tiptap JSON note body (mentions as chips); falls back to plain text. */
export const NoteBody: React.FC<{ body: unknown; fallback: string }> = ({ body, fallback }) => {
  const doc = body as PMNode | null;
  if (doc && typeof doc === 'object' && doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length) {
    return <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{renderChildren(doc)}</div>;
  }
  return <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-200">{fallback || 'Empty note'}</p>;
};
