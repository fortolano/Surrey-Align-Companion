# React Native Web Polish Reference

Use this reference when the PWA uses React Native Web and appears less polished than native.

## 1. Web polish goals

- Improve perceived visual quality.
- Match spacing and typography rhythm across devices.
- Correct shadow, border, and layering behavior.
- Ensure touch and hover/focus interactions feel native to the web.

## 2. Common RN Web adjustments

- Typography:
  - Normalize font stacks for web availability.
  - Tune letter-spacing and line-height for readability.
  - Verify weight rendering (400/500/600/700) with selected web fonts.

- Spacing/layout:
  - Audit paddings/margins for dense or sparse screens.
  - Ensure containers use viewport-stable heights (`100dvh`) where needed.
  - Eliminate accidental overflow and clipped content.

- Shadows/borders:
  - Replace flat defaults with calibrated box-shadow values.
  - Verify border radii and divider contrast.
  - Ensure overlays/modals have clear depth separation.

- Motion/interaction:
  - Add subtle transitions for hover/press/focus on web.
  - Respect reduced-motion preferences.
  - Ensure pressed/active feedback is clear on touch devices.

## 3. Input and focus behavior

- Provide visible focus ring for keyboard users.
- Ensure form controls have clear labels and error messaging.
- Avoid web-inconsistent input sizing.
- Keep focus behavior stable during route transitions.

## 4. Navigation and shell consistency

- Keep app shell structure predictable across pages.
- Stabilize top/bottom nav positioning.
- Avoid reflow jumps on async content load.
- Ensure loading and empty states match brand style (not generic placeholders).

## 5. Cross-browser sanity checks

At minimum test:
- Mobile Safari (iOS).
- Chrome Android.
- Desktop Chrome/Edge.

Confirm:
- Shadows render cleanly.
- Typography is consistent.
- Scroll/touch behavior matches locked app policy.
- No layout wobble on keyboard open/close.
