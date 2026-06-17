import { useEffect, useRef, useState, useCallback } from 'react'

export function usePullToRefresh(onRefresh, threshold = 80) {
  const [pulling, setPulling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const pulling_ = useRef(false)
  const scrollEl = useRef(null)
  const progressRef = useRef(0)
  const refreshingRef = useRef(false)

  const refresh = useCallback(onRefresh, [onRefresh])

  useEffect(() => {
    function scrollTopOf(el) { return el ? el.scrollTop : 0 }

    function onTouchStart(e) {
      if (refreshingRef.current) return
      // The actual scroll container is the page's .page div, not the window
      // (the app shell is a fixed-height flex column — window never scrolls).
      const el = e.target.closest ? e.target.closest('.page') : null
      scrollEl.current = el
      if (scrollTopOf(el) > 2) { startY.current = null; return }
      startY.current = e.touches[0].clientY
      pulling_.current = false
    }

    function onTouchMove(e) {
      if (startY.current === null || refreshingRef.current) return
      if (scrollTopOf(scrollEl.current) > 2) {
        startY.current = null
        pulling_.current = false
        setPulling(false)
        setProgress(0)
        progressRef.current = 0
        return
      }
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        startY.current = null
        pulling_.current = false
        setPulling(false)
        setProgress(0)
        progressRef.current = 0
        return
      }
      if (dy > 10) {
        pulling_.current = true
        setPulling(true)
        const p = Math.min(dy / threshold, 1)
        progressRef.current = p
        setProgress(p)
      }
    }

    async function onTouchEnd() {
      if (pulling_.current && progressRef.current >= 1) {
        setPulling(false)
        setRefreshing(true)
        refreshingRef.current = true
        try { await refresh() } finally {
          setRefreshing(false)
          refreshingRef.current = false
        }
      } else {
        setPulling(false)
      }
      setProgress(0)
      progressRef.current = 0
      startY.current = null
      pulling_.current = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [refresh, threshold])

  return { pulling, progress, refreshing }
}
