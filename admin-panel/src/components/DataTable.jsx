import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Empty } from './ui.jsx';

export default function DataTable({
  columns,
  rows,
  searchKeys,
  searchPlaceholder = 'Qidirish...',
  pageSize = 10,
  toolbarExtra,
  emptyTitle,
  emptyText,
  initialSort,
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort || { key: null, dir: 'asc' });
  const [page, setPage] = useState(1);

  const keys = searchKeys || columns.map((c) => c.key);

  const filtered = useMemo(() => {
    let data = rows || [];
    if (q.trim()) {
      const needle = q.toLowerCase();
      data = data.filter((r) =>
        keys.some((k) => String(r[k] ?? '').toLowerCase().includes(needle))
      );
    }
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      const getVal = col?.value || ((r) => r[sort.key]);
      data = [...data].sort((a, b) => {
        let va = getVal(a), vb = getVal(b);
        if (typeof va === 'number' && typeof vb === 'number') return sort.dir === 'asc' ? va - vb : vb - va;
        va = String(va ?? ''); vb = String(vb ?? '');
        return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return data;
  }, [rows, q, sort, columns, keys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  const pageNumbers = useMemo(() => {
    const arr = [];
    const around = 1;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - around && i <= safePage + around)) arr.push(i);
      else if (arr[arr.length - 1] !== '…') arr.push('…');
    }
    return arr;
  }, [totalPages, safePage]);

  return (
    <div>
      <div className="table-toolbar">
        <div className="input-icon">
          <Search size={16} />
          <input
            className="input"
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        {toolbarExtra}
      </div>

      {pageRows.length === 0 ? (
        <Empty title={emptyTitle} text={emptyText} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={c.sortable ? 'sortable' : ''}
                    style={{ width: c.width, textAlign: c.align }}
                    onClick={() => c.sortable && toggleSort(c.key)}
                  >
                    <span className="th-inner">
                      {c.label}
                      {c.sortable && sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={row.id ?? row.code ?? i}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align }}>
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="pagination">
          <span className="muted">{filtered.length} ta yozuv</span>
          <button className="page-btn" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft size={16} />
          </button>
          {pageNumbers.map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="muted">…</span>
            ) : (
              <button key={n} className={`page-btn ${n === safePage ? 'active' : ''}`} onClick={() => setPage(n)}>
                {n}
              </button>
            )
          )}
          <button className="page-btn" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
