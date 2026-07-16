-- ============================================================
-- 014_bible_search.sql
-- Prayer passage index for keyword-to-prayer Bible lookup.
-- Tables: prayer_themes, prayer_passages, prayer_passage_themes,
--         prayer_keywords, bible_api_cache
-- Seed:   7 themes, ~60 keyword mappings, ~45 passages
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prayer_wall.prayer_themes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  parent_id    UUID REFERENCES prayer_wall.prayer_themes(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prayer_wall.prayer_passages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT NOT NULL UNIQUE,
  book_usfm        TEXT NOT NULL,
  chapter_start    SMALLINT NOT NULL,
  verse_start      SMALLINT NOT NULL,
  chapter_end      SMALLINT NOT NULL,
  verse_end        SMALLINT NOT NULL,
  canonical_weight NUMERIC(5,2) DEFAULT 1.0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prayer_wall.prayer_passage_themes (
  passage_id       UUID NOT NULL REFERENCES prayer_wall.prayer_passages(id) ON DELETE CASCADE,
  theme_id         UUID NOT NULL REFERENCES prayer_wall.prayer_themes(id) ON DELETE CASCADE,
  relevance_weight NUMERIC(5,2) DEFAULT 1.0,
  PRIMARY KEY (passage_id, theme_id)
);

CREATE TABLE IF NOT EXISTS prayer_wall.prayer_keywords (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword            TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  theme_id           UUID REFERENCES prayer_wall.prayer_themes(id) ON DELETE CASCADE,
  weight             NUMERIC(5,2) DEFAULT 1.0,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (normalized_keyword, theme_id)
);

-- Short-lived cache for Bible API responses.
-- Do NOT cache NIV text permanently — use short expires_at TTLs.
CREATE TABLE IF NOT EXISTS prayer_wall.bible_api_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,
  bible_id      TEXT NOT NULL,
  reference     TEXT NOT NULL,
  response_json JSONB NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, bible_id, reference)
);

CREATE INDEX IF NOT EXISTS ix_bible_api_cache_expires
  ON prayer_wall.bible_api_cache(expires_at);

-- ── Seed: Themes ─────────────────────────────────────────────

INSERT INTO prayer_wall.prayer_themes (slug, display_name, description) VALUES
  ('anxiety',     'Anxiety',     'Prayer and Scripture for worry, fear, and anxious thoughts'),
  ('healing',     'Healing',     'Prayer and Scripture for physical, emotional, and spiritual healing'),
  ('forgiveness', 'Forgiveness', 'Prayer and Scripture for confession, repentance, and mercy'),
  ('gratitude',   'Gratitude',   'Prayer and Scripture for thanksgiving and praise'),
  ('guidance',    'Guidance',    'Prayer and Scripture for wisdom, decisions, and direction'),
  ('grief',       'Grief',       'Prayer and Scripture for mourning, loss, and comfort'),
  ('protection',  'Protection',  'Prayer and Scripture for safety, refuge, and deliverance'),
  ('strength',    'Strength',    'Prayer and Scripture for endurance, courage, and perseverance'),
  ('peace',       'Peace',       'Prayer and Scripture for rest, calm, and reconciliation'),
  ('faith',       'Faith',       'Prayer and Scripture for trust, belief, and confidence in God')
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: Passages ───────────────────────────────────────────

INSERT INTO prayer_wall.prayer_passages
  (reference, book_usfm, chapter_start, verse_start, chapter_end, verse_end, canonical_weight)
VALUES
  -- Anxiety / Peace
  ('Philippians 4:6-7',    'PHP', 4,  6,  4,  7,  1.00),
  ('Matthew 6:25-34',      'MAT', 6,  25, 6,  34, 0.95),
  ('1 Peter 5:7',          '1PE', 5,  7,  5,  7,  0.90),
  ('Isaiah 41:10',         'ISA', 41, 10, 41, 10, 0.95),
  ('John 14:27',           'JHN', 14, 27, 14, 27, 0.90),
  ('Romans 8:28',          'ROM', 8,  28, 8,  28, 0.90),
  ('Psalm 46:1-3',         'PSA', 46, 1,  46, 3,  0.88),
  -- Healing
  ('James 5:14-15',        'JAS', 5,  14, 5,  15, 1.00),
  ('Jeremiah 17:14',       'JER', 17, 14, 17, 14, 0.95),
  ('Psalm 103:2-3',        'PSA', 103,2,  103,3,  0.90),
  ('Isaiah 53:5',          'ISA', 53, 5,  53, 5,  0.95),
  ('3 John 1:2',           '3JN', 1,  2,  1,  2,  0.85),
  -- Forgiveness
  ('1 John 1:9',           '1JN', 1,  9,  1,  9,  1.00),
  ('Psalm 51:1-2',         'PSA', 51, 1,  51, 2,  0.95),
  ('Matthew 6:14-15',      'MAT', 6,  14, 6,  15, 0.90),
  ('Ephesians 4:32',       'EPH', 4,  32, 4,  32, 0.88),
  ('Colossians 3:13',      'COL', 3,  13, 3,  13, 0.85),
  -- Gratitude
  ('1 Thessalonians 5:16-18','1TH',5, 16, 5,  18, 1.00),
  ('Psalm 100:1-5',        'PSA', 100,1,  100,5,  0.95),
  ('Colossians 3:15-17',   'COL', 3,  15, 3,  17, 0.90),
  ('Psalm 107:1',          'PSA', 107,1,  107,1,  0.85),
  ('Hebrews 13:15',        'HEB', 13, 15, 13, 15, 0.85),
  -- Guidance
  ('Proverbs 3:5-6',       'PRO', 3,  5,  3,  6,  1.00),
  ('James 1:5',            'JAS', 1,  5,  1,  5,  0.95),
  ('Psalm 25:4-5',         'PSA', 25, 4,  25, 5,  0.90),
  ('Isaiah 30:21',         'ISA', 30, 21, 30, 21, 0.88),
  ('Psalm 119:105',        'PSA', 119,105,119,105, 0.88),
  -- Grief
  ('Psalm 34:18',          'PSA', 34, 18, 34, 18, 1.00),
  ('Matthew 5:4',          'MAT', 5,  4,  5,  4,  0.95),
  ('Revelation 21:4',      'REV', 21, 4,  21, 4,  0.90),
  ('Romans 8:38-39',       'ROM', 8,  38, 8,  39, 0.88),
  ('2 Corinthians 1:3-4',  '2CO', 1,  3,  1,  4,  0.90),
  -- Protection
  ('Psalm 91:1-2',         'PSA', 91, 1,  91, 2,  1.00),
  ('2 Thessalonians 3:3',  '2TH', 3,  3,  3,  3,  0.90),
  ('Proverbs 18:10',       'PRO', 18, 10, 18, 10, 0.88),
  ('Psalm 23:4',           'PSA', 23, 4,  23, 4,  0.90),
  -- Strength
  ('Isaiah 40:31',         'ISA', 40, 31, 40, 31, 1.00),
  ('Philippians 4:13',     'PHP', 4,  13, 4,  13, 0.95),
  ('2 Corinthians 12:9',   '2CO', 12, 9,  12, 9,  0.90),
  ('Joshua 1:9',           'JOS', 1,  9,  1,  9,  0.90),
  ('Ephesians 6:10',       'EPH', 6,  10, 6,  10, 0.88),
  -- Faith
  ('Hebrews 11:1',         'HEB', 11, 1,  11, 1,  1.00),
  ('Romans 10:17',         'ROM', 10, 17, 10, 17, 0.90),
  ('Matthew 17:20',        'MAT', 17, 20, 17, 20, 0.88),
  ('Mark 9:23',            'MRK', 9,  23, 9,  23, 0.88)
ON CONFLICT (reference) DO NOTHING;

-- ── Seed: Passage–Theme links ────────────────────────────────

INSERT INTO prayer_wall.prayer_passage_themes (passage_id, theme_id, relevance_weight)
SELECT p.id, t.id, w.relevance_weight
FROM (VALUES
  -- Anxiety
  ('Philippians 4:6-7',   'anxiety',     1.00),
  ('Philippians 4:6-7',   'peace',       0.90),
  ('Matthew 6:25-34',     'anxiety',     0.95),
  ('1 Peter 5:7',         'anxiety',     0.90),
  ('Isaiah 41:10',        'anxiety',     0.88),
  ('Isaiah 41:10',        'strength',    0.80),
  ('John 14:27',          'peace',       1.00),
  ('John 14:27',          'anxiety',     0.85),
  ('Romans 8:28',         'anxiety',     0.80),
  ('Psalm 46:1-3',        'anxiety',     0.85),
  ('Psalm 46:1-3',        'protection',  0.80),
  -- Healing
  ('James 5:14-15',       'healing',     1.00),
  ('Jeremiah 17:14',      'healing',     0.95),
  ('Psalm 103:2-3',       'healing',     0.90),
  ('Psalm 103:2-3',       'gratitude',   0.75),
  ('Isaiah 53:5',         'healing',     0.95),
  ('3 John 1:2',          'healing',     0.85),
  -- Forgiveness
  ('1 John 1:9',          'forgiveness', 1.00),
  ('Psalm 51:1-2',        'forgiveness', 0.95),
  ('Matthew 6:14-15',     'forgiveness', 0.90),
  ('Ephesians 4:32',      'forgiveness', 0.88),
  ('Colossians 3:13',     'forgiveness', 0.85),
  -- Gratitude
  ('1 Thessalonians 5:16-18','gratitude',1.00),
  ('1 Thessalonians 5:16-18','peace',    0.75),
  ('Psalm 100:1-5',       'gratitude',   0.95),
  ('Colossians 3:15-17',  'gratitude',   0.90),
  ('Colossians 3:15-17',  'peace',       0.80),
  ('Psalm 107:1',         'gratitude',   0.88),
  ('Hebrews 13:15',       'gratitude',   0.85),
  -- Guidance
  ('Proverbs 3:5-6',      'guidance',    1.00),
  ('Proverbs 3:5-6',      'faith',       0.80),
  ('James 1:5',           'guidance',    0.95),
  ('Psalm 25:4-5',        'guidance',    0.90),
  ('Isaiah 30:21',        'guidance',    0.88),
  ('Psalm 119:105',       'guidance',    0.88),
  -- Grief
  ('Psalm 34:18',         'grief',       1.00),
  ('Matthew 5:4',         'grief',       0.95),
  ('Revelation 21:4',     'grief',       0.90),
  ('Romans 8:38-39',      'grief',       0.88),
  ('Romans 8:38-39',      'faith',       0.80),
  ('2 Corinthians 1:3-4', 'grief',       0.90),
  ('2 Corinthians 1:3-4', 'healing',     0.75),
  -- Protection
  ('Psalm 91:1-2',        'protection',  1.00),
  ('2 Thessalonians 3:3', 'protection',  0.90),
  ('Proverbs 18:10',      'protection',  0.88),
  ('Psalm 23:4',          'protection',  0.90),
  ('Psalm 23:4',          'grief',       0.75),
  -- Strength
  ('Isaiah 40:31',        'strength',    1.00),
  ('Philippians 4:13',    'strength',    0.95),
  ('2 Corinthians 12:9',  'strength',    0.90),
  ('Joshua 1:9',          'strength',    0.90),
  ('Joshua 1:9',          'guidance',    0.75),
  ('Ephesians 6:10',      'strength',    0.88),
  ('Ephesians 6:10',      'protection',  0.80),
  -- Faith
  ('Hebrews 11:1',        'faith',       1.00),
  ('Romans 10:17',        'faith',       0.90),
  ('Matthew 17:20',       'faith',       0.88),
  ('Mark 9:23',           'faith',       0.88)
) AS w(reference, slug, relevance_weight)
JOIN prayer_wall.prayer_passages p ON p.reference = w.reference
JOIN prayer_wall.prayer_themes   t ON t.slug      = w.slug
ON CONFLICT (passage_id, theme_id) DO NOTHING;

-- ── Seed: Keywords ───────────────────────────────────────────

INSERT INTO prayer_wall.prayer_keywords (keyword, normalized_keyword, theme_id, weight)
SELECT k.keyword, k.normalized_keyword, t.id, k.weight
FROM (VALUES
  -- anxiety
  ('anxiety',      'anxiety',      'anxiety',     1.00),
  ('anxious',      'anxious',      'anxiety',     0.95),
  ('worry',        'worry',        'anxiety',     0.90),
  ('worried',      'worried',      'anxiety',     0.90),
  ('stress',       'stress',       'anxiety',     0.85),
  ('stressed',     'stressed',     'anxiety',     0.85),
  ('overwhelmed',  'overwhelmed',  'anxiety',     0.85),
  ('fear',         'fear',         'anxiety',     0.80),
  ('afraid',       'afraid',       'anxiety',     0.80),
  ('panic',        'panic',        'anxiety',     0.80),
  -- healing
  ('healing',      'healing',      'healing',     1.00),
  ('sick',         'sick',         'healing',     0.95),
  ('sickness',     'sickness',     'healing',     0.95),
  ('illness',      'illness',      'healing',     0.90),
  ('disease',      'disease',      'healing',     0.90),
  ('cancer',       'cancer',       'healing',     0.90),
  ('recovery',     'recovery',     'healing',     0.85),
  ('health',       'health',       'healing',     0.80),
  ('pain',         'pain',         'healing',     0.85),
  -- forgiveness
  ('forgiveness',  'forgiveness',  'forgiveness', 1.00),
  ('forgive',      'forgive',      'forgiveness', 0.95),
  ('sin',          'sin',          'forgiveness', 0.90),
  ('repentance',   'repentance',   'forgiveness', 0.90),
  ('confession',   'confession',   'forgiveness', 0.90),
  ('guilt',        'guilt',        'forgiveness', 0.85),
  ('shame',        'shame',        'forgiveness', 0.85),
  ('mercy',        'mercy',        'forgiveness', 0.85),
  -- gratitude
  ('gratitude',    'gratitude',    'gratitude',   1.00),
  ('thankful',     'thankful',     'gratitude',   0.95),
  ('thanksgiving', 'thanksgiving', 'gratitude',   0.95),
  ('grateful',     'grateful',     'gratitude',   0.90),
  ('praise',       'praise',       'gratitude',   0.85),
  ('blessed',      'blessed',      'gratitude',   0.80),
  -- guidance
  ('guidance',     'guidance',     'guidance',    1.00),
  ('direction',    'direction',    'guidance',    0.95),
  ('wisdom',       'wisdom',       'guidance',    0.90),
  ('decision',     'decision',     'guidance',    0.90),
  ('decisions',    'decisions',    'guidance',    0.90),
  ('discernment',  'discernment',  'guidance',    0.90),
  ('confused',     'confused',     'guidance',    0.85),
  ('lost',         'lost',         'guidance',    0.80),
  -- grief
  ('grief',        'grief',        'grief',       1.00),
  ('loss',         'loss',         'grief',       0.95),
  ('death',        'death',        'grief',       0.90),
  ('mourning',     'mourning',     'grief',       0.90),
  ('sorrow',       'sorrow',       'grief',       0.90),
  ('sadness',      'sadness',      'grief',       0.85),
  ('sad',          'sad',          'grief',       0.80),
  ('depression',   'depression',   'grief',       0.80),
  -- protection
  ('protection',   'protection',   'protection',  1.00),
  ('safety',       'safety',       'protection',  0.95),
  ('safe',         'safe',         'protection',  0.90),
  ('danger',       'danger',       'protection',  0.90),
  ('refuge',       'refuge',       'protection',  0.90),
  ('deliverance',  'deliverance',  'protection',  0.88),
  ('enemy',        'enemy',        'protection',  0.80),
  -- strength
  ('strength',     'strength',     'strength',    1.00),
  ('strong',       'strong',       'strength',    0.90),
  ('tired',        'tired',        'strength',    0.85),
  ('weak',         'weak',         'strength',    0.85),
  ('weary',        'weary',        'strength',    0.90),
  ('endurance',    'endurance',    'strength',    0.88),
  ('courage',      'courage',      'strength',    0.88),
  ('perseverance', 'perseverance', 'strength',    0.85),
  -- peace
  ('peace',        'peace',        'peace',       1.00),
  ('calm',         'calm',         'peace',       0.90),
  ('rest',         'rest',         'peace',       0.88),
  ('conflict',     'conflict',     'peace',       0.85),
  ('reconciliation','reconciliation','peace',     0.88),
  ('troubled',     'troubled',     'peace',       0.85),
  -- faith
  ('faith',        'faith',        'faith',       1.00),
  ('trust',        'trust',        'faith',       0.90),
  ('doubt',        'doubt',        'faith',       0.88),
  ('believe',      'believe',      'faith',       0.90),
  ('belief',       'belief',       'faith',       0.88),
  ('hope',         'hope',         'faith',       0.85)
) AS k(keyword, normalized_keyword, slug, weight)
JOIN prayer_wall.prayer_themes t ON t.slug = k.slug
ON CONFLICT (normalized_keyword, theme_id) DO NOTHING;
