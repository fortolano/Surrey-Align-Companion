export interface LeaveGuardRequest {
  reason: 'tab' | 'back';
  targetRouteName?: string;
  continueNavigation: () => void;
}

type LeaveGuardHandler = (request: LeaveGuardRequest) => boolean;

let activeLeaveGuard: LeaveGuardHandler | null = null;

export function setActiveLeaveGuard(handler: LeaveGuardHandler | null) {
  activeLeaveGuard = handler;
}

export function requestLeaveGuard(request: LeaveGuardRequest): boolean {
  if (!activeLeaveGuard) return false;
  return activeLeaveGuard(request);
}
