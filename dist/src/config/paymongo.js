import axios from "axios";
import { env } from "./env";
export const paymongoClient = axios.create({
    baseURL: "https://api.paymongo.com/v1",
    headers: {
        "Content-Type": "application/json",
        Authorization: env.PAYMONGO_SECRET_KEY
            ? `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ":").toString("base64")}`
            : "",
    },
});
