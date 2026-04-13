-- ============================================================================
-- StaffBazaar — full schema + seed + RLS + realtime
-- Paste this whole file into Supabase → SQL Editor → Run.
-- NON-DESTRUCTIVE: preserves existing tables and data.
--   - create table if not exists   (no drops)
--   - insert ... on conflict do nothing   (re-seeding skips existing rows)
-- ============================================================================

-- ============================================================================
-- JOBS
-- ============================================================================
create table if not exists public.jobs (
  id            text primary key,
  title         text not null,
  role          text not null,
  status        text not null check (status in ('active','draft','paused','closed')),
  applicants    int not null default 0,
  new_today     int not null default 0,
  views         int not null default 0,
  posted_days_ago int not null default 0,
  salary_min    int not null default 0,
  salary_max    int not null default 0,
  shift         text,
  job_type      text,
  tips          boolean default false,
  description   text,
  created_at    timestamptz default now()
);

-- ============================================================================
-- WORKERS (browseable staff pool)
-- ============================================================================
create table if not exists public.workers (
  id            text primary key,
  name          text not null,
  role          text not null,
  role_label    text not null,
  city          text,
  availability  text check (availability in ('now','week','month')),
  experience    int default 0,
  salary        int default 0,
  rating        int default 0,
  phone         text,
  avatar        text,
  initials      text,
  verified      boolean default true,
  created_at    timestamptz default now()
);

-- ============================================================================
-- APPLICANTS (per-job kanban cards)
-- ============================================================================
create table if not exists public.applicants (
  id            text primary key,
  job_id        text references public.jobs(id) on delete cascade,
  name          text not null,
  role          text,
  experience    int default 0,
  salary        int default 0,
  rating        int default 0,
  phone         text,
  avatar        text,
  initials      text,
  stage         text not null check (stage in ('applied','shortlisted','called','hired')),
  created_at    timestamptz default now()
);

-- ============================================================================
-- SAVED STAFF (simple join: owner "me" ↔ worker)
-- ============================================================================
create table if not exists public.saved_staff (
  worker_id     text primary key references public.workers(id) on delete cascade,
  saved_at      timestamptz default now()
);

-- ============================================================================
-- CONVERSATIONS + MESSAGES
-- ============================================================================
create table if not exists public.conversations (
  id            text primary key,
  name          text not null,
  role          text,
  avatar        text,
  initials      text,
  type          text check (type in ('active','hired')),
  last_message  text,
  time          text,
  unread        int default 0,
  updated_at    timestamptz default now()
);

create table if not exists public.messages (
  id              text primary key,
  conversation_id text references public.conversations(id) on delete cascade,
  from_me         boolean default false,
  text            text not null,
  time            text,
  created_at      timestamptz default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id);

-- ============================================================================
-- APP SETTINGS (singleton row for quota)
-- ============================================================================
create table if not exists public.app_settings (
  id          int primary key default 1,
  posts_used  int default 2,
  posts_limit int default 3,
  check (id = 1)
);

insert into public.app_settings (id, posts_used, posts_limit) values (1, 2, 3)
on conflict (id) do nothing;

-- ============================================================================
-- ROW-LEVEL SECURITY
-- For the demo we allow anyone to read + write. Lock down once auth is wired.
-- ============================================================================
alter table public.jobs           enable row level security;
alter table public.workers        enable row level security;
alter table public.applicants     enable row level security;
alter table public.saved_staff    enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.app_settings   enable row level security;

do $$
declare
  t text;
  tables text[] := array['jobs','workers','applicants','saved_staff','conversations','messages','app_settings'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'anon all ' || t
    ) then
      execute format(
        'create policy %I on public.%I for all using (true) with check (true)',
        'anon all ' || t, t
      );
    end if;
  end loop;
end $$;

-- ============================================================================
-- REALTIME — add all mutating tables to the publication
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array['jobs','applicants','saved_staff','conversations','messages','app_settings'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- SEED: JOBS
-- ============================================================================
insert into public.jobs (id, title, role, status, applicants, new_today, views, posted_days_ago, salary_min, salary_max, shift, job_type, tips, description) values
('head-chef',      'Head Chef',      'Cooks & Chefs',     'active', 12, 3, 156, 5, 35000, 50000, 'Evening', 'Full-time', true,  'We are looking for an experienced Head Chef with strong leadership skills and expertise in North Indian cuisine.'),
('tandoor-chef',   'Tandoor Chef',   'Cooks & Chefs',     'active',  8, 2,  89, 3, 25000, 38000, 'Evening', 'Full-time', true,  'Experienced tandoor chef needed for our busy restaurant.'),
('kitchen-helper', 'Kitchen Helper', 'Kitchen Helpers',   'active', 22, 5, 230, 7, 12000, 18000, 'Morning', 'Full-time', false, 'Hardworking kitchen helper needed. Training provided.'),
('waiter',         'Waiter / Server','Waiters & Servers', 'paused', 15, 0, 198, 14,15000, 22000, 'Evening', 'Full-time', true,  'Friendly waiter for our front of house team.'),
('bartender',      'Bartender',      'Bartenders',        'closed', 18, 0, 312, 30,25000, 35000, 'Night',   'Full-time', true,  'Mixology experience required.')
on conflict (id) do nothing;

-- ============================================================================
-- SEED: WORKERS
-- ============================================================================
insert into public.workers (id, name, role, role_label, city, availability, experience, salary, rating, phone, avatar, initials, verified) values
('w1',  'Vikram Sharma',    'chef',     'Head Chef',       'Mumbai',    'week',  12, 45000, 4, '+919876543220', 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop&crop=face', 'VS', true),
('w2',  'Ravi Patil',       'helper',   'Kitchen Helper',  'Bangalore', 'now',    3, 18000, 4, '+919876543221', null, 'RP', true),
('w3',  'Ananya Deshmukh',  'captain',  'Captain',         'Bangalore', 'now',    7, 28000, 4, '+919876543222', null, 'AD', true),
('w4',  'Rajesh Kumar',     'chef',     'Head Chef',       'Bangalore', 'week',  15, 55000, 4, '+919876543223', null, 'RK', true),
('w5',  'Abdul Malik',      'chef',     'Tandoor Chef',    'Hyderabad', 'month', 10, 40000, 4, '+919876543224', null, 'AM', true),
('w6',  'Deepak Thakur',    'helper',   'Kitchen Helper',  'Mumbai',    'now',    1, 14000, 4, '+919876543225', null, 'DT', true),
('w7',  'Peter Fernandes',  'captain',  'Captain',         'Bangalore', 'month',  5, 25000, 4, '+919876543226', null, 'PF', true),
('w8',  'Sunita Gupta',     'chef',     'Pastry Chef',     'Bangalore', 'now',    6, 30000, 4, '+919876543227', null, 'SG', true),
('w9',  'Arjun Yadav',      'runner',   'Food Runner',     'Bangalore', 'now',    2, 16000, 4, '+919876543228', null, 'AY', true),
('w10', 'Priya Menon',      'captain',  'Captain',         'Bangalore', 'week',   4, 22000, 4, '+919876543229', null, 'PM', true),
('w11', 'Manoj Sawant',     'support',  'Dishwasher',      'Bangalore', 'now',    2, 12000, 4, '+919876543230', null, 'MS', true)
on conflict (id) do nothing;

-- ============================================================================
-- SEED: APPLICANTS
-- ============================================================================
insert into public.applicants (id, job_id, name, role, experience, salary, rating, phone, avatar, initials, stage) values
-- Head Chef
('a1',  'head-chef',     'Arjun Mehta',      'Head Chef',      8,  42000, 4, '+919876543210', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face', 'AM', 'applied'),
('a2',  'head-chef',     'Priya Krishnan',   'Sous Chef',      6,  35000, 5, '+919876543211', null, 'PK', 'applied'),
('a3',  'head-chef',     'Sandeep Mishra',   'Line Cook',      4,  28000, 3, '+919876543212', null, 'SM', 'applied'),
('a4',  'head-chef',     'Neha Reddy',       'Head Chef',      10, 50000, 5, '+919876543213', null, 'NR', 'applied'),
('a5',  'head-chef',     'Ramesh Tiwari',    'Tandoor Chef',   12, 38000, 4, '+919876543214', null, 'RT', 'applied'),
('a6',  'head-chef',     'Mohammed Javed',   'Head Chef',      7,  40000, 3, '+919876543215', null, 'MJ', 'applied'),
('a7',  'head-chef',     'Vikram Sharma',    'Head Chef',      12, 45000, 5, '+919876543220', 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&h=100&fit=crop&crop=face', 'VS', 'shortlisted'),
('a8',  'head-chef',     'Abdul Malik',      'Tandoor Chef',   10, 40000, 4, '+919876543221', null, 'AM', 'shortlisted'),
('a9',  'head-chef',     'Sunita Gupta',     'Pastry Chef',    6,  30000, 4, '+919876543222', null, 'SG', 'shortlisted'),
('a10', 'head-chef',     'Ananya Deshmukh',  'Head Chef',      7,  38000, 5, '+919876543230', null, 'AD', 'called'),
('a11', 'head-chef',     'Rajesh Kumar',     'Head Chef',      15, 55000, 5, '+919876543231', null, 'RK', 'called'),
('a12', 'head-chef',     'Deepak Thakur',    'Kitchen Helper', 1,  14000, 4, '+919876543240', null, 'DT', 'hired'),
-- Tandoor Chef
('tc1', 'tandoor-chef',  'Iqbal Ahmed',      'Tandoor Specialist',   9,  35000, 5, '+919811112201', null, 'IA', 'applied'),
('tc2', 'tandoor-chef',  'Hardeep Singh',    'Tandoor Chef',         7,  32000, 4, '+919811112202', null, 'HS', 'applied'),
('tc3', 'tandoor-chef',  'Faisal Khan',      'Tandoor Master',       11, 38000, 5, '+919811112203', null, 'FK', 'applied'),
('tc4', 'tandoor-chef',  'Pankaj Joshi',     'Grill & Tandoor',      5,  28000, 4, '+919811112204', null, 'PJ', 'applied'),
('tc5', 'tandoor-chef',  'Kamal Verma',      'Tandoor Chef',         8,  33000, 4, '+919811112205', null, 'KV', 'shortlisted'),
('tc6', 'tandoor-chef',  'Rahul Sharma',     'Senior Tandoor Chef',  13, 42000, 5, '+919811112206', null, 'RS', 'shortlisted'),
('tc7', 'tandoor-chef',  'Sanjay Bhatia',    'Tandoor Chef',         6,  30000, 4, '+919811112207', null, 'SB', 'called'),
('tc8', 'tandoor-chef',  'Vinod Kumar',      'Head Tandoor',         14, 45000, 5, '+919811112208', null, 'VK', 'called'),
-- Kitchen Helper
('kh1', 'kitchen-helper','Suresh Yadav',     'Kitchen Helper',  1, 14000, 4, '+919822221101', null, 'SY', 'applied'),
('kh2', 'kitchen-helper','Manoj Pawar',      'Dishwasher',      2, 13000, 3, '+919822221102', null, 'MP', 'applied'),
('kh3', 'kitchen-helper','Ramu Das',         'Prep Cook',       3, 16000, 4, '+919822221103', null, 'RD', 'applied'),
('kh4', 'kitchen-helper','Lalit Kumar',      'Kitchen Helper',  1, 14000, 4, '+919822221104', null, 'LK', 'applied'),
('kh5', 'kitchen-helper','Bablu Singh',      'Helper',          2, 15000, 3, '+919822221105', null, 'BS', 'applied'),
('kh6', 'kitchen-helper','Mohit Roy',        'Kitchen Helper',  4, 17000, 5, '+919822221106', null, 'MR', 'shortlisted'),
('kh7', 'kitchen-helper','Aakash Jha',       'Helper',          1, 13000, 4, '+919822221107', null, 'AJ', 'shortlisted'),
('kh8', 'kitchen-helper','Pradeep Nair',     'Prep Helper',     3, 15000, 4, '+919822221108', null, 'PN', 'shortlisted'),
('kh9', 'kitchen-helper','Sachin Tomar',     'Kitchen Helper',  2, 14000, 4, '+919822221109', null, 'ST', 'called'),
('kh10','kitchen-helper','Vijay More',       'Senior Helper',   5, 18000, 5, '+919822221110', null, 'VM', 'called')
on conflict (id) do nothing;

-- ============================================================================
-- SEED: CONVERSATIONS + MESSAGES
-- ============================================================================
insert into public.conversations (id, name, role, avatar, initials, type, last_message, time, unread) values
('vikram', 'Vikram Sharma',    'Head Chef',      'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&h=100&fit=crop&crop=face', 'VS', 'active', 'Yes sir, I can join from next Monday', '10:32 AM', 2),
('ananya', 'Ananya Deshmukh',  'Head Chef',      null, 'AD', 'active', 'What time should I come for the interview?', '9:15 AM', 1),
('abdul',  'Abdul Malik',      'Tandoor Chef',   null, 'AM', 'active', 'Thank you for considering my application', 'Yesterday', 0),
('deepak', 'Deepak Thakur',    'Kitchen Helper', null, 'DT', 'hired',  'I will bring my documents tomorrow', '2 Apr', 0)
on conflict (id) do nothing;

insert into public.messages (id, conversation_id, from_me, text, time) values
('vm1', 'vikram', false, 'Namaste sir, I saw your job post for Head Chef. I have 12 years of experience.', '1 Apr, 2:30 PM'),
('vm2', 'vikram', true,  'Hello Vikram, thank you for applying. Can you tell me about your tandoor experience?', '1 Apr, 3:15 PM'),
('vm3', 'vikram', false, 'Yes sir, I have managed live Tandoor counters at The Grand Pavilion for 5 years.', '1 Apr, 3:45 PM'),
('vm4', 'vikram', true,  'Wonderful. Can you come for an in-person interview this week?', '2 Apr, 10:00 AM'),
('vm5', 'vikram', false, 'Sure sir, I am available on Thursday or Friday.', '2 Apr, 11:30 AM'),
('vm6', 'vikram', true,  'Let us do Thursday at 11 AM. Please bring your experience certificates.', '2 Apr, 12:00 PM'),
('vm7', 'vikram', false, 'Yes sir, I can join from next Monday', '10:32 AM'),

('am1', 'ananya', false, 'Hi, I applied for the Head Chef position.', 'Yesterday, 2:30 PM'),
('am2', 'ananya', true,  'Hello Ananya, we would like to interview you. Are you available this week?', 'Today, 9:00 AM'),
('am3', 'ananya', false, 'What time should I come for the interview?', '9:15 AM'),

('ab1', 'abdul',  false, 'Thank you for considering my application', 'Yesterday, 5:00 PM'),

('dm1', 'deepak', true,  'Welcome to the team! When can you start?', '1 Apr, 4:00 PM'),
('dm2', 'deepak', false, 'I will bring my documents tomorrow', '2 Apr, 9:00 AM')
on conflict (id) do nothing;

-- ============================================================================
-- DONE — run this whole file. You should see "Success. No rows returned."
-- ============================================================================
