// backend/src/modules/facility-requests/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../common/errors.js';
import { Role } from '@prisma/client';
import type {
  CreateFacilityRequestInput,
  ListRequestsQuery,
  UpdateRequestStatusInput,
  AvailabilityQuery,
} from './schemas.js';

export const facilityRequestService = {
  /**
   * Create a facility request. Pre-checks for conflicts against existing events.
   */
  async create(schoolId: string, input: CreateFacilityRequestInput, requesterId: string) {
    // Verify the facility belongs to this school
    const facility = await prisma.facility.findFirst({
      where: { id: input.facilityId, schoolId },
    });
    if (!facility) {
      throw new NotFoundError('Facility', input.facilityId);
    }

    // Check for time conflicts: existing games/practices at same facility on same date
    const requestedDate = new Date(input.requestedDate);
    const dayStart = new Date(requestedDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const [games, practices] = await Promise.all([
      prisma.game.findMany({
        where: {
          facilityId: input.facilityId,
          datetime: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true, datetime: true, opponent: true },
      }),
      prisma.practice.findMany({
        where: {
          facilityId: input.facilityId,
          datetime: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true, datetime: true, durationMinutes: true },
      }),
    ]);

    // Parse requested times for overlap check
    const [reqStartH, reqStartM] = input.startTime.split(':').map(Number);
    const [reqEndH, reqEndM] = input.endTime.split(':').map(Number);
    const reqStartMin = reqStartH * 60 + reqStartM;
    const reqEndMin = reqEndH * 60 + reqEndM;

    if (reqEndMin <= reqStartMin) {
      throw new ValidationError('End time must be after start time');
    }

    const conflicts: string[] = [];

    for (const game of games) {
      const gameH = game.datetime.getUTCHours();
      const gameM = game.datetime.getUTCMinutes();
      const gameStartMin = gameH * 60 + gameM;
      const gameEndMin = gameStartMin + 120; // 2-hour default
      if (reqStartMin < gameEndMin && reqEndMin > gameStartMin) {
        conflicts.push(`Game vs ${game.opponent} at ${gameH}:${String(gameM).padStart(2, '0')}`);
      }
    }

    for (const practice of practices) {
      const pH = practice.datetime.getUTCHours();
      const pM = practice.datetime.getUTCMinutes();
      const pStartMin = pH * 60 + pM;
      const pEndMin = pStartMin + practice.durationMinutes;
      if (reqStartMin < pEndMin && reqEndMin > pStartMin) {
        conflicts.push(`Practice at ${pH}:${String(pM).padStart(2, '0')}`);
      }
    }

    // Also check existing pending/approved facility requests for overlap
    const existingRequests = await prisma.facilityRequest.findMany({
      where: {
        facilityId: input.facilityId,
        requestedDate: requestedDate,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: { id: true, title: true, startTime: true, endTime: true },
    });

    for (const req of existingRequests) {
      const [rStartH, rStartM] = req.startTime.split(':').map(Number);
      const [rEndH, rEndM] = req.endTime.split(':').map(Number);
      const rStartMin = rStartH * 60 + rStartM;
      const rEndMin = rEndH * 60 + rEndM;
      if (reqStartMin < rEndMin && reqEndMin > rStartMin) {
        conflicts.push(`Existing request: ${req.title}`);
      }
    }

    const request = await prisma.facilityRequest.create({
      data: {
        schoolId,
        facilityId: input.facilityId,
        requesterId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        requestedDate: requestedDate,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      include: {
        facility: { select: { id: true, name: true } },
        requester: { select: { id: true, email: true, name: true } },
      },
    });

    return {
      ...request,
      conflicts,
    };
  },

  /**
   * List facility requests. COMMUNITY users see only their own.
   */
  async list(schoolId: string, query: ListRequestsQuery, userId: string, userRole: Role) {
    const { status, facilityId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { schoolId };
    if (status) where.status = status;
    if (facilityId) where.facilityId = facilityId;

    // COMMUNITY users can only see their own requests
    if (userRole === Role.COMMUNITY) {
      where.requesterId = userId;
    }

    const [requests, total] = await Promise.all([
      prisma.facilityRequest.findMany({
        where,
        include: {
          facility: { select: { id: true, name: true } },
          requester: { select: { id: true, email: true, name: true } },
          reviewer: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.facilityRequest.count({ where }),
    ]);

    return {
      data: requests,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Update request status (approve/deny/cancel). Management only.
   */
  async updateStatus(
    schoolId: string,
    requestId: string,
    input: UpdateRequestStatusInput,
    reviewerId: string,
  ) {
    const request = await prisma.facilityRequest.findFirst({
      where: { id: requestId, schoolId },
    });

    if (!request) {
      throw new NotFoundError('FacilityRequest', requestId);
    }

    if (request.status !== 'PENDING') {
      throw new ValidationError(`Cannot update request with status ${request.status}`);
    }

    const updated = await prisma.facilityRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        reviewNotes: input.reviewNotes ?? null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        facility: { select: { id: true, name: true } },
        requester: { select: { id: true, email: true, name: true } },
        reviewer: { select: { id: true, email: true, name: true } },
      },
    });

    return updated;
  },

  /**
   * Get availability for a facility in a date range.
   * Returns each day's slots with booked/pending/open status.
   */
  async getAvailability(facilityId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);

    // Fetch all events and requests in the range
    const [games, practices, requests] = await Promise.all([
      prisma.game.findMany({
        where: {
          facilityId,
          datetime: { gte: fromDate, lte: toDate },
        },
        select: { id: true, datetime: true, opponent: true },
      }),
      prisma.practice.findMany({
        where: {
          facilityId,
          datetime: { gte: fromDate, lte: toDate },
        },
        select: { id: true, datetime: true, durationMinutes: true },
      }),
      prisma.facilityRequest.findMany({
        where: {
          facilityId,
          requestedDate: { gte: fromDate, lte: toDate },
          status: { in: ['PENDING', 'APPROVED'] },
        },
        select: { id: true, requestedDate: true, startTime: true, endTime: true, status: true, title: true },
      }),
    ]);

    // Build day-by-day availability
    const days: Array<{
      date: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        status: 'booked' | 'pending' | 'open';
        label?: string;
      }>;
    }> = [];

    const current = new Date(fromDate);
    while (current <= toDate) {
      const dateStr = current.toISOString().slice(0, 10);
      const slots: Array<{
        startTime: string;
        endTime: string;
        status: 'booked' | 'pending' | 'open';
        label?: string;
      }> = [];

      // Check games on this day
      for (const game of games) {
        const gDate = game.datetime.toISOString().slice(0, 10);
        if (gDate === dateStr) {
          const h = game.datetime.getUTCHours();
          const m = game.datetime.getUTCMinutes();
          const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const endH = h + 2;
          const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          slots.push({ startTime, endTime, status: 'booked', label: `Game vs ${game.opponent}` });
        }
      }

      // Check practices on this day
      for (const practice of practices) {
        const pDate = practice.datetime.toISOString().slice(0, 10);
        if (pDate === dateStr) {
          const h = practice.datetime.getUTCHours();
          const m = practice.datetime.getUTCMinutes();
          const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const totalMins = h * 60 + m + practice.durationMinutes;
          const endH = Math.floor(totalMins / 60);
          const endM = totalMins % 60;
          const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
          slots.push({ startTime, endTime, status: 'booked', label: 'Practice' });
        }
      }

      // Check facility requests on this day
      for (const req of requests) {
        const rDate = req.requestedDate.toISOString().slice(0, 10);
        if (rDate === dateStr) {
          slots.push({
            startTime: req.startTime,
            endTime: req.endTime,
            status: req.status === 'APPROVED' ? 'booked' : 'pending',
            label: req.title,
          });
        }
      }

      // Sort slots by start time
      slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

      days.push({ date: dateStr, slots });
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return days;
  },
};
