-- ─── 130: driver_messaging ────────────────────────────────────────────────────
--
-- Minimal scoped messaging between a driver and their company's dispatchers.
-- Conversations are optionally linked to a job.
-- RLS restricts each driver to conversations where they are a participant.
-- Dispatchers (admin/owner within the same company) can see all company convos.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists driver_conversations (
  id             uuid        primary key default gen_random_uuid(),
  company_id     uuid        not null references companies(id)  on delete cascade,
  driver_id      uuid        not null references drivers(id)    on delete cascade,
  job_id         uuid                    references jobs(id)    on delete set null,
  subject        text,
  created_at     timestamptz not null    default now(),
  updated_at     timestamptz not null    default now()
);

create index if not exists driver_conversations_driver_id_idx
  on driver_conversations(driver_id);

create index if not exists driver_conversations_company_id_idx
  on driver_conversations(company_id);

create table if not exists driver_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references driver_conversations(id) on delete cascade,
  sender_user_id  uuid        not null references auth.users(id)           on delete cascade,
  body            text        not null check (char_length(trim(body)) between 1 and 5000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists driver_messages_conversation_id_idx
  on driver_messages(conversation_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table driver_conversations enable row level security;
alter table driver_messages       enable row level security;

-- driver_conversations: driver sees only their own rows
create policy "driver_conversations_driver_select"
  on driver_conversations for select
  using (
    driver_id in (
      select id from drivers where user_id = auth.uid()
    )
  );

-- driver_conversations: company admins/owners see all conversations in their company
create policy "driver_conversations_company_select"
  on driver_conversations for select
  using (
    company_id in (
      select company_id
      from   profiles
      where  user_id = auth.uid()
      and    role    in ('admin', 'owner', 'dispatcher')
    )
  );

-- Only server-side (service-role) can insert conversations
-- (drivers send messages through the API which uses service role)

-- driver_messages: driver can see messages in their conversations
create policy "driver_messages_driver_select"
  on driver_messages for select
  using (
    conversation_id in (
      select dc.id
      from   driver_conversations dc
      join   drivers d on d.id = dc.driver_id
      where  d.user_id = auth.uid()
    )
  );

-- company staff can see messages in company conversations
create policy "driver_messages_company_select"
  on driver_messages for select
  using (
    conversation_id in (
      select dc.id
      from   driver_conversations dc
      join   profiles p on p.company_id = dc.company_id
      where  p.user_id = auth.uid()
      and    p.role    in ('admin', 'owner', 'dispatcher')
    )
  );
