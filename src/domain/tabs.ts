/**
 * The tabs, in the order they sit in the bar. One list, so a swipe can never
 * disagree with what the tab bar shows — `components/app-tabs.tsx` and
 * `app-tabs.web.tsx` draw the same five, in this order.
 */
/** Spelled out, so `router.navigate` still gets a route it knows. */
export type TabPath = '/' | '/budgets' | '/bills' | '/savings' | '/insights';

export interface TabRoute {
  /** The route file name inside `app/(tabs)`. */
  name: string;
  path: TabPath;
  label: string;
}

export const TABS: readonly TabRoute[] = [
  { name: 'index', path: '/', label: 'Overview' },
  { name: 'budgets', path: '/budgets', label: 'Budgets' },
  { name: 'bills', path: '/bills', label: 'Bills' },
  { name: 'savings', path: '/savings', label: 'Savings' },
  { name: 'insights', path: '/insights', label: 'Insights' },
];

/** Which tab a path belongs to, or `-1` for anywhere else in the app. */
export function tabIndexOf(pathname: string): number {
  const path = pathname.replace(/\/+$/, '') || '/';
  return TABS.findIndex((tab) => tab.path === path);
}

/**
 * The tab one step along, or `null` at either end and away from the tabs.
 * The ends do not wrap: an iOS tab bar has a first and a last tab, and a swipe
 * that jumps from one end of the app to the other loses people.
 */
export function neighbourTab(pathname: string, step: 1 | -1): TabRoute | null {
  const index = tabIndexOf(pathname);
  if (index === -1) return null;
  return TABS[index + step] ?? null;
}
