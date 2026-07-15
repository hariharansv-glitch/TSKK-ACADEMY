import { hmacSha256, randomToken, sha256, timingSafeEqual } from './hash.util';

describe('hash.util', () => {
  describe('sha256', () => {
    it('is deterministic and hex-encoded', () => {
      const a = sha256('hello');
      const b = sha256('hello');
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{64}$/);
    });
    it('produces different digests for different inputs', () => {
      expect(sha256('a')).not.toBe(sha256('b'));
    });
  });

  describe('hmacSha256', () => {
    it('is keyed and different from bare sha256', () => {
      expect(hmacSha256('secret', 'hello')).toMatch(/^[a-f0-9]{64}$/);
      expect(hmacSha256('secret', 'hello')).not.toBe(hmacSha256('other', 'hello'));
    });
  });

  describe('randomToken', () => {
    it('returns unique base64url strings', () => {
      const a = randomToken();
      const b = randomToken();
      expect(a).not.toBe(b);
      expect(a).not.toMatch(/[+/=]/);
    });
  });

  describe('timingSafeEqual', () => {
    it('matches equal strings and rejects unequal ones', () => {
      expect(timingSafeEqual('abc', 'abc')).toBe(true);
      expect(timingSafeEqual('abc', 'abd')).toBe(false);
      expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    });
  });
});
