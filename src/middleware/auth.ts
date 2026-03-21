import { Request, Response, NextFunction } from 'express';

/**
 * Stub auth middleware — assumes a valid user ID is present.
 * In production, this would verify a session/token and set req.userId.
 * For now, it reads from the `x-user-id` header.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
    return;
  }
  (req as any).userId = userId;
  next();
}
