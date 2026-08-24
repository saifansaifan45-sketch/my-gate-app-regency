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

export function smartBack(router: AppRouter, fallback: string) {
  const current = routeHistory[routeHistory.length - 1];
  const previous = [...routeHistory].reverse().find((path) => path !== current && !isAuthRoute(path));

  if (previous) {
    routeHistory.pop();
    router.replace(previous as never);
  } else {
    router.replace(fallback as never);
  }
}
