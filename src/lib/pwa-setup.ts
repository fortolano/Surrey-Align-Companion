import { Platform } from 'react-native';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let hasInitializedWebPWA = false;
let didRefreshForUpdate = false;

function getFloatingBannerFrame(shadow: string, borderColor: string): Partial<CSSStyleDeclaration> {
  return {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(420px, calc(100vw - 24px))',
    bottom: 'max(12px, calc(env(safe-area-inset-bottom) + 12px))',
    padding: '20px',
    borderRadius: '16px',
    background: '#ffffff',
    color: '#1e293b',
    boxShadow: `${shadow}, 0 0 0 1px ${borderColor}`,
    zIndex: '9999',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    animation: 'pwa-slide-up 0.35s ease-out',
  };
}

function createInstallBanner(onInstall: () => void, onDismiss: () => void): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'pwa-install-banner';
  Object.assign(container.style, getFloatingBannerFrame('0 8px 32px rgba(1, 97, 131, 0.18)', 'rgba(1, 97, 131, 0.08)'), {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });

  addBannerAnimation();

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px' });

  const iconWrap = document.createElement('div');
  Object.assign(iconWrap.style, {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #016183, #0289B5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: '0',
  });
  iconWrap.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>';

  const titleArea = document.createElement('div');
  titleArea.style.flex = '1';

  const title = document.createElement('div');
  Object.assign(title.style, { fontWeight: '700', fontSize: '16px', color: '#0f172a', marginBottom: '2px' });
  title.textContent = 'Install SurreyALIGN App';

  const subtitle = document.createElement('div');
  Object.assign(subtitle.style, { fontSize: '13px', color: '#64748b', lineHeight: '1.3' });
  subtitle.textContent = 'Add to your home screen for quick access — works like a regular app.';

  titleArea.appendChild(title);
  titleArea.appendChild(subtitle);
  header.appendChild(iconWrap);
  header.appendChild(titleArea);

  const buttonRow = document.createElement('div');
  Object.assign(buttonRow.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });

  const installButton = document.createElement('button');
  installButton.textContent = 'Install App';
  installButton.type = 'button';
  Object.assign(installButton.style, {
    flex: '1 1 160px', border: '0', borderRadius: '10px',
    background: 'linear-gradient(135deg, #016183, #0289B5)',
    color: '#ffffff', minHeight: '48px', padding: '12px 16px', fontWeight: '600',
    fontSize: '15px', cursor: 'pointer', letterSpacing: '0.3px',
  });
  installButton.onclick = onInstall;

  const dismissButton = document.createElement('button');
  dismissButton.textContent = 'Not Now';
  dismissButton.type = 'button';
  Object.assign(dismissButton.style, {
    flex: '1 1 120px', border: '1px solid #e2e8f0', borderRadius: '10px',
    background: '#f8fafc', color: '#64748b',
    minHeight: '48px', padding: '12px 16px', fontWeight: '500',
    fontSize: '15px', cursor: 'pointer',
  });
  dismissButton.onclick = onDismiss;

  buttonRow.appendChild(installButton);
  buttonRow.appendChild(dismissButton);

  container.appendChild(header);
  container.appendChild(buttonRow);

  return container;
}

function addBannerAnimation() {
  if (document.getElementById('pwa-banner-anim')) return;
  const style = document.createElement('style');
  style.id = 'pwa-banner-anim';
  style.textContent = `
    @keyframes pwa-slide-up {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function maybeShowIosInstallTip() {
  if (typeof window === 'undefined') return;
  if (!window.sessionStorage) return;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isIos = /iphone|ipad|ipod/i.test(nav.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone);
  const tipDismissed = window.sessionStorage.getItem('pwa-ios-tip-dismissed') === '1';

  if (!isIos || isStandalone || tipDismissed) return;

  addBannerAnimation();

  const tip = document.createElement('div');
  tip.id = 'pwa-ios-tip';
  Object.assign(tip.style, getFloatingBannerFrame('0 8px 32px rgba(180, 83, 9, 0.18)', 'rgba(180, 83, 9, 0.12)'));

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' });

  const iconWrap = document.createElement('div');
  Object.assign(iconWrap.style, {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #b45309, #d97706)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: '0',
  });
  const iconSvgDoc = new DOMParser().parseFromString('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>', 'image/svg+xml');
  iconWrap.appendChild(iconSvgDoc.documentElement);

  const titleArea = document.createElement('div');
  titleArea.style.flex = '1';

  const title = document.createElement('div');
  Object.assign(title.style, { fontWeight: '700', fontSize: '16px', color: '#0f172a', marginBottom: '2px' });
  title.textContent = 'Install SurreyALIGN App';

  const subtitle = document.createElement('div');
  Object.assign(subtitle.style, { fontSize: '13px', color: '#64748b', lineHeight: '1.3' });
  subtitle.textContent = 'Add to your home screen in 3 quick steps:';

  titleArea.appendChild(title);
  titleArea.appendChild(subtitle);
  header.appendChild(iconWrap);
  header.appendChild(titleArea);

  const steps = document.createElement('div');
  Object.assign(steps.style, { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' });

  const shareIconUrl = '/images/share-icon.png';
  const shareImg = `<img src="${shareIconUrl}" alt="Share" style="width:14px;height:14px;vertical-align:middle;margin:0 2px;">`;

  const stepData = [
    { num: '1', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>', text: `In Chrome: Tap the <b>Share</b> ${shareImg} button on the address field.<br>In Safari: Tap <b>...</b> and then the <b>Share</b> ${shareImg} button.` },
    { num: '2', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>', text: 'Scroll down in the menu' },
    { num: '3', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>', text: 'Tap <b>Add to Home Screen</b>' },
  ];

  stepData.forEach(({ num, icon, text }) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '10px 12px', borderRadius: '10px',
      background: '#fffbeb',
    });

    const badge = document.createElement('div');
    Object.assign(badge.style, {
      width: '26px', height: '26px', borderRadius: '8px',
      background: '#b45309', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: '700', flexShrink: '0',
      marginTop: '2px',
    });
    badge.textContent = num;

    const iconEl = document.createElement('div');
    Object.assign(iconEl.style, {
      width: '24px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: '0',
      marginTop: '2px',
    });
    const svgDoc = new DOMParser().parseFromString(icon, 'image/svg+xml');
    iconEl.appendChild(svgDoc.documentElement);

    const label = document.createElement('div');
    Object.assign(label.style, { fontSize: '13px', lineHeight: '1.4', color: '#334155', flex: '1' });
    const labelDoc = new DOMParser().parseFromString(`<span>${text}</span>`, 'text/html');
    label.appendChild(labelDoc.body.firstChild!);

    row.appendChild(badge);
    row.appendChild(iconEl);
    row.appendChild(label);
    steps.appendChild(row);
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Got It';
  Object.assign(close.style, {
    width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px',
    background: '#f8fafc', color: '#64748b',
    minHeight: '48px', padding: '12px', fontWeight: '500', fontSize: '15px',
    cursor: 'pointer',
  });
  close.onclick = () => {
    window.sessionStorage.setItem('pwa-ios-tip-dismissed', '1');
    tip.style.animation = 'none';
    tip.style.transition = 'opacity 0.2s, transform 0.2s';
    tip.style.opacity = '0';
    tip.style.transform = 'translateY(24px)';
    setTimeout(() => tip.remove(), 220);
  };

  tip.appendChild(header);
  tip.appendChild(steps);
  tip.appendChild(close);
  document.body.appendChild(tip);
}

function maybeShowAndroidInstallTip() {
  if (typeof window === 'undefined') return;
  if (!window.sessionStorage) return;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isAndroid = /android/i.test(nav.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const tipDismissed = window.sessionStorage.getItem('pwa-android-tip-dismissed') === '1';

  if (!isAndroid || isStandalone || tipDismissed) return;

  addBannerAnimation();

  const tip = document.createElement('div');
  tip.id = 'pwa-android-tip';
  Object.assign(tip.style, getFloatingBannerFrame('0 8px 32px rgba(180, 83, 9, 0.18)', 'rgba(180, 83, 9, 0.12)'));

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' });

  const iconWrap = document.createElement('div');
  Object.assign(iconWrap.style, {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #b45309, #d97706)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: '0',
  });
  const iconSvgDoc = new DOMParser().parseFromString('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>', 'image/svg+xml');
  iconWrap.appendChild(iconSvgDoc.documentElement);

  const titleArea = document.createElement('div');
  titleArea.style.flex = '1';

  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, { fontWeight: '700', fontSize: '16px', color: '#0f172a', marginBottom: '2px' });
  titleEl.textContent = 'Install SurreyALIGN App';

  const subtitleEl = document.createElement('div');
  Object.assign(subtitleEl.style, { fontSize: '13px', color: '#64748b', lineHeight: '1.3' });
  subtitleEl.textContent = 'Add to your home screen in 3 quick steps:';

  titleArea.appendChild(titleEl);
  titleArea.appendChild(subtitleEl);
  header.appendChild(iconWrap);
  header.appendChild(titleArea);

  const steps = document.createElement('div');
  Object.assign(steps.style, { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' });

  const stepData = [
    { num: '1', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>', text: 'Tap the <b>⋮ menu</b> (3 dots) in Chrome' },
    { num: '2', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>', text: 'Scroll down in the menu' },
    { num: '3', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>', text: 'Tap <b>Add to Home Screen</b>' },
  ];

  stepData.forEach(({ num, icon, text }) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 12px', borderRadius: '10px',
      background: '#fffbeb',
    });

    const badge = document.createElement('div');
    Object.assign(badge.style, {
      width: '26px', height: '26px', borderRadius: '8px',
      background: '#b45309', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: '700', flexShrink: '0',
    });
    badge.textContent = num;

    const iconEl = document.createElement('div');
    Object.assign(iconEl.style, {
      width: '24px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: '0',
    });
    const svgDoc = new DOMParser().parseFromString(icon, 'image/svg+xml');
    iconEl.appendChild(svgDoc.documentElement);

    const label = document.createElement('div');
    Object.assign(label.style, { fontSize: '14px', lineHeight: '1.3', color: '#334155', flex: '1' });
    const labelDoc = new DOMParser().parseFromString(`<span>${text}</span>`, 'text/html');
    label.appendChild(labelDoc.body.firstChild!);

    row.appendChild(badge);
    row.appendChild(iconEl);
    row.appendChild(label);
    steps.appendChild(row);
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Got It';
  Object.assign(close.style, {
    width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px',
    background: '#f8fafc', color: '#64748b',
    minHeight: '48px', padding: '12px', fontWeight: '500', fontSize: '15px',
    cursor: 'pointer',
  });
  close.onclick = () => {
    window.sessionStorage.setItem('pwa-android-tip-dismissed', '1');
    tip.style.animation = 'none';
    tip.style.transition = 'opacity 0.2s, transform 0.2s';
    tip.style.opacity = '0';
    tip.style.transform = 'translateY(24px)';
    setTimeout(() => tip.remove(), 220);
  };

  tip.appendChild(header);
  tip.appendChild(steps);
  tip.appendChild(close);
  document.body.appendChild(tip);
}

function applyWaitingUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

export async function updateAppNow(): Promise<'reloading' | 'not_supported'> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'not_supported';
  }

  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return 'reloading';
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) {
      window.location.reload();
      return 'reloading';
    }

    for (const registration of registrations) {
      registration.update().catch(() => {});

      if (registration.waiting) {
        applyWaitingUpdate(registration);
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            applyWaitingUpdate(registration);
          }
        });
      });
    }

    // Fallback refresh to avoid stale sessions when iOS keeps the old worker active.
    window.setTimeout(() => {
      if (didRefreshForUpdate) return;
      didRefreshForUpdate = true;
      window.location.reload();
    }, 1500);
  } catch {
    window.location.reload();
  }

  return 'reloading';
}

export function setupPWA() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (hasInitializedWebPWA) return;
  hasInitializedWebPWA = true;

  const head = document.head;

  function addMeta(name: string, content: string) {
    let meta = head.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  // Ensure viewport allows accessibility zoom (no maximum-scale or user-scalable=no)
  const viewport = head.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover'
    );
  }

  addMeta('theme-color', '#016183');
  addMeta('mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  addMeta('apple-mobile-web-app-title', 'SurreyALIGN');

  if (!head.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = '/manifest.json';
    head.appendChild(manifestLink);
  }

  if (!head.querySelector('link[rel="apple-touch-icon"]')) {
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = '/apple-touch-icon.png';
    head.appendChild(appleIcon);
  }

  if (!document.getElementById('pwa-runtime-styles')) {
    const style = document.createElement('style');
    style.id = 'pwa-runtime-styles';
    style.textContent = `
      /* ═══ BROWSER MODE: 100dvh excludes the browser toolbar ═══ */
      html {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }
      body {
        width: 100% !important;
        height: 100dvh !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #f5f9fb !important;
        color-scheme: light !important;
        overflow: hidden !important;
        position: fixed !important;
        overscroll-behavior: none !important;
        touch-action: pan-y !important;
      }
      /* ═══ STANDALONE PWA: no browser toolbar, use full screen ═══ */
      @media all and (display-mode: standalone) {
        body { height: 100vh !important; }
      }
      #root {
        display: flex !important;
        flex: 1 !important;
        width: 100% !important;
        height: 100% !important;
        background: #f5f9fb !important;
        overflow: hidden !important;
      }

      /* ═══ Global UX: disable text selection, tap highlight, scrollbars ═══ */
      * {
        -webkit-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        scrollbar-width: none;
      }
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: auto !important;
        user-select: auto !important;
      }
      img, a {
        -webkit-touch-callout: none;
      }
      ::-webkit-scrollbar {
        display: none !important;
      }
      *:focus-visible {
        outline: 2px solid #0289B5 !important;
        outline-offset: 2px;
      }
    `;
    head.appendChild(style);
  }

  // Context menu prevention (keeps app feel, does not block accessibility zoom)
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
  });

  maybeShowIosInstallTip();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
      let installBanner: HTMLDivElement | null = null;

      const removeInstallBanner = () => {
        if (!installBanner) return;
        installBanner.remove();
        installBanner = null;
      };

      const showInstallBanner = () => {
        if (!deferredInstallPrompt || installBanner) return;

        installBanner = createInstallBanner(
          async () => {
            if (!deferredInstallPrompt) return;
            removeInstallBanner();
            await deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
          },
          () => {
            removeInstallBanner();
          }
        );

        document.body.appendChild(installBanner);
      };

      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event as BeforeInstallPromptEvent;
        showInstallBanner();
      });

      window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        removeInstallBanner();
      });

      setTimeout(() => {
        if (!deferredInstallPrompt && !installBanner) {
          maybeShowAndroidInstallTip();
        }
      }, 2500);

      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates on launch (non-disruptive — just downloads in background)
          registration.update().catch(() => {});

          // Check for updates when user returns to the app (tab refocus)
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          });

          // No auto-apply of waiting SW — updates are applied only when:
          // 1. User presses "Update App Now" in More menu (calls updateAppNow())
          // 2. User closes and reopens the app (SW activates naturally)
        })
        .catch(() => {});
    });
  }
}
