import type { KeyboardEvent } from 'react'

/** Keep edge Tab presses in the modal instead of moving focus to browser chrome. */
export const containDialogFocus = (event: KeyboardEvent<HTMLElement>): void => {
  if (event.key !== 'Tab') return
  const dialog = event.currentTarget
  const items = [...dialog.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], summary, [tabindex]')]
    .filter((item) => item.tabIndex >= 0 && !item.matches(':disabled') && item.getClientRects().length > 0)
  const first = items[0]
  const last = items.at(-1)
  if (first === undefined || last === undefined) { event.preventDefault(); dialog.focus(); return }
  const active = dialog.ownerDocument.activeElement
  if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus() }
}
