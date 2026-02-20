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
      name: 'Westlake High School',
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
    data: { schoolId: school.id, name: 'Main Gymnasium', type: 'GYM', capacity: 2500 },
  });
  const auxGym = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Auxiliary Gym', type: 'GYM', capacity: 500 },
  });
  const footballField = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Chaparral Stadium', type: 'FIELD', capacity: 8000 },
  });
  const baseballField = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Baseball Complex', type: 'FIELD', capacity: 1000 },
  });
  const pool = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Aquatic Center', type: 'POOL', capacity: 400 },
  });
  const track = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Track & Field Complex', type: 'TRACK', capacity: 2000 },
  });
  const tennisCourts = await prisma.facility.create({
    data: { schoolId: school.id, name: 'Tennis Center', type: 'COURT', capacity: 300 },
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

  const [vFootball, jvFootball, vBBoys, vBGirls, jvBBoys, vBaseball, vVolleyball, vSwimming, vTrack, vTennis, vSoccerB, vSoccerG] = teams;

  // Create seasons (Spring 2026 for spring sports, Fall 2025 already happened)
  const now = new Date('2026-02-18');

  // Basketball season (current - wrapping up)
  const bbSeason = await prisma.season.create({
    data: { teamId: vBBoys.id, name: 'Basketball 2025-26', year: 2026, startDate: new Date('2025-11-10'), endDate: new Date('2026-03-01') },
  });
  const bbGirlsSeason = await prisma.season.create({
    data: { teamId: vBGirls.id, name: 'Basketball 2025-26', year: 2026, startDate: new Date('2025-11-10'), endDate: new Date('2026-03-01') },
  });
  const jvBBSeason = await prisma.season.create({
    data: { teamId: jvBBoys.id, name: 'JV Basketball 2025-26', year: 2026, startDate: new Date('2025-11-10'), endDate: new Date('2026-03-01') },
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
  const bbOpponents = ['Lake Travis', 'Dripping Springs', 'Hays', 'Del Valle', 'Bowie', 'Anderson', 'Akins'];
  for (let i = 0; i < bbOpponents.length; i++) {
    const gameDate = new Date('2026-02-19');
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
  const bbGirlsOpponents = ['Lake Travis', 'Dripping Springs', 'Hays', 'Bowie', 'Anderson'];
  for (let i = 0; i < bbGirlsOpponents.length; i++) {
    const gameDate = new Date('2026-02-20');
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
  const baseballOpponents = ['Round Rock', 'Cedar Park', 'Vandegrift', 'Vista Ridge', 'McNeil', 'Leander', 'Hendrickson', 'Stony Point'];
  for (let i = 0; i < baseballOpponents.length; i++) {
    const gameDate = new Date('2026-02-24');
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
  const soccerOpponents = ['Austin High', 'Travis', 'Crockett', 'McCallum', 'Akins', 'Del Valle'];
  for (let i = 0; i < soccerOpponents.length; i++) {
    const gameDate = new Date('2026-02-21');
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
  const trackMeets = ['Relays at Round Rock', 'District Qualifier', 'Westlake Invitational', 'Regional Qualifier'];
  for (let i = 0; i < trackMeets.length; i++) {
    const meetDate = new Date('2026-02-28');
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
  const tennisOpponents = ['Lake Travis', 'Dripping Springs', 'Hays', 'Bowie', 'Anderson'];
  for (let i = 0; i < tennisOpponents.length; i++) {
    const matchDate = new Date('2026-02-23');
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
      const date = new Date('2026-02-18');
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
      description: 'Main gym floor being refinished',
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
