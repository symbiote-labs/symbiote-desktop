# Authentication Integration

This document describes the authentication system integrated into the symbiote-desktop application.

## Overview

The application now includes a complete authentication system that integrates with the external Symbiote Labs authentication service at `https://use.symbiotelabs.ai`.

## Components

### Core Services

#### `AuthService.ts`
- **Location**: `src/renderer/src/services/AuthService.ts`
- **Purpose**: Handles all API communication with the external auth service
- **Features**:
  - CSRF token management
  - Bearer token storage in localStorage
  - Login, register, logout, and user status checking
  - Automatic token refresh and validation

#### `AuthProvider.tsx`
- **Location**: `src/renderer/src/context/AuthProvider.tsx`
- **Purpose**: React context provider for authentication state
- **Features**:
  - Global authentication state management
  - Auto-checking authentication status on app load
  - Login/logout methods available throughout the app

### UI Components

#### `SymbioteUserPopup.tsx`
- **Location**: `src/renderer/src/components/Popups/SymbioteUserPopup.tsx`
- **Purpose**: Main authentication popup that replaces the original UserPopup
- **Features**:
  - Login and registration forms
  - User profile display when authenticated
  - Logout functionality
  - Seamless switching between login/register modes

#### `Login.tsx` & `Register.tsx`
- **Location**: `src/renderer/src/components/auth/`
- **Purpose**: Form components for user authentication
- **Features**:
  - Form validation
  - Error handling
  - Loading states
  - Password confirmation for registration

#### `ProtectedRoute.tsx`
- **Location**: `src/renderer/src/components/auth/ProtectedRoute.tsx`
- **Purpose**: Route wrapper that requires authentication
- **Features**:
  - Automatically shows login popup for unauthenticated users
  - Loading states during authentication checks
  - Protects sensitive application areas

#### `AuthStatus.tsx`
- **Location**: `src/renderer/src/components/auth/AuthStatus.tsx`
- **Purpose**: Display component showing current authentication status
- **Features**:
  - Visual authentication status indicator
  - User information display
  - Quick logout functionality

## Integration Points

### App.tsx
- Added `AuthProvider` to the provider chain
- Wrapped settings route with `ProtectedRoute` to protect sensitive configurations

### Sidebar.tsx
- Replaced `UserPopup` with `SymbioteUserPopup` for authentication flow
- Clicking the user avatar now opens the authentication popup

### GeneralSettings.tsx
- Added `AuthStatus` component to show current authentication state
- Users can see their login status and user information

## Authentication Flow

1. **Unauthenticated User**:
   - Clicks user avatar in sidebar
   - `SymbioteUserPopup` opens with login form
   - User enters credentials
   - `AuthService` handles login API call with CSRF protection
   - Bearer token stored in localStorage
   - User state updated throughout app

2. **Authenticated User**:
   - User information displayed in popup
   - Settings and other protected routes accessible
   - Token validation happens on app startup

3. **Protected Routes**:
   - Routes wrapped with `ProtectedRoute` check authentication
   - If not authenticated, login popup automatically appears
   - User can't access protected content until authenticated

## API Integration

The system integrates with the external Symbiote Labs API:

- **Base URL**: `https://use.symbiotelabs.ai`
- **Endpoints**:
  - `GET /login` - Get CSRF token
  - `POST /api/login` - Authenticate user
  - `POST /api/register` - Register new user
  - `GET /api/user/status` - Check authentication status
  - `POST /api/logout` - Logout user

## Security Features

- **CSRF Protection**: All state-changing requests include CSRF tokens
- **Bearer Token Authentication**: Secure token-based authentication
- **Credential Storage**: Secure localStorage management
- **Session Validation**: Server-side session verification
- **Error Handling**: Comprehensive error handling and user feedback

## Usage

### For Users
1. Click your avatar in the sidebar to access authentication
2. Register for a new account or login with existing credentials
3. Access to settings and other protected features requires authentication
4. Logout anytime via the user popup or auth status component

### For Developers
1. Wrap sensitive routes with `<ProtectedRoute>`
2. Use `useAuth()` hook to access authentication state
3. Check `isAuthenticated` before showing sensitive content
4. Use `user` object to display user-specific information

## Configuration

No additional configuration required. The system automatically:
- Checks authentication status on app startup
- Manages token storage and validation
- Handles CSRF token rotation
- Provides loading states during authentication checks

## Future Enhancements

Potential improvements could include:
- Remember me functionality with extended token lifetime
- Multi-factor authentication support
- Role-based access control for different app features
- Offline authentication caching
- Password reset functionality 