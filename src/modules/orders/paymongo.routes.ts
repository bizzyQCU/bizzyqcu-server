import { Router } from "express";
import express from "express";
import { handlePayMongoWebhook } from "./paymongo.controller";

const router = Router();

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handlePayMongoWebhook
);

export default router;