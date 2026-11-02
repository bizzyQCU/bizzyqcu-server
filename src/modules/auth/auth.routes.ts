
import { Router } from "express";

import { AuthController } from "./auth.controller";

import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";

import {
    registerUserSchema,
    passwordLoginSchema,
    verifyPasswordOtpSchema,
} from "./auth.validation";

import {
    requestOtpLimiter,
    verifyOtpLimiter,
} from "../../middlewares/otp-rate-limit.middleware";

const router = Router();

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

// Authenticated user profile
router.get(
    "/profile",
    requireAuth,
    AuthController.getProfile
);

export default router;
