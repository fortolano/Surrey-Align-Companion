# Viewport and Touch Lock Reference

Use this reference when the user wants native-like mobile behavior in a web app/PWA.
Goal: remove browser-default drag, bounce, zoom, and unstable viewport behavior.

## 1. Required viewport meta

Apply in HTML head:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
/>
```

Notes:
- This intentionally disables pinch zoom to match native-app feel.
- If product requirements later demand zoom accessibility, make it an explicit product decision.

## 2. Root sizing and overflow policy

Use stable full-height rules:

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: manipulation;
}

.app-shell {
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}

.scroll-region {
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

Principles:
- Root document should not scroll.
- Scrolling is opt-in within explicit scroll containers.
- Use `dvh` for better mobile keyboard behavior.

## 3. Bounce and pull-to-refresh suppression

Required:
- `overscroll-behavior: none` on root shell.
- Prevent body/document level vertical scrolling.
- Ensure top-level container cannot be pulled down.

If the browser still allows pull-to-refresh in edge cases, intercept touch gestures at shell level carefully without breaking inner scroll regions.

## 4. Gesture lock policy

Target behavior:
- No pinch zoom.
- No two-finger browser zoom.
- No accidental horizontal drag of app shell.

Use CSS first, then JS fallback only when needed:
- CSS: `touch-action` on shell and interactive surfaces.
- JS fallback: gesture event prevention for multi-touch zoom in browsers that ignore CSS alone.

Do not block intended gestures inside designated canvas/map components unless requested.

## 5. Keyboard and safe-area stability

Requirements:
- Respect `env(safe-area-inset-*)` on iOS notch devices.
- Keep focused input visible in scroll region.
- Avoid shifting the whole app shell unpredictably when keyboard opens.
- Use sticky/fixed nav bars that remain anchored.

Example:

```css
.app-shell {
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}
```

## 6. Validation checklist

- Cannot pinch zoom.
- Cannot drag page around.
- No elastic bounce at top/bottom.
- Pull-to-refresh disabled in app shell usage.
- App fills viewport on device rotate and keyboard open/close.
- Inner lists still scroll smoothly.
