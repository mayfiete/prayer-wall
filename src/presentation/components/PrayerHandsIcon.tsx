interface Props {
  className?: string
}

export function PrayerHandsIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Praying hands — open stone"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Open prayer stone</title>
      {/* Left hand */}
      <path
        d="
          M50 16 C48 16,46 17,45 19 L43 26
          Q42 22,41 18 C40.5 15,39 14.5,38.5 16 Q39 19,40 24
          L39 22 Q38 18,37 15.5 C36.5 13.5,35 13.5,35 15.5 Q35.5 18,37 24
          L36 21 Q35 17.5,34 15.5 C33.5 14,32 14.2,32.2 16 Q33 19,34.5 24
          L33.5 22 Q33 19.5,32.5 18 C32 16.5,31 17,31 18.5 Q31.5 21,33 26
          L35 34 Q36 37,35.5 40 L34 44 Q32 48,33 52
          L36 58 Q38 62,42 66 L46 72 Q48 74,50 76
          L50 19 Q50 17,50 16 Z
        "
        fill="#2a2620"
        fillOpacity=".3"
        stroke="#2a2620"
        strokeOpacity=".4"
        strokeWidth=".7"
      />
      {/* Right hand (mirror) */}
      <path
        d="
          M50 16 C52 16,54 17,55 19 L57 26
          Q58 22,59 18 C59.5 15,61 14.5,61.5 16 Q61 19,60 24
          L61 22 Q62 18,63 15.5 C63.5 13.5,65 13.5,65 15.5 Q64.5 18,63 24
          L64 21 Q65 17.5,66 15.5 C66.5 14,68 14.2,67.8 16 Q67 19,65.5 24
          L66.5 22 Q67 19.5,67.5 18 C68 16.5,69 17,69 18.5 Q68.5 21,67 26
          L65 34 Q64 37,64.5 40 L66 44 Q68 48,67 52
          L64 58 Q62 62,58 66 L54 72 Q52 74,50 76
          L50 19 Q50 17,50 16 Z
        "
        fill="#2a2620"
        fillOpacity=".3"
        stroke="#2a2620"
        strokeOpacity=".4"
        strokeWidth=".7"
      />
      {/* Center seam */}
      <line
        x1="50" y1="18" x2="50" y2="74"
        stroke="#2a2620"
        strokeOpacity=".15"
        strokeWidth=".5"
      />
      {/* Cuff */}
      <path
        d="M36 58 Q43 62,50 60 Q57 62,64 58"
        fill="none"
        stroke="#2a2620"
        strokeOpacity=".2"
        strokeWidth=".5"
      />
    </svg>
  )
}
