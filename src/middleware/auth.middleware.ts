// Simple auth middleware wrapper for compatibility
import { authenticateToken } from './auth';

// Export authenticateToken as requireAuth for backward compatibility
export const requireAuth = authenticateToken;