# Service Worker Strategies Reference

Use this reference to choose and implement safe PWA caching behavior.

## 1. Strategy selection matrix

Choose one profile first, then refine per route/API:

- `content-heavy`: static/article/catalog apps
  - Navigation/documents: stale-while-revalidate
  - Assets: cache-first with versioning
  - API reads: stale-while-revalidate with TTL

- `transactional`: dashboards/forms/order flows
  - Navigation: network-first with offline fallback
  - API reads: network-first with bounded timeout
  - API writes: queue + retry/backoff (if offline edit/create is required)

- `hybrid`: mixed app types
  - Public/reference sections: stale-while-revalidate
  - Auth/account flows: network-first
  - Split by route group and API domain

## 2. Required implementation rules

- Precache app shell and critical static files.
- Add offline fallback for navigation failures.
- Version cache names and delete old caches on activate.
- Define max entries/max age for runtime caches.
- Do not cache authenticated/sensitive responses.
- Do not cache token-bearing request/response payloads.

## 3. Navigation fallback policy

For SPA PWAs:
- Serve app shell for navigation when online.
- On network failure, serve offline fallback route/component.
- Keep fallback informative and actionable.

## 4. Update lifecycle policy

Required:
- Detect waiting service worker.
- Prompt user before applying update when active work may be interrupted.
- Avoid forced refresh during form entry.
- Provide clear “Update available” messaging.

Optional:
- Include short changelog snippet in update toast/banner.

## 5. Offline data policy for editable apps

If users can create/edit offline:
- Use IndexedDB for durable queue and draft state.
- Add retry with exponential backoff.
- Store operation metadata for replay.
- Define conflict strategy:
  - `last-write-wins` for low-risk domains.
  - Merge UX for collaborative/high-stakes domains.

## 6. Verification checklist

- Fresh install works.
- Reload uses precached shell.
- Offline navigation fallback works.
- Runtime caching behavior matches strategy.
- Stale caches are cleaned on new SW activation.
- Update prompt appears and applies safely.
