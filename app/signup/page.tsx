"use client";

import { useState, ChangeEvent } from "react";
import OrganizationModal from "@/components/OrganizationModal";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app as firebaseApp } from "@/lib/Firebase";
import { OrganizationFormState } from "@/types";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/Firebase";
import { createUserProfile, createOrganization } from "@/lib/firestore";
import Link from "next/link";
import { User } from "firebase/auth";

// Initial blank org form state
const initialOrgForm: OrganizationFormState = {
  name: "",
  description: "",
  website: "",
  status: "pending",
  isVerified: false,
  logoUrl: "",
  categories: [],
  contactInfo: {
    phone: "",
    email: "",
    website: "",
  },
  address: {
    street: "",
    city: "",
    state: "",
    zipCode: "",
  },
  adminUsers: [],
  totalResources: 0,
  avgRating: 0,
  totalReviews: 0,
};

// Utility to update nested fields by dot notation
function setNestedField<T extends object>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  function deepClone<O>(o: O): O {
    if (Array.isArray(o)) return [...o] as O;
    if (o && typeof o === "object") return { ...o } as O;
    return o;
  }
  const newObj = deepClone(obj);
  let curr: Record<string, unknown> = newObj as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in curr) || typeof curr[key] !== "object" || curr[key] === null) {
      curr[key] = {};
    } else {
      curr[key] = deepClone(curr[key]);
    }
    curr = curr[key] as Record<string, unknown>;
  }
  curr[lastKey] = value;
  return newObj;
}

export default function SignUpPage() {
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNewOrg, setIsNewOrg] = useState(false);
  // State to control Organization modal
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgForm, setOrgForm] = useState<OrganizationFormState>(initialOrgForm);
  const [orgModalLoading, setOrgModalLoading] = useState(false);
  const [orgModalError, setOrgModalError] = useState<string | null>(null);
  const [orgModalMessage, setOrgModalMessage] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      await sendEmailVerification(user);

      // Create user profile in Firestore
      // Use user.uid as the ID for the Firestore document
      // Default role is 'user', can be modified based on your app's needs
      await createUserProfile(user, "user");

      if (isNewOrg) {
        setCreatedUserId(user.uid);
        setCreatedUser(user);
        setShowOrgModal(true);
        setOrgForm(initialOrgForm); // Reset org form
      } else {
        setMessage(
          "Account created successfully! A verification email has been sent. Please check your inbox."
        );
        // Optionally clear form fields
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      if (err instanceof FirebaseError) {
        // Handle specific Firebase Auth errors
        switch (err.code) {
          case "auth/email-already-in-use":
            setError("This email address is already in use.");
            break;
          case "auth/invalid-email":
            setError("The email address is not valid.");
            break;
          case "auth/weak-password":
            setError("Password should be at least 6 characters.");
            break;
          default:
            setError(`Sign up failed: ${err.message}`);
        }
        console.error("❌ Firebase Sign up error:", err.code, err.message);
      } else if (err instanceof Error) {
        setError(`An unexpected error occurred: ${err.message}`);
        console.error("❌ General Sign up error:", err.message);
      } else {
        setError("An unknown error occurred during sign up.");
        console.error("❌ Unknown Sign up error:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-900 px-4">
      {/* Organization Modal (shown after signup if New Organization is checked) */}
      {showOrgModal && (
        <OrganizationModal
          show={showOrgModal}
          onClose={() => setShowOrgModal(false)}
          onSubmit={async () => {
            setOrgModalLoading(true);
            setOrgModalError(null);
            setOrgModalMessage(null);
            try {
              if (!createdUserId) throw new Error("User ID not found");
              let logoUrl = orgForm.logoUrl || "";
              if (orgLogoFile && createdUser) {
                // Upload logo to Firebase Storage
                const storage = getStorage(firebaseApp);
                const ext = orgLogoFile.name.split(".").pop() || "png";
                const storageRef = ref(
                  storage,
                  `user_uploads/${
                    createdUser.uid
                  }/organization-logos/new-org_${Date.now()}.${ext}`
                );
                await uploadBytes(storageRef, orgLogoFile);
                logoUrl = await getDownloadURL(storageRef);
              }
              const orgData = { ...orgForm, logoUrl };
              await createOrganization(
                { ...orgData, status: "pending" },
                createdUserId
              );
              setOrgModalLoading(false);
              setOrgModalMessage(
                "Organization request submitted! Pending approval."
              );
              setShowOrgModal(false);
              setMessage("Organization request submitted! Pending approval.");
            } catch (err) {
              setOrgModalLoading(false);
              if (err instanceof Error) {
                setOrgModalError(err.message);
              } else {
                setOrgModalError("Failed to submit organization request.");
              }
            }
          }}
          onInputChange={(
            e: ChangeEvent<
              HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >
          ) => {
            const { name, value, type } = e.target;
            let fieldValue: string | boolean = value;
            if (type === "checkbox" && "checked" in e.target) {
              fieldValue = (e.target as HTMLInputElement).checked;
            }
            setOrgForm((prev) => setNestedField(prev, name, fieldValue));
          }}
          editingData={null}
          newData={orgForm}
          loading={orgModalLoading}
          error={orgModalError}
          message={orgModalMessage}
          firebaseUser={createdUser || undefined}
          // Patch: capture logo file selection
          onLogoFileChange={setOrgLogoFile}
        />
      )}
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 p-8 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center text-zinc-800 dark:text-white">
          Create Account
        </h1>

        {error && (
          <p className="text-red-600 mb-4 text-sm text-center">{error}</p>
        )}
        {message && (
          <p className="text-green-600 mb-4 text-sm text-center">{message}</p>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full p-3 border rounded-md dark:bg-zinc-700 dark:text-white"
            disabled={isLoading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full p-3 border rounded-md dark:bg-zinc-700 dark:text-white"
            disabled={isLoading}
          />
          <div className="flex items-center">
            <input
              id="new-org-checkbox"
              type="checkbox"
              checked={isNewOrg}
              onChange={(e) => setIsNewOrg(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
              disabled={isLoading}
            />
            <label
              htmlFor="new-org-checkbox"
              className="text-sm text-zinc-700 dark:text-zinc-200"
            >
              New Organization
            </label>
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? "Signing Up..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-zinc-600 dark:text-zinc-300">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
