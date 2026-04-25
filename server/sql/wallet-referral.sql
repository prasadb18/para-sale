-- ── Referral code on profiles ──────────────────────────────────────────
alter table profiles add column if not exists referral_code text unique;

-- ── Wallet ──────────────────────────────────────────────────────────────
create table if not exists user_wallets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz   not null default now()
);

alter table user_wallets enable row level security;

create policy "users manage own wallet"
  on user_wallets for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Wallet transactions ─────────────────────────────────────────────────
create table if not exists wallet_transactions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  amount      numeric(12,2) not null,
  type        text        not null check (type in ('credit', 'debit')),
  description text        not null,
  ref_id      text,
  created_at  timestamptz not null default now()
);

alter table wallet_transactions enable row level security;

create policy "users see own transactions"
  on wallet_transactions for all
  using (auth.uid() = user_id);

create index if not exists idx_wallet_txn_user on wallet_transactions (user_id, created_at desc);

-- ── claim_referral RPC ──────────────────────────────────────────────────
-- Credits both referrer (₹50) and referee (₹50) once per code per user.
create or replace function claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_referrer_id uuid;
  v_already     boolean;
begin
  select id into v_referrer_id
    from profiles
   where upper(referral_code) = upper(p_code)
   limit 1;

  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid referral code');
  end if;

  if v_referrer_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Cannot use your own referral code');
  end if;

  select exists(
    select 1 from wallet_transactions
     where user_id = auth.uid()
       and ref_id  = upper(p_code)
       and type    = 'credit'
  ) into v_already;

  if v_already then
    return jsonb_build_object('ok', false, 'error', 'Referral already claimed');
  end if;

  -- Credit referee (current user)
  insert into user_wallets(user_id, balance)
    values (auth.uid(), 50)
    on conflict (user_id)
    do update set balance = user_wallets.balance + 50, updated_at = now();

  insert into wallet_transactions(user_id, amount, type, description, ref_id)
    values (auth.uid(), 50, 'credit', 'Referral bonus — joined via code ' || upper(p_code), upper(p_code));

  -- Credit referrer
  insert into user_wallets(user_id, balance)
    values (v_referrer_id, 50)
    on conflict (user_id)
    do update set balance = user_wallets.balance + 50, updated_at = now();

  insert into wallet_transactions(user_id, amount, type, description, ref_id)
    values (v_referrer_id, 50, 'credit', 'Referral bonus — a friend joined using your code', upper(p_code));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function claim_referral(text) to authenticated;

-- ── debit_wallet RPC ────────────────────────────────────────────────────
-- Safely deducts wallet balance (fails if insufficient funds).
create or replace function debit_wallet(p_amount numeric, p_description text, p_ref_id text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance numeric;
begin
  select balance into v_balance from user_wallets where user_id = auth.uid() for update;

  if v_balance is null or v_balance < p_amount then
    return jsonb_build_object('ok', false, 'error', 'Insufficient wallet balance');
  end if;

  update user_wallets
     set balance = balance - p_amount, updated_at = now()
   where user_id = auth.uid();

  insert into wallet_transactions(user_id, amount, type, description, ref_id)
    values (auth.uid(), p_amount, 'debit', p_description, p_ref_id);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function debit_wallet(numeric, text, text) to authenticated;
