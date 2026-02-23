import { Platform } from 'react-native';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let hasInitializedWebPWA = false;
let didRefreshForUpdate = false;

function createInstallBanner(onInstall: () => void, onDismiss: () => void): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '16px';
  container.style.right = '16px';
  container.style.bottom = 'max(16px, env(safe-area-inset-bottom))';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'space-between';
  container.style.gap = '12px';
  container.style.padding = '12px 14px';
  container.style.borderRadius = '12px';
  container.style.background = '#0f172a';
  container.style.color = '#ffffff';
  container.style.boxShadow = '0 10px 22px rgba(15, 23, 42, 0.28)';
  container.style.zIndex = '9999';

  const text = document.createElement('span');
  text.textContent = 'Install SurreyALIGN for a faster app-like experience.';
  text.style.fontSize = '14px';
  text.style.lineHeight = '1.35';
  text.style.flex = '1';

  const installButton = document.createElement('button');
  installButton.textContent = 'Install';
  installButton.type = 'button';
  installButton.style.border = '0';
  installButton.style.borderRadius = '8px';
  installButton.style.background = '#016183';
  installButton.style.color = '#ffffff';
  installButton.style.padding = '8px 12px';
  installButton.style.fontWeight = '600';
  installButton.style.cursor = 'pointer';
  installButton.onclick = onInstall;

  const dismissButton = document.createElement('button');
  dismissButton.textContent = 'Later';
  dismissButton.type = 'button';
  dismissButton.style.border = '1px solid rgba(255,255,255,0.4)';
  dismissButton.style.borderRadius = '8px';
  dismissButton.style.background = 'transparent';
  dismissButton.style.color = '#ffffff';
  dismissButton.style.padding = '8px 10px';
  dismissButton.style.cursor = 'pointer';
  dismissButton.onclick = onDismiss;

  container.appendChild(text);
  container.appendChild(installButton);
  container.appendChild(dismissButton);

  return container;
}

function maybeShowIosInstallTip() {
  if (typeof window === 'undefined') return;
  if (!window.sessionStorage) return;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isIos = /iphone|ipad|ipod/i.test(nav.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone);
  const tipDismissed = window.sessionStorage.getItem('pwa-ios-tip-dismissed') === '1';

  if (!isIos || isStandalone || tipDismissed) return;

  const tip = document.createElement('div');
  tip.style.position = 'fixed';
  tip.style.left = '16px';
  tip.style.right = '16px';
  tip.style.bottom = 'max(16px, env(safe-area-inset-bottom))';
  tip.style.padding = '12px 14px';
  tip.style.borderRadius = '12px';
  tip.style.background = '#ffffff';
  tip.style.color = '#1e293b';
  tip.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.18)';
  tip.style.zIndex = '9999';
  tip.style.fontSize = '14px';
  tip.style.lineHeight = '1.4';
  tip.textContent = 'Install SurreyALIGN on iPhone: tap Share, then "Add to Home Screen".';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Dismiss';
  close.style.marginTop = '10px';
  close.style.border = '0';
  close.style.borderRadius = '8px';
  close.style.background = '#016183';
  close.style.color = '#ffffff';
  close.style.padding = '7px 11px';
  close.style.cursor = 'pointer';
  close.onclick = () => {
    window.sessionStorage.setItem('pwa-ios-tip-dismissed', '1');
    tip.remove();
  };

  tip.appendChild(document.createElement('br'));
  tip.appendChild(close);
  document.body.appendChild(tip);
}

function promptForUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return;

  const shouldUpdate = window.confirm(
    'A newer version of SurreyALIGN is available. Update now?'
  );

  if (shouldUpdate) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
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

  const viewport = head.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
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
      html {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        position: relative !important;
        overscroll-behavior: none !important;
      }
      body, #root {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        position: fixed !important;
        overscroll-behavior: none !important;
        touch-action: pan-y !important;
      }
      #root {
        min-height: 100vh;
        max-height: 100vh;
      }
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

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    },
    false
  );

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

      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (registration.waiting) {
            promptForUpdate(registration);
          }

          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                promptForUpdate(registration);
              }
            });
          });

          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (didRefreshForUpdate) return;
            didRefreshForUpdate = true;
            window.location.reload();
          });
        })
        .catch(() => {});
    });
  }
}
