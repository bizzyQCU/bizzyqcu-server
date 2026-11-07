import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { hashPassword, comparePassword } from "../../utils/password";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms

export class OrganizationService {
  /**
   * Helper to verify if 7 days have passed since the last change for a field.
   * Throws 403 Forbidden if still in cooldown.
   */
  private static checkCooldown(lastChange: Date | null | undefined, fieldName: string) {
    if (!lastChange) return;
    const elapsed = Date.now() - new Date(lastChange).getTime();
    if (elapsed < SEVEN_DAYS_MS) {
      throw new AppError(`You can only change this ${fieldName} once every 7 days.`, 403);
    }
  }

  /**
   * Helper to generate a unique URL slug for store names.
   */
  private static async generateUniqueSlug(name: string, excludeId?: string) {
    const baseSlug =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "store";

    let slug = baseSlug;
    let counter = 2;

    while (
      await prisma.store.findFirst({
        where: {
          slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Get organization profile and current cooldown timestamps.
   */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: {
          include: { store: true },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const store = user.sellerProfile?.store;

    return {
      id: user.id,
      email: user.email,
      contactNumber: user.contactNumber || store?.contactNumber || null,
      name: store?.name || user.fullName,
      location: store?.pickupLocation || null,
      bio: store?.description || null,
      logoUrl: store?.logoUrl || null,
      cooldowns: {
        email: user.lastEmailChange,
        contact: user.lastContactChange || store?.lastContactChange,
        password: user.lastPasswordChange,
        name: store?.lastNameChange,
        location: store?.lastLocationChange,
        bio: store?.lastBioChange,
      },
    };
  }

  /**
   * Update organization profile with 7-day cooldown and validation checks.
   * Supports both:
   * 1. Single-field update: { field: "contact", value: "09123456789" }
   * 2. Full object update: { name, location, bio, email, contactNumber }
   */
  static async updateProfile(userId: string, body: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: {
          include: { store: true },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    let store = user.sellerProfile?.store;

    // Handle single field payload: { field, value }
    if (body.field) {
      const field = String(body.field).toLowerCase().trim();
      const value = typeof body.value === "string" ? body.value.trim() : body.value;

      switch (field) {
        case "contact": {
          // Validation: digits only, starts with 09, exactly 11 digits
          if (!value || typeof value !== "string" || !/^09\d{9}$/.test(value)) {
            throw new AppError(
              "Contact number must be exactly 11 digits, numbers only, and start with 09.",
              400
            );
          }

          // 7-day cooldown check
          this.checkCooldown(user.lastContactChange, "contact");

          const now = new Date();
          await prisma.user.update({
            where: { id: userId },
            data: {
              contactNumber: value,
              lastContactChange: now,
            },
          });

          if (store) {
            await prisma.store.update({
              where: { id: store.id },
              data: {
                contactNumber: value,
                lastContactChange: now,
              },
            });
          }

          return {
            message: "Contact number updated successfully.",
            field: "contact",
            value,
          };
        }

        case "email": {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!value || !emailRegex.test(value)) {
            throw new AppError("A valid email address is required.", 400);
          }

          // 7-day cooldown check
          this.checkCooldown(user.lastEmailChange, "email");

          const existing = await prisma.user.findFirst({
            where: { email: value, NOT: { id: userId } },
            select: { id: true },
          });

          if (existing) {
            throw new AppError("This email address is already in use.", 409);
          }

          await prisma.user.update({
            where: { id: userId },
            data: {
              email: value,
              lastEmailChange: new Date(),
            },
          });

          return {
            message: "Email address updated successfully.",
            field: "email",
            value,
          };
        }

        case "name": {
          if (!value || value.length < 3) {
            throw new AppError("Organization name must be at least 3 characters.", 400);
          }

          if (store) {
            this.checkCooldown(store.lastNameChange, "name");

            const existingName = await prisma.store.findUnique({
              where: { name: value },
              select: { id: true },
            });

            if (existingName && existingName.id !== store.id) {
              throw new AppError("This organization name is already taken.", 409);
            }

            const slug = await this.generateUniqueSlug(value, store.id);

            store = await prisma.store.update({
              where: { id: store.id },
              data: {
                name: value,
                slug,
                lastNameChange: new Date(),
                lastProfileChange: new Date(),
              },
            });
          }

          return {
            message: "Organization name updated successfully.",
            field: "name",
            value,
          };
        }

        case "location": {
          if (!value || value.length < 1) {
            throw new AppError("Campus location cannot be empty.", 400);
          }

          if (store) {
            this.checkCooldown(store.lastLocationChange, "location");

            store = await prisma.store.update({
              where: { id: store.id },
              data: {
                pickupLocation: value,
                lastLocationChange: new Date(),
                lastProfileChange: new Date(),
              },
            });
          }

          return {
            message: "Campus location updated successfully.",
            field: "location",
            value,
          };
        }

        case "bio": {
          if (!value || value.length < 10) {
            throw new AppError("Short bio must be at least 10 characters.", 400);
          }

          if (store) {
            this.checkCooldown(store.lastBioChange, "bio");

            store = await prisma.store.update({
              where: { id: store.id },
              data: {
                description: value,
                lastBioChange: new Date(),
                lastProfileChange: new Date(),
              },
            });
          }

          return {
            message: "Short bio updated successfully.",
            field: "bio",
            value,
          };
        }

        default:
          throw new AppError(`Unknown field: ${body.field}`, 400);
      }
    }

    // Handle multi-field object update: { name, location, bio, email, contactNumber }
    const now = new Date();
    const updateUserData: any = {};
    const updateStoreData: any = {};

    if (body.contactNumber || body.contact) {
      const contactVal = (body.contactNumber || body.contact).trim();
      if (!/^09\d{9}$/.test(contactVal)) {
        throw new AppError(
          "Contact number must be exactly 11 digits, numbers only, and start with 09.",
          400
        );
      }
      this.checkCooldown(user.lastContactChange, "contact");
      updateUserData.contactNumber = contactVal;
      updateUserData.lastContactChange = now;
      updateStoreData.contactNumber = contactVal;
      updateStoreData.lastContactChange = now;
    }

    if (body.email) {
      const emailVal = body.email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailVal)) {
        throw new AppError("A valid email address is required.", 400);
      }
      this.checkCooldown(user.lastEmailChange, "email");
      const existing = await prisma.user.findFirst({
        where: { email: emailVal, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new AppError("This email address is already in use.", 409);
      }
      updateUserData.email = emailVal;
      updateUserData.lastEmailChange = now;
    }

    if (store) {
      if (body.name) {
        const nameVal = body.name.trim();
        if (nameVal.length < 3) {
          throw new AppError("Organization name must be at least 3 characters.", 400);
        }
        this.checkCooldown(store.lastNameChange, "name");
        updateStoreData.name = nameVal;
        updateStoreData.slug = await this.generateUniqueSlug(nameVal, store.id);
        updateStoreData.lastNameChange = now;
      }

      if (body.location) {
        const locationVal = body.location.trim();
        this.checkCooldown(store.lastLocationChange, "location");
        updateStoreData.pickupLocation = locationVal;
        updateStoreData.lastLocationChange = now;
      }

      if (body.bio) {
        const bioVal = body.bio.trim();
        if (bioVal.length < 10) {
          throw new AppError("Short bio must be at least 10 characters.", 400);
        }
        this.checkCooldown(store.lastBioChange, "bio");
        updateStoreData.description = bioVal;
        updateStoreData.lastBioChange = now;
      }
    }

    if (Object.keys(updateUserData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateUserData,
      });
    }

    if (store && Object.keys(updateStoreData).length > 0) {
      updateStoreData.lastProfileChange = now;
      await prisma.store.update({
        where: { id: store.id },
        data: updateStoreData,
      });
    }

    return {
      message: "Profile updated successfully.",
    };
  }

  /**
   * Change password with bcrypt verification and 7-day server cooldown.
   * Throws 401 Unauthorized if current password does not match.
   * Throws 403 Forbidden if password change is currently on cooldown.
   */
  static async changePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        lastPasswordChange: true,
      },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // Enforce 7-day cooldown on password change
    this.checkCooldown(user.lastPasswordChange, "password");

    if (!user.passwordHash) {
      throw new AppError("No password set on this account.", 400);
    }

    // Security: Use bcrypt to compare currentPassword with hashed password
    const isMatched = await comparePassword(data.currentPassword, user.passwordHash);
    if (!isMatched) {
      throw new AppError("Current password does not match.", 401);
    }

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new AppError("New password must be at least 8 characters.", 400);
    }

    // Hash the new password and update with cooldown timestamp
    const newHash = await hashPassword(data.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        lastPasswordChange: new Date(),
      },
    });

    return {
      message: "Password changed successfully.",
    };
  }
}
