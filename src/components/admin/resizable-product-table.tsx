import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

type SortColumn = 'name' | 'brand' | 'category' | 'status';
const columns = [
  { id: 'name', label: 'Product', width: 360, min: 180 },
  { id: 'brand', label: 'Brand', width: 190, min: 100 },
  { id: 'category', label: 'Category', width: 150, min: 100 },
  { id: 'status', label: 'Verification', width: 150, min: 110 },
  { id: 'availability', label: 'Availability', width: 150, min: 110 },
] as const;
const storageKey = 'substrate:admin-products:column-widths:v1';
const maxWidth = 1200;
const defaults = columns.map((column) => column.width as number);
const clamp = (width: number, index: number) => Math.round(Math.max(columns[index].min, Math.min(maxWidth, width)));

export default function ResizableProductTable({ sort, descending, onSort, children }: {
  sort: SortColumn; descending: boolean; onSort: (column: SortColumn) => void; children: ReactNode;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const drag = useRef<{ index: number; x: number; widths: number[] } | null>(null);
  const [widths, setWidths] = useState<number[]>(defaults);
  const latestWidths = useRef(widths);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const available = tableRef.current?.parentElement?.clientWidth;
    const scale = available ? (available - 44) / defaults.reduce((sum, width) => sum + width, 0) : 1;
    let next = defaults.map((width, index) => clamp(width * scale, index));
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        next = columns.map((column, index) => {
          const value = (saved as Record<string, unknown>)[column.id];
          return typeof value === 'number' && Number.isFinite(value) ? clamp(value, index) : column.width;
        });
      }
    } catch { /* Keep the default layout when browser storage is unavailable. */ }
    latestWidths.current = next;
    setWidths(next);
  }, []);

  function apply(next: number[], persist = false) {
    latestWidths.current = next;
    setWidths(next);
    if (persist) {
      try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(columns.map((column, index) => [column.id, next[index]])))); }
      catch { /* Resizing still works when local storage is disabled or full. */ }
    }
  }
  function measuredWidths() {
    const headers = tableRef.current?.querySelectorAll('thead th');
    return columns.map((_, index) => clamp(headers?.[index]?.getBoundingClientRect().width ?? latestWidths.current[index], index));
  }
  function finish() {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
    apply(latestWidths.current, true);
  }

  return <table ref={tableRef} className={'cms-table cms-product-table cms-resizable-table' + (resizing ? ' cms-resizing' : '')} style={{ width: widths.reduce((sum, width) => sum + width, 44) }}>
    <colgroup>{widths.map((width, index) => <col key={columns[index].id} style={{ width }} />)}<col style={{ width: 44 }} /></colgroup>
    <thead><tr>{columns.map((column, index) => <th key={column.id} aria-sort={column.id === sort ? descending ? 'descending' : 'ascending' : undefined}>
      {column.id === 'availability' ? column.label : <button onClick={() => onSort(column.id)}>{column.label}{column.id === sort ? descending ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : null}</button>}
      <span className="cms-column-resizer" role="separator" tabIndex={0} aria-label={'Resize ' + column.label + ' column'} aria-orientation="vertical" aria-valuemin={column.min} aria-valuemax={maxWidth} aria-valuenow={widths[index]} title="Drag to resize. Arrow keys adjust width; double-click to reset."
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          const measured = measuredWidths();
          drag.current = { index, x: event.clientX, widths: measured };
          apply(measured); setResizing(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active) return;
          const next = [...active.widths];
          next[active.index] = clamp(active.widths[active.index] + event.clientX - active.x, active.index);
          apply(next);
        }}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onDoubleClick={() => { const next = measuredWidths(); next[index] = column.width; apply(next, true); }}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const next = measuredWidths();
          next[index] = event.key === 'Home' ? column.min : event.key === 'End' ? maxWidth : clamp(next[index] + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 50 : 10), index);
          apply(next, true);
        }} />
    </th>)}<th><span className="cms-sr-only">Open product</span></th></tr></thead>
    {children}
  </table>;
}
