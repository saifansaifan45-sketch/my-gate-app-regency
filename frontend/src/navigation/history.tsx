import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

const routeHistory: string[] = [];

const isAuthRoute = (path: string) => path.includes('/login') || path.includes('/register') || path.includes('/onboarding');

export function NavigationHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || isAuthRoute(pathname)) return;
    const previous = routeHistory[routeHistory.length - 1];
    if (previous !== pathname) {
      routeHistory.push(pathname);
      if (routeHistory.length > 40) routeHistory.shift();
    }
  }, [pathname]);

  return null;
}

/**
 * Uses the native/router stack first. If a tab or replace transition removed
 * that stack entry, recover the last authenticated route instead of guessing Home.
 */
export function smartBack(router: AppRouter, fallback: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  const current = routeHistory[routeHistory.length - 1];
  const previous = [...routeHistory].reverse().find((path) => path !== current && !isAuthRoute(path));
  router.replace((previous || fallback) as never);
}
