import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { sfx } from '../lib/sfx'

interface Props {
  open: boolean
  onClose: () => void
  labelledBy: string
  className?: string
  children: ReactNode
}

/**
 * In-game dialog: dims the scene, moves focus to the element marked data-autofocus
 * (or the first button), keeps Tab inside, closes on Escape and gives focus back.
 */
export default function Modal({ open, onClose, labelledBy, className, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const el = box.current
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('button')
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); sfx('back'); closeRef.current() }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select')]
        if (!items.length) return
        const a = items[0], z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.({ preventScroll: true }) }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="overlay-dim" onClick={onClose} />
      <div ref={box} className={`overlay-box ${className ?? ''}`}>{children}</div>
    </div>,
    document.body,
  )
}

/** A yes/no question styled like the rest of the game, used instead of window.confirm. */
export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-title" className="confirm cut">
      <h2 id="confirm-title" className="confirm-title">{title}</h2>
      <p>{body}</p>
      <div className="dialog-actions">
        <button className="btn ghost cut" data-sfx="back" data-autofocus onClick={onCancel}>Cancel</button>
        <button className={`btn cut ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
