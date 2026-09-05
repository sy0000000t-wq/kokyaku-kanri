import { Card, CardHeader } from "@/components/ui";

/** 説明文の中で使う小さな部品。見た目をそろえるためにここに集める */

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-3 p-4 text-sm leading-relaxed">{children}</div>
    </Card>
  );
}

/** 手順。番号を振って、上から順にやれば終わる形にする */
export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-medium text-white">
            {i + 1}
          </span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** 画面上の場所を指すときに使う */
export function Where({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-canvas px-1.5 py-0.5 font-medium whitespace-nowrap">
      {children}
    </span>
  );
}

/** 覚えておくと得なこと */
export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border-l-2 border-brand bg-brand-soft/50 px-3 py-2 text-xs">
      {children}
    </p>
  );
}

/** 気をつけること */
export function Caution({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border-l-2 border-warn bg-warn-soft px-3 py-2 text-xs">
      {children}
    </p>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2.5 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2.5 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
