
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Generates an access token for an authenticated user.
 * The user's database ID is stored in the JWT subject.
 * Token expiration: 1 hour.
 */

export const generateAccessToken = (userId: string): string => {
    const options: SignOptions = {
        subject: userId,
        expiresIn: "1h",
    };

    return jwt.sign({}, env.JWT_SECRET, options);
};
