import { Router } from "express";

import { AuthController } from "./auth.controller";

import { validate } from "../../middlewares/validate.middleware";
import { optionalAuth, requireAuth } from "../../middlewares/auth.middleware";
import { verificationUpload } from "../../middlewares/upload.middleware";

import {
    requestRegistrationOtpSchema,
    verifyRegistrationOtpSchema,
    registerUserSchema,
    registerSellerSchema,
    resubmitUserVerificationSchema,
    resubmitSellerVerificationSchema,
    verificationUploadSchema,
    deviceIdSchema,
    updateDeviceSchema,
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
    verificationUploadLimiter,
    webauthnLimiter,
} from "../../middlewares/otp-rate-limit.middleware";

const router = Router();

// ==========================================
// 1. REGISTRATION & SELLER APPLICATIONS (Manuel & Vizconde)
// ==========================================

// Public so pre-signup ID/selfie uploads work; rate/size/type/magic-byte checked and stored as authenticated assets.
router.post(
    "/uploads/verification",
    verificationUploadLimiter,
    verificationUpload.single("file"),
    validate(verificationUploadSchema),
    AuthController.uploadVerificationDocument
);

router.post(
    "/register/otp/request",
    requestOtpLimiter,
    validate(requestRegistrationOtpSchema),
    AuthController.requestRegistrationOtp
);

router.post(
    "/register/otp/verify",
    verifyOtpLimiter,
    validate(verifyRegistrationOtpSchema),
    AuthController.verifyRegistrationOtp
);

router.post(
    "/register",
    validate(registerUserSchema),
    AuthController.register
);

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

router.post(
    "/resubmit-verification",
    requireAuth,
    validate(resubmitUserVerificationSchema),
    AuthController.resubmitUserVerification
);

router.post(
    "/seller/resubmit",
    requireAuth,
    validate(resubmitSellerVerificationSchema),
    AuthController.resubmitSellerVerification
);

// ==========================================
// 3. REGISTERED DEVICE MANAGEMENT CRUD (Manuel)
// ==========================================

router.get(
    "/devices",
    requireAuth,
    AuthController.listDevices
);

router.get(
    "/devices/:id",
    requireAuth,
    validate(deviceIdSchema),
    AuthController.getDevice
);

router.patch(
    "/devices/:id",
    requireAuth,
    validate(updateDeviceSchema),
    AuthController.updateDevice
);

router.delete(
    "/devices/:id",
    requireAuth,
    validate(deviceIdSchema),
    AuthController.deleteDevice
);

// ==========================================
// 4. PASSWORD + OTP FALLBACK (Vizconde)
// ==========================================

router.post(
    "/login/password",
    requestOtpLimiter,
    validate(passwordLoginSchema),
    AuthController.requestPasswordOtp
);

router.post(
    "/login/otp/verify",
    verifyOtpLimiter,
    validate(verifyPasswordOtpSchema),
    AuthController.verifyPasswordOtp
);

// ==========================================
// 5. WEBAUTHN / PASSKEY REGISTRATION & LOGIN
// ==========================================

router.post(
    "/webauthn/register/options",
    webauthnLimiter,
    optionalAuth,
    validate(webauthnRegisterOptionsSchema),
    AuthController.generateRegistrationOptions
);

router.post(
    "/webauthn/register/verify",
    webauthnLimiter,
    optionalAuth,
    validate(webauthnRegisterVerifySchema),
    AuthController.verifyRegistration
);

router.post(
    "/webauthn/login/options",
    webauthnLimiter,
    validate(webauthnLoginOptionsSchema),
    AuthController.generateAuthenticationOptions
);

router.post(
    "/webauthn/login/verify",
    webauthnLimiter,
    validate(webauthnLoginVerifySchema),
    AuthController.verifyAuthentication
);

// ==========================================
// 6. AUTHENTICATED PROFILE, SETTINGS & PASSKEY COMPATIBILITY
// ==========================================

router.get(
    "/profile",
    requireAuth,
    AuthController.getProfile
);

router.get(
    "/webauthn/passkeys",
    requireAuth,
    AuthController.listPasskeys
);

router.delete(
    "/webauthn/passkeys/:id",
    requireAuth,
    validate(deletePasskeySchema),
    AuthController.deletePasskey
);

router.patch(
    "/password",
    requireAuth,
    validate(changePasswordSchema),
    AuthController.changePassword
);

router.patch(
    "/email",
    requireAuth,
    validate(updateEmailSchema),
    AuthController.updateEmail
);

export default router;
