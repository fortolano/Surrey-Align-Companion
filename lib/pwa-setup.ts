import { Platform } from 'react-native';

export function setupPWA() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;

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
    viewport.setAttribute('content',
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

  const style = document.createElement('style');
  style.textContent = `
    html, body, #root {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      position: fixed !important;
      overscroll-behavior: none !important;
      -webkit-overflow-scrolling: touch;
    }
    body {
      overscroll-behavior-y: contain !important;
      touch-action: manipulation !important;
    }
    * {
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
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
    * {
      scrollbar-width: none;
    }
    button:focus, [role="button"]:focus, a:focus {
      outline: none;
    }
  `;
  head.appendChild(style);

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, false);

  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
