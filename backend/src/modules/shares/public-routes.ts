// backend/src/modules/shares/public-routes.ts
// Public routes for schedule sharing - no authentication required
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sharesService } from './service.js';

// Generate iCalendar (.ics) format
function generateICS(schedule: {
  title: string;
  games: Array<{
    datetime: string;
    opponent: string;
    homeAway: string;
    facility: string | null;
    status: string;
  }>;
  practices: Array<{
    datetime: string;
    duration: number;
    facility: string | null;
  }>;
}): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AthleticOS//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(schedule.title)}`,
  ];

  // Add games
  for (const game of schedule.games) {
    if (game.status === 'CANCELLED') continue;

    const startDate = new Date(game.datetime);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    const summary = game.homeAway === 'HOME'
      ? `vs ${game.opponent}`
      : game.homeAway === 'AWAY'
        ? `@ ${game.opponent}`
        : `vs ${game.opponent} (Neutral)`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:game-${startDate.getTime()}@athleticos.com`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${formatICSDate(startDate)}`);
    lines.push(`DTEND:${formatICSDate(endDate)}`);
    lines.push(`SUMMARY:${escapeICS(summary)}`);
    if (game.facility) {
      lines.push(`LOCATION:${escapeICS(game.facility)}`);
    }
    lines.push('END:VEVENT');
  }

  // Add practices
  for (const practice of schedule.practices) {
    const startDate = new Date(practice.datetime);
    const endDate = new Date(startDate.getTime() + practice.duration * 60 * 1000);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:practice-${startDate.getTime()}@athleticos.com`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${formatICSDate(startDate)}`);
    lines.push(`DTEND:${formatICSDate(endDate)}`);
    lines.push(`SUMMARY:Practice (${practice.duration} min)`);
    if (practice.facility) {
      lines.push(`LOCATION:${escapeICS(practice.facility)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Simple in-memory rate limiter (100 req/min per IP)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60000; // 1 minute

function getRateLimitKey(request: FastifyRequest): string {
  // Use X-Forwarded-For if behind a proxy, otherwise use direct IP
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  return request.ip || 'unknown';
}

function checkRateLimit(request: FastifyRequest): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getRateLimitKey(request);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + WINDOW_MS;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count, resetAt: entry.resetAt };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export async function publicScheduleRoutes(app: FastifyInstance) {
  // Rate limiting hook for all public routes
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const { allowed, remaining, resetAt } = checkRateLimit(request);

    reply.header('X-RateLimit-Limit', RATE_LIMIT);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (!allowed) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
    }
  });

  // Get public schedule data (JSON API)
  app.get('/public/schedules/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    try {
      const schedule = await sharesService.getPublicSchedule(token);
      return { data: schedule };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('no longer active')) {
          return reply.status(404).send({
            error: {
              code: 'SHARE_INACTIVE',
              message: 'This schedule link is no longer active',
            },
          });
        }
        if (error.message.includes('has expired')) {
          return reply.status(404).send({
            error: {
              code: 'SHARE_EXPIRED',
              message: 'This schedule link has expired',
            },
          });
        }
      }
      throw error;
    }
  });

  // Download .ics calendar file
  app.get('/public/schedules/:token/calendar', async (request, reply) => {
    const { token } = request.params as { token: string };

    try {
      const schedule = await sharesService.getPublicSchedule(token);
      const icsContent = generateICS(schedule);

      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${schedule.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`)
        .send(icsContent);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('no longer active') || error.message.includes('has expired')) {
          return reply.status(404).send({
            error: {
              code: 'SHARE_NOT_FOUND',
              message: 'Schedule not found',
            },
          });
        }
      }
      throw error;
    }
  });
}
