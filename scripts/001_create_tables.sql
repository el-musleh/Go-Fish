-- Go Fish Database Schema

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date,
  time time,
  location text,
  participant_count int default 1,
  budget decimal,
  description text,
  status text default 'planning' check (status in ('planning', 'confirmed', 'completed')),
  ai_suggestion jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;

create policy "events_select_own" on public.events for select using (auth.uid() = user_id);
create policy "events_insert_own" on public.events for insert with check (auth.uid() = user_id);
create policy "events_update_own" on public.events for update using (auth.uid() = user_id);
create policy "events_delete_own" on public.events for delete using (auth.uid() = user_id);

-- Memories table (knowledge base)
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('activities', 'countries')),
  title text not null,
  content jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.memories enable row level security;

create policy "memories_select_own" on public.memories for select using (auth.uid() = user_id);
create policy "memories_insert_own" on public.memories for insert with check (auth.uid() = user_id);
create policy "memories_update_own" on public.memories for update using (auth.uid() = user_id);
create policy "memories_delete_own" on public.memories for delete using (auth.uid() = user_id);

-- Preferences table (for API keys and user settings)
create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, key)
);

alter table public.preferences enable row level security;

create policy "preferences_select_own" on public.preferences for select using (auth.uid() = user_id);
create policy "preferences_insert_own" on public.preferences for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on public.preferences for update using (auth.uid() = user_id);
create policy "preferences_delete_own" on public.preferences for delete using (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
