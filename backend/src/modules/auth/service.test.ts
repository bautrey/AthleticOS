// backend/src/modules/auth/service.test.ts
// Uses real database per NO MOCKS policy.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../../common/db.js';
import { authService } from './service.js';
import { UnauthorizedError, ValidationError } from '../../common/errors.js';

const EMAIL_NS = `auth-svc-${Date.now()}`;
const emailFor = (slot: string) => `${EMAIL_NS}-${slot}@test.com`;

let schoolId: string;

describe('authService', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const school = await prisma.school.create({
      data: { name: 'Auth Test School', timezone: 'America/New_York' },
    });
    schoolId = school.id;
  });

  afterAll(async () => {
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_NS } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.schoolUser.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_NS } } });
  });

  describe('register', () => {
    it('creates a user and never returns the password hash', async () => {
      const user = await authService.register({
        email: emailFor('register-basic'),
        password: 'a-strong-password',
        name: 'Pat',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(emailFor('register-basic'));
      expect(user.name).toBe('Pat');
      expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((user as Record<string, unknown>).password).toBeUndefined();
    });

    it('persists a bcrypt hash, not the plaintext password', async () => {
      const email = emailFor('register-hash');
      await authService.register({ email, password: 'super-secret-pw' });

      const stored = await prisma.user.findUnique({ where: { email } });
      expect(stored?.passwordHash).toBeTruthy();
      expect(stored?.passwordHash).not.toBe('super-secret-pw');
      // bcrypt prefixes: $2a$, $2b$, $2y$
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(await bcrypt.compare('super-secret-pw', stored!.passwordHash)).toBe(true);
    });

    it('throws ValidationError when email is already registered', async () => {
      const email = emailFor('register-dupe');
      await authService.register({ email, password: 'pw-one-pw-one' });

      await expect(
        authService.register({ email, password: 'pw-two-pw-two' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('allows registration without a name', async () => {
      const user = await authService.register({
        email: emailFor('register-no-name'),
        password: 'no-name-password',
      });
      expect(user.name).toBeNull();
    });
  });

  describe('login', () => {
    it('returns id + email for valid credentials', async () => {
      const email = emailFor('login-ok');
      const registered = await authService.register({ email, password: 'login-password' });

      const result = await authService.login({ email, password: 'login-password' });
      expect(result.id).toBe(registered.id);
      expect(result.email).toBe(email);
    });

    it('throws UnauthorizedError for unknown email', async () => {
      await expect(
        authService.login({ email: emailFor('login-unknown'), password: 'whatever' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError for wrong password', async () => {
      const email = emailFor('login-wrong-pw');
      await authService.register({ email, password: 'the-right-password' });

      await expect(
        authService.login({ email, password: 'the-wrong-password' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('uses the same error code for unknown-email and wrong-password (no enumeration)', async () => {
      // Security property: error responses should not let an attacker distinguish
      // "no such user" from "wrong password". Confirm both paths emit UNAUTHORIZED
      // with the same message.
      const email = emailFor('login-enum');
      await authService.register({ email, password: 'real-password' });

      const errUnknown = await authService
        .login({ email: emailFor('login-enum-other'), password: 'x' })
        .catch((e) => e);
      const errWrongPw = await authService
        .login({ email, password: 'wrong' })
        .catch((e) => e);

      expect(errUnknown).toBeInstanceOf(UnauthorizedError);
      expect(errWrongPw).toBeInstanceOf(UnauthorizedError);
      expect((errUnknown as UnauthorizedError).code).toBe((errWrongPw as UnauthorizedError).code);
      expect((errUnknown as UnauthorizedError).message).toBe(
        (errWrongPw as UnauthorizedError).message
      );
    });

    it('does not leak the password hash on the returned object', async () => {
      const email = emailFor('login-no-leak');
      await authService.register({ email, password: 'do-not-leak' });
      const result = await authService.login({ email, password: 'do-not-leak' });
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });

  describe('getProfile', () => {
    it('returns the user with their school memberships and roles', async () => {
      const email = emailFor('profile-with-school');
      const user = await authService.register({ email, password: 'profile-password' });
      await prisma.schoolUser.create({
        data: { userId: user.id, schoolId, role: 'ADMIN' },
      });

      const profile = await authService.getProfile(user.id);

      expect(profile.id).toBe(user.id);
      expect(profile.email).toBe(email);
      expect(profile.schools).toHaveLength(1);
      expect(profile.schools[0]).toEqual({ id: schoolId, name: 'Auth Test School', role: 'ADMIN' });
    });

    it('returns an empty schools array when the user has no memberships', async () => {
      const email = emailFor('profile-no-school');
      const user = await authService.register({ email, password: 'lonely-password' });
      const profile = await authService.getProfile(user.id);
      expect(profile.schools).toEqual([]);
    });

    it('throws UnauthorizedError when the user does not exist', async () => {
      await expect(
        authService.getProfile('00000000-0000-0000-0000-000000000000')
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('never returns the password hash', async () => {
      const email = emailFor('profile-no-hash');
      const user = await authService.register({ email, password: 'no-hash-password' });
      const profile = await authService.getProfile(user.id);
      expect((profile as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });
});
