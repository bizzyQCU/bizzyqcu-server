import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
const envSchema = z.object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    FRONTEND_URL: z.string().default("http://localhost:5173"),
    // Cloudinary (Optional in dev, required for live media)
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    // PayMongo (Optional in dev)
    PAYMONGO_SECRET_KEY: z.string().optional(),
    PAYMONGO_PUBLIC_KEY: z.string().optional(),
    // WebAuthn Passkeys
    RP_NAME: z.string().default("BizzyQCU"),
    RP_ID: z.string().default("localhost"),
    ORIGIN: z.string().default("http://localhost:5173"),
});
export const env = envSchema.parse(process.env);
