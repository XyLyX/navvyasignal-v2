// Decides whether the build may use offline fixture articles instead of live feeds.
// Pure (takes the environment as an argument) so the guard can be regression-tested.
type Env = Record<string, string | undefined>;

/** Netlify sets these on every build; none are set by GitHub Actions or a local shell. */
export function isNetlifyBuild(env: Env): boolean {
  return env.NETLIFY === 'true' || !!env.NETLIFY_BUILD_BASE || !!env.DEPLOY_ID;
}

export function resolveFixtureMode(env: Env): { useFixtures: boolean; blocked: boolean } {
  const requested = env.V2_RSS_FIXTURES === '0' ? false : env.V2_RSS_FIXTURES === '1' || (env.CI === 'true' && env.V2_CI_STATIC_FIXTURE === '1');
  // A real deployment must never publish fixture articles, however the variables are set.
  if (requested && isNetlifyBuild(env)) return { useFixtures: false, blocked: true };
  return { useFixtures: requested, blocked: false };
}
