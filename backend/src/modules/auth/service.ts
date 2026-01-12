// backend/src/modules/auth/service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../../common/db.js';
import { UnauthorizedError, ValidationError } from '../../common/errors.js';
import type { RegisterInput, LoginInput } from './schemas.js';

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ValidationError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
      },
      select: { id: true, email: true, createdAt: true },
    });

    return user;
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return { id: user.id, email: user.email };
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        schoolUsers: {
          select: {
            role: true,
            school: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      schools: user.schoolUsers.map(su => ({
        id: su.school.id,
        name: su.school.name,
        role: su.role,
      })),
    };
  },
};
