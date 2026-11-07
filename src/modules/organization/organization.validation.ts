import { z } from "zod";

export const updateOrganizationProfileSchema = z.object({
  body: z.union([
    // Single-field update format: { field: "contact", value: "09123456789" }
    z.object({
      field: z.enum(["name", "location", "bio", "email", "contact"]),
      value: z.string().min(1, "Value is required"),
    }),
    // Full/multi-field update format: { name, location, bio, email, contactNumber }
    z.object({
      name: z.string().trim().min(3, "Name must be at least 3 characters").optional(),
      bio: z.string().trim().min(10, "Bio must be at least 10 characters").optional(),
      location: z.string().trim().min(1, "Location is required").optional(),
      email: z.string().trim().email("Invalid email address").optional(),
      contactNumber: z
        .string()
        .regex(/^09\d{9}$/, "Contact number must be exactly 11 digits, numbers only, and start with 09")
        .optional(),
      contact: z
        .string()
        .regex(/^09\d{9}$/, "Contact number must be exactly 11 digits, numbers only, and start with 09")
        .optional(),
    }).refine(
      (data) => Object.keys(data).length > 0,
      { message: "At least one field must be provided." }
    ),
  ]),
});

export const changeOrganizationPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
});
