import { Alert, Platform } from 'react-native';

export interface AppAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  isPreferred?: boolean;
}

function composeWebMessage(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}

function isCancelButton(button: AppAlertButton): boolean {
  const normalizedText = button.text?.trim().toLowerCase();
  return button.style === 'cancel' || normalizedText === 'cancel' || normalizedText === 'no';
}

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const normalizedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  const cancelButton = normalizedButtons.find(isCancelButton);
  const primaryButton = [...normalizedButtons].reverse().find((button) => button !== cancelButton) ?? normalizedButtons[0];
  const webMessage = composeWebMessage(title, message);

  if (typeof window === 'undefined') {
    primaryButton?.onPress?.();
    return;
  }

  if (normalizedButtons.length === 1) {
    window.alert(webMessage);
    normalizedButtons[0]?.onPress?.();
    return;
  }

  const confirmed = window.confirm(webMessage);
  if (confirmed) {
    primaryButton?.onPress?.();
    return;
  }

  cancelButton?.onPress?.();
}
