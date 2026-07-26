import { Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middlewares/auth";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";
const TOKEN_EXPIRY = "15m"; // 15 minutes for access token

function generateToken(user: { id: string; email: string; fullName: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export async function register(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate request body
    const parseResult = RegisterBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
      return;
    }

    const { email, password, fullName } = parseResult.data;

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "Email is already registered" });
      return;
    }

    // Hash password
    const passwordHash = await argon2.hash(password);

    // Insert user
    const [newUser] = await db
      .insert(usersTable)
      .values({
        email,
        passwordHash,
        fullName,
      })
      .returning();

    // Generate token
    const token = generateToken(newUser);

    // Set cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        createdAt: newUser.createdAt.toISOString(),
      },
      accessToken: token,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate request body
    const parseResult = LoginBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
      return;
    }

    const { email, password } = parseResult.data;

    // Find user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Generate token
    const token = generateToken(user);

    // Set cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt.toISOString(),
      },
      accessToken: token,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.clearCookie("accessToken");
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.status(200).json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
