"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "@/lib/Firebase";
import { getUserProfile } from "@/lib/firestore";
import type { AppUser, User } from "@/types";

import AdminDashboard from "@/components/AdminDashboard";
import UserDashboard from "@/components/dashboard/UserDashboard";
import OrganizationAdminDashboard from "@/components/dashboard/OrganizationAdminDashboard";
// ...existing code...
import { useSearchParams } from "next/navigation";

// Normalize any historical/spelling variants to a single canonical role string
function normalizeRole(
  role: string | undefined | null
): "admin" | "organization_admin" | "user" {
  const r = (role ?? "user").toLowerCase();
  if (
    r === "orgadmin" ||
    r === "organizationadmin" ||
    r === "organization_admin"
  )
    return "organization_admin";
  if (r === "admin") return "admin";
  return "user";
}

export default function DashboardPage() {
  // All hooks must be at the top, before any return/conditional
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const openOrgModal = searchParams?.get("openOrgModal") === "1";
  const [orgModalRef, setOrgModalRef] = useState<{
    openEditModal: () => void;
  } | null>(null);
  // ...existing code...
  // Compute role as soon as currentUser is available
  const role = currentUser
    ? normalizeRole((currentUser as AppUser).role)
    : null;
  // Effect: open modal if query param present and org admin
  useEffect(() => {
    if (
      role === "organization_admin" &&
      openOrgModal &&
      orgModalRef &&
      typeof orgModalRef.openEditModal === "function"
    ) {
      orgModalRef.openEditModal();
    }
    // Only run when these change
  }, [role, openOrgModal, orgModalRef]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        router.push("/signin");
        return;
      }

      try {
        const userProfile = await getUserProfile(user.uid);
        if (!userProfile) {
          setError(
            "User profile not found in database. Please contact support."
          );
          console.error("❌ User profile missing for UID:", user.uid);
          await signOut(auth);
          router.push("/signin");
        } else {
          setCurrentUser(userProfile);
        }
      } catch (profileError) {
        setError("Failed to load user profile. Please try again.");
        console.error("❌ Error fetching user profile:", profileError);
        await signOut(auth);
        router.push("/signin");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/signin");
    } catch (err) {
      console.error("❌ Error signing out:", err);
      setError("Failed to sign out. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-zinc-700 dark:text-zinc-300">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-red-600 text-lg mb-4">{error}</p>
        <button
          onClick={handleSignOut}
          className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-zinc-700 dark:text-zinc-300">
          You are not logged in.
        </p>
        <button
          onClick={() => router.push("/signin")}
          className="mt-4 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // ✅ Org admin branch — send to org admin dashboard
  if (role === "organization_admin") {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white">
        <main className="p-8">
          <OrganizationAdminDashboard
            user={currentUser as AppUser}
            setOrgModalRef={setOrgModalRef}
          />
        </main>
      </div>
    );
  }

  // Admin branch
  if (role === "admin") {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white">
        <main className="p-8">
          <AdminDashboard user={currentUser as AppUser} />
        </main>
      </div>
    );
  }

  // Default → regular user dashboard
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white">
      <main className="p-8">
        <UserDashboard
          user={{
            ...(currentUser as AppUser),
            email: (currentUser as AppUser).email ?? "",
            displayName: (currentUser as AppUser).displayName ?? undefined,
          }}
        />
      </main>
    </div>
  );
}
