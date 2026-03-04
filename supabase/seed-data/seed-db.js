import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv({ path: new URL('../../.env', import.meta.url) });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_PASSWORD = 'Pass123';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATAR_IMAGES_DIR = path.join(__dirname, 'avatar-images');
const SPORT_IMAGES_DIR = path.join(__dirname, 'sport-images');

const USERS_TO_CREATE = [
  { email: 'admin@sportspot.com', fullName: 'Admin User', role: 'admin' },
  { email: 'user1@gmail.com', fullName: 'Alex Member', role: 'user' },
  { email: 'user2@gmail.com', fullName: 'Jordan Member', role: 'user' },
  { email: 'user3@gmail.com', fullName: 'Casey Member', role: 'user' },
  { email: 'user4@gmail.com', fullName: 'Taylor Member', role: 'user' }
];

const WORKOUT_TYPES_TO_CREATE = [
  { file: 'box.jpg', title: 'Box', category: 'Combat', difficulty: 3, duration: 60 },
  { file: 'pilates.jpg', title: 'Pilates', category: 'Mind & Body', difficulty: 2, duration: 50 },
  { file: 'kango-jumps.jpg', title: 'Kango Jumps', category: 'Cardio', difficulty: 3, duration: 45 },
  { file: 'yoga.jpg', title: 'Yoga', category: 'Mind & Body', difficulty: 1, duration: 55 },
  { file: 'spinning.jpg', title: 'Spinning', category: 'Cardio', difficulty: 2, duration: 45 },
  { file: 'cross-bootcamp.jpg', title: 'Cross Bootcamp', category: 'Strength', difficulty: 3, duration: 45 },
  { file: 'cross-training.jpg', title: 'Cross Training', category: 'Strength', difficulty: 3, duration: 55 },
  { file: 'dance-fit.jpg', title: 'Dance Fit', category: 'Cardio', difficulty: 2, duration: 50 },
  { file: 'fit-ball.jpg', title: 'Fit Ball', category: 'Strength', difficulty: 1, duration: 45 },
  { file: 'fit-bands.jpg', title: 'Fit Bands', category: 'Strength', difficulty: 2, duration: 45 },
  { file: 'fly-yoga.jpg', title: 'Fly Yoga', category: 'Mind & Body', difficulty: 2, duration: 50 },
  { file: 'functional-training.jpg', title: 'Functional Training', category: 'Strength', difficulty: 2, duration: 55 },
  { file: 'kick-box.jpg', title: 'Kick Box', category: 'Combat', difficulty: 3, duration: 50 },
  { file: 'mobility.jpg', title: 'Mobility', category: 'Mind & Body', difficulty: 1, duration: 50 },
  { file: 'p-box.jpg', title: 'P.Boxx', category: 'Combat', difficulty: 3, duration: 55 },
  { file: 'pilates-reformer.jpg', title: 'Pilates Reformer', category: 'Mind & Body', difficulty: 2, duration: 50 },
  { file: 'stretching.jpg', title: 'Stretching', category: 'Mind & Body', difficulty: 1, duration: 40 },
  { file: 'tabata.jpg', title: 'Tabata', category: 'Cardio', difficulty: 3, duration: 40 },
  { file: 'total-body.jpg', title: 'Total Body', category: 'Strength', difficulty: 2, duration: 55 },
  { file: 'yoga-fit.jpg', title: 'Yoga Fit', category: 'Mind & Body', difficulty: 1, duration: 60 },
  { file: 'zumba.jpg', title: 'Zumba', category: 'Cardio', difficulty: 2, duration: 50 }
];

const PAST_BOOKING_PLAN = {
  Box: 15,
  Pilates: 10,
  'Kango Jumps': 7,
  Yoga: 3,
  Spinning: 1
};

const TRAINERS = ['Ivan', 'Maria', 'Chris', 'Elena', 'Daniel', 'Nina'];
const ROOMS = ['Studio A', 'Studio B', 'Zone 1', 'Zone 2', 'Mind Studio', 'Arena'];
const FIXED_HOURLY_SLOTS = [7, 8, 9, 10, 17, 18, 19, 20];

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

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function withUtcTime(date, hour) {
  const next = new Date(date);
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKeyUtc(date) {
  return date.toISOString().slice(0, 10);
}

function pickRoundRobin(list, index) {
  return list[index % list.length];
}

function chunk(list, size) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

function buildWorkoutDescription(title) {
  return `${title} is a coached group class focused on progressive technique, safe effort, and measurable fitness improvements.`;
}

function buildWorkoutLongDescription(title, category) {
  return [
    `${title} is one of our signature ${category} sessions designed for consistent weekly progress and an engaging class flow.`,
    'Members receive clear coaching cues, practical movement progressions, and a class structure that balances quality and intensity.',
    `Attend ${title} regularly to improve performance, confidence, and overall training consistency.`
  ].join('\n\n');
}

async function listImageFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function uploadFilesToBucket(client, bucketName, files, sourceDir, destinationPathFactory) {
  const map = new Map();

  for (const fileName of files) {
    const sourcePath = path.join(sourceDir, fileName);
    const fileBuffer = await readFile(sourcePath);
    const destinationPath = destinationPathFactory(fileName);

    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(destinationPath, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (uploadError) {
      throw new Error(`Failed upload ${bucketName}/${destinationPath}: ${uploadError.message}`);
    }

    const { data: publicData } = client.storage.from(bucketName).getPublicUrl(destinationPath);
    map.set(fileName, publicData.publicUrl);
  }

  return map;
}

async function clearExistingData(client) {
  const tableNames = ['bookings', 'schedule', 'workout_types'];

  for (const tableName of tableNames) {
    const { error } = await client.from(tableName).delete().not('id', 'is', null);
    if (error) {
      throw new Error(`Failed cleanup for ${tableName}: ${error.message}`);
    }
  }
}

async function createOrGetSignedInUser({ email, fullName, password }) {
  const client = createBaseClient();

  const signUpResult = await client.auth.signUp({
    email,
    password,
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
    password
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
    throw new Error(`Failed profile upsert for ${email}: ${profileError.message}`);
  }

  return {
    email,
    fullName,
    userId,
    client
  };
}

async function ensureRoles(adminClient, users) {
  const roleRows = users.map((user) => ({
    user_id: user.userId,
    role: user.email === 'admin@sportspot.com' ? 'admin' : 'user'
  }));

  const { error: deleteError } = await adminClient
    .from('user_roles')
    .delete()
    .in('user_id', users.map((user) => user.userId));

  if (deleteError) {
    throw new Error(`Failed clearing user roles: ${deleteError.message}`);
  }

  const { error: insertError } = await adminClient.from('user_roles').insert(roleRows);
  if (insertError) {
    throw new Error(`Failed assigning user roles: ${insertError.message}`);
  }
}

async function uploadAvatarImagesForUsers(users) {
  const avatarFiles = await listImageFiles(AVATAR_IMAGES_DIR);
  if (avatarFiles.length < users.length) {
    throw new Error(`Expected at least ${users.length} avatar images, found ${avatarFiles.length}`);
  }

  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const avatarFile = avatarFiles[index];
    const userAvatarMap = await uploadFilesToBucket(
      user.client,
      'avatars',
      [avatarFile],
      AVATAR_IMAGES_DIR,
      () => `${user.userId}/avatar.jpg`
    );

    const avatarUrl = userAvatarMap.get(avatarFile);
    const { error: profileError } = await user.client
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.userId);

    if (profileError) {
      throw new Error(`Failed setting avatar URL for ${user.email}: ${profileError.message}`);
    }
  }
}

async function uploadWorkoutImages(adminClient) {
  const sportFiles = await listImageFiles(SPORT_IMAGES_DIR);

  if (sportFiles.length !== WORKOUT_TYPES_TO_CREATE.length) {
    throw new Error(
      `Expected ${WORKOUT_TYPES_TO_CREATE.length} sport images, found ${sportFiles.length}.`
    );
  }

  return uploadFilesToBucket(
    adminClient,
    'workout-images',
    sportFiles,
    SPORT_IMAGES_DIR,
    (fileName) => fileName
  );
}

async function seedWorkoutTypes(adminClient, workoutImageUrlMap) {
  const payload = WORKOUT_TYPES_TO_CREATE.map((workout) => ({
    title: workout.title,
    slug: slugify(workout.title),
    category: workout.category,
    description: buildWorkoutDescription(workout.title),
    description_long: buildWorkoutLongDescription(workout.title, workout.category),
    suitable_for: 'All members with basic movement readiness; intensity can be scaled by instructor guidance.',
    what_to_bring: 'Water bottle, towel, and appropriate training outfit.',
    duration_minutes: workout.duration,
    difficulty_level: workout.difficulty,
    image_url: workoutImageUrlMap.get(workout.file) || null
  }));

  const { error: insertError } = await adminClient.from('workout_types').insert(payload);
  if (insertError) {
    throw new Error(`Failed inserting workout types: ${insertError.message}`);
  }

  const { data: workouts, error: workoutsError } = await adminClient
    .from('workout_types')
    .select('id, title')
    .order('title', { ascending: true });

  if (workoutsError) {
    throw new Error(`Failed loading workout types: ${workoutsError.message}`);
  }

  return workouts;
}

function buildPastSchedulePayload(workoutMapByTitle) {
  const payload = [];
  const now = new Date();
  const featuredTitles = ['Box', 'Pilates', 'Kango Jumps', 'Yoga', 'Spinning'];

  const extraTitles = WORKOUT_TYPES_TO_CREATE.map((workout) => workout.title).filter(
    (title) => !featuredTitles.includes(title)
  );

  let extraIndex = 0;

  for (let dayOffset = 30; dayOffset >= 1; dayOffset -= 1) {
    const day = addDays(now, -dayOffset);

    for (let slotIndex = 0; slotIndex < FIXED_HOURLY_SLOTS.length; slotIndex += 1) {
      const hour = FIXED_HOURLY_SLOTS[slotIndex];
      const title =
        slotIndex < featuredTitles.length
          ? featuredTitles[slotIndex]
          : pickRoundRobin(extraTitles, extraIndex++);

      payload.push({
        workout_type_id: workoutMapByTitle.get(title),
        start_time: withUtcTime(day, hour).toISOString(),
        trainer_name: pickRoundRobin(TRAINERS, dayOffset + slotIndex),
        capacity: 30,
        room: pickRoundRobin(ROOMS, slotIndex + dayOffset)
      });
    }
  }

  return payload;
}

function buildFutureSchedulePayload(workoutMapByTitle) {
  const payload = [];
  const now = new Date();
  const allTitles = WORKOUT_TYPES_TO_CREATE.map((workout) => workout.title);

  let titleIndex = 0;

  for (let dayOffset = 1; dayOffset <= 20; dayOffset += 1) {
    const day = addDays(now, dayOffset);

    for (let slotIndex = 0; slotIndex < 8; slotIndex += 1) {
      const hour = FIXED_HOURLY_SLOTS[slotIndex];
      const title = pickRoundRobin(allTitles, titleIndex++);

      payload.push({
        workout_type_id: workoutMapByTitle.get(title),
        start_time: withUtcTime(day, hour).toISOString(),
        trainer_name: pickRoundRobin(TRAINERS, dayOffset + slotIndex),
        capacity: 30,
        room: pickRoundRobin(ROOMS, dayOffset + slotIndex * 2)
      });
    }
  }

  return payload;
}

async function insertScheduleInBatches(adminClient, rows) {
  for (const rowsChunk of chunk(rows, 500)) {
    const { error } = await adminClient.from('schedule').insert(rowsChunk);
    if (error) {
      throw new Error(`Failed inserting schedule rows: ${error.message}`);
    }
  }
}

async function loadScheduleWithWorkoutTitles(adminClient) {
  const { data, error } = await adminClient
    .from('schedule')
    .select('id, start_time, workout_types(title)')
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(`Failed loading schedule rows: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    start_time: row.start_time,
    title: row.workout_types?.title || null
  }));
}

function splitSchedule(scheduleRows) {
  const now = new Date();
  const past = [];
  const future = [];

  for (const row of scheduleRows) {
    if (new Date(row.start_time) < now) {
      past.push(row);
    } else {
      future.push(row);
    }
  }

  return { past, future };
}

function indexScheduleByTitle(scheduleRows) {
  const map = new Map();

  for (const row of scheduleRows) {
    if (!row.title) continue;
    const list = map.get(row.title) || [];
    list.push(row);
    map.set(row.title, list);
  }

  return map;
}

function buildPastBookings(users, pastScheduleRows) {
  const byTitle = indexScheduleByTitle(pastScheduleRows);
  const bookings = [];

  for (const user of users) {
    for (const [title, count] of Object.entries(PAST_BOOKING_PLAN)) {
      const slots = byTitle.get(title) || [];
      if (slots.length < count) {
        throw new Error(`Insufficient past schedule rows for ${title}. Need ${count}, found ${slots.length}`);
      }

      for (let index = 0; index < count; index += 1) {
        bookings.push({
          schedule_id: slots[index].id,
          user_id: user.userId
        });
      }
    }
  }

  return bookings;
}

function buildUpcomingBookings(members, futureScheduleRows) {
  const byDate = new Map();

  for (const row of futureScheduleRows) {
    const key = dateKeyUtc(new Date(row.start_time));
    const list = byDate.get(key) || [];
    list.push(row);
    byDate.set(key, list);
  }

  const nextThreeDays = [...byDate.keys()].sort().slice(0, 3);
  if (nextThreeDays.length < 3) {
    throw new Error('Insufficient future schedule days for upcoming booking seeding.');
  }

  const bookings = [];

  for (const member of members) {
    for (let dayIndex = 0; dayIndex < nextThreeDays.length; dayIndex += 1) {
      const dayKey = nextThreeDays[dayIndex];
      const sessions = byDate.get(dayKey) || [];
      if (sessions.length === 0) {
        throw new Error(`No sessions available on ${dayKey} for upcoming booking seeding.`);
      }

      const selectedSession = sessions[(dayIndex + members.indexOf(member)) % sessions.length];
      bookings.push({
        schedule_id: selectedSession.id,
        user_id: member.userId
      });
    }
  }

  return bookings;
}

async function insertBookingsInBatches(adminClient, bookings) {
  for (const rowsChunk of chunk(bookings, 500)) {
    const { error } = await adminClient.from('bookings').insert(rowsChunk);
    if (error) {
      throw new Error(`Failed inserting bookings: ${error.message}`);
    }
  }
}

async function main() {
  requireEnv('SUPABASE_URL or VITE_SUPABASE_URL', SUPABASE_URL);
  requireEnv('SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_PUBLISHABLE_KEY);

  const users = [];
  for (const seedUser of USERS_TO_CREATE) {
    users.push(
      await createOrGetSignedInUser({
        email: seedUser.email,
        fullName: seedUser.fullName,
        password: DEFAULT_PASSWORD
      })
    );
  }

  const adminUser = users.find((user) => user.email === 'admin@sportspot.com');
  if (!adminUser) {
    throw new Error('Admin user was not created.');
  }

  await ensureRoles(adminUser.client, users);

  await clearExistingData(adminUser.client);

  await uploadAvatarImagesForUsers(users);
  const workoutImageUrlMap = await uploadWorkoutImages(adminUser.client);

  const workouts = await seedWorkoutTypes(adminUser.client, workoutImageUrlMap);
  const workoutMapByTitle = new Map(workouts.map((workout) => [workout.title, workout.id]));

  const pastScheduleRows = buildPastSchedulePayload(workoutMapByTitle);
  const futureScheduleRows = buildFutureSchedulePayload(workoutMapByTitle);

  await insertScheduleInBatches(adminUser.client, [...pastScheduleRows, ...futureScheduleRows]);

  const scheduleRows = await loadScheduleWithWorkoutTitles(adminUser.client);
  const { past, future } = splitSchedule(scheduleRows);

  const allUsersPastBookings = buildPastBookings(users, past);
  const members = users.filter((user) => user.email !== 'admin@sportspot.com');
  const upcomingMemberBookings = buildUpcomingBookings(members, future);

  const allBookings = [...allUsersPastBookings, ...upcomingMemberBookings];
  await insertBookingsInBatches(adminUser.client, allBookings);

  console.log(
    `[SportSpot seed complete] users=${users.length} workouts=${workouts.length} bookings=${allBookings.length}`
  );
}

main().catch((error) => {
  console.error('[SportSpot seed failed]', error);
  process.exitCode = 1;
});
