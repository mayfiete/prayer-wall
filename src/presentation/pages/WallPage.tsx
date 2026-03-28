import { Link } from 'react-router-dom'
import { PrayerWallGrid } from '../components/PrayerWallGrid'
import { MockBanner } from '../components/MockBanner'
import { Share2, AlignLeft, BookOpen } from 'lucide-react'
import { TileModeToggle } from '../components/TileModeToggle'

const CHURCH_ID = import.meta.env.VITE_CHURCH_ID as string
const CHURCH_NAME = (import.meta.env.VITE_CHURCH_NAME as string | undefined) ?? 'Heritage Christian Academy'

function LogoMark() {
  return (
    <div className="w-[60px] h-[60px] rounded-full bg-[#6b2737] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 40 40" width="38" height="38" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <polygon points="20,4 36,34 4,34" stroke="#fff" strokeWidth="2" fill="none" />
        <polygon points="20,10 30,28 10,28" fill="rgba(255,255,255,0.35)" />
      </svg>
    </div>
  )
}

export function WallPage() {
  return (
    <div className="min-h-screen flex flex-col bg-parchment-100 font-body">
      <MockBanner />

      {/* Breadcrumb */}
      <nav className="px-6 py-2.5 text-[13px] text-[#7a6a5a] border-b border-parchment-300 bg-white">
        <Link to="/" className="hover:underline text-[#7a6a5a]">
          ← Back to {CHURCH_NAME}
        </Link>
        {' / '}
        <strong>Prayer Wall</strong>
      </nav>

      {/* Page header */}
      <header className="flex items-center gap-4 px-8 py-6 bg-white border-b border-[#e8e0d6]">
        <LogoMark />
        <div>
          <h1 className="font-serif text-[28px] text-[#1a1a1a] leading-tight">Prayer Wall</h1>
          <p className="text-sm text-[#888] mt-0.5">{CHURCH_NAME}</p>
        </div>
      </header>

      {/* Intro */}
      <section className="px-8 py-5 bg-white">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1a1a1a]">
            <AlignLeft size={16} />
            Pray Today
          </div>
          <TileModeToggle />
        </div>
        <p className="text-[13.5px] text-[#555] leading-relaxed">
          To get started, select a prayer stone from the wall below. Be a part of the growing
          family as we build a Prayer Wall together.
        </p>
      </section>

      {/* Grid */}
      <section className="px-8 pb-8 bg-white">
        <PrayerWallGrid churchId={CHURCH_ID} />
      </section>

      <hr className="border-none border-t border-[#e8e0d6] mx-8" />

      {/* Overview */}
      <section className="px-8 py-5 bg-white">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1a1a1a] mb-1.5">
          <BookOpen size={16} />
          Overview
        </div>
        <p className="text-[13.5px] text-[#555] leading-relaxed">
          We are committed to teaching the next generation to love God, love people, and love
          learning through classical Christian education that cultivates virtue, celebrates Biblical
          values, and equips students with wisdom to engage with the culture.
        </p>
      </section>

      <hr className="border-none border-t border-[#e8e0d6] mx-8" />

      {/* Share */}
      <section className="px-8 py-5 pb-10 bg-white">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1a1a1a] mb-1.5">
          <Share2 size={16} />
          Prayer Wall Link
        </div>
        <p className="text-[13.5px] text-[#555] leading-relaxed">
          Know someone who would also love {CHURCH_NAME}? Send them this link so they too can
          join in prayer.
        </p>
        <Link
          to="/commit"
          className="inline-block mt-3 px-4 py-2 bg-[#6b2737] text-white text-sm font-medium rounded hover:bg-[#7d2d40] transition-colors"
        >
          Add your name to the wall
        </Link>
      </section>
    </div>
  )
}
