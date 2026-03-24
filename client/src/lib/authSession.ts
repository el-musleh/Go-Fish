export interface SessionUser {
  email?: string;
}

export interface AuthSessionLike {
  user?: SessionUser;
}

export function getSessionEmailForSync(
  event: string,
  session: AuthSessionLike | null,
  currentUserId: string | null
): string | null {
  if (currentUserId) {
    return null;
  }

  if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') {
    return null;
  }

  const email = session?.user?.email?.trim();
  return email ? email : null;
}

export function getPostAuthDestination(currentPath: string, isNew: boolean): string | null {
  if (!isNew) {
    return null;
  }

  const resolvedPath = currentPath || '/dashboard';
  return `/benchmark?returnTo=${encodeURIComponent(resolvedPath)}`;
}

export function shouldBlockDuringAuthBootstrap(pathname: string, isBootstrapping: boolean): boolean {
  if (!isBootstrapping) {
    return false;
  }

  return pathname !== '/';
}
