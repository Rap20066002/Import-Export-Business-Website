import jwt from "jsonwebtoken";

export type Role = "SUPER_ADMIN" | "SALES_MANAGER" | "LOGISTICS_MANAGER" | "BUYER";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function generateToken(payload: AuthUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(roles?: Role[]) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || typeof decoded !== "object") {
        return res.status(401).json({ error: "Invalid token" });
      }

      const maybe = decoded as Record<string, unknown>;
      const user: AuthUser = {
        id: String(maybe.id ?? ""),
        role: (maybe.role as Role) ?? "BUYER",
        email: String(maybe.email ?? ""),
      };

      if (!user.id || !user.email) {
        return res.status(401).json({ error: "Invalid token" });
      }

      if (roles && !roles.includes(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      req.user = user;
      return next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

