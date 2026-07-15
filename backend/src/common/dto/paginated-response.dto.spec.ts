import { buildPaginationMeta, paginate } from './paginated-response.dto';

describe('paginated-response.dto', () => {
  describe('buildPaginationMeta', () => {
    it('computes total pages and navigation flags', () => {
      const meta = buildPaginationMeta(1, 20, 45);
      expect(meta.totalPages).toBe(3);
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrevious).toBe(false);
    });
    it('marks the last page correctly', () => {
      const meta = buildPaginationMeta(3, 20, 45);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrevious).toBe(true);
    });
    it('always reports at least 1 total page for an empty result', () => {
      expect(buildPaginationMeta(1, 20, 0).totalPages).toBe(1);
    });
  });

  describe('paginate', () => {
    it('returns the data plus computed meta', () => {
      const res = paginate(['a', 'b'], 2, 10, 15);
      expect(res.data).toEqual(['a', 'b']);
      expect(res.meta.page).toBe(2);
      expect(res.meta.total).toBe(15);
    });
  });
});
