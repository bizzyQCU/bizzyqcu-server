
import { sendOtpEmail } from "./src/utils/email";

const recipient = process.argv[2];

if (!recipient) {
    console.error("Please provide a recipient email address.");
    process.exit(1);
}

try {
    await sendOtpEmail(recipient, "123456");

    console.log("Test email sent successfully!");
} catch (error) {
    console.error("Email sending failed:");

    console.error(
        error instanceof Error ? error.message : error
    );

    process.exitCode = 1;
}
