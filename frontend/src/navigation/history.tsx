import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/** The current pathname is enough to give Android hardware back the same
 * parent route that the visible header button uses. */
let currentPath: string | null = null;

const isAuthRoute = (path: string) =>
  path.includes('/login') || path.includes('/register') || path.includes('/onboarding');

/** Group segments (/(app), /(auth)) and trailing slashes are irrelevant for comparisons. */
function normalize(path: string | undefined | null): string {
  if (!path) return '';
  return path.replace(/\/\((?:[^)]*)\)/g, '').replace(/\/+$/, '') || '/';
}

const ROOT_ROUTES = new Set(['/home', '/community', '/services', '/profile', '/manager', '/leadership', '/work']);

function isRootRoute(path: string | null) {
  return ROOT_ROUTES.has(normalize(path));
}

/** Parent destinations used by native hardware back and deep links. */
export function getDefaultBackRoute(path: string | null): string {
  const route = normalize(path);

  if (route.startsWith('/manager/tickets/')) return '/manager/tickets';
  if (route === '/manager/tickets') return '/manager';
  if (route.startsWith('/manager/personnel/')) return '/manager/personnel';
  if (route === '/manager/personnel') return '/manager';
  if (route.startsWith('/manager/visitors/audit/')) return '/manager/visitors';
  if (route === '/manager/visitors') return '/manager';
  if (route === '/manager/approvals' || route === '/manager/attendance' || route === '/manager/tasks') return '/manager';

  if (route.startsWith('/leadership/')) return '/leadership';

  if (route.startsWith('/work/tasks/')) return '/work/tasks';
  if (route === '/work/tasks') return '/work';
  if (route === '/work/visitors' || route === '/work/gate-activity' || route === '/work/attendance' || route === '/work/profile') return '/work';

  if (route.startsWith('/visitors/')) return '/visitors';
  if (route === '/visitors') return '/services';
  if (route === '/services/raise-issue') return '/services/maintenance';
  if (route.startsWith('/services/')) return '/services';

  if (route.startsWith('/announcement/')) return '/announcements';
  if (route === '/change-password') return '/profile-settings';
  if (route === '/profile-settings' || route === '/community-hub' || route === '/my-home' || route === '/family-members') return '/profile';

  return '/home';
}

/**
 * Use the parent declared by each screen. The old implementation attempted
 * to emulate a stack across sibling Tabs routes; tab switches and role
 * redirects polluted that stack and caused most back presses to fall through
 * to Home.
 */
export function smartBack(router: AppRouter, fallback: string) {
  router.replace((fallback || getDefaultBackRoute(currentPath)) as never);
}

export function NavigationHistoryTracker() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    currentPath = pathname ?? null;
  }, [pathname]);

  // Hardware back follows the same parent-route rules as the visible back
  // button. Root tabs are left to the operating system (exit/minimize).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!currentPath || isAuthRoute(currentPath) || isRootRoute(currentPath)) return false;
      smartBack(router, getDefaultBackRoute(currentPath));
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}
