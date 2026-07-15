import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  jest.setTimeout(15_000);

  it('produces argon2id hashes and verifies them', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct-horse-battery-staple')).toBe(true);
  });

  it('rejects mismatched passwords', async () => {
    const hash = await hashPassword('one');
    expect(await verifyPassword(hash, 'two')).toBe(false);
  });

  it('produces different hashes for the same input (unique salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});
