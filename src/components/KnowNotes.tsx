import type { Note } from '../data/knowledge'
import { sourceById } from '../data/sources'

/** One astronomy or engineering note: what, why, the sum behind it and where the numbers come from. */
export function KnowNote({ note }: { note: Note }) {
  const src = sourceById(note.sourceId)
  return (
    <div className={`know-note k-${note.kind}`}>
      <strong>{note.title}</strong>
      <p>{note.text}</p>
      {note.math && <p className="know-math"><span>The sum</span>{note.math}</p>}
      {src && <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>}
    </div>
  )
}

/** A folded list of notes, for places where space is tight */
export default function KnowNotes({ label, notes, open }: { label: string; notes: Note[]; open?: boolean }) {
  if (!notes.length) return null
  return (
    <details className="know" open={open}>
      <summary>{label}</summary>
      <div className="know-list">{notes.map(n => <KnowNote key={n.id} note={n} />)}</div>
    </details>
  )
}
