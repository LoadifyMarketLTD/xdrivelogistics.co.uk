export function marketplacePage(total: number, pageSize: number, requested: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, requested));
  const start = (page - 1) * pageSize;
  return { page, pageCount, start, end: Math.min(start + pageSize, total), hasPrevious: page > 1, hasNext: page < pageCount };
}
