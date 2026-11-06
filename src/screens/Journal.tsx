import { useState } from 'react'
import { useGame } from '../store'
import Icon from '../components/Icon'

export default function Journal() {
  const { journal, addNote, deleteNote } = useGame()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const save = () => {
    if (!title.trim() && !text.trim()) return
    addNote(title.trim() || 'Field note', text.trim())
    setTitle('')
    setText('')
  }
  return (
    <div className="page narrow">
      <header className="screen-head">
        <h1 className="screen-title">Research journal</h1>
        <p className="lede">Certifications and landing choices are logged here automatically. Add your own observations too.</p>
      </header>
      <div className="note-form cut">
        <label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Why Kamestastin rehearses the lunar highlands" /></label>
        <label>Note<textarea value={text} onChange={e => setText(e.target.value)} rows={4} /></label>
        <button className="btn primary cut" onClick={save}><Icon name="book" size={18} />Save note</button>
      </div>
      {journal.length === 0 && <p className="empty">No entries yet. Certify a site to write your first one.</p>}
      <ul className="journal">
        {journal.map(j => (
          <li key={j.id} className={j.auto ? 'auto' : 'own'}>
            <div className="j-meta">
              <span className="j-kind">{j.auto ? 'Mission log' : 'Field note'}</span>
              <time dateTime={j.date}>{new Date(j.date).toLocaleString()}</time>
            </div>
            <h2>{j.title}</h2>
            {j.text && <p>{j.text}</p>}
            {!j.auto && <button className="btn ghost cut small" data-sfx="remove" onClick={() => deleteNote(j.id)}>Delete</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
