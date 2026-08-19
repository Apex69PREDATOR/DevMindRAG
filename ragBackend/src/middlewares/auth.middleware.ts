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
  // const cookieToken = req.cookies.token; will use this if you are using cookie-parser middleware

  const authHeader = req.headers.authorization;
  const cookieToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;  //comment this line if you are using cookie-parser middleware
  
  

  if (!cookieToken) {
    res.status(401).json({ error: "Unauthorized — no token provided" });
    return;
  }
  try {
    const payload = jwt.verify(cookieToken, process.env.JWT_SECRET as string) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    console.log("authMiddleware: token verification failed", err);
    
    res.status(401).json({ error: "Unauthorized — invalid or expired token" });
  }
};