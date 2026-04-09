import { Platform } from 'react-native';
import { authFetch } from '@/lib/api';

type PermissionState = NotificationPermission | 'unsupported';
const SERVICE_WORKER_READY_TIMEOUT_MS = 4000;

export interface PushConfigResponse {
  success: boolean;
  push_enabled: boolean;
  stake_notifications_enabled: boolean;
  stake_push_enabled: boolean;
  user_push_enabled: boolean;
  public_key: string | null;
}

export interface PushDeviceState {
  supported: boolean;
  backendEnabled: boolean;
  accountEnabled: boolean;
  isInstalledApp: boolean;
  requiresInstall: boolean;
  permission: PermissionState;
  hasSubscription: boolean;
  enabled: boolean;
  statusLabel: string;
  message: string;
}

function isWebPushSupported(): boolean {
  return Platform.OS === 'web'
    && typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as Navigator & { standalone?: boolean };

  return window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone);
}

function isIosDevice(): boolean {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function browserFamily(): string {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari';

  return 'unknown';
}

function platformName(): string {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  if (ua.includes('android')) return 'android';

  return 'desktop';
}

function permissionState(): PermissionState {
  if (!isWebPushSupported()) return 'unsupported';

  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;

  try {
    const rootRegistration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (rootRegistration) return rootRegistration;
  } catch {}

  try {
    const directRegistration = await navigator.serviceWorker.getRegistration();
    if (directRegistration) return directRegistration;
  } catch {}

  try {
    const createdRegistration = await navigator.serviceWorker.register('/sw.js');
    if (createdRegistration) return createdRegistration;
  } catch {}

  try {
    const readyRegistration = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), SERVICE_WORKER_READY_TIMEOUT_MS);
      }),
    ]);

    if (readyRegistration) return readyRegistration;
  } catch {}

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations[0] ?? null;
  } catch {}

  return null;
}

async function getSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration();
  if (!registration) return null;

  return registration.pushManager.getSubscription();
}

function buildDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device';

  const installedLabel = isStandaloneDisplayMode() ? 'installed app' : 'browser';
  const platform = platformName();

  return `${platform} ${installedLabel}`.trim();
}

async function fetchPushConfig(token: string | null): Promise<PushConfigResponse | null> {
  if (!token) return null;

  return authFetch(token, '/api/notifications/push-config');
}

async function sendSubscriptionToServer(token: string, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const keys = json.keys || {};

  await authFetch(token, '/api/notifications/push-subscriptions', {
    method: 'POST',
    body: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      platform: platformName(),
      browser_family: browserFamily(),
      device_label: buildDeviceLabel(),
      app_build: 'pwa-web',
      is_installed_app: isStandaloneDisplayMode(),
      permission_state: permissionState() === 'unsupported' ? null : permissionState(),
    },
  });
}

export async function getPushDeviceState(token: string | null): Promise<PushDeviceState> {
  if (!isWebPushSupported()) {
    return {
      supported: false,
      backendEnabled: false,
      accountEnabled: false,
      isInstalledApp: false,
      requiresInstall: false,
      permission: 'unsupported',
      hasSubscription: false,
      enabled: false,
      statusLabel: 'Not available here',
      message: 'This browser does not support mobile alerts for SurreyALIGN.',
    };
  }

  const currentPermission = permissionState();
  const installed = isStandaloneDisplayMode();
  const requiresInstall = isIosDevice() && !installed;
  const [subscription, config] = await Promise.all([
    getSubscription(),
    fetchPushConfig(token),
  ]);
  const serverReady = Boolean(config?.public_key);
  const backendEnabled = Boolean(config?.push_enabled && config?.public_key);
  const accountEnabled = Boolean(config?.user_push_enabled ?? false);
  const hasSubscription = Boolean(subscription);

  if (!serverReady) {
    return {
      supported: true,
      backendEnabled: false,
      accountEnabled,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription,
      enabled: false,
      statusLabel: 'Not ready yet',
      message: 'Mobile alerts are not ready on this server yet.',
    };
  }

  if (config?.stake_push_enabled === false) {
    return {
      supported: true,
      backendEnabled: false,
      accountEnabled,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription,
      enabled: false,
      statusLabel: 'Stake off',
      message: config?.stake_notifications_enabled === false
        ? 'Your stake has not turned notifications on yet.'
        : 'Your stake has not turned mobile alerts on yet.',
    };
  }

  if (config?.user_push_enabled === false) {
    return {
      supported: true,
      backendEnabled: false,
      accountEnabled: false,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription,
      enabled: false,
      statusLabel: 'Off for account',
      message: 'Phone alerts are turned off for your account. Turn them on below before you enable this device.',
    };
  }

  if (requiresInstall) {
    return {
      supported: true,
      backendEnabled,
      accountEnabled,
      isInstalledApp: false,
      requiresInstall: true,
      permission: currentPermission,
      hasSubscription,
      enabled: false,
      statusLabel: 'Install required',
      message: 'Install SurreyALIGN on your home screen first to turn on phone-style alerts on iPhone.',
    };
  }

  if (!backendEnabled) {
    return {
      supported: true,
      backendEnabled: false,
      accountEnabled,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription,
      enabled: false,
      statusLabel: 'Not ready yet',
      message: config?.stake_notifications_enabled === false
        ? 'Your stake has not turned notifications on yet.'
        : 'Mobile alerts are not ready on this server yet.',
    };
  }

  if (currentPermission === 'denied') {
    return {
      supported: true,
      backendEnabled: true,
      accountEnabled,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription,
      enabled: false,
      statusLabel: 'Blocked',
      message: 'Notifications are blocked for SurreyALIGN on this device.',
    };
  }

  if (currentPermission === 'granted' && hasSubscription) {
    return {
      supported: true,
      backendEnabled: true,
      accountEnabled,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription: true,
      enabled: true,
      statusLabel: 'On',
      message: 'Mobile alerts are on for this device.',
    };
  }

  if (currentPermission === 'granted') {
    return {
      supported: true,
      backendEnabled: true,
      accountEnabled,
      isInstalledApp: installed,
      requiresInstall: false,
      permission: currentPermission,
      hasSubscription: false,
      enabled: false,
      statusLabel: 'Almost on',
      message: 'Notifications are allowed. Finish connecting this device to receive SurreyALIGN alerts.',
    };
  }

  return {
    supported: true,
    backendEnabled: true,
    isInstalledApp: installed,
    requiresInstall: false,
    permission: currentPermission,
    hasSubscription,
    enabled: false,
    statusLabel: 'Off',
    message: 'Turn on mobile alerts to receive time-sensitive updates on this device.',
  };
}

export async function syncExistingPushSubscription(token: string | null): Promise<void> {
  if (!token || !isWebPushSupported() || permissionState() !== 'granted') return;
  if (isIosDevice() && !isStandaloneDisplayMode()) return;

  let config: PushConfigResponse | null = null;

  try {
    config = await fetchPushConfig(token);
  } catch {
    return;
  }

  if (!config?.push_enabled || !config.public_key) return;

  const subscription = await getSubscription();
  if (!subscription) return;

  try {
    await sendSubscriptionToServer(token, subscription);
  } catch {
    // Sync is best-effort only during app boot and session refresh.
  }
}

export async function enablePushForCurrentDevice(token: string | null): Promise<PushDeviceState> {
  if (!token) {
    throw new Error('You need to be signed in to turn on mobile alerts.');
  }

  if (!isWebPushSupported()) {
    throw new Error('This browser does not support mobile alerts for SurreyALIGN.');
  }

  if (isIosDevice() && !isStandaloneDisplayMode()) {
    throw new Error('Install SurreyALIGN on your home screen first, then turn on mobile alerts.');
  }

  const config = await fetchPushConfig(token);
  if (!config?.push_enabled || !config.public_key) {
    throw new Error(config?.stake_notifications_enabled === false
      ? 'Your stake has not turned notifications on yet.'
      : (config?.user_push_enabled === false
          ? 'Turn on phone alerts for your account first.'
          : 'Mobile alerts are not ready on this server yet.'));
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('SurreyALIGN was not allowed to show notifications on this device.');
  }

  const registration = await getRegistration();
  if (!registration) {
    throw new Error('The app could not finish mobile-alert setup on this device.');
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.public_key),
    });
  }

  await sendSubscriptionToServer(token, subscription);
  await new Promise((resolve) => {
    window.setTimeout(resolve, 250);
  });

  return getPushDeviceState(token);
}

export async function disablePushForCurrentDevice(token: string | null): Promise<PushDeviceState | null> {
  const subscription = await getSubscription();

  if (token && subscription) {
    try {
      await authFetch(token, '/api/notifications/push-subscriptions/current', {
        method: 'DELETE',
        body: {
          endpoint: subscription.endpoint,
          permission_state: permissionState() === 'unsupported' ? null : permissionState(),
        },
      });
    } catch {
      // Best-effort device cleanup should not block logout or settings changes.
    }
  }

  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch {
      // Ignore local unsubscribe failures and still refresh state.
    }
  }

  if (!token) return null;

  return getPushDeviceState(token);
}
