import type { Prayer } from '../../domain/entities/Prayer'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'

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

export const LIVE_NAMES = [
  'Grace H.', 'Ethan W.', 'Olivia R.', 'Noah P.', 'Ava J.', 'Liam C.',
  'Emma D.', 'Mason F.', 'Sophia B.', 'Logan T.', 'Isabella N.', 'Lucas M.',
  'Mia V.', 'Elijah K.', 'Charlotte S.', 'Aiden Q.',
]
