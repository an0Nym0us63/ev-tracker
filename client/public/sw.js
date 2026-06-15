// Cache version — increment this to force update on all clients
const CACHE_VERSION = 'v3.24'
const CACHE = `ev-tracker-${CACHE_VERSION}`
const STATIC = ['/', '/index.html', '/manifest.json', '/logo.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  // Force immediate activation — don't wait for old SW to die
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k)
        return caches.delete(k)
      }))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // API calls — always network
  if (e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  )
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
