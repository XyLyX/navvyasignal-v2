// Non-secret rollout state. Environment overrides remain available for emergency rollback.
export function schedulerConfiguration(mode?:string,startAt?:string) {
  return {mode:mode ?? 'probe',startAt:startAt ?? ''};
}
