import { useEffect, useRef, useState, useCallback } from 'react'

export function usePullToRefresh(onRefresh, threshold = 80) {
  const [pulling, setPulling] = useState(false)
  const [progress, setProgress] = useState(0)
  const startY = useRef(null)
  const pulling_ = useRef(false)

  const refresh = useCallback(onRefresh, [])

  useEffect(() => {
    function onTouchStart(e) {
      // Only start PTR when at very top of page
      if (window.scrollY > 2) return
      startY.current = e.touches[0].clientY
      pulling_.current = false
    }

    function onTouchMove(e) {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        startY.current = null
        setPulling(false)
        setProgress(0)
        return
      }
      // Only engage if pulling down significantly
      if (dy > 10) {
        pulling_.current = true
        setPulling(true)
        setProgress(Math.min(dy / threshold, 1))
      }
    }

    function onTouchEnd() {
      if (pulling_.current && progress >= 1) {
        refresh()
      }
      startY.current = null
      pulling_.current = false
      setPulling(false)
      setProgress(0)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [refresh, threshold, progress])

  return { pulling, progress }
}
