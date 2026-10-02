// Non-secret rollout state. Environment overrides remain available for emergency rollback.
export function schedulerConfiguration(mode?:string,startAt?:string) {
  return {mode:mode ?? 'live',startAt:startAt ?? '2026-10-02T22:30:00Z'};
}
