import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "./AppError";

export type OtpEmailPurpose = "login" | "registration";

const OTP_EMAIL_COPY: Record<
    OtpEmailPurpose,
    { label: string; subject: string; heading: string; intro: string }
> = {
    login: {
        label: "Login verification",
        subject: "BizzyQCU Login Verification Code",
        heading: "BizzyQCU Verification",
        intro: "Your login verification code is:",
    },
    registration: {
        label: "Registration email verification",
        subject: "BizzyQCU Registration Verification Code",
        heading: "BizzyQCU Email Verification",
        intro: "Use this code to verify your email and complete your BizzyQCU registration:",
    },
};

/**
 * Sends a 6-digit OTP email for login or registration.
 * In development mode, if SMTP credentials are not configured,
 * logs the OTP code directly to console for rapid local testing.
 */
export const sendOtpEmail = async (
    recipient: string,
    otp: string,
    purpose: OtpEmailPurpose = "login"
): Promise<void> => {
    const copy = OTP_EMAIL_COPY[purpose];
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
            console.log(`📧 Purpose: ${copy.label}`);
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
        subject: copy.subject,
        text: `Your BizzyQCU verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
        html: `
      <h2>${copy.heading}</h2>
      <p>${copy.intro}</p>
      <h1>${otp}</h1>
      <p>This code expires in 5 minutes.</p>
      <p>Do not share this code with anyone.</p>
    `,
    });
};
