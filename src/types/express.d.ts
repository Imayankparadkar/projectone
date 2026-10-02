// Extend Express Request to carry our custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: string;
      userRole?: string;
    }
  }
}

export {};
