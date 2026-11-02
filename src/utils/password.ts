
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Converts a plain-text password into a secure hash.
 */
export const hashPassword = async (
    password: string
): Promise<string> => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares a submitted password with its stored hash.
 */
export const comparePassword = async (
    password: string,
    passwordHash: string
): Promise<boolean> => {
    return bcrypt.compare(password, passwordHash);
};
