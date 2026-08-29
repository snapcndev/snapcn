/**
 * Stand-in for `registry/snap-cn-pro/__index__` in a checkout that has no pro
 * tier — the directory is gitignored, so most checkouts do not.
 *
 * `scripts/dev/render-one.mts` aliases the pro barrel to this file when it is
 * missing, which is what lets `dev-root` import it unconditionally instead of
 * every consumer carrying a branch.
 */
export const proRegistry = {};
export default proRegistry;
