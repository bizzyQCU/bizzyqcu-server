import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "./AppError";

/**
 * Sends an OTP email to the registered user.
 * In development mode, if SMTP credentials are not configured,
 * logs the OTP code directly to console for rapid local testing.
 */
export const sendOtpEmail = async (
    recipient: string,
    otp: string
): Promise<void> => {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_FROM,
    } = env;

    // Check whether SMTP credentials are configured
    if (
        !SMTP_HOST?.trim() ||
        !SMTP_PORT ||
        !SMTP_USER?.trim() ||
        !SMTP_PASS?.trim()
    ) {
        if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
            console.log("\n========================================================");
            console.log("📧 [DEV EMAIL MOCK] SMTP credentials not configured.");
            console.log(`📧 Recipient: ${recipient}`);
            console.log(`🔑 Verification OTP: ${otp}`);
            console.log("⏱️  Valid for 5 minutes.");
            console.log("========================================================\n");
            return;
        }

        throw new AppError(
            "Email service is not configured.",
            503
        );
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: SMTP_FROM?.trim() || SMTP_USER,
        to: recipient,
        subject: "BizzyQCU Login Verification Code",
        text: `Your BizzyQCU verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
        html: `
      <h2>BizzyQCU Verification</h2>
      <p>Your login verification code is:</p>
      <h1>${otp}</h1>
      <p>This code expires in 5 minutes.</p>
      <p>Do not share this code with anyone.</p>
    `,
    });
};
