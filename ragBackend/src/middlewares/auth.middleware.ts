import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId:      string;
  email:       string;
  accessToken: string; // GitHub OAuth token
}

// Extend Express Request type
// declare global {
//   namespace Express {
//     interface Request {
//       user?: AuthPayload;
//     }
//   }
// }

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized — no token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized — invalid or expired token" });
  }
};