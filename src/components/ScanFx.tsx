import { useEffect, useState } from 'react'
import Icon from './Icon'
import Counter from './Counter'

/** The scanning sequence: a sweeping scope and a log of the datasets being read for this mission. */
export function Scanner({ siteName, lines }: { siteName: string; lines: { label: string; source: string }[] }) {
  return (
    <div className="scanner" role="status" aria-live="polite">
      <div className="scope" aria-hidden="true">
        <span className="scope-ring" /><span className="scope-ring r2" /><span className="scope-ring r3" />
        <span className="scope-sweep" />
        <span className="scope-blip" />
      </div>
      <p className="scan-title">Scanning {siteName}</p>
      <ol className="scan-log">
        {lines.map((l, i) => (
          <li key={l.label} style={{ animationDelay: `${120 + i * 260}ms` }}>
            <span className="scan-factor">{l.label}</span>
            <span className="scan-src">{l.source}</span>
            <Icon name="check" size={14} className="scan-ok" />
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 270° gauge for the Analog Similarity Index, with a notch at the pass mark. */
export function AsiGauge({ asi, pass }: { asi: number; pass: number }) {
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFill(asi))
    return () => cancelAnimationFrame(raf)
  }, [asi])
  const r = 52
  const c = 2 * Math.PI * r
  const arc = 0.75
  const ok = asi >= pass
  const notch = ((135 + 270 * (pass / 100)) * Math.PI) / 180
  return (
    <div className={`gauge ${ok ? 'pass' : 'fail'}`}>
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle className="gauge-track" cx="66" cy="66" r={r} strokeDasharray={`${c * arc} ${c}`} transform="rotate(135 66 66)" />
        <circle className="gauge-fill" cx="66" cy="66" r={r} strokeDasharray={`${c * arc * (fill / 100)} ${c}`} transform="rotate(135 66 66)" />
        <line className="gauge-notch" x1={66 + Math.cos(notch) * 44} y1={66 + Math.sin(notch) * 44} x2={66 + Math.cos(notch) * 61} y2={66 + Math.sin(notch) * 61} />
      </svg>
      <div className="gauge-read">
        <Counter from={0} value={asi} duration={900} className="gauge-num" />
        <span className="gauge-unit">ASI</span>
      </div>
    </div>
  )
}
