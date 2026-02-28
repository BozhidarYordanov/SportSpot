import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: new URL('../../.env', import.meta.url) });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_PASSWORD = 'Pass123';

const USERS_TO_CREATE = [
  { email: 'user1@gmail.com', fullName: 'User One' },
  { email: 'user2@gmail.com', fullName: 'User Two' },
  { email: 'user3@gmail.com', fullName: 'User Three' },
  { email: 'user4@gmail.com', fullName: 'User Four' },
  { email: 'user5@gmail.com', fullName: 'User Five' }
];

const WORKOUT_TYPES_TO_CREATE = [
  {
    title: 'Yoga fit',
    category: 'Mind & Body',
    difficulty: 1,
    duration_minutes: 60,
    description: 'Dynamic yoga flow that builds flexibility, control, and calm focus.',
    suitable_for: 'Beginners to intermediate members wanting mindful full-body training.',
    what_to_bring: 'Yoga mat, water bottle, comfortable stretchable outfit.'
  },
  {
    title: 'Fit Bands',
    category: 'Strength',
    difficulty: 2,
    duration_minutes: 45,
    description: 'Resistance-band class focused on toning and posture-friendly strength.',
    suitable_for: 'Members who want low-impact strength with scalable resistance.',
    what_to_bring: 'Training bands, towel, indoor trainers.'
  },
  {
    title: 'Pilates reformer',
    category: 'Mind & Body',
    difficulty: 2,
    duration_minutes: 50,
    description: 'Controlled reformer sequences for deep core activation and alignment.',
    suitable_for: 'Anyone improving posture, core stability, and movement precision.',
    what_to_bring: 'Grip socks, fitted training clothes, water.'
  },
  {
    title: 'P.Boxx',
    category: 'Combat',
    difficulty: 3,
    duration_minutes: 55,
    description: 'Power boxing intervals with pads, footwork, and sharp cardio rounds.',
    suitable_for: 'Members seeking high-energy combat conditioning and stress release.',
    what_to_bring: 'Gloves, hand wraps, towel, supportive footwear.'
  },
  {
    title: 'Cross Bootcamp',
    category: 'Strength',
    difficulty: 3,
    duration_minutes: 45,
    description: 'Circuit bootcamp combining sleds, carries, and bodyweight power drills.',
    suitable_for: 'Intermediate to advanced athletes who enjoy variety and intensity.',
    what_to_bring: 'Cross-training shoes, towel, hydration.'
  },
  {
    title: 'Pulse CrossRX',
    category: 'Cardio',
    difficulty: 3,
    duration_minutes: 60,
    description: 'Cross-conditioning class with pulse-based intervals and metabolic finishers.',
    suitable_for: 'Members targeting endurance, stamina, and calorie burn.',
    what_to_bring: 'Lightweight shoes, sweat towel, water bottle.'
  },
  {
    title: 'Stretching',
    category: 'Mind & Body',
    difficulty: 1,
    duration_minutes: 40,
    description: 'Guided flexibility and recovery session to release tension and improve range.',
    suitable_for: 'All fitness levels, especially after heavy training days.',
    what_to_bring: 'Mat, light layer, water.'
  },
  {
    title: 'Mobility',
    category: 'Mind & Body',
    difficulty: 1,
    duration_minutes: 50,
    description: 'Joint mobility and movement quality drills for resilient everyday performance.',
    suitable_for: 'Members with desk-heavy routines or limited mobility.',
    what_to_bring: 'Mat, mini band (optional), comfortable clothing.'
  },
  {
    title: 'Yoga',
    category: 'Mind & Body',
    difficulty: 1,
    duration_minutes: 55,
    description: 'Classic yoga class blending breathwork, balance, and gentle strength.',
    suitable_for: 'Beginners and regular practitioners alike.',
    what_to_bring: 'Yoga mat, water, optional yoga blocks.'
  },
  {
    title: 'Box',
    category: 'Combat',
    difficulty: 3,
    duration_minutes: 60,
    description: 'Technique-first boxing session with combinations, defense, and rounds.',
    suitable_for: 'Members wanting combat skill work and conditioning.',
    what_to_bring: 'Boxing gloves, wraps, training shoes.'
  },
  {
    title: 'Kick Box',
    category: 'Combat',
    difficulty: 3,
    duration_minutes: 50,
    description: 'Kickboxing conditioning with controlled strikes and interval rounds.',
    suitable_for: 'Intermediate members looking for intense cardio and coordination.',
    what_to_bring: 'Gloves, shin protection (optional), towel.'
  },
  {
    title: 'Total body',
    category: 'Strength',
    difficulty: 2,
    duration_minutes: 55,
    description: 'Balanced full-body training session for strength, tone, and endurance.',
    suitable_for: 'Anyone seeking an efficient, all-in-one workout.',
    what_to_bring: 'Comfortable trainers, water, sweat towel.'
  },
  {
    title: 'Spinning',
    category: 'Cardio',
    difficulty: 2,
    duration_minutes: 45,
    description: 'Rhythm-based cycling with hill climbs, sprints, and coached pacing.',
    suitable_for: 'Cardio lovers and members improving aerobic capacity.',
    what_to_bring: 'Cycling shoes (optional), towel, bottle.'
  },
  {
    title: 'Dance fit',
    category: 'Cardio',
    difficulty: 2,
    duration_minutes: 50,
    description: 'Dance-inspired cardio workout that blends choreography and fun intervals.',
    suitable_for: 'Anyone who prefers energetic, music-led workouts.',
    what_to_bring: 'Lightweight sneakers, water, breathable outfit.'
  },
  {
    title: 'Functional training',
    category: 'Strength',
    difficulty: 2,
    duration_minutes: 55,
    description: 'Functional movement patterns to improve strength for real-life activity.',
    suitable_for: 'Members wanting practical strength, balance, and coordination.',
    what_to_bring: 'Cross-training shoes, towel, hydration.'
  },
  {
    title: 'Tabata',
    category: 'Cardio',
    difficulty: 3,
    duration_minutes: 40,
    description: 'Short, intense interval blocks for maximum output in minimal time.',
    suitable_for: 'Advanced or time-limited members who like high-intensity sessions.',
    what_to_bring: 'Supportive shoes, towel, water.'
  },
  {
    title: 'Fly Yoga',
    category: 'Mind & Body',
    difficulty: 2,
    duration_minutes: 50,
    description: 'Aerial yoga using hammocks to improve mobility, core, and confidence.',
    suitable_for: 'Members ready to explore playful inversion and stability work.',
    what_to_bring: 'Fitted top, leggings, no sharp accessories.'
  },
  {
    title: 'Pilates',
    category: 'Mind & Body',
    difficulty: 2,
    duration_minutes: 50,
    description: 'Mat pilates for core control, spinal support, and elegant movement quality.',
    suitable_for: 'All levels, especially members improving posture and core endurance.',
    what_to_bring: 'Mat, grip socks (optional), water.'
  },
  {
    title: 'Cross training',
    category: 'Strength',
    difficulty: 3,
    duration_minutes: 55,
    description: 'Mixed-modality training integrating strength blocks and cardio transitions.',
    suitable_for: 'Members who enjoy varied, performance-focused workouts.',
    what_to_bring: 'Cross trainers, towel, hydration.'
  },
  {
    title: 'Zumba',
    category: 'Cardio',
    difficulty: 2,
    duration_minutes: 50,
    description: 'Latin-inspired dance cardio class with nonstop energy and rhythm.',
    suitable_for: 'Anyone wanting a social, upbeat fat-burning session.',
    what_to_bring: 'Comfortable dance-friendly shoes, water.'
  },
  {
    title: 'Kango Jumps',
    category: 'Cardio',
    difficulty: 3,
    duration_minutes: 45,
    description: 'Rebound-boot cardio class designed for explosive, joint-friendly intensity.',
    suitable_for: 'Members seeking advanced cardio novelty with strong calorie burn.',
    what_to_bring: 'Kangoo boots (or rental), towel, moisture-wicking outfit.'
  },
  {
    title: 'Fit ball',
    category: 'Strength',
    difficulty: 1,
    duration_minutes: 45,
    description: 'Stability ball workout for core strength, posture, and controlled movement.',
    suitable_for: 'Beginners, rehab-friendly participants, and core-focused members.',
    what_to_bring: 'Exercise mat, clean sneakers, water bottle.'
  }
];

const TRAINERS = ['Ivan', 'Maria', 'Chris', 'Elena', 'Daniel', 'Nina'];
const ROOMS = ['Studio A', 'Studio B', 'Zone 1', 'Zone 2', 'Mind Studio', 'Arena'];
const SESSION_TIME_SLOTS = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 30 },
  { hour: 10, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 17, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 19, minute: 30 },
  { hour: 21, minute: 0 }
];

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function createBaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date, hour, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function pickFrom(list, index) {
  return list[index % list.length];
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildLongDescription(title, category) {
  return [
    `${title} is one of our signature ${category} experiences, designed to deliver visible progress while keeping every session engaging and purposeful. Expect smart coaching, premium class flow, and a motivating atmosphere from warm-up to final stretch.`,
    `Each class blends structured technique, progressive intensity, and practical movement patterns so members build confidence week after week. Whether you are training for performance or simply feeling better in daily life, this format creates reliable momentum without unnecessary complexity.`,
    `You will leave with stronger form, better body awareness, and a clear sense of accomplishment. Join consistently and ${title} becomes a cornerstone session for long-term fitness, resilience, and energy.`
  ].join('\n\n');
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[randomInt(0, list.length - 1)];
}

function sampleWithoutReplacement(list, count) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isHighDemandWindow(date) {
  const key = formatDateKey(date);
  return key >= '2026-02-24' && key <= '2026-03-05';
}

async function deleteAllRows(client, tableName) {
  const { error } = await client.from(tableName).delete().not('id', 'is', null);
  if (error) {
    throw new Error(`Failed cleanup for ${tableName}: ${error.message}`);
  }
}

async function cleanupExistingData(client) {
  await deleteAllRows(client, 'bookings');
  await deleteAllRows(client, 'schedule');
  await deleteAllRows(client, 'workout_types');
  await deleteAllRows(client, 'profiles');
}

async function createOrGetUserClient({ email, fullName }) {
  const client = createBaseClient();

  const signUpResult = await client.auth.signUp({
    email,
    password: DEFAULT_PASSWORD,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (signUpResult.error && !/already|exists|registered/i.test(signUpResult.error.message || '')) {
    throw new Error(`Unable to sign up ${email}: ${signUpResult.error.message}`);
  }

  const signInResult = await client.auth.signInWithPassword({
    email,
    password: DEFAULT_PASSWORD
  });

  if (signInResult.error) {
    throw new Error(`Unable to sign in ${email}: ${signInResult.error.message}`);
  }

  const userId = signInResult.data.user?.id;
  if (!userId) {
    throw new Error(`No user id returned for ${email}`);
  }

  const { error: profileError } = await client.from('profiles').upsert(
    {
      id: userId,
      full_name: fullName,
      email
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw new Error(`Failed ensuring profile for ${email}: ${profileError.message}`);
  }

  return {
    email,
    userId,
    client
  };
}

async function upsertWorkoutTypes(adminClient) {
  const payload = WORKOUT_TYPES_TO_CREATE.map((workout) => ({
    title: workout.title,
    slug: slugify(workout.title),
    description: workout.description,
    description_long: buildLongDescription(workout.title, workout.category),
    suitable_for: workout.suitable_for,
    what_to_bring: workout.what_to_bring,
    category: workout.category,
    duration_minutes: workout.duration_minutes,
    difficulty_level: workout.difficulty,
    image_url: null
  }));

  const { error: insertError } = await adminClient.from('workout_types').insert(payload);

  if (insertError) {
    throw new Error(`Failed inserting workout types: ${insertError.message}`);
  }

  const { data: allWorkouts, error: allWorkoutsError } = await adminClient
    .from('workout_types')
    .select('id, title, difficulty_level')
    .order('title');

  if (allWorkoutsError) {
    throw new Error(`Failed loading workout types after insert: ${allWorkoutsError.message}`);
  }

  return allWorkouts;
}

async function createSchedule(adminClient, workouts) {
  const now = new Date();
  const startDate = setTime(addDays(now, -7), 0, 0);
  const endDate = new Date('2026-03-10T23:59:59.999');

  const schedulePayload = [];

  for (
    let cursor = new Date(startDate);
    cursor <= endDate;
    cursor = addDays(cursor, 1)
  ) {
    const sortedSlots = [...SESSION_TIME_SLOTS].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
    const sessionsCount = isHighDemandWindow(cursor) ? 8 : randomInt(7, 8);
    const selectedSlots = sampleWithoutReplacement(sortedSlots, sessionsCount);

    selectedSlots.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

    for (const slot of selectedSlots) {
      const workout = pickRandom(workouts);
      schedulePayload.push({
        workout_type_id: workout.id,
        start_time: setTime(cursor, slot.hour, slot.minute).toISOString(),
        trainer_name: pickRandom(TRAINERS),
        capacity: randomInt(18, 30),
        room: pickRandom(ROOMS)
      });
    }
  }

  const { error: insertScheduleError } = await adminClient
    .from('schedule')
    .insert(schedulePayload);

  if (insertScheduleError) {
    throw new Error(`Failed creating schedule rows: ${insertScheduleError.message}`);
  }

  const { data: schedules, error: schedulesError } = await adminClient
    .from('schedule')
    .select('id, start_time')
    .order('start_time', { ascending: true });

  if (schedulesError) {
    throw new Error(`Failed loading schedule rows: ${schedulesError.message}`);
  }

  return schedules;
}

function splitPastFutureSchedules(scheduleRows) {
  const now = new Date();
  const past = [];
  const future = [];

  for (const row of scheduleRows) {
    const startTime = new Date(row.start_time);
    if (startTime < now) {
      past.push(row);
    } else {
      future.push(row);
    }
  }

  return { past, future };
}

async function createBookingsForUsers(users, schedulesByTime) {
  for (const user of users) {
    const { client, userId, email } = user;
    const pastSelections = sampleWithoutReplacement(schedulesByTime.past, 5);
    const futureSelections = sampleWithoutReplacement(schedulesByTime.future, 5);

    const bookingPayload = [
      ...pastSelections.map((schedule) => ({ schedule_id: schedule.id, user_id: userId })),
      ...futureSelections.map((schedule) => ({ schedule_id: schedule.id, user_id: userId }))
    ];

    const { error } = await client.from('bookings').insert(bookingPayload);

    if (error && !/duplicate key/i.test(error.message || '')) {
      throw new Error(`Failed creating bookings for ${email}: ${error.message}`);
    }
  }
}

async function main() {
  requireEnv('SUPABASE_URL or VITE_SUPABASE_URL', SUPABASE_URL);
  requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_PUBLISHABLE_KEY);

  const baseClient = createBaseClient();
  await cleanupExistingData(baseClient);

  const users = [];
  for (const userSeed of USERS_TO_CREATE) {
    const user = await createOrGetUserClient(userSeed);
    users.push(user);
  }

  const adminClient = users[0].client;
  const workouts = await upsertWorkoutTypes(adminClient);
  const scheduleRows = await createSchedule(adminClient, workouts);
  const schedulesByTime = splitPastFutureSchedules(scheduleRows);

  if (schedulesByTime.past.length < 5 || schedulesByTime.future.length < 5) {
    throw new Error('Insufficient past/future schedules created for booking seeding.');
  }

  await createBookingsForUsers(users, schedulesByTime);

  console.log('Seed data script completed (users, workout_types, schedule, bookings).');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
