'use client';

export default function WorkspacePagination({ page, total, perPage, onPageChange }: { page: number; total: number; perPage: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 0), pages - 1);
  return (
    <div className="workspace-pagination">
      <span>{total === 0 ? 'No results' : `${safePage * perPage + 1}–${Math.min((safePage + 1) * perPage, total)} of ${total}`}</span>
      <div>
        <button type="button" onClick={() => onPageChange(safePage - 1)} disabled={safePage === 0}>Previous</button>
        <button type="button" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= pages - 1}>Next</button>
      </div>
    </div>
  );
}
