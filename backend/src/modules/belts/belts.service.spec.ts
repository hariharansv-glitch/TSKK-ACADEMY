import { BadRequestException } from '@nestjs/common';
import { BeltsService } from './belts.service';

/**
 * Unit tests for the private belt progression rule. We access the private
 * method through the prototype to keep the rule specification tight, without
 * needing to mock the entire service (Prisma, Audit, Certificates).
 */
describe('BeltsService.assertBeltProgression', () => {
  const svc = Object.create(BeltsService.prototype) as BeltsService;
  const assert = (from: string, to: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).assertBeltProgression(from, to);

  it('allows a normal progression', () => {
    expect(() => assert('WHITE', 'YELLOW')).not.toThrow();
    expect(() => assert('YELLOW', 'GREEN')).not.toThrow();
    expect(() => assert('RED', 'BLACK')).not.toThrow();
  });

  it('rejects a demotion', () => {
    expect(() => assert('BLACK', 'RED')).toThrow(BadRequestException);
  });

  it('rejects a same-level exam', () => {
    expect(() => assert('YELLOW', 'YELLOW')).toThrow(BadRequestException);
  });

  it('rejects unknown belts', () => {
    // @ts-expect-error deliberately passing invalid values
    expect(() => assert('PINK', 'BLUE')).toThrow(BadRequestException);
  });

  it('allows skipping intermediate belts (accelerated promotion)', () => {
    expect(() => assert('WHITE', 'GREEN')).not.toThrow();
  });
});
