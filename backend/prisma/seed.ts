import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Find or create the dev user
  let user = await prisma.user.findUnique({ where: { email: 'burke@athleticos.dev' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'burke@athleticos.dev',
        passwordHash: await bcrypt.hash('AthleticOS2026', 10),
      },
    });
  }

  // Create school
  const school = await prisma.school.create({
    data: {
      name: 'Trinity Christian Academy',
      timezone: 'America/Chicago',
      settings: {},
    },
  });

  // Link user as admin
  await prisma.schoolUser.create({
    data: { schoolId: school.id, userId: user.id, role: 'ADMIN' },
  });

  // Create facilities
  const mainGym = await prisma.facility.create({
    data: { schoolId: school.id, name: 'MCB Gym', type: 'GYM', capacity: 2500 },
  });
  const auxGym = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Field House', type: 'GYM', capacity: 500 },
  });
  const footballField = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Tom Landry Stadium', type: 'FIELD', capacity: 5000 },
  });
  const baseballField = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Trojan Baseball Field', type: 'FIELD', capacity: 1000 },
  });
  const pool = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Aquatic Center', type: 'POOL', capacity: 400 },
  });
  const track = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Trojan Blue Track', type: 'TRACK', capacity: 2000 },
  });
  const tennisCourts = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Trojan Tennis Courts', type: 'COURT', capacity: 300 },
  });

  // Create teams
  const teams = await Promise.all([
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Football', sport: 'Football', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'JV Football', sport: 'Football', level: 'JV' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Basketball (Boys)', sport: 'Basketball', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Basketball (Girls)', sport: 'Basketball', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'JV Basketball (Boys)', sport: 'Basketball', level: 'JV' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Baseball', sport: 'Baseball', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Volleyball', sport: 'Volleyball', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Swimming', sport: 'Swimming', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Track & Field', sport: 'Track & Field', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Tennis', sport: 'Tennis', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Soccer (Boys)', sport: 'Soccer', level: 'VARSITY' } }),
    prisma.team.create({ data: { schoolId: school.id, name: 'Varsity Soccer (Girls)', sport: 'Soccer', level: 'VARSITY' } }),
  ]);

  const [_vFootball, _jvFootball, vBBoys, vBGirls, jvBBoys, vBaseball, _vVolleyball, vSwimming, vTrack, vTennis, vSoccerB, _vSoccerG] = teams;

  // Create seasons (Spring 2026 for spring sports, Fall 2025 already happened)
  const _now = new Date('2026-02-27');

  // Basketball season (current - wrapping up)
  const bbSeason = await prisma.season.create({
    data: { teamId: vBBoys.id, name: 'Basketball 2025-26', year: 2026, startDate: new Date('2025-11-10'), endDate: new Date('2026-03-21') },
  });
  const bbGirlsSeason = await prisma.season.create({
    data: { teamId: vBGirls.id, name: 'Basketball 2025-26', year: 2026, startDate: new Date('2025-11-10'), endDate: new Date('2026-03-21') },
  });
  const jvBBSeason = await prisma.season.create({
    data: { teamId: jvBBoys.id, name: 'JV Basketball 2025-26', year: 2026, startDate: new Date('2025-11-10'), endDate: new Date('2026-03-21') },
  });

  // Spring sports
  const baseballSeason = await prisma.season.create({
    data: { teamId: vBaseball.id, name: 'Baseball 2026', year: 2026, startDate: new Date('2026-02-15'), endDate: new Date('2026-05-20') },
  });
  const trackSeason = await prisma.season.create({
    data: { teamId: vTrack.id, name: 'Track & Field 2026', year: 2026, startDate: new Date('2026-02-10'), endDate: new Date('2026-05-15') },
  });
  const tennisSeason = await prisma.season.create({
    data: { teamId: vTennis.id, name: 'Tennis 2026', year: 2026, startDate: new Date('2026-01-20'), endDate: new Date('2026-04-25') },
  });
  const soccerBSeason = await prisma.season.create({
    data: { teamId: vSoccerB.id, name: 'Soccer 2026', year: 2026, startDate: new Date('2026-01-05'), endDate: new Date('2026-04-10') },
  });
  const swimmingSeason = await prisma.season.create({
    data: { teamId: vSwimming.id, name: 'Swimming 2025-26', year: 2026, startDate: new Date('2025-10-15'), endDate: new Date('2026-02-28') },
  });

  // Games - Basketball boys (remaining schedule)
  const bbOpponents = ['Fort Worth Christian', 'Dallas Christian', 'Covenant Christian', 'Heritage Christian', 'Grace Prep', 'Grapevine Faith', 'Prestonwood Christian'];
  for (let i = 0; i < bbOpponents.length; i++) {
    const gameDate = new Date('2026-02-28');
    gameDate.setDate(gameDate.getDate() + (i * 3));
    await prisma.game.create({
      data: {
        seasonId: bbSeason.id,
        facilityId: i % 2 === 0 ? mainGym.id : null,
        opponent: bbOpponents[i],
        datetime: gameDate,
        homeAway: i % 2 === 0 ? 'HOME' : 'AWAY',
        status: 'SCHEDULED',
      },
    });
  }

  // Games - Basketball girls
  const bbGirlsOpponents = ['Fort Worth Christian', 'Dallas Christian', 'Covenant Christian', 'Grace Prep', 'Grapevine Faith'];
  for (let i = 0; i < bbGirlsOpponents.length; i++) {
    const gameDate = new Date('2026-03-01');
    gameDate.setDate(gameDate.getDate() + (i * 3));
    await prisma.game.create({
      data: {
        seasonId: bbGirlsSeason.id,
        facilityId: i % 2 === 0 ? mainGym.id : null,
        opponent: bbGirlsOpponents[i],
        datetime: gameDate,
        homeAway: i % 2 === 0 ? 'HOME' : 'AWAY',
        status: 'SCHEDULED',
      },
    });
  }

  // Games - Baseball
  const baseballOpponents = ['Bishop Lynch', 'Prestonwood Christian', 'Regents School', 'Houston Christian', 'Nolan Catholic', 'All Saints', 'Midland Christian', 'Brook Hill'];
  for (let i = 0; i < baseballOpponents.length; i++) {
    const gameDate = new Date('2026-03-02');
    gameDate.setDate(gameDate.getDate() + (i * 4));
    await prisma.game.create({
      data: {
        seasonId: baseballSeason.id,
        facilityId: i % 2 === 0 ? baseballField.id : null,
        opponent: baseballOpponents[i],
        datetime: gameDate,
        homeAway: i % 2 === 0 ? 'HOME' : 'AWAY',
        status: 'SCHEDULED',
      },
    });
  }

  // Games - Soccer
  const soccerOpponents = ['Trinity Valley', 'Liberty Christian', 'John Paul II', 'Southwest Christian', 'Plano John Paul', 'Heritage Christian'];
  for (let i = 0; i < soccerOpponents.length; i++) {
    const gameDate = new Date('2026-03-01');
    gameDate.setDate(gameDate.getDate() + (i * 5));
    await prisma.game.create({
      data: {
        seasonId: soccerBSeason.id,
        facilityId: i % 2 === 0 ? footballField.id : null,
        opponent: soccerOpponents[i],
        datetime: gameDate,
        homeAway: i % 2 === 0 ? 'HOME' : 'AWAY',
        status: 'SCHEDULED',
      },
    });
  }

  // Track meets
  const trackMeets = ['Relays at Midland Christian', 'District Qualifier', 'TCA Invitational', 'Regional Qualifier'];
  for (let i = 0; i < trackMeets.length; i++) {
    const meetDate = new Date('2026-03-07');
    meetDate.setDate(meetDate.getDate() + (i * 14));
    await prisma.game.create({
      data: {
        seasonId: trackSeason.id,
        facilityId: i % 2 === 0 ? track.id : null,
        opponent: trackMeets[i],
        datetime: meetDate,
        homeAway: i === 2 ? 'HOME' : 'AWAY',
        status: 'SCHEDULED',
      },
    });
  }

  // Tennis matches
  const tennisOpponents = ['Fort Worth Christian', 'Dallas Christian', 'Covenant Christian', 'Grace Prep', 'Grapevine Faith'];
  for (let i = 0; i < tennisOpponents.length; i++) {
    const matchDate = new Date('2026-03-02');
    matchDate.setDate(matchDate.getDate() + (i * 7));
    await prisma.game.create({
      data: {
        seasonId: tennisSeason.id,
        facilityId: i % 2 === 0 ? tennisCourts.id : null,
        opponent: tennisOpponents[i],
        datetime: matchDate,
        homeAway: i % 2 === 0 ? 'HOME' : 'AWAY',
        status: 'SCHEDULED',
      },
    });
  }

  // Practices - generate for active seasons (next 2 weeks)
  const practiceConfigs = [
    { season: bbSeason, facility: mainGym, days: [1, 3, 5], time: '15:30' },
    { season: bbGirlsSeason, facility: mainGym, days: [2, 4], time: '15:30' },
    { season: jvBBSeason, facility: auxGym, days: [1, 2, 3, 4, 5], time: '16:00' },
    { season: baseballSeason, facility: baseballField, days: [1, 2, 3, 4, 5], time: '15:30' },
    { season: trackSeason, facility: track, days: [1, 2, 3, 4], time: '15:30' },
    { season: tennisSeason, facility: tennisCourts, days: [1, 3, 5], time: '15:00' },
    { season: soccerBSeason, facility: footballField, days: [1, 2, 4, 5], time: '16:00' },
    { season: swimmingSeason, facility: pool, days: [1, 2, 3, 4, 5], time: '06:00' },
  ];

  for (const config of practiceConfigs) {
    for (let d = 0; d < 14; d++) {
      const date = new Date('2026-02-27');
      date.setDate(date.getDate() + d);
      const dayOfWeek = date.getDay();
      if (config.days.includes(dayOfWeek)) {
        const [hours, mins] = config.time.split(':');
        const practiceDate = new Date(date);
        practiceDate.setHours(parseInt(hours), parseInt(mins), 0, 0);
        await prisma.practice.create({
          data: {
            seasonId: config.season.id,
            facilityId: config.facility.id,
            datetime: practiceDate,
            durationMinutes: 90,
          },
        });
      }
    }
  }

  // Blockers
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'EXAM',
      name: 'Spring Midterm Exams',
      description: 'No practices or games during midterm exam week',
      scope: 'SCHOOL_WIDE',
      startDatetime: new Date('2026-03-09T00:00:00Z'),
      endDatetime: new Date('2026-03-13T23:59:00Z'),
      createdBy: user.id,
    },
  });
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'HOLIDAY',
      name: 'Spring Break',
      description: 'Spring break - no school activities',
      scope: 'SCHOOL_WIDE',
      startDatetime: new Date('2026-03-16T00:00:00Z'),
      endDatetime: new Date('2026-03-20T23:59:00Z'),
      createdBy: user.id,
    },
  });
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'MAINTENANCE',
      name: 'Gym Floor Refinishing',
      description: 'MCB Gym floor being refinished',
      scope: 'FACILITY',
      facilityId: mainGym.id,
      startDatetime: new Date('2026-03-02T00:00:00Z'),
      endDatetime: new Date('2026-03-04T23:59:00Z'),
      createdBy: user.id,
    },
  });
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'WEATHER',
      name: 'Severe Weather Protocol',
      description: 'Outdoor activities suspended due to ice storm forecast',
      scope: 'SCHOOL_WIDE',
      startDatetime: new Date('2026-02-25T00:00:00Z'),
      endDatetime: new Date('2026-02-26T23:59:00Z'),
      createdBy: user.id,
    },
  });
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'MAINTENANCE',
      name: 'Facility Inspection',
      description: 'Annual safety and compliance inspection of MCB Gym',
      scope: 'FACILITY',
      facilityId: mainGym.id,
      startDatetime: new Date('2026-03-03T00:00:00Z'),
      endDatetime: new Date('2026-03-04T23:59:00Z'),
      createdBy: user.id,
    },
  });
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'EXAM',
      name: 'Standardized Testing',
      description: 'School-wide standardized testing - no afternoon practices',
      scope: 'SCHOOL_WIDE',
      startDatetime: new Date('2026-03-05T00:00:00Z'),
      endDatetime: new Date('2026-03-05T23:59:00Z'),
      createdBy: user.id,
    },
  });

  // === EXPLICIT FACILITY DOUBLE-BOOKINGS ===

  // Double-booking 1: Baseball practice AND Soccer practice at Trojan Baseball Field, same time
  const doubleBook1Date = new Date('2026-03-06T16:00:00');
  await prisma.practice.create({
    data: {
      seasonId: baseballSeason.id,
      facilityId: baseballField.id,
      datetime: doubleBook1Date,
      durationMinutes: 120,
      notes: 'Extended practice - scrimmage',
    },
  });
  await prisma.practice.create({
    data: {
      seasonId: soccerBSeason.id,
      facilityId: baseballField.id,
      datetime: doubleBook1Date,
      durationMinutes: 90,
      notes: 'Field training overflow from Tom Landry Stadium',
    },
  });

  // Double-booking 2: Boys Basketball practice AND Girls Basketball practice at MCB Gym, same time
  const doubleBook2Date = new Date('2026-03-07T15:30:00');
  await prisma.practice.create({
    data: {
      seasonId: bbSeason.id,
      facilityId: mainGym.id,
      datetime: doubleBook2Date,
      durationMinutes: 90,
    },
  });
  await prisma.practice.create({
    data: {
      seasonId: bbGirlsSeason.id,
      facilityId: mainGym.id,
      datetime: doubleBook2Date,
      durationMinutes: 90,
    },
  });

  // Double-booking 3: Track practice AND Soccer game at Tom Landry Stadium, same time
  const doubleBook3Date = new Date('2026-03-10T16:00:00');
  await prisma.practice.create({
    data: {
      seasonId: trackSeason.id,
      facilityId: footballField.id,
      datetime: doubleBook3Date,
      durationMinutes: 90,
      notes: 'Sprint drills on main field',
    },
  });
  await prisma.game.create({
    data: {
      seasonId: soccerBSeason.id,
      facilityId: footballField.id,
      opponent: 'Ursuline Academy',
      datetime: doubleBook3Date,
      homeAway: 'HOME',
      status: 'SCHEDULED',
    },
  });

  // === GAME CONFLICTING WITH WEATHER BLOCKER ===
  // Weather blocker is Feb 25-26, but that's in the past. Add a new weather blocker for demo.
  const _weatherBlocker = await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'WEATHER',
      name: 'Tornado Watch',
      description: 'Tornado watch issued - all outdoor activities suspended',
      scope: 'SCHOOL_WIDE',
      startDatetime: new Date('2026-03-06T12:00:00Z'),
      endDatetime: new Date('2026-03-06T23:59:00Z'),
      createdBy: user.id,
    },
  });
  // Baseball game during tornado watch (outdoor sport = rain plan demo)
  await prisma.game.create({
    data: {
      seasonId: baseballSeason.id,
      facilityId: baseballField.id,
      opponent: 'Fort Worth Country Day',
      datetime: new Date('2026-03-06T17:00:00'),
      homeAway: 'HOME',
      status: 'SCHEDULED',
      notes: 'Needs rain plan',
    },
  });

  // === VARSITY GAME CONFLICTING WITH EXAM PERIOD (high-confidence override suggestion) ===
  // Midterm exams are March 9-13. Add a varsity basketball playoff game during that time.
  await prisma.game.create({
    data: {
      seasonId: bbSeason.id,
      facilityId: mainGym.id,
      opponent: 'Bishop Lynch (Playoff)',
      datetime: new Date('2026-03-10T19:00:00'),
      homeAway: 'HOME',
      status: 'SCHEDULED',
      notes: 'District playoff game - exam week conflict',
    },
  });

  // === MAINTENANCE BLOCKER ON BASEBALL FIELD ===
  await prisma.blocker.create({
    data: {
      schoolId: school.id,
      type: 'MAINTENANCE',
      name: 'Baseball Infield Resurfacing',
      description: 'Infield clay resurfacing and mound repair',
      scope: 'FACILITY',
      facilityId: baseballField.id,
      startDatetime: new Date('2026-03-14T00:00:00Z'),
      endDatetime: new Date('2026-03-15T23:59:00Z'),
      createdBy: user.id,
    },
  });

  // === RESOLVED OVERRIDE (for override history demo) ===
  // Find the first basketball game that conflicts with gym maintenance (March 2-4)
  const bbGameDuringMaintenance = await prisma.game.findFirst({
    where: {
      seasonId: bbSeason.id,
      facilityId: mainGym.id,
      datetime: {
        gte: new Date('2026-03-02'),
        lt: new Date('2026-03-05'),
      },
    },
  });
  // Also override the Standardized Testing blocker (March 5) for a practice
  const bbPracticeDuringTesting = await prisma.practice.findFirst({
    where: {
      seasonId: bbSeason.id,
      facilityId: mainGym.id,
      datetime: {
        gte: new Date('2026-03-05'),
        lt: new Date('2026-03-06'),
      },
    },
  });

  // Get blocker IDs
  const gymMaintenanceBlocker = await prisma.blocker.findFirst({
    where: { schoolId: school.id, name: 'Gym Floor Refinishing' },
  });
  const standardizedTestingBlocker = await prisma.blocker.findFirst({
    where: { schoolId: school.id, name: 'Standardized Testing' },
  });

  if (bbGameDuringMaintenance && gymMaintenanceBlocker) {
    await prisma.conflictOverride.create({
      data: {
        schoolId: school.id,
        eventType: 'GAME',
        eventId: bbGameDuringMaintenance.id,
        blockerId: gymMaintenanceBlocker.id,
        overriddenBy: user.id,
        reason: 'Playoff implications - gym refinishing rescheduled to start March 5',
      },
    });
  }
  if (bbPracticeDuringTesting && standardizedTestingBlocker) {
    await prisma.conflictOverride.create({
      data: {
        schoolId: school.id,
        eventType: 'PRACTICE',
        eventId: bbPracticeDuringTesting.id,
        blockerId: standardizedTestingBlocker.id,
        overriddenBy: user.id,
        reason: 'Shortened practice approved by AD - post-testing hours only',
      },
    });
  }

  // Time slots for facilities
  const weekdays = [1, 2, 3, 4, 5];
  for (const day of weekdays) {
    await prisma.timeSlot.create({ data: { facilityId: mainGym.id, dayOfWeek: day, startTime: '06:00', endTime: '22:00' } });
    await prisma.timeSlot.create({ data: { facilityId: auxGym.id, dayOfWeek: day, startTime: '06:00', endTime: '21:00' } });
    await prisma.timeSlot.create({ data: { facilityId: footballField.id, dayOfWeek: day, startTime: '07:00', endTime: '21:00' } });
    await prisma.timeSlot.create({ data: { facilityId: baseballField.id, dayOfWeek: day, startTime: '07:00', endTime: '20:00' } });
    await prisma.timeSlot.create({ data: { facilityId: pool.id, dayOfWeek: day, startTime: '05:30', endTime: '20:00' } });
    await prisma.timeSlot.create({ data: { facilityId: track.id, dayOfWeek: day, startTime: '06:00', endTime: '20:00' } });
    await prisma.timeSlot.create({ data: { facilityId: tennisCourts.id, dayOfWeek: day, startTime: '07:00', endTime: '20:00' } });
  }
  // Saturday
  await prisma.timeSlot.create({ data: { facilityId: mainGym.id, dayOfWeek: 6, startTime: '08:00', endTime: '18:00' } });
  await prisma.timeSlot.create({ data: { facilityId: footballField.id, dayOfWeek: 6, startTime: '08:00', endTime: '18:00' } });
  await prisma.timeSlot.create({ data: { facilityId: baseballField.id, dayOfWeek: 6, startTime: '08:00', endTime: '17:00' } });
  await prisma.timeSlot.create({ data: { facilityId: track.id, dayOfWeek: 6, startTime: '08:00', endTime: '17:00' } });

  console.log('Seed complete!');
  console.log(`  School: ${school.name}`);
  console.log(`  Teams: ${teams.length}`);
  console.log(`  Facilities: 7`);
  console.log(`  Seasons: 8`);
  console.log(`  Login: burke@athleticos.dev / AthleticOS2026`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
