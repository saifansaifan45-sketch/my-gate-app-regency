import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/** The current pathname and full route history stack are tracked in memory. */
let currentPath: string | null = null;
const routeHistory: string[] = [];

const isAuthRoute = (path: string) =>
  path.includes('/login') ||
  path.includes('/register') ||
  path.includes('/onboarding') ||
  path.includes('/forgot-password') ||
  path.includes('/reset-password');

/** Group segments (/(app), /(auth)) and trailing slashes are removed for clean matching. */
export function normalizeRoute(path: string | undefined | null): string {
  if (!path) return '';
  return path.replace(/\/\((?:[^)]*)\)/g, '').replace(/\/+$/, '') || '/';
}

const ROOT_ROUTES = new Set([
  '/',
  '/home',
  '/community',
  '/services',
  '/profile',
  '/manager',
  '/leadership',
  '/work',
  '/login',
  '/(auth)/login',
]);

export function isRootRoute(path: string | null): boolean {
  return ROOT_ROUTES.has(normalizeRoute(path));
}

/**
 * Exhaustive Parent Route Resolver for deep-links, direct URLs, or empty navigation stacks.
 */
export function getDefaultBackRoute(path: string | null): string {
  const route = normalizeRoute(path);

  // --- Manager Portal Subscreens ---
  if (route.startsWith('/manager/tickets/assign')) return '/manager/tickets';
  if (route.startsWith('/manager/tickets/')) return '/manager/tickets';
  if (route === '/manager/tickets') return '/manager';
  if (route.startsWith('/manager/personnel/')) return '/manager/personnel';
  if (route === '/manager/personnel') return '/manager';
  if (route.startsWith('/manager/visitors/audit/')) return '/manager/visitors';
  if (route === '/manager/visitors') return '/manager';
  if (
    route === '/manager/approvals' ||
    route === '/manager/attendance' ||
    route === '/manager/tasks'
  )
    return '/manager';

  // --- Leadership Portal Subscreens ---
  if (
    route === '/leadership/tickets' ||
    route === '/leadership/approvals' ||
    route === '/leadership/create-announcement' ||
    route.startsWith('/leadership/')
  )
    return '/leadership';

  // --- Workforce / Guard Portal Subscreens ---
  if (route.startsWith('/work/tasks/history')) return '/work/tasks';
  if (route.startsWith('/work/tasks/')) return '/work/tasks';
  if (route === '/work/tasks') return '/work';
  if (route === '/work/gate-activity') return '/work/visitors';
  if (
    route === '/work/visitors' ||
    route === '/work/attendance' ||
    route === '/work/profile'
  )
    return '/work';

  // --- Resident Services & Visitors Subscreens ---
  if (route.startsWith('/visitors/')) return '/visitors';
  if (route === '/visitors') return '/services';
  if (route === '/services/raise-issue') return '/services/maintenance';
  if (
    route === '/services/maintenance' ||
    route === '/services/staff-attendance' ||
    route.startsWith('/services/')
  )
    return '/services';

  // --- Community & Notices Subscreens ---
  if (route.startsWith('/announcement/')) return '/announcements';
  if (route === '/announcements') return '/community';
  if (route === '/calendar') return '/community';

  // --- Profile & Household Subscreens ---
  if (route === '/change-password') return '/profile-settings';
  if (route === '/community-hub') return '/profile-settings';
  if (
    route === '/profile-settings' ||
    route === '/family-members' ||
    route === '/my-home' ||
    route === '/residency-requests'
  )
    return '/profile';

  // --- Utilities & Direct Overlays ---
  if (route === '/chat') return '/home';
  if (route === '/notifications') return '/home';
  if (route === '/help-desk') return '/home';
  if (route === '/quick-actions') return '/home';
  if (route === '/activity-log' || route === '/activity-overview') return '/home';

  // --- Auth Subscreens ---
  if (
    route === '/register' ||
    route === '/forgot-password' ||
    route === '/reset-password' ||
    route.startsWith('/onboarding')
  )
    return '/(auth)/login';

  return '/home';
}

/**
 * Context-Aware Smart Navigation:
 * 1. Checks if the navigation stack has a recorded previous route.
 *    If yes, pops the active route and returns to the prior screen.
 * 2. If the stack is empty (e.g., deep-link, direct URL, page reload), routes gracefully
 *    to the specified `fallback` or hierarchical `getDefaultBackRoute(currentPath)`.
 */
export function smartBack(router: AppRouter, fallback?: string) {
  const current = normalizeRoute(currentPath);

  // Pop current route from the history stack if top matches
  if (routeHistory.length > 0 && normalizeRoute(routeHistory[routeHistory.length - 1]) === current) {
    routeHistory.pop();
  }

  // If there is a previous route in history, navigate to it
  if (routeHistory.length > 0) {
    const prev = routeHistory.pop()!;
    let target = normalizeRoute(prev);
    if (target.endsWith('/index')) {
      target = target.replace(/\/index$/, '') || '/';
    }
    router.replace(target as never);
    return;
  }

  // Fallback to logical parent hierarchy
  let target = fallback ? normalizeRoute(fallback) : getDefaultBackRoute(current);
  if (target.endsWith('/index')) {
    target = target.replace(/\/index$/, '') || '/';
  }

  router.replace(target as never);
}

export function NavigationHistoryTracker() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const clean = normalizeRoute(pathname);
    if (!clean) return;

    currentPath = clean;

    // Record route transition into the history stack (avoiding duplicate consecutive entries)
    if (routeHistory.length === 0 || routeHistory[routeHistory.length - 1] !== clean) {
      routeHistory.push(clean);
      if (routeHistory.length > 40) {
        routeHistory.shift();
      }
    }
  }, [pathname]);

  // Hardware back follows the same history-aware rules:
  // - If at a root tab or auth root, allow default OS behavior (exit/minimize).
  // - Otherwise, execute smartBack to pop or route to parent.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!currentPath || isAuthRoute(currentPath) || isRootRoute(currentPath)) {
        return false;
      }
      smartBack(router, getDefaultBackRoute(currentPath));
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}
