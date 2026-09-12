# Design System — V0.0.1 Production

> **Tokens are code** (`frontend/src/theme.ts:109`), not just Markdown. Reference images guide intent, `theme.ts` is truth.

## Hierarchy

Reference → `theme.ts` → `src/components/ui/*` → screens. When reference and code conflict, preserve reference intent via `theme.ts` tokens, never one-off values.

## Brand — Prestige Elysian

Premium, secure, warm, structured. `Login` clean + illustration, `Resident` dense but legible dashboard (QuickActions radial `QuickActionsRadial:92` centered on FAB, `GateStatusCard`, `CommunityUpdates`).

## Tokens (V0.0.1)

```ts
// theme.ts:109
colors: {
  primary: '#143D2A', primaryDeep: '#1B4D36', onPrimary: '#FFFFFF',
  background: '#F4F6F1', surface: '#FCFDF9', surfaceMuted: '#E9EEE7', border: '#E2E9E2',
  textPrimary: '#17221C', textSecondary: '#506057', textTertiary: '#718078',
  accent: '#B06A3C', community: '#3E5E4C',
  status: { success: '#256B43', warning: '#875200', danger: '#B42318' }
}
spacing: { xs:3, s:6, m:12, l:20, xl:28 }
radii: { s:6, m:10, l:14, xl:18, pill:100 }
typography: PlusJakartaSans_400/500/600/700 — no serif, heading -0.5, body 14/21
shadows: card shadowBox('#1B4D36',0,4,0.06,12,2)
```

- **Background** `F4F6F1` warm off-white, not `#FFFFFF`.
- **Buttons** pill `radius 100` (`Button.tsx:100`), `primary` `#143D2A` + shadow, `secondary` `surfaceMuted`.
- **Cards** `16-24` radius, `surface` + `border` + `shadows.card`.

## Components (V0.0.1)

- `Button` (`label` not `title`, `variant primary/secondary/outline/danger`, `size sm/md/lg`, `PremiumPressable` scale `0.97`, `haptic light`).
- `QuickActionsRadial:92` (centered, `theme.surface`, `haptic`), `Card`, `AppHeader`, `SkeletonCard`, `CenterModal`, `BottomSheet`, `GateVisitorCard`, `CommunityUpdates`, `AppHeader`.
- All use `theme` + `StyleSheet`, no `NativeWind` — one styling system.

## Navigation

- `Expo Router` file-based: `(auth)` linear, `(app)` tabs `Home/Community/Services/Profile` + `Manager`/`Leadership`/`Work` stacks, `history.tsx:174` state-aware `normalizeRoute`/`getDefaultBackRoute` (handles `manager/tickets/assign`, `work/tasks/history`, `announcement/:id` deep links).
- `QuickActions` radial FAB, `BackHandler` Android hardware → parent route.

## States

- **Loading:** `Skeleton` shimmer, `ActivityIndicator`.
- **Empty:** `EmptyState` illustration + CTA (`No visitors yet. Add.` / `No messages yet.`).
- **Error:** `Toast` + `FormError` inline retry, `ErrorBoundary`.
- **Disabled:** `opacity 0.6`.
- **Permission:** `ResidenceGuardBanner` + `RoleSelector` (`403`).

## Motion

`AnimatedEntrance` `200ms Easing.out`, `QuickActionsRadial` spring `friction 8`, `TypingIndicator` staggered `280ms` wave.

## A11y & Responsive

- `FlatList` virtualized, `KeyboardAvoidingView`, `Dynamic Type` scaling, `44x44pt` hit, `accessibilityLabel` on FAB, `WCAG AA` contrast (`textPrimary #17221C` on `surface #FCFDF9`).

## V0.0.1 Gate

```bash
npm run typecheck # 0 — theme + Button label + surface
```

No second styling system, no hardcoded `#FFFFFF` backgrounds, no serif.
