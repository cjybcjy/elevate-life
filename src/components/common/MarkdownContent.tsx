import type { ReactNode } from 'react';

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

function isBlank(line: string) {
  return line.trim().length === 0;
}

function isFence(line: string) {
  return /^\s*```/.test(line);
}

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.slice(1, -1).includes('|');
}

function isTableSeparator(line: string | undefined) {
  if (!line || !isTableLine(line)) return false;
  return splitTableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableCells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function pushParagraph(blocks: MarkdownBlock[], lines: string[]) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  if (cleanLines.length > 0) {
    blocks.push({ type: 'paragraph', lines: cleanLines });
  }
  lines.length = 0;
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isBlank(line)) {
      pushParagraph(blocks, paragraphLines);
      index += 1;
      continue;
    }

    if (isFence(line)) {
      pushParagraph(blocks, paragraphLines);
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !isFence(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      index += index < lines.length ? 1 : 0;
      continue;
    }

    if (isTableLine(line) && isTableSeparator(lines[index + 1])) {
      pushParagraph(blocks, paragraphLines);
      const headers = splitTableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableLine(lines[index])) {
        rows.push(splitTableCells(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      pushParagraph(blocks, paragraphLines);
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3 | 4,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const unorderedMatch = /^\s*[-*]\s+(.+)$/.exec(line);
    if (unorderedMatch) {
      pushParagraph(blocks, paragraphLines);
      const items: string[] = [];
      while (index < lines.length) {
        const match = /^\s*[-*]\s+(.+)$/.exec(lines[index]);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    const orderedMatch = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (orderedMatch) {
      pushParagraph(blocks, paragraphLines);
      const items: string[] = [];
      while (index < lines.length) {
        const match = /^\s*\d+[.)]\s+(.+)$/.exec(lines[index]);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const quoteMatch = /^\s*>\s?(.+)$/.exec(line);
    if (quoteMatch) {
      pushParagraph(blocks, paragraphLines);
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const match = /^\s*>\s?(.+)$/.exec(lines[index]);
        if (!match) break;
        quoteLines.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  pushParagraph(blocks, paragraphLines);
  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    const codeIndex = rest.indexOf('`');
    const boldIndex = rest.indexOf('**');
    const nextIndex = [codeIndex, boldIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? -1;

    if (nextIndex < 0) {
      nodes.push(rest);
      break;
    }

    if (nextIndex > 0) {
      nodes.push(rest.slice(0, nextIndex));
      rest = rest.slice(nextIndex);
      continue;
    }

    if (rest.startsWith('`')) {
      const end = rest.indexOf('`', 1);
      if (end > 0) {
        nodes.push(
          <code
            key={`code-${key++}`}
            className="rounded bg-ledger-bg px-1 py-0.5 text-[0.92em] text-[var(--color-text-primary)]"
          >
            {rest.slice(1, end)}
          </code>,
        );
        rest = rest.slice(end + 1);
        continue;
      }
    }

    if (rest.startsWith('**')) {
      const end = rest.indexOf('**', 2);
      if (end > 0) {
        nodes.push(<strong key={`strong-${key++}`}>{renderInlineMarkdown(rest.slice(2, end))}</strong>);
        rest = rest.slice(end + 2);
        continue;
      }
    }

    nodes.push(rest[0]);
    rest = rest.slice(1);
  }

  return nodes;
}

function renderLines(lines: string[]) {
  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 && <br />}
      {renderInlineMarkdown(line)}
    </span>
  ));
}

export default function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-3 text-sm leading-6 text-[var(--color-text-primary)]">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
          const sizeClass = block.level <= 2 ? 'text-base' : 'text-sm';
          return (
            <Tag key={`heading-${index}`} className={`${sizeClass} font-semibold text-[var(--color-text-primary)]`}>
              {renderInlineMarkdown(block.text)}
            </Tag>
          );
        }

        if (block.type === 'paragraph') {
          return (
            <p key={`paragraph-${index}`} className="text-ledger-muted">
              {renderLines(block.lines)}
            </p>
          );
        }

        if (block.type === 'unordered-list') {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 text-ledger-muted">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5 text-ledger-muted">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={`quote-${index}`} className="border-l-2 border-ledger-primary/30 pl-3 text-ledger-muted">
              {renderLines(block.lines)}
            </blockquote>
          );
        }

        if (block.type === 'code') {
          return (
            <pre key={`code-${index}`} className="overflow-x-auto rounded-md bg-ledger-bg p-3 text-xs leading-5 text-[var(--color-text-primary)]">
              <code>{block.text}</code>
            </pre>
          );
        }

        return (
          <div key={`table-${index}`} className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-ledger-primary/10">
                  {block.headers.map((header, headerIndex) => (
                    <th key={`${header}-${headerIndex}`} className="px-2 py-2 text-left font-semibold text-[var(--color-text-primary)]">
                      {renderInlineMarkdown(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-b border-ledger-primary/5">
                    {block.headers.map((_, cellIndex) => (
                      <td key={`cell-${rowIndex}-${cellIndex}`} className="px-2 py-2 align-top text-ledger-muted">
                        {renderInlineMarkdown(row[cellIndex] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
