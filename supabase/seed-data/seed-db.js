import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: new URL('../../.env', import.meta.url) });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_PASSWORD = 'pass123';

const USERS_TO_CREATE = [
  { email: 'user1@gmail.com', fullName: 'User One' },
  { email: 'user2@gmail.com', fullName: 'User Two' },
  { email: 'user3@gmail.com', fullName: 'User Three' }
];

const WORKOUT_TYPES_TO_CREATE = [
  {
    title: 'Yoga Flow',
    description: 'Breath-focused mobility and balance session.',
    duration_minutes: 60,
    difficulty_level: 1
  },
  {
    title: 'Power HIIT',
    description: 'High-intensity intervals for cardio and endurance.',
    duration_minutes: 45,
    difficulty_level: 3
  },
  {
    title: 'Box Conditioning',
    description: 'Punch combos, footwork, and conditioning drills.',
    duration_minutes: 50,
    difficulty_level: 3
  },
  {
    title: 'Pilates Core',
    description: 'Low-impact core strength and posture training.',
    duration_minutes: 55,
    difficulty_level: 2
  },
  {
    title: 'Spinning Blast',
    description: 'Indoor cycling intervals with rhythm-based sprints.',
    duration_minutes: 45,
    difficulty_level: 2
  },
  {
    title: 'Strength Basics',
    description: 'Foundational full-body resistance training.',
    duration_minutes: 60,
    difficulty_level: 1
  },
  {
    title: 'Mobility Reset',
    description: 'Joint mobility and recovery-focused movement.',
    duration_minutes: 40,
    difficulty_level: 1
  },
  {
    title: 'Cross Training',
    description: 'Mixed modality workout combining cardio and strength.',
    duration_minutes: 50,
    difficulty_level: 2
  },
  {
    title: 'Functional Circuit',
    description: 'Real-world movement patterns in station circuits.',
    duration_minutes: 55,
    difficulty_level: 2
  },
  {
    title: 'Advanced Endurance',
    description: 'Longer sets designed to build stamina and grit.',
    duration_minutes: 60,
    difficulty_level: 3
  }
];

const TRAINERS = ['Alex', 'Maya', 'Jordan', 'Chris', 'Taylor', 'Sam'];
const ROOMS = ['Studio A', 'Studio B', 'Cycle Room', 'Box Zone'];

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
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

async function createOrGetUserClient({ email, fullName }) {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

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

  return {
    email,
    userId,
    client
  };
}

async function upsertWorkoutTypes(adminClient) {
  const { data: existing, error: existingError } = await adminClient
    .from('workout_types')
    .select('id, title');

  if (existingError) {
    throw new Error(`Failed loading existing workout types: ${existingError.message}`);
  }

  const existingByTitle = new Map(existing.map((item) => [item.title.toLowerCase(), item]));
  const payload = WORKOUT_TYPES_TO_CREATE.map((workout) => ({
    ...workout,
    image_url: null
  }));

  const { error: upsertError } = await adminClient
    .from('workout_types')
    .upsert(payload, { onConflict: 'title' });

  if (upsertError && !/there is no unique|constraint/i.test(upsertError.message || '')) {
    throw new Error(`Failed to upsert workout types: ${upsertError.message}`);
  }

  if (upsertError) {
    for (const workout of payload) {
      if (!existingByTitle.has(workout.title.toLowerCase())) {
        const { error: insertError } = await adminClient.from('workout_types').insert(workout);
        if (insertError && !/duplicate key/i.test(insertError.message || '')) {
          throw new Error(`Failed to insert workout type ${workout.title}: ${insertError.message}`);
        }
      }
    }
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
  const days = [
    ...Array.from({ length: 7 }, (_, idx) => -7 + idx),
    ...Array.from({ length: 7 }, (_, idx) => idx + 1)
  ];

  const schedulePayload = [];

  workouts.forEach((workout, workoutIndex) => {
    const pastDay = days[workoutIndex % 7];
    const futureDay = days[7 + (workoutIndex % 7)];

    const pastDate = setTime(addDays(now, pastDay), 8 + (workoutIndex % 4) * 2, 0);
    const futureDate = setTime(addDays(now, futureDay), 9 + (workoutIndex % 4) * 2, 30);

    schedulePayload.push({
      workout_type_id: workout.id,
      start_time: pastDate.toISOString(),
      trainer_name: pickFrom(TRAINERS, workoutIndex),
      capacity: 20,
      room: pickFrom(ROOMS, workoutIndex)
    });

    schedulePayload.push({
      workout_type_id: workout.id,
      start_time: futureDate.toISOString(),
      trainer_name: pickFrom(TRAINERS, workoutIndex + 2),
      capacity: 20,
      room: pickFrom(ROOMS, workoutIndex + 1)
    });
  });

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
    const pastSelections = schedulesByTime.past.slice(0, 2);
    const futureSelections = schedulesByTime.future.slice(0, 2);

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
  requireEnv('SUPABASE_URL', SUPABASE_URL);
  requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_PUBLISHABLE_KEY);

  const users = [];
  for (const userSeed of USERS_TO_CREATE) {
    const user = await createOrGetUserClient(userSeed);
    users.push(user);
  }

  const adminClient = users[0].client;
  const workouts = await upsertWorkoutTypes(adminClient);
  const scheduleRows = await createSchedule(adminClient, workouts);
  const schedulesByTime = splitPastFutureSchedules(scheduleRows);

  if (schedulesByTime.past.length < 2 || schedulesByTime.future.length < 2) {
    throw new Error('Insufficient past/future schedules created for booking seeding.');
  }

  await createBookingsForUsers(users, schedulesByTime);

  console.log('Seed data script completed (users, workout_types, schedule, bookings).');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
