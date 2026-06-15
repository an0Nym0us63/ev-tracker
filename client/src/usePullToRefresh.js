import { useEffect, useRef, useState } from 'react'

export function usePullToRefresh(onRefresh, threshold = 70) {
  const [pulling, setPulling] = useState(false)
  const [progress, setProgress] = useState(0)
  const startY = useRef(null)
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)

  useEffect(() => {
    if (!isMobile) return

    function onTouchStart(e) {
      if (window.scrollY === 0) startY.current = e.touches[0].clientY
    }
    function onTouchMove(e) {
      if (startY.current == null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && window.scrollY === 0) {
        setPulling(true)
        setProgress(Math.min(dy / threshold, 1))
      }
    }
    function onTouchEnd() {
      if (progress >= 1) onRefresh()
      setPulling(false)
      setProgress(0)
      startY.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive:true })
    document.addEventListener('touchmove',  onTouchMove,  { passive:true })
    document.addEventListener('touchend',   onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [progress, onRefresh, threshold])

  return { pulling, progress }
}
