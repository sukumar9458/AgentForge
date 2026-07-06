"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { signIn } from "@/lib/auth/auth";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

export interface ActionState {
  success: boolean;
  error?: string;
}

export async function registerUser(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { success: false, error: "Please fill in all fields." };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  try {
    await connectToDatabase();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return { success: false, error: "An account with this email already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
    });

    return { success: true };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function loginUser(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Please fill in all fields." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password." };
        default:
          return { success: false, error: "Authentication failed. Please check credentials." };
      }
    }
    // Check if error message is redirect (Auth.js throws redirect as error)
    if ((error as any).message === "NEXT_REDIRECT") {
      return { success: true };
    }
    console.error("Login error:", error);
    return { success: false, error: (error as any).message || "Something went wrong." };
  }
}
