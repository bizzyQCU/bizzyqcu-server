import { Router } from "express";

import { AuthController } from "./auth.controller";

import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { isAdmin } from "../../middlewares/rbac.middleware";

import {
    registerUserSchema,
    registerSellerSchema,
    resubmitUserVerificationSchema,
    resubmitSellerVerificationSchema,
    checkAccountStatusSchema,
    deviceIdSchema,
    updateDeviceSchema,
    adminListUsersStatusQuerySchema,
    adminUpdateUserStatusSchema,
    passwordLoginSchema,
    verifyPasswordOtpSchema,
    webauthnRegisterOptionsSchema,
    webauthnRegisterVerifySchema,
    webauthnLoginOptionsSchema,
    webauthnLoginVerifySchema,
    deletePasskeySchema,
} from "./auth.validation";

import {
    requestOtpLimiter,
    verifyOtpLimiter,
} from "../../middlewares/otp-rate-limit.middleware";

const router = Router();

// ==========================================
// 1. REGISTRATION & SELLER APPLICATIONS (Manuel)
// ==========================================

// User registration (Captures QCU ID details, live selfie, and optional seller endorsement documents)
router.post(
    "/register",
    validate(registerUserSchema),
    AuthController.register
);

// Apply for seller verification (For existing users with endorsement documents)
router.post(
    "/seller-application",
    requireAuth,
    validate(registerSellerSchema),
    AuthController.applyForSeller
);

router.post(
    "/seller/register",
    requireAuth,
    validate(registerSellerSchema),
    AuthController.applyForSeller
);

// ==========================================
// 2. ACCOUNT STATUS TRACKING CRUD (Manuel)
// ==========================================

// Authenticated user checks account and seller verification status
router.get(
    "/account-status",
    requireAuth,
    AuthController.getAccountStatus
);

router.get(
    "/status",
    requireAuth,
    AuthController.getAccountStatus
);

// Public / pre-login status check by QCU ID or email
router.post(
    "/check-status",
    validate(checkAccountStatusSchema),
    AuthController.checkPublicAccountStatus
);

// Resubmit user verification documents after rejection
router.post(
    "/resubmit-verification",
    requireAuth,
    validate(resubmitUserVerificationSchema),
    AuthController.resubmitUserVerification
);

// Resubmit seller endorsement documents after rejection
router.post(
    "/seller/resubmit",
    requireAuth,
    validate(resubmitSellerVerificationSchema),
    AuthController.resubmitSellerVerification
);

// Admin: List users by verification status (PENDING, VERIFIED, REJECTED)
router.get(
    "/admin/users/status",
    requireAuth,
    isAdmin,
    validate(adminListUsersStatusQuerySchema),
    AuthController.adminListUsersStatus
);

// Admin: Update user verification status
router.patch(
    "/admin/users/:id/status",
    requireAuth,
    isAdmin,
    validate(adminUpdateUserStatusSchema),
    AuthController.adminUpdateUserStatus
);

// ==========================================
// 3. REGISTERED DEVICE MANAGEMENT CRUD (Manuel)
// ==========================================

// List all registered devices / passkeys
router.get(
    "/devices",
    requireAuth,
    AuthController.listDevices
);

// Get single registered device detail
router.get(
    "/devices/:id",
    requireAuth,
    validate(deviceIdSchema),
    AuthController.getDevice
);

// Update / rename registered device nickname
router.patch(
    "/devices/:id",
    requireAuth,
    validate(updateDeviceSchema),
    AuthController.updateDevice
);

// Revoke / delete registered device
router.delete(
    "/devices/:id",
    requireAuth,
    validate(deviceIdSchema),
    AuthController.deleteDevice
);

// ==========================================
// 4. PASSWORD + OTP FALLBACK (Vizconde)
// ==========================================

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
// 5. WEBAUTHN / PASSKEY REGISTRATION & LOGIN
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
// 6. AUTHENTICATED PROFILE & BACKWARD COMPAT PASSKEYS
// ==========================================

// Authenticated user profile
router.get(
    "/profile",
    requireAuth,
    AuthController.getProfile
);

// List registered passkeys for current user (compatibility alias)
router.get(
    "/webauthn/passkeys",
    requireAuth,
    AuthController.listPasskeys
);

// Delete/revoke a passkey (compatibility alias)
router.delete(
    "/webauthn/passkeys/:id",
    requireAuth,
    validate(deletePasskeySchema),
    AuthController.deletePasskey
);

export default router;
