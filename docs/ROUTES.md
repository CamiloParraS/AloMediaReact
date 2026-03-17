# Routes & Navigation Guide
# AloMedia — Routes & Navigation

## Route Tree

The router is defined in `src/router.tsx` using React Router v7's `createBrowserRouter`.

```
/auth/*         → PublicRoute guard → AuthLayout
	/auth/login         → LoginPage
	/auth/register      → RegisterPage
	/auth/recover       → RecoverPage
	/auth/recover/request → RecoverRequestPage

/dashboard      → PrivateRoute guard → DashboardPage

/editor         → VideoEditor  (no guard — dev/testing route)

*               → redirect to /auth/login
```

---

## Route Guards

### PublicRoute

**Location**: `src/routes/PublicRoute.tsx`

Wraps all `/auth/*` routes. Reads `isAuthenticated` from `useAuth()`:
- If the user **is** authenticated → redirects to `/dashboard`.
- If not → renders `<Outlet />` (the requested auth page).

This prevents logged-in users from accessing the login or register pages, ensuring they always land on the dashboard.

### PrivateRoute

**Location**: `src/routes/PrivateRoute.tsx`

Wraps protected routes like `/dashboard`. Reads `isAuthenticated` from `useAuth()`:
- If the user **is not** authenticated → redirects to `/auth/login`.
- If authenticated → renders `<Outlet />`.

**Important**: Guards should wait for `isLoading` to be `false` before evaluating `isAuthenticated`. During the initial session check (`GET /auth/me` on app load), `isLoading` is `true` and `isAuthenticated` is `false` — acting on it immediately would always redirect to the login page.

---

## Auth Pages

All auth pages share the `AuthLayout` wrapper, which provides a centered dark-themed background and renders the page via `<Outlet />`.

### `/auth/login` — Login

Two-column layout: email/password form on the left, OAuth buttons (Google, GitHub) on the right. On success, calls `login(user)` in `AuthContext` and navigates to `/dashboard`.

Field-level API errors (e.g. "Email not found", "Incorrect password") are surfaced inline using `ApiError.fieldMessage()`.

Google OAuth is a redirect flow: the button links to `VITE_BASE_URL + /oauth2/authorize/google`, which is handled entirely by the backend.

### `/auth/register` — Registration

Standard email/password registration form. On success, auto-logs in and navigates to `/dashboard`.

### `/auth/recover/request` — Forgot Password

Accepts an email address and calls `POST /auth/recover/request`. The backend sends a recovery link to the email if the account exists. The response is the same regardless of whether the email is registered (to prevent user enumeration).

### `/auth/recover` — Password Reset

Accepts a token (from the email link's query string) and a new password. Calls `validateRecoverToken(token)` on mount to verify the token is still valid before showing the form. On success, calls `POST /auth/recover/reset` and redirects to `/auth/login`.

---

## Dashboard — `/dashboard`

The authenticated home screen. Displays a project gallery (currently using sample data) and quick-action cards. A "New Project" button navigates to `/editor/new`, which is not yet handled by the router (future work).

---

## Editor — `/editor`

The full video editor. Currently accessible without authentication (no `PrivateRoute` guard) for development convenience. This should be protected before production deployment.

---

## API Layer

### HTTP Client (`src/api/http.ts`)

A typed `fetch` wrapper used by all service functions:
- Base URL from `import.meta.env.VITE_BASE_URL`.
- Sends `credentials: "include"` on every request so httpOnly cookies are automatically attached.
- Sets `Content-Type: application/json` for all requests.
- On non-ok responses, parses the error body and throws an `ApiError`.
- Accepts a `parse: false` option for endpoints that return no body (e.g. logout).

### `ApiError` (`src/api/errors.ts`)

Custom error class thrown by the HTTP client:

| Field | Description |
|---|---|
| `status` | HTTP status code |
| `message` | Human-readable error summary |
| `fields` | Array of `{ field, message }` for form validation errors |

`apiError.fieldMessage("email")` — convenience method used in auth forms to display inline validation errors next to the relevant input.

### Auth Service (`src/services/authService.ts`)

Thin wrappers over `http()`:

| Function | Endpoint | Description |
|---|---|---|
| `signIn(payload)` | `POST /auth/login` | Credential login |
| `signUp(payload)` | `POST /auth/register` | New account creation |
| `me()` | `GET /auth/me` | Session restoration on app load |
| `signout()` | `POST /auth/logout` | Invalidate session + clear cookie |
| `recoverRequest(payload)` | `POST /auth/recover/request` | Send recovery email |
| `validateRecoverToken(token)` | `GET /auth/recover/validate?token=...` | Pre-validate token before showing form |
| `recoverReset(payload)` | `POST /auth/recover/reset` | Submit new password with token |

**Component**: `RecoverRequestPage.tsx`  
**Purpose**: Request password recovery email

## Private Routes (`/dashboard`)

Private routes require authentication. Unauthenticated users are redirected to `/auth/login`.

### `/dashboard`
The main user workspace. Typically displays user's projects, recent work, and options to create new projects.

**Component**: `DashboardPage.tsx`  
**Purpose**: User's project management hub

## Testing Routes (`/editor`)

The `/editor` route is not protected and is primarily used for development and testing of the video editor component in isolation.

**Component**: `VideoEditor.tsx`  
**Purpose**: Full-screen video editing interface

Note: In production, this route should be moved under `/dashboard` and properly protected, or removed entirely if only accessible through the dashboard.

## Navigation Components

### `PublicRoute` Wrapper
Located in `src/routes/PublicRoute.tsx`, this component wraps public-only routes. It checks the authentication context and redirects authenticated users to `/dashboard`.

The implementation uses React Router's outlet pattern to render child routes:
```
If user is not authenticated → render outlet (show the auth page)
If user is authenticated → show loading state, then redirect to /dashboard
```

### `PrivateRoute` Wrapper
Located in `src/routes/PrivateRoute.tsx`, this component wraps private routes. It checks authentication and redirects unauthenticated users to `/auth/login`.

The implementation:
```
If user is authenticated → render outlet (show the private page)
If not authenticated or still loading → redirect to /auth/login
```

### `AuthLayout` Wrapper
Located in `src/layouts/AuthLayout.tsx`, this provides a consistent visual layout for all auth pages. It typically includes branding, background styling, and centers the auth forms.

## Navigation Flow

### Typical User Journey

1. **User lands on app** → Default route is `/` which redirects to `/auth/login` (via fallback route)
2. **User clicks register** → Routes to `/auth/register`
3. **User completes registration** → Backend returns user data, AuthProvider's `login()` is called
4. **Redirect to dashboard** → Router automatically goes to `/dashboard`
5. **User clicks "Edit Project"** → Routes to `/editor` with project ID in URL state (if implemented)
6. **User finishes editing** → Could save project or return to dashboard
7. **User clicks logout** → AuthProvider's `logout()` is called, routes back to `/auth/login`

### Lost Password Flow

1. **User on login page** → Clicks "Forgot password?" link
2. **Route to recover request** → Goes to `/auth/recover/request`
3. **User enters email** → Backend sends recovery email
4. **User clicks email link** → Link contains token, routes to `/auth/recover?token=xyz`
5. **User sets new password** → Backend validates token and updates password
6. **Redirect to login** → User can now log in with new password

## URL Patterns

### Query Parameters
Recovery routes use query parameters for temporary tokens:
```
/auth/recover?token=abc123def456
```

The token is validated by the backend before allowing password reset.

### State-Based Navigation
For more complex data passing between routes, React Router allows state:
```javascript
navigate('/editor', { state: { projectId: 'proj123' } })
```

This allows passing data without exposing sensitive information in the URL.

## Authentication Context Integration

The routing system is tightly integrated with the `AuthProvider` context:

- **Automatic session check on app load**: AuthProvider verifies auth status via `/auth/me` endpoint on mount
- **Loading state**: While authentication is being verified, routes display loading state
- **Context-aware redirects**: PrivateRoute and PublicRoute both read from AuthContext to make routing decisions

This ensures that:
- Protected routes don't briefly flash before redirecting
- Unauthenticated users can't access private content
- The UI stays in sync with actual authentication status

## Route Configuration Best Practices

### Protected Pages
All pages under `/dashboard` and `/editor` should use the `PrivateRoute` wrapper to ensure only authenticated users can access them.

### Public Pages
All pages under `/auth` should use the `PublicRoute` wrapper to prevent already-logged-in users from seeing auth forms.

### Error Handling
The fallback route (`path: "*"`) catches any undefined routes and redirects to login. This prevents users from landing on non-existent pages.

### Route Transitions
React Router 7 handles animated route transitions through CSS or component-level logic. Consider adding page transitions for a polished feel.

## Future Route Considerations

As the application grows, consider adding:

- **Project routes**: `/dashboard/project/:projectId/edit` for opening specific projects
- **Settings routes**: `/settings` for user preferences
- **Admin routes**: `/admin` for administrative functions
- **404 page**: A custom 404 page instead of just redirecting
- **Deep linking**: Ability to share specific editor states or project links
- **Route analytics**: Track which routes users visit and how often
