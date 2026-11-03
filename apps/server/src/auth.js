import argon2 from "argon2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env, isProduction } from "./config.js";
import { ApiError } from "./lib/http.js";
import { UserModel, roles } from "./models/User.js";
const cookieName = "learnhub_token";
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export async function verifyPassword(hash, password) {
    if (hash?.startsWith("$argon2")) {
        return argon2.verify(hash, password);
    }
    return bcrypt.compare(password, hash);
}
export function signToken(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
}
export function setAuthCookie(res, token) {
    res.cookie(cookieName, token, {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
export function clearAuthCookie(res) {
    res.clearCookie(cookieName, {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        path: "/",
    });
}
export function requireAuth(req, _res, next) {
    let token = req.cookies?.[cookieName];
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
            token = parts[1].trim();
        }
    }
    if (!token) {
        return next(new ApiError(401, "Authentication required."));
    }
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        req.user = { id: payload.sub, role: payload.role };
        return next();
    }
    catch {
        return next(new ApiError(401, "Invalid or expired session."));
    }
}
export function requireRole(...allowedRoles) {
    return async (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new ApiError(401, "Authentication required."));
        }
        const isAdminRole = (role) => role === "admin" || role === "hub_admin";
        const roleIsAllowed = allowedRoles.includes(req.user.role)
            || (isAdminRole(req.user.role) && allowedRoles.some(isAdminRole));
        if (!roleIsAllowed) {
            return next(new ApiError(403, "You do not have permission for this action."));
        }
        const user = await UserModel.findById(req.user.id).lean();
        if (!user || user.isDeleted || user.accountStatus !== "active" || (!isAdminRole(user.role) && !user.emailVerified)) {
            return next(new ApiError(403, "Your account is not active or email is not verified. Please verify your email first."));
        }
        // Throttled activity heartbeat powering engagement/retention analytics.
        // At most one write per user per 15 minutes, never blocking the request.
        const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
        if (Date.now() - lastActive > 15 * 60 * 1000) {
            void UserModel.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => { });
        }
        return next();
    };
}
export const protect = requireAuth;
export const authorizeRoles = requireRole;
