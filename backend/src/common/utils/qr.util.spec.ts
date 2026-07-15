import { buildStudentQrPayload, verifyStudentQrPayload } from './qr.util';

describe('qr.util', () => {
  const secret = 'test-secret-do-not-use-in-prod';
  const params = { secret, academyId: 'acad_1', studentCode: 'STU-0001' };

  it('builds a signed payload with expected shape', () => {
    const { payload, signature } = buildStudentQrPayload(params);
    expect(payload).toMatch(/^TSKK\|acad_1\|STU-0001\|[a-f0-9]{16}$/);
    expect(signature).toHaveLength(16);
  });

  it('verifies a payload built with the same secret', () => {
    const { payload } = buildStudentQrPayload(params);
    const res = verifyStudentQrPayload(payload, secret);
    expect(res.valid).toBe(true);
    expect(res.academyId).toBe('acad_1');
    expect(res.studentCode).toBe('STU-0001');
  });

  it('rejects a payload signed with a different secret', () => {
    const { payload } = buildStudentQrPayload(params);
    expect(verifyStudentQrPayload(payload, 'wrong').valid).toBe(false);
  });

  it('rejects tampered payloads', () => {
    const { payload } = buildStudentQrPayload(params);
    const tampered = payload.replace('STU-0001', 'STU-9999');
    expect(verifyStudentQrPayload(tampered, secret).valid).toBe(false);
  });

  it('rejects malformed payloads', () => {
    expect(verifyStudentQrPayload('garbage', secret).valid).toBe(false);
    expect(verifyStudentQrPayload('TSKK|only|three', secret).valid).toBe(false);
  });
});
