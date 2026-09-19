import { useEffect, type RefObject } from 'react'

/**
 * Open menu on mobile:
 * - Swipe right from the left edge, or
 * - Swipe left anywhere on the page (finger moves left).
 */
export function useSwipeOpenMenu(target: RefObject<HTMLElement | null>, onOpen: () => void) {
  useEffect(() => {
    const el = target.current
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      tracking = true
      startX = t.clientX
      startY = t.clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dy > 100) return

      const fromLeftEdge = startX < 56 && dx > 64
      const swipeLeft = dx < -72
      if (fromLeftEdge || swipeLeft) onOpen()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [target, onOpen])
}
