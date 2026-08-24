import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

const routeHistory: string[] = [];
const MAX_HISTORY = 40;

const isAuthRoute = (path: string) => path.includes('/login') || path.includes('/register') || path.includes('/onboarding');

export function NavigationHistoryTracker() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || isAuthRoute(pathname)) return;
    if (prevPath.current && prevPath.current !== pathname) {
      routeHistory.push(prevPath.current);
      if (routeHistory.length > MAX_HISTORY) routeHistory.shift();
    }
    prevPath.current = pathname;
  }, [pathname]);

  return null;
}

/**
 * Navigate back. Uses the native stack first. Only falls back to a
 * hard route when the stack is empty (e.g. deep-linked directly to
 * a subscreen).
 */
export function smartBack(router: AppRouter, fallback: string) {
  try {
    router.back();
  } catch {
    router.replace(fallback as never);
  }
}
