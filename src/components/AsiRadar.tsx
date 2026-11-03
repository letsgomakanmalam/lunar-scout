import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Legend } from 'recharts'
import type { ScanResult } from '../lib/scoring'
import { FACTOR_LABELS } from '../data/types'

/** Site (Earth blue) against the Moon target (regolith white) for each factor the mission weighs. */
export default function AsiRadar({ result }: { result: ScanResult }) {
  const data = result.factors.map(f => ({
    factor: FACTOR_LABELS[f.key],
    Site: Math.round(f.siteValue * 100),
    Moon: Math.round(f.targetValue * 100),
  }))
  if (data.length < 3) return null
  return (
    <div className="radar">
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="rgba(150,175,215,0.22)" />
          <PolarAngleAxis dataKey="factor" tick={{ fill: '#a3a6ad', fontSize: 12, fontFamily: 'Barlow Condensed, sans-serif' }} />
          <Radar name="Moon target" dataKey="Moon" stroke="#ebe6da" strokeDasharray="4 3" fill="#ebe6da" fillOpacity={0.08} />
          <Radar name="This site" dataKey="Site" stroke="#72b6ff" fill="#72b6ff" fillOpacity={0.3} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
