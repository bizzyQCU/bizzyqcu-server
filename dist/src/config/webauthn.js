import { env } from "./env";
export const webAuthnConfig = {
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    origin: env.ORIGIN,
};
