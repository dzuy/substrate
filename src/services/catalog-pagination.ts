/** Traverse provider row limits with stable ordering; never silently truncate a catalog. */
export async function collectCatalogRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  concurrency = 1,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error('Catalog concurrency must be an integer from 1 to 4.');
  }
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size * concurrency) {
    const results = await Promise.all(Array.from({ length: concurrency }, (_, index) => {
      const start = from + index * size;
      return page(start, start + size - 1);
    }));
    // Consume in catalog order, even when network requests finish out of order.
    for (const result of results) {
      if (result.error) return { data: null, error: result.error };
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < size) return { data: rows, error: null };
    }
  }
}
