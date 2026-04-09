import type { NotificationAppAction, NotificationLike } from '@/lib/notification-actions';
import Colors from '@/constants/colors';

type NotificationPresentation = {
  iconName: string;
  iconColor: string;
  iconBackground: string;
  label: string;
  actionLabel: string;
};

const DEFAULT_PRESENTATION: NotificationPresentation = {
  iconName: 'notifications-outline',
  iconColor: Colors.brand.primary,
  iconBackground: '#E8F4F8',
  label: 'Update',
  actionLabel: 'Open update',
};

const TYPE_PRESENTATIONS: Record<string, NotificationPresentation> = {
  agenda_assignment: {
    iconName: 'calendar-outline',
    iconColor: '#1E40AF',
    iconBackground: '#DBEAFE',
    label: 'Meeting',
    actionLabel: 'Open meeting',
  },
  agenda_published: {
    iconName: 'calendar-clear-outline',
    iconColor: '#065F46',
    iconBackground: '#D1FAE5',
    label: 'Meeting',
    actionLabel: 'Open meeting',
  },
  agenda_unassignment: {
    iconName: 'calendar-clear-outline',
    iconColor: '#B45309',
    iconBackground: '#FEF3C7',
    label: 'Meeting',
    actionLabel: 'Open meeting',
  },
  agenda_response_declined: {
    iconName: 'alert-circle-outline',
    iconColor: '#991B1B',
    iconBackground: '#FEE2E2',
    label: 'Meeting',
    actionLabel: 'Open meeting',
  },
  board_mention: {
    iconName: 'at-outline',
    iconColor: '#7C3AED',
    iconBackground: '#EDE9FE',
    label: 'Mention',
    actionLabel: 'Open board card',
  },
  feedback: {
    iconName: 'chatbubble-ellipses-outline',
    iconColor: '#0F766E',
    iconBackground: '#CCFBF1',
    label: 'Feedback',
    actionLabel: 'Open feedback',
  },
  reminder: {
    iconName: 'alarm-outline',
    iconColor: '#B45309',
    iconBackground: '#FEF3C7',
    label: 'Reminder',
    actionLabel: 'Open reminder',
  },
  task_assignment: {
    iconName: 'checkmark-circle-outline',
    iconColor: '#0369A1',
    iconBackground: '#E0F2FE',
    label: 'Task',
    actionLabel: 'Open task',
  },
  task_due: {
    iconName: 'time-outline',
    iconColor: '#B45309',
    iconBackground: '#FEF3C7',
    label: 'Task',
    actionLabel: 'Open task',
  },
  task_overdue: {
    iconName: 'warning-outline',
    iconColor: '#B91C1C',
    iconBackground: '#FEE2E2',
    label: 'Task',
    actionLabel: 'Open task',
  },
  vote_requested: {
    iconName: 'hand-left-outline',
    iconColor: '#B45309',
    iconBackground: '#FEF3C7',
    label: 'Decision',
    actionLabel: 'Open decision',
  },
};

function actionName(notification: NotificationLike): string {
  return notification.app_action?.name ?? '';
}

function presentationForAction(action: NotificationAppAction | null | undefined): NotificationPresentation | null {
  switch (action?.name) {
    case 'goal.detail':
      return {
        iconName: 'flag-outline',
        iconColor: '#0369A1',
        iconBackground: '#E0F2FE',
        label: 'Goal',
        actionLabel: 'Open goal',
      };
    case 'calling_request.detail':
      return {
        iconName: 'people-outline',
        iconColor: '#7C3AED',
        iconBackground: '#EDE9FE',
        label: 'Calling',
        actionLabel: 'Open calling',
      };
    case 'agenda.detail':
    case 'agenda.item_detail':
    case 'agenda.submission_detail':
      return {
        iconName: 'calendar-clear-outline',
        iconColor: '#1E40AF',
        iconBackground: '#DBEAFE',
        label: 'Meeting',
        actionLabel: 'Open meeting',
      };
    case 'checkin.detail':
      return {
        iconName: 'document-text-outline',
        iconColor: '#0F766E',
        iconBackground: '#CCFBF1',
        label: 'Monthly update',
        actionLabel: 'Open update',
      };
    case 'sunday_business.index':
      return {
        iconName: 'list-outline',
        iconColor: '#7C2D12',
        iconBackground: '#FFEDD5',
        label: 'Sunday business',
        actionLabel: 'Open Sunday business',
      };
    case 'speaking.swap_detail':
      return {
        iconName: 'mic-outline',
        iconColor: '#7C2D12',
        iconBackground: '#FFEDD5',
        label: 'Speaking',
        actionLabel: 'Open assignment',
      };
    default:
      return null;
  }
}

function presentationForType(type: string | null | undefined): NotificationPresentation | null {
  switch (type ?? '') {
    case 'agenda_assignment':
    case 'agenda_published':
    case 'agenda_unassignment':
    case 'agenda_response_declined':
      return TYPE_PRESENTATIONS[type ?? ''] ?? null;
    case 'board_mention':
      return TYPE_PRESENTATIONS.board_mention;
    case 'feedback_requested':
    case 'feedback_received':
      return TYPE_PRESENTATIONS.feedback;
    case 'task_assignment':
      return TYPE_PRESENTATIONS.task_assignment;
    case 'task_due_soon':
      return TYPE_PRESENTATIONS.task_due;
    case 'task_overdue':
      return TYPE_PRESENTATIONS.task_overdue;
    case 'vote_requested':
      return TYPE_PRESENTATIONS.vote_requested;
    case 'reminder':
      return TYPE_PRESENTATIONS.reminder;
    default:
      return null;
  }
}

export function getNotificationPresentation(notification: NotificationLike): NotificationPresentation {
  return presentationForAction(notification.app_action)
    ?? presentationForType(notification.type)
    ?? DEFAULT_PRESENTATION;
}

export function mapCatalogIconToIonicon(icon: string | null | undefined, categoryKey?: string | null): string {
  switch (icon ?? '') {
    case 'bi-check-circle':
      return 'checkmark-circle-outline';
    case 'bi-chat-dots':
      return 'chatbubble-ellipses-outline';
    case 'bi-kanban':
      return 'clipboard-outline';
    case 'bi-arrow-repeat':
      return 'refresh-outline';
    case 'bi-calendar3':
      return 'calendar-clear-outline';
    case 'bi-at':
      return 'at-outline';
    case 'bi-lightbulb':
      return 'bulb-outline';
    default:
      break;
  }

  switch (categoryKey ?? '') {
    case 'decisions':
      return 'checkmark-circle-outline';
    case 'feedback':
      return 'chatbubble-ellipses-outline';
    case 'execution':
      return 'clipboard-outline';
    case 'updates':
      return 'refresh-outline';
    case 'agendas':
      return 'calendar-clear-outline';
    case 'mentions':
      return 'at-outline';
    case 'coaching':
      return 'bulb-outline';
    default:
      return 'ellipse-outline';
  }
}

export function notificationActionLabel(notification: NotificationLike): string {
  return getNotificationPresentation(notification).actionLabel;
}

export function notificationSurfaceLabel(notification: NotificationLike): string {
  const fromType = presentationForType(notification.type);
  if (fromType) {
    return fromType.label;
  }

  const fromAction = presentationForAction(notification.app_action);
  if (fromAction) {
    return fromAction.label;
  }

  const action = actionName(notification);
  if (action.startsWith('agenda.')) return 'Meeting';
  if (action.startsWith('goal.')) return 'Goal';
  if (action.startsWith('calling_request.')) return 'Calling';

  return DEFAULT_PRESENTATION.label;
}
