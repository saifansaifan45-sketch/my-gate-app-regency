# Frontend — V0.0.1 Production Architecture

> **Stack:** Expo SDK 57 + React Native 0.86 + Expo Router + TypeScript + TanStack Query + SecureStore. `frontend tsc 0`, `app/(app)/chat` header auth.

## Navigation (state-aware)

- **Expo Router file-based:** `app/(auth)` (login/register/onboarding, no tab), `app/(app)` (resident/manager/work/leadership, bottom tabs), `app/(app)/chat` (header auth via `src/api/chat.ts`).
- **History:** `src/navigation/history.tsx:174` `normalizeRoute` + `isRootRoute` + `getDefaultBackRoute` exhaustive — handles `manager/tickets/assign`, `work/tasks/history`, `announcement/:id` deep links, `BackHandler` Android hardware back → parent route. Ported from `fix/navigation-routing@aaef469`.
- **Structure:** `app/(app)/_layout.tsx:12` bottom tabs, `modals` for `AddVisitor`/`Raise Issue`.

## State

- **Local/UI:** `useState`/`useReducer`, `useResponsive` hook.
- **Server:** `TanStack Query` `useQuery` for `chat/channels`, `visitors/gate`, `household` — `staleTime` + `retry` + `FlatList` virtualized.
- **Auth:** `src/store/auth.tsx` `React Context` + `expo-secure-store` `JWT` `accessToken`/`refreshToken`, `api/client.ts:85` `Authorization: Bearer` interceptor with `tokenVersion` refresh, `401` → logout.

## API Client (header, never ?token=)

- `src/api/client.ts:85` `api` Axios instance — `Authorization: Bearer ${token}` header, `refresh` queue.
- `src/api/chat.ts:22` `chatApi.getChannels()` → `GET /chat/channels`, `getMessages(channelId)` → `GET /chat/channels/:channelId/messages`, `sendMessage(channelId, content)` → `POST` — all header auth, `canUserAccessChannel` checks `ACTIVE`/`APPROVED`, `PAUSED/REVOKED` → `404`.
- `src/services/chatSocket.ts:3` stub for V0.0.1 — no `?token=` query, uses `api` header; real WS would use `Sec-WebSocket-Protocol` Bearer.

## Design System (strict)

- **Tokens:** `src/theme.ts:109` `colors` (`primary #143D2A`, `surface #FCFDF9`, `border #E2E9E2`), `spacing`, `radii`, `typography` `PlusJakartaSans_400/500/600/700` — no hardcoded values, no serif.
- **Components:** `src/components/ui/*` `Button` (`label` not `title`, `variant primary/secondary`), `Card`, `PremiumPressable`, `Skeleton`, `QuickActionsRadial:92` centering (port from `fix/ui-layout-polish@8c24f6e` superset), `CommunityUpdates`, `GateStatusCard`.
- **Styling:** `StyleSheet` + `theme` + `shadowBox`, `NativeWind` not used — keep `StyleSheet` bound to tokens.

## Chat Frontend (V0.0.1)

- `app/(app)/chat/index.tsx:82` — `useQuery` channels, `FlatList` messages, `TextInput` + `Button label="Send"` (header auth via `chatApi`), `AppHeader`, `theme.surface` bubbles — **no** `TypingIndicator` WS, REST polling via `invalidateQueries`.

## Module Boundaries

- `app/*` thin routes → `src/features/*` domain components (`visitors`, `household`, `chat`, `manager`).
- `src/api/*` per domain (`auth.ts`, `visitors.ts`, `household.ts`, `chat.ts`), `src/hooks/*`, `src/store/*`.

## Handling

- **Loading:** `SkeletonCard` shimmer, `ActivityIndicator`.
- **Empty:** `EmptyState` `No visitors scheduled` / `No messages yet`.
- **Error:** `ErrorBoundary` + `FormError` inline retry, `Toast`.
- **Permission:** `403` → `ResidenceGuardBanner` + `RoleSelector`.

## Responsive & A11y

- Mobile-first, `FlatList`, `KeyboardAvoidingView`, `Dynamic Type` scaling, `accessibilityLabel` on `QuickActionsRadial` FAB.

## V0.0.1 Gate

```bash
npm run typecheck # 0
```
`app/(app)/chat` header auth, `history.tsx:174` exhaustive, UI superset `QuickActionsRadial` centering preserved.
