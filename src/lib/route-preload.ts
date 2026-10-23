const routes: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Dashboard'),
  '/members': () => import('@/pages/TeamWorkspace'),
  '/directory': () => import('@/pages/Members'),
  '/team-status': () => import('@/pages/TeamStatus'),
  '/crm': () => import('@/pages/AgencyCRM'),
  '/tools': () => import('@/pages/Tools'),
  '/tools/invoices': () => import('@/pages/Invoices'),
  '/tools/finance': () => import('@/pages/Finance'),
};
const loading = new Set<string>();
export function preloadRoute(path: string) {
  const route = path.split('?')[0];
  if (loading.has(route)) return;
  loading.add(route);
  const load = routes[route] || (route.startsWith('/tools/') ? () => import('@/pages/DailyTools') : undefined);
  void load?.().catch(() => loading.delete(route));
}
