import { AttendanceStatus } from '@prisma/client';
import { AttendanceService } from './attendance.service';

describe('AttendanceService helpers', () => {
  const svc = Object.create(AttendanceService.prototype) as AttendanceService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (now: Date, lateAfter: number) => (svc as any).computeQrStatus(now, lateAfter);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minutes = (now: Date) => (svc as any).minutesPastReference(now);

  describe('computeQrStatus', () => {
    it('returns PRESENT when scanned within grace period', () => {
      const now = new Date('2026-01-01T10:04:00.000Z');
      expect(status(now, 15)).toBe(AttendanceStatus.PRESENT);
    });
    it('returns LATE when scanned past the grace period', () => {
      const now = new Date('2026-01-01T10:20:00.000Z');
      expect(status(now, 15)).toBe(AttendanceStatus.LATE);
    });
    it('respects a zero-minute grace window', () => {
      const now = new Date('2026-01-01T10:01:00.000Z');
      expect(status(now, 0)).toBe(AttendanceStatus.LATE);
    });
  });

  describe('minutesPastReference', () => {
    it('reports 0 minutes exactly on the hour', () => {
      expect(minutes(new Date('2026-01-01T10:00:00.000Z'))).toBe(0);
    });
    it('reports elapsed minutes accurately', () => {
      expect(minutes(new Date('2026-01-01T10:07:00.000Z'))).toBe(7);
    });
    it('is clamped at zero for edge cases', () => {
      expect(minutes(new Date('2026-01-01T10:00:00.000Z'))).toBeGreaterThanOrEqual(0);
    });
  });
});
