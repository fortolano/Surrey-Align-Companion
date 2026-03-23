# PWA UI Patterns

This document is the source of truth for mobile UI and interaction work in the SurreyAlign PWA at `/var/www/app.surreyalign.org`.

Use it before changing:
- screens in `src/app/`
- shared UI in `src/components/` or `src/components/ui/`
- tokens in `src/constants/`
- web PWA shell behavior in `src/lib/pwa-setup.ts`
- navigation shells, headers, tabs, forms, cards, or install prompts

## Product posture

- This repo is the separate SurreyAlign PWA.
- It is not the desktop web app at `/var/www/surreyalign.org`.
- It is mobile-first and portrait-first.
- It should feel close to a native app on iPhone and Android.
- It should support selected high-value mobile workflows, not mirror every desktop screen.
- Shared APIs do not mean shared layout or interaction rules.

## Device priority

Design and test in this order:

1. iPhone-sized portrait screens
2. Android phone portrait screens
3. narrow mobile web in browser mode
4. PWA standalone mode with safe areas

Do not optimize for desktop browser density first in this repo.

Current platform posture in code:

- portrait only in [`src/app.json`](/var/www/app.surreyalign.org/src/app.json)
- light theme only in [`src/app.json`](/var/www/app.surreyalign.org/src/app.json)
- no tablet support on iOS in [`src/app.json`](/var/www/app.surreyalign.org/src/app.json)

## Core design principles

Problem: Mobile screens become stressful when they feel like compressed desktop pages.
Change: Keep each screen focused on one main job, one primary action, and a clear scan path.
Why it helps: Leaders can move quickly in meetings, between errands, or during short task windows.

Problem: Mobile apps feel cheap when taps are small, spacing is tight, and feedback is weak.
Change: Use generous touch targets, visible pressed states, native-feeling spacing, and immediate feedback.
Why it helps: The app feels reliable and easier to use with one hand.

Problem: PWA screens often break when browser chrome, safe areas, keyboards, and install mode are ignored.
Change: Treat iPhone and Android system behavior as part of the layout, not edge cases.
Why it helps: The app feels stable whether it runs in browser mode or standalone mode.

## Native-feeling shell rules

### Header pattern

Use [`ScreenHeader.tsx`](/var/www/app.surreyalign.org/src/components/ScreenHeader.tsx) as the default top shell.

Rules:
- keep the title short and direct
- use a subtitle only when it adds real context
- place only one high-value action on the right side when possible
- respect top safe area padding
- keep the header visually strong enough to anchor the screen

Do not build one-off headers unless the screen has a true product reason to differ.

### Bottom tab pattern

Use the app tab shell in [`src/app/(app)/(tabs)/_layout.tsx`](/var/www/app.surreyalign.org/src/app/(app)/(tabs)/_layout.tsx) as the default bottom navigation pattern.

Rules:
- keep tab labels short
- keep the tab count low
- preserve bottom safe area support
- avoid adding a second persistent nav bar on top of the tab bar
- if a route is deeper than a top-level tab, push it into the route stack instead of adding more tabs

### Screen structure

Default order for most screens:

1. header
2. short summary or context
3. main content or list
4. sticky or bottom-anchored primary action when needed

Use progressive disclosure. Put advanced details behind a tap, sheet, or follow-up screen instead of front-loading everything.

## Touch and sizing standards

Use the shared UI constants in [`src/constants/ui.ts`](/var/www/app.surreyalign.org/src/constants/ui.ts):

- `UI_TOUCH_MIN = 44`
- `UI_BUTTON_HEIGHT = 48`
- `UI_BUTTON_HEIGHT_LARGE = 52`
- `UI_RADIUS_SM = 10`
- `UI_RADIUS_MD = 12`
- `UI_RADIUS_LG = 14`
- `UI_FONT_INTERACTIVE_MIN = 14`

Rules:
- no tappable target smaller than 44px by 44px
- primary buttons should normally be 48px to 52px tall
- icon-only buttons still need full tap area, not just a visible icon
- leave enough spacing around actions so adjacent taps are hard to miss

Current shared examples:
- [`AppButton.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppButton.tsx)
- [`AppActionButton.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppActionButton.tsx)
- [`AppIconButton.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppIconButton.tsx)
- [`AppSegmentedControl.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppSegmentedControl.tsx)

## Buttons and interactive controls

### Primary buttons

Use for the main next step on a screen.

Rules:
- one clear primary button per section
- keep labels action-led: `Save`, `Continue`, `Approve`, `Mark Complete`
- do not stack several competing primary buttons together
- loading states must replace the label with visible progress feedback

### Secondary buttons

Use for lower-priority actions that still matter.

Rules:
- keep them visually quieter than the primary action
- use outline, subtle fill, or lower emphasis
- do not make destructive actions look equal to the primary action

### Icon buttons

Use only when the icon is obvious or the action is standard.

Rules:
- keep accessibility labels meaningful
- do not rely on tiny visual icons without a full touch target
- use them for header actions, dismissals, overflow menus, or scan-friendly quick controls

### Pickers and segmented controls

Rules:
- use segmented controls for a small set of immediate mode switches
- use picker triggers when the option list is longer or better shown in a modal or sheet
- never cram a desktop-style filter bar into a narrow mobile header area

## Form rules

Problem: Mobile forms fail when fields are crowded, labels are vague, and the keyboard blocks the next step.
Change: Use short groups, clear labels, strong defaults, and keyboard-aware scrolling.
Why it helps: Leaders can complete the task with fewer mistakes and less scrolling friction.

Rules:
- group fields into short chunks
- prefer one column always
- keep helper text brief and practical
- use the right keyboard type when available
- preserve comfortable field height and padding
- keep the submit action obvious when the keyboard is open
- avoid long forms on one screen when a short step flow would be clearer

Current shared examples:
- [`AppInput.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppInput.tsx)
- [`AppPickerTrigger.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppPickerTrigger.tsx)
- [`KeyboardAwareScrollViewCompat.tsx`](/var/www/app.surreyalign.org/src/components/KeyboardAwareScrollViewCompat.tsx)

## Cards, rows, and lists

Problem: Mobile lists become noisy when every item carries too much metadata.
Change: Give each row one main line of meaning, one support line if needed, and a clean action model.
Why it helps: People can scan quickly without reading a wall of text.

Rules:
- keep card and row hierarchy simple
- place the most important text first
- trim metadata to what helps the next decision
- keep swipe, tap, and overflow actions deliberate and consistent
- use cards as first-class mobile layout tools, not as desktop leftovers

Prefer existing shared building blocks before making custom row systems:
- [`AppListRow.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppListRow.tsx)
- [`SkeletonCard.tsx`](/var/www/app.surreyalign.org/src/components/SkeletonCard.tsx)
- [`AppStatusBadge.tsx`](/var/www/app.surreyalign.org/src/components/ui/AppStatusBadge.tsx)

## Safe areas, viewport, and install-mode behavior

The app already handles important PWA shell behavior in [`src/lib/pwa-setup.ts`](/var/www/app.surreyalign.org/src/lib/pwa-setup.ts) and [`src/constants/layout.ts`](/var/www/app.surreyalign.org/src/constants/layout.ts).

Rules:
- respect top and bottom safe areas
- assume standalone mode behaves differently than browser mode
- keep bottom actions clear of the home indicator area
- use `viewport-fit=cover`
- do not disable pinch zoom
- keep body and root sizing stable so browser chrome changes do not break layouts

This repo already sets:
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-status-bar-style`
- `theme-color`
- standalone-safe runtime CSS
- install banners and install tips for iOS and Android

Do not replace these with ad hoc page-level hacks.

## iPhone and Android behavior rules

### Shared expectations

- pressed states should feel immediate
- important success moments can use tactile feedback
- scrolling should feel natural and stable
- system safe areas must be respected
- the app should feel usable with one hand when possible

### iPhone considerations

- account for the bottom home indicator area in standalone mode
- keep install guidance clear because iOS install is less obvious
- avoid placing small controls too close to the very top or bottom edges
- do not assume browser chrome size is fixed

### Android considerations

- support standalone install prompts and Chrome menu install guidance
- preserve clear elevation and touch feedback
- keep badges and tap states readable across denser icon styles

## Motion, feedback, and native feel

Use motion to confirm actions, not to decorate the app.

Rules:
- pressed states should appear immediately
- light haptics are good for simple taps
- stronger haptics are good for confirmation or more important actions
- loading indicators should appear quickly when content refreshes
- success, error, empty, and disabled states must be obvious without extra explanation

Current examples already exist in:
- [`ScreenHeader.tsx`](/var/www/app.surreyalign.org/src/components/ScreenHeader.tsx)
- [`AvatarMenu.tsx`](/var/www/app.surreyalign.org/src/components/AvatarMenu.tsx)
- [`src/app/(app)/(tabs)/notifications.tsx`](/var/www/app.surreyalign.org/src/app/(app)/(tabs)/notifications.tsx)

## Visual rules

Use the shared tokens before introducing new colors or radii:
- [`colors.ts`](/var/www/app.surreyalign.org/src/constants/colors.ts)
- [`layout.ts`](/var/www/app.surreyalign.org/src/constants/layout.ts)
- [`ui.ts`](/var/www/app.surreyalign.org/src/constants/ui.ts)
- [`status-colors.ts`](/var/www/app.surreyalign.org/src/constants/status-colors.ts)

Visual direction:
- calm, trustworthy, and simple
- bright enough for daytime mobile use
- avoid cramped enterprise density
- avoid decorative clutter
- keep contrast strong and state colors easy to recognize

## Content and information rules

- lead with the task, not the system
- use plain English labels
- keep titles short
- keep helper text short
- show the next useful action early
- prefer summarized context before detailed context

## Accessibility baseline

- do not remove zoom support
- keep touch targets generous
- preserve readable contrast
- add accessibility labels to icon-only controls
- avoid relying only on color to show state
- preserve keyboard and assistive-tech friendliness where supported

## What good looks like in this repo

Good mobile screens in this app should feel like:
- clear native-style headers
- large comfortable tap areas
- one strong next action
- stable bottom tabs
- safe-area aware layouts
- short forms
- card-first mobile composition
- fast scanning

## What to avoid

- desktop-style filter toolbars squeezed into mobile width
- multi-column layouts
- tiny text links used as primary actions
- stacked competing buttons
- one-off colors and radii
- custom header systems that ignore safe areas
- page-level hacks for browser chrome or standalone mode
- mobile screens that try to show every bit of desktop detail at once

## Implementation checklist

Before shipping a PWA UI change, confirm:

- the work belongs in the PWA, not the desktop web app
- the screen supports a focused mobile job
- the layout respects safe areas
- touch targets are at least 44px
- shared components were reused before new ones were created
- the primary action is obvious
- loading, empty, error, and disabled states are clear
- iPhone and Android standalone behavior were considered
- `npm run lint` was run in `src/`
