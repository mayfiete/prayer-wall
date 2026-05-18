import type { Prayer } from '../../domain/entities/Prayer'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import type { PrayerMeditation } from '../../domain/entities/PrayerMeditation'

export const MOCK_ORG_ID = '00000000-0000-0000-0000-000000000001'
export const MOCK_WALL_ID = '00000000-0000-0000-0000-000000000002'

export const MOCK_CATEGORIES: PrayerCategory[] = [
  { id: 'cat-1', orgId: MOCK_ORG_ID, name: 'Family', displayOrder: 1, isActive: true },
  { id: 'cat-2', orgId: MOCK_ORG_ID, name: 'Health', displayOrder: 2, isActive: true },
  { id: 'cat-3', orgId: MOCK_ORG_ID, name: 'Finances', displayOrder: 3, isActive: true },
  { id: 'cat-4', orgId: MOCK_ORG_ID, name: 'Relationships', displayOrder: 4, isActive: true },
  { id: 'cat-5', orgId: MOCK_ORG_ID, name: 'Work & Career', displayOrder: 5, isActive: true },
  { id: 'cat-6', orgId: MOCK_ORG_ID, name: 'Spiritual Growth', displayOrder: 6, isActive: true },
  { id: 'cat-7', orgId: MOCK_ORG_ID, name: 'Community', displayOrder: 7, isActive: true },
  { id: 'cat-8', orgId: MOCK_ORG_ID, name: 'Mission & Outreach', displayOrder: 8, isActive: true },
]

const NAMES = [
  'James T.', 'Mary K.', 'Robert S.', 'Patricia L.', 'John M.', 'Jennifer A.',
  'Michael B.', 'Linda C.', 'William D.', 'Barbara E.', 'David F.', 'Susan G.',
  'Richard H.', 'Jessica I.', 'Joseph J.', 'Sarah K.', 'Thomas L.', 'Karen M.',
  'Charles N.', 'Lisa O.', 'Christopher P.', 'Nancy Q.', 'Daniel R.', 'Betty S.',
  'Matthew T.', 'Margaret U.', 'Anthony V.', 'Sandra W.', 'Mark X.', 'Ashley Y.',
  'Donald Z.', 'Dorothy A.', 'Steven B.', 'Kimberly C.', 'Paul D.', 'Emily E.',
  'Andrew F.', 'Donna G.', 'Joshua H.', 'Michelle I.', 'Kenneth J.', 'Carol K.',
  'Kevin L.', 'Amanda M.', 'Brian N.', 'Melissa O.', 'George P.', 'Deborah Q.',
  'Timothy R.', 'Stephanie S.', 'Ronald T.', 'Rebecca U.', 'Edward V.', 'Sharon W.',
  'Jason X.', 'Laura Y.', 'Jeffrey Z.', 'Cynthia A.', 'Ryan B.', 'Kathleen C.',
]

function makeDate(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d
}

export const MOCK_PRAYERS: Prayer[] = NAMES.slice(0, 48).map((name, i) => ({
  id: `mock-prayer-${i + 1}`,
  wallId: MOCK_WALL_ID,
  name,
  committedAt: makeDate(Math.floor(Math.random() * 30)),
  reminderActive: true,
  lastRemindedAt: i % 3 === 0 ? makeDate(7) : null,
}))

export const MOCK_MEDITATIONS: PrayerMeditation[] = [
  {
    id: 'med-1',
    categoryId: 'cat-1',
    orgId: MOCK_ORG_ID,
    body: '2 Corinthians 5:15 — "He died for all, that those who live might no longer live for themselves." Lord, bless every family represented on this wall and draw them closer to You.',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'med-2',
    categoryId: 'cat-1',
    orgId: MOCK_ORG_ID,
    body: 'Deuteronomy 6:6-7 — "These commandments are to be on your hearts. Impress them on your children." Father, strengthen parents to lead their homes in faith and wisdom.',
    displayOrder: 2,
    isActive: true,
    createdAt: new Date('2024-01-02'),
  },
  {
    id: 'med-3',
    categoryId: 'cat-2',
    orgId: MOCK_ORG_ID,
    body: 'James 5:14-15 — "Is anyone among you sick? Let them call the elders of the church to pray over them." Father, we lift up every need for physical and emotional healing.',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2024-01-03'),
  },
  {
    id: 'med-4',
    categoryId: 'cat-2',
    orgId: MOCK_ORG_ID,
    body: 'Psalm 103:2-3 — "Praise the Lord, O my soul, and forget not all his benefits — who forgives all your sins and heals all your diseases." We trust You for complete restoration.',
    displayOrder: 2,
    isActive: false,
    createdAt: new Date('2024-01-04'),
  },
  {
    id: 'med-5',
    categoryId: 'cat-3',
    orgId: MOCK_ORG_ID,
    body: 'Philippians 4:19 — "And my God will meet all your needs according to the riches of his glory in Christ Jesus." Lord, provide for every financial need represented here.',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2024-01-05'),
  },
  {
    id: 'med-6',
    categoryId: 'cat-6',
    orgId: MOCK_ORG_ID,
    body: 'Colossians 2:6-7 — "So then, just as you received Christ Jesus as Lord, continue to live your lives in him, rooted and built up in him." Deepen our roots in You, Lord.',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2024-01-06'),
  },
]

export const LIVE_NAMES = [
  'Grace H.', 'Ethan W.', 'Olivia R.', 'Noah P.', 'Ava J.', 'Liam C.',
  'Emma D.', 'Mason F.', 'Sophia B.', 'Logan T.', 'Isabella N.', 'Lucas M.',
  'Mia V.', 'Elijah K.', 'Charlotte S.', 'Aiden Q.',
]
