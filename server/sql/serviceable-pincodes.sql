create table if not exists serviceable_pincodes (
  pincode       char(6)     primary key,
  city          text        not null,
  state         text        not null,
  delivery_days smallint    not null default 1
);

-- RLS: public read-only (no auth needed for delivery check)
alter table serviceable_pincodes enable row level security;

create policy "public read serviceable pincodes"
  on serviceable_pincodes for select
  using (true);

-- Mumbai South & Central
insert into serviceable_pincodes (pincode, city, state, delivery_days) values
  ('400001', 'Mumbai (Fort)',           'Maharashtra', 1),
  ('400002', 'Mumbai (Mandvi)',         'Maharashtra', 1),
  ('400003', 'Mumbai (Masjid Bunder)', 'Maharashtra', 1),
  ('400004', 'Mumbai (Girgaon)',        'Maharashtra', 1),
  ('400005', 'Mumbai (Colaba)',         'Maharashtra', 1),
  ('400008', 'Mumbai (Mumbai Central)','Maharashtra', 1),
  ('400011', 'Mumbai (Parel)',          'Maharashtra', 1),
  ('400012', 'Mumbai (Dadar)',          'Maharashtra', 1),
  ('400016', 'Mumbai (Mahim)',          'Maharashtra', 1),
  ('400018', 'Mumbai (Worli)',          'Maharashtra', 1),
  ('400022', 'Mumbai (Sion)',           'Maharashtra', 1),
  ('400024', 'Mumbai (Wadala)',         'Maharashtra', 1),
  ('400025', 'Mumbai (Prabhadevi)',     'Maharashtra', 1),

-- Mumbai Western Suburbs
  ('400051', 'Mumbai (Bandra West)',    'Maharashtra', 1),
  ('400052', 'Mumbai (Bandra East)',    'Maharashtra', 1),
  ('400053', 'Mumbai (Santacruz West)','Maharashtra', 1),
  ('400054', 'Mumbai (Santacruz East)','Maharashtra', 1),
  ('400055', 'Mumbai (Juhu)',           'Maharashtra', 1),
  ('400056', 'Mumbai (Vile Parle)',     'Maharashtra', 1),
  ('400057', 'Mumbai (Andheri West)',   'Maharashtra', 1),
  ('400058', 'Mumbai (Andheri East)',   'Maharashtra', 1),
  ('400059', 'Mumbai (Goregaon West)', 'Maharashtra', 1),
  ('400060', 'Mumbai (Malad West)',     'Maharashtra', 1),
  ('400061', 'Mumbai (Kandivali West)','Maharashtra', 1),
  ('400062', 'Mumbai (Kandivali East)','Maharashtra', 1),
  ('400063', 'Mumbai (Dahisar East)',   'Maharashtra', 1),
  ('400064', 'Mumbai (Borivali West)', 'Maharashtra', 1),
  ('400066', 'Mumbai (Borivali East)', 'Maharashtra', 1),
  ('400068', 'Mumbai (Goregaon East)', 'Maharashtra', 1),
  ('400069', 'Mumbai (Malad East)',     'Maharashtra', 1),

-- Mumbai Eastern Suburbs
  ('400070', 'Mumbai (Chembur)',        'Maharashtra', 1),
  ('400071', 'Mumbai (Mankhurd)',       'Maharashtra', 1),
  ('400074', 'Mumbai (Govandi)',        'Maharashtra', 1),
  ('400075', 'Mumbai (Kurla West)',     'Maharashtra', 1),
  ('400076', 'Mumbai (Kurla East)',     'Maharashtra', 1),
  ('400079', 'Mumbai (Powai)',          'Maharashtra', 1),
  ('400080', 'Mumbai (Ghatkopar West)','Maharashtra', 1),
  ('400081', 'Mumbai (Ghatkopar East)','Maharashtra', 1),
  ('400082', 'Mumbai (Vikhroli)',       'Maharashtra', 1),
  ('400083', 'Mumbai (Kanjurmarg)',     'Maharashtra', 1),
  ('400085', 'Mumbai (Mulund West)',    'Maharashtra', 1),
  ('400086', 'Mumbai (Mulund East)',    'Maharashtra', 1),

-- Thane
  ('400601', 'Thane (West)',            'Maharashtra', 1),
  ('400602', 'Thane (East)',            'Maharashtra', 1),
  ('400603', 'Thane (Naupada)',         'Maharashtra', 1),
  ('400604', 'Thane (Uthalsar)',        'Maharashtra', 1),
  ('400605', 'Thane (Wagle Estate)',    'Maharashtra', 1),
  ('400606', 'Thane (Majiwada)',        'Maharashtra', 1),
  ('400607', 'Thane (Kopri)',           'Maharashtra', 1),
  ('400608', 'Thane (Manpada)',         'Maharashtra', 1),
  ('400610', 'Thane (Pokhran)',         'Maharashtra', 1),
  ('400612', 'Thane (Diva)',            'Maharashtra', 1),
  ('400614', 'Thane (Kalwa / Mumbra)', 'Maharashtra', 1),
  ('400615', 'Thane (Mumbra)',          'Maharashtra', 1),

-- Navi Mumbai
  ('400703', 'Navi Mumbai (CBD Belapur)','Maharashtra', 1),
  ('400705', 'Navi Mumbai (Airoli)',    'Maharashtra', 1),
  ('400706', 'Navi Mumbai (Ghansoli)', 'Maharashtra', 1),
  ('400707', 'Navi Mumbai (Kopar Khairne)','Maharashtra', 1),
  ('400708', 'Navi Mumbai (Turbhe)',   'Maharashtra', 1),
  ('400709', 'Navi Mumbai (Vashi)',    'Maharashtra', 1),
  ('400710', 'Navi Mumbai (Sanpada)', 'Maharashtra', 1),

-- Kalyan
  ('421301', 'Kalyan (West)',           'Maharashtra', 1),
  ('421302', 'Kalyan (East)',           'Maharashtra', 1),
  ('421303', 'Kalyan',                  'Maharashtra', 1),
  ('421304', 'Kalyan (Titwala)',        'Maharashtra', 1),
  ('421306', 'Ulhasnagar',              'Maharashtra', 1),

-- Dombivli
  ('421201', 'Dombivli (West)',         'Maharashtra', 1),
  ('421202', 'Dombivli (East)',         'Maharashtra', 1),
  ('421203', 'Thakurli',                'Maharashtra', 1),
  ('421204', 'Dombivli',                'Maharashtra', 1),

-- Nearby areas
  ('421101', 'Ambernath',               'Maharashtra', 1),
  ('421102', 'Ambernath (East)',        'Maharashtra', 1),
  ('421103', 'Badlapur',                'Maharashtra', 1),
  ('421501', 'Bhiwandi',                'Maharashtra', 1)

on conflict (pincode) do nothing;
