import { Router } from "express";

import { AuthController } from "./auth.controller";

import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";

import {
    registerUserSchema,
    passwordLoginSchema,
    verifyPasswordOtpSchema,
    webauthnRegisterOptionsSchema,
    webauthnRegisterVerifySchema,
    webauthnLoginOptionsSchema,
    webauthnLoginVerifySchema,
    deletePasskeySchema,
    changePasswordSchema,
    updateEmailSchema,
} from "./auth.validation";

import {
    requestOtpLimiter,
    verifyOtpLimiter,
} from "../../middlewares/otp-rate-limit.middleware";

const router = Router();

// ==========================================
// 1. REGISTRATION & PASSWORD + OTP FALLBACK
// ==========================================

// Registration (Manuel & Vizconde)
router.post(
    "/register",
    validate(registerUserSchema),
    AuthController.register
);

// Password login: verify credentials and send OTP
router.post(
    "/login/password",
    requestOtpLimiter,
    validate(passwordLoginSchema),
    AuthController.requestPasswordOtp
);

// OTP verification: consume OTP and issue JWT
router.post(
    "/login/otp/verify",
    verifyOtpLimiter,
    validate(verifyPasswordOtpSchema),
    AuthController.verifyPasswordOtp
);

// ==========================================
// 2. WEBAUTHN / PASSKEY REGISTRATION & LOGIN
// ==========================================

// WebAuthn Passkey Registration Options
router.post(
    "/webauthn/register/options",
    validate(webauthnRegisterOptionsSchema),
    AuthController.generateRegistrationOptions
);

// WebAuthn Passkey Registration Verification
router.post(
    "/webauthn/register/verify",
    validate(webauthnRegisterVerifySchema),
    AuthController.verifyRegistration
);

// WebAuthn Passkey Authentication Options (Login)
router.post(
    "/webauthn/login/options",
    validate(webauthnLoginOptionsSchema),
    AuthController.generateAuthenticationOptions
);

// WebAuthn Passkey Authentication Verification (Login)
router.post(
    "/webauthn/login/verify",
    validate(webauthnLoginVerifySchema),
    AuthController.verifyAuthentication
);

// ==========================================
// 3. AUTHENTICATED PROFILE & PASSKEY MANAGEMENT
// ==========================================

// Authenticated user profile
router.get(
    "/profile",
    requireAuth,
    AuthController.getProfile
);

// List registered passkeys for current user
router.get(
    "/webauthn/passkeys",
    requireAuth,
    AuthController.listPasskeys
);

// Delete/revoke a passkey
router.delete(
    "/webauthn/passkeys/:id",
    requireAuth,
    validate(deletePasskeySchema),
    AuthController.deletePasskey
);

// Update/change password
router.patch(
    "/password",
    requireAuth,
    validate(changePasswordSchema),
    AuthController.changePassword
);

// Update user email
router.patch(
    "/email",
    requireAuth,
    validate(updateEmailSchema),
    AuthController.updateEmail
);

export default router;
