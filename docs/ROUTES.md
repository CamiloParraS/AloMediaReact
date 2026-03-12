# Routes & Navigation Guide

## Route Structure

AloMedia uses React Router 7 to manage navigation between different application sections. The router is composed of three main route groups, each with its own protection level and purpose.

## Route Hierarchy

```
/auth (Public-only routes)
├── login
├── register
├── recover
└── recover/request

/dashboard (Private routes)
└── dashboard

/editor (Testing/Direct access)
└── editor

/* (Fallback)
└── redirect to /auth/login
```

## Public Routes (`/auth`)

Public routes are accessible only to **unauthenticated users**. If a logged-in user tries to access these routes, they are automatically redirected to the dashboard.

### `/auth/login`
The primary authentication entry point. Users enter their credentials (email and password) and submit the form. On successful authentication, the token is stored in an httpOnly cookie and the user is redirected to the dashboard.

**Component**: `LoginPage.tsx`  
**Purpose**: User login form with email and password fields

### `/auth/register`
Allows new users to create an account. The registration form typically collects email, password, and password confirmation. Backend validation ensures data integrity.

**Component**: `RegisterPage.tsx`  
**Purpose**: New user account creation

### `/auth/recover`
Allows users to set a new password if they know their recovery token (typically sent via email). This is part of the password recovery flow where the user received a recovery link and was redirected here with the token in the URL.

**Component**: `RecoverPage.tsx`  
**Purpose**: Password reset with a valid recovery token

### `/auth/recover/request`
Allows users to request a password recovery email. Users enter their email address, and the backend sends them a recovery link if the account exists.

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
