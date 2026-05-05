import { type NextRequest, NextResponse } from "next/server";
import {
  initializeApp,
  cert,
  getApps,
  App,
  ServiceAccount,
} from "firebase-admin/app";
import {
  getFirestore,
  Timestamp as AdminTimestamp,
  Firestore,
} from "firebase-admin/firestore";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import type { Organization, ResourceCategoryType, User } from "@/types";

// (Optional but recommended for Admin routes)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK init (typed + lint-friendly)
// ─────────────────────────────────────────────────────────────────────────────
let adminApp: App;
if (!getApps().length) {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.error(
      "Missing Firebase env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)"
    );
    throw new Error("Missing Firebase Admin SDK credentials.");
  }

  const privateKey: string = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(
    /\\n/g,
    "\n"
  );

  const serviceAccountKey: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  adminApp = initializeApp({
    credential: cert(serviceAccountKey),
    projectId: serviceAccountKey.projectId,
  });
} else {
  adminApp = getApps()[0];
}

const adminAuth = getAuth(adminApp);
const db = getFirestore(adminApp, "reentry");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (no `any`)
// ─────────────────────────────────────────────────────────────────────────────
type Role = "admin" | "organization_admin" | null;

type AuthCtx = {
  ok: boolean;
  uid: string | null;
  role: Role;
  orgId: string | null;
  token?: DecodedIdToken;
  error?: string;
};

function normalizeRole(input?: string | null): Role {
  const r = (input ?? "").toLowerCase();
  if (r === "admin") return "admin";
  if (
    r === "organization_admin" ||
    r === "organizationadmin" ||
    r === "orgadmin"
  )
    return "organization_admin";
  return null;
}

async function getAuthCtx(req: NextRequest): Promise<AuthCtx> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  console.log("[getAuthCtx] Authorization header:", authHeader);
  if (!token) {
    console.warn("[getAuthCtx] No authorization token provided.");
    return {
      ok: false,
      uid: null,
      role: null,
      orgId: null,
      error: "No authorization token provided.",
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    console.log("[getAuthCtx] Decoded UID:", uid);

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      console.warn(`[getAuthCtx] User profile not found for UID: ${uid}`);
      return {
        ok: false,
        uid,
        role: null,
        orgId: null,
        error: "User profile not found.",
      };
    }

    const user = userSnap.data() as Partial<User>;
    console.log("[getAuthCtx] User doc:", user);
    const role = normalizeRole(user?.role as string | undefined);
    const orgId =
      (user as { orgId?: string | null })?.orgId !== undefined
        ? (user as { orgId?: string | null }).orgId ?? null
        : null;
    console.log(`[getAuthCtx] role: ${role}, orgId: ${orgId}`);

    return { ok: true, uid, role, orgId, token: decoded };
  } catch (e) {
    console.error("[getAuthCtx] verifyIdToken error:", e);
    return {
      ok: false,
      uid: null,
      role: null,
      orgId: null,
      error: "Invalid or expired authentication token.",
    };
  }
}

function forbid(message: string, status = 403) {
  return NextResponse.json({ message }, { status });
}

async function isOrgAdminForOrg(
  firestore: Firestore,
  orgId: string,
  uid: string
): Promise<boolean> {
  const doc = await firestore.collection("organizations").doc(orgId).get();
  if (!doc.exists) return false;
  const data = doc.data() as Partial<
    Organization & { adminUserIds?: string[]; adminUsers?: string[] }
  >;
  const ids = Array.isArray(data?.adminUserIds) ? data.adminUserIds! : [];
  const legacy = Array.isArray(data?.adminUsers) ? data.adminUsers! : [];
  return ids.includes(uid) || legacy.includes(uid);
}

function ensureArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr.filter((x) => x != null) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: list organizations
//   - admin → all
//   - organization_admin → only their org (by user.orgId if present,
//     else by membership arrays adminUserIds/adminUsers)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await getAuthCtx(request);
  if (!auth.ok || !auth.uid) {
    return NextResponse.json(
      { message: auth.error || "Unauthorized." },
      { status: 401 }
    );
  }

  const isAdmin = auth.role === "admin";
  const isOrgAdmin = auth.role === "organization_admin";

  if (!isAdmin && !isOrgAdmin) {
    return forbid("User does not have administrative privileges.");
  }

  try {
    const col = db.collection("organizations");

    if (isAdmin) {
      const snap = await col.get();
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
      return NextResponse.json(rows, { status: 200 });
    }

    // organization_admin scope
    if (auth.orgId) {
      const doc = await col.doc(auth.orgId).get();
      if (!doc.exists) return NextResponse.json([], { status: 200 });
      return NextResponse.json(
        [{ id: doc.id, ...(doc.data() as Record<string, unknown>) }],
        { status: 200 }
      );
    }

    // fallback: membership arrays
    const byAdminIds = await col
      .where("adminUserIds", "array-contains", auth.uid)
      .get();
    const rowsByAdminIds = byAdminIds.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));

    const byLegacy = await col
      .where("adminUsers", "array-contains", auth.uid)
      .get();
    const rowsByLegacy = byLegacy.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));

    // merge unique by id
    const map = new Map<string, Record<string, unknown>>();
    [...rowsByAdminIds, ...rowsByLegacy].forEach((r) =>
      map.set(r.id as string, r)
    );
    return NextResponse.json([...map.values()], { status: 200 });
  } catch (error) {
    console.error("GET /api/organizations error:", error);
    return NextResponse.json(
      { message: "Error fetching organizations." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: create or update (update if `id` present to match your previous API)
//   - admin → create & update
//   - organization_admin → update ONLY their org; create adds their UID to adminUserIds
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await getAuthCtx(request);
  console.log("[POST] getAuthCtx result:", auth);
  if (!auth.ok || !auth.uid) {
    console.warn("[POST] Not authenticated:", auth.error);
    return NextResponse.json(
      { message: auth.error || "Unauthorized." },
      { status: 401 }
    );
  }

  const isAdmin = auth.role === "admin";
  const isOrgAdmin = auth.role === "organization_admin";

  if (!isAdmin && !isOrgAdmin) {
    return forbid("User does not have administrative privileges.");
  }

  try {
    const organizationData: Organization = await request.json();

    if (!organizationData.name || !organizationData.description) {
      return NextResponse.json(
        { message: "Error: Name and description are required." },
        { status: 400 }
      );
    }

    const organizationsRef = db.collection("organizations");

    // UPDATE path (id provided)
    if (organizationData.id) {
      // org-admin may only update their own org
      if (!isAdmin) {
        const allowed =
          auth.orgId === organizationData.id ||
          (await isOrgAdminForOrg(db, organizationData.id, auth.uid!));
        if (!allowed) {
          return forbid("You are not allowed to update this organization.");
        }
      }

      const orgRef = organizationsRef.doc(organizationData.id);
      const existing = await orgRef.get();
      if (!existing.exists) {
        return NextResponse.json(
          { message: "Error: Organization not found for update." },
          { status: 404 }
        );
      }

      const updateData: Partial<Omit<Organization, "id">> & {
        updatedAt?: AdminTimestamp;
      } = {};

      if (organizationData.name) updateData.name = organizationData.name;
      if (organizationData.description)
        updateData.description = organizationData.description;
      if (organizationData.contactInfo !== undefined)
        updateData.contactInfo = organizationData.contactInfo;
      if (organizationData.contactInfo?.socialMedia !== undefined) {
        if (!updateData.contactInfo) updateData.contactInfo = {};
        updateData.contactInfo.socialMedia =
          organizationData.contactInfo.socialMedia;
      }
      if (organizationData.website !== undefined)
        updateData.website = organizationData.website;
      if (organizationData.address !== undefined)
        updateData.address = organizationData.address;
      if (organizationData.hours !== undefined)
        updateData.hours = organizationData.hours;
      if (organizationData.specialHours !== undefined)
        updateData.specialHours = organizationData.specialHours;
      // coordinates property removed: not part of Organization type
      if (organizationData.categories !== undefined)
        updateData.categories = ensureArray<ResourceCategoryType>(
          organizationData.categories as
            | ResourceCategoryType[]
            | null
            | undefined
        );
      if (Object.prototype.hasOwnProperty.call(organizationData, "status"))
        updateData.status = organizationData.status;
      if (organizationData.isVerified !== undefined)
        updateData.isVerified = organizationData.isVerified;

      updateData.updatedAt = AdminTimestamp.now();
      await orgRef.update(updateData);

      return NextResponse.json(
        {
          message: "Organization updated successfully!",
          id: organizationData.id,
        },
        { status: 200 }
      );
    }

    // CREATE path
    const orgToSave: Omit<Organization, "id"> & {
      createdAt: AdminTimestamp;
      updatedAt: AdminTimestamp;
      adminUserIds?: string[];
      adminUsers?: string[]; // legacy support
      totalResources?: number;
      avgRating?: number;
      totalReviews?: number;
    } = {
      name: organizationData.name,
      description: organizationData.description,
      contactInfo: organizationData.contactInfo || undefined,
      website: organizationData.website || undefined,
      logoUrl: organizationData.logoUrl || undefined,
      address: organizationData.address || undefined,
      hours: organizationData.hours || undefined,
      specialHours: organizationData.specialHours || undefined,
      // coordinates property removed: not part of Organization type
      categories: ensureArray<ResourceCategoryType>(
        organizationData.categories as ResourceCategoryType[] | null | undefined
      ),
      status: organizationData.status ?? "active",
      isVerified: organizationData.isVerified ?? false,
      adminUsers: ensureArray<string>(
        (organizationData as unknown as { adminUsers?: string[] | null })
          ?.adminUsers
      ),
      adminUserIds: ensureArray<string>(
        (organizationData as unknown as { adminUserIds?: string[] | null })
          ?.adminUserIds
      ),
      totalResources: 0,
      avgRating: 0,
      totalReviews: 0,
      createdAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now(),
    };

    // If org-admin is creating, ensure they’re added to adminUserIds
    if (isOrgAdmin && auth.uid && !orgToSave.adminUserIds?.includes(auth.uid)) {
      orgToSave.adminUserIds = [...(orgToSave.adminUserIds ?? []), auth.uid];
    }

    const result = await organizationsRef.add(orgToSave);
    return NextResponse.json(
      { message: "Organization added successfully!", id: result.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/organizations error:", error);
    return NextResponse.json(
      { message: "Error adding/updating organization." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const auth = await getAuthCtx(request);
  if (!auth.ok || !auth.uid) {
    return NextResponse.json(
      { message: auth.error || "Unauthorized." },
      { status: 401 }
    );
  }

  const isAdmin = auth.role === "admin";
  const isOrgAdmin = auth.role === "organization_admin";
  if (!isAdmin && !isOrgAdmin) {
    return forbid("User does not have administrative privileges.");
  }

  try {
    const updatedFields: Partial<Organization> & { id?: string } =
      await request.json();
    if (!updatedFields.id) {
      return NextResponse.json(
        { message: "Error: Organization ID is required for update." },
        { status: 400 }
      );
    }

    // org-admin may only update their own org
    if (!isAdmin) {
      const allowed =
        auth.orgId === updatedFields.id ||
        (await isOrgAdminForOrg(db, updatedFields.id, auth.uid!));
      if (!allowed) {
        return forbid("You are not allowed to update this organization.");
      }
    }

    const orgRef = db.collection("organizations").doc(updatedFields.id);
    const existing = await orgRef.get();
    if (!existing.exists) {
      return NextResponse.json(
        { message: "Error: Organization not found." },
        { status: 404 }
      );
    }

    // Avoid unused `id` lint by copying + deleting id
    const fieldsToUpdate: Partial<Organization> = { ...updatedFields };
    delete (fieldsToUpdate as { id?: string }).id;

    await orgRef.update({
      ...fieldsToUpdate,
      updatedAt: AdminTimestamp.now(),
    });

    return NextResponse.json(
      { message: "Organization updated successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT /api/organizations error:", error);
    return NextResponse.json(
      { message: "Error updating organization." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const auth = await getAuthCtx(request);
  if (!auth.ok || !auth.uid) {
    return NextResponse.json(
      { message: auth.error || "Unauthorized." },
      { status: 401 }
    );
  }

  const isAdmin = auth.role === "admin";
  const isOrgAdmin = auth.role === "organization_admin";
  if (!isAdmin && !isOrgAdmin) {
    return forbid("User does not have administrative privileges.");
  }

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("id");
    if (!organizationId) {
      return NextResponse.json(
        { message: "Error: Organization ID is required for deletion." },
        { status: 400 }
      );
    }

    // org-admin may only delete their own org
    if (!isAdmin) {
      const allowed =
        auth.orgId === organizationId ||
        (await isOrgAdminForOrg(db, organizationId, auth.uid!));
      if (!allowed) {
        return forbid("You are not allowed to delete this organization.");
      }
    }

    const orgRef = db.collection("organizations").doc(organizationId);
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
      return NextResponse.json(
        { message: "Error: Organization not found." },
        { status: 404 }
      );
    }

    // Cascade delete resources & locations
    const batch = db.batch();

    const resourcesSnapshot = await db
      .collection("resources")
      .where("organizationId", "==", organizationId)
      .get();
    resourcesSnapshot.docs.forEach((d) => batch.delete(d.ref));

    const locationsSnapshot = await db
      .collection("locations")
      .where("organizationId", "==", organizationId)
      .get();
    locationsSnapshot.docs.forEach((d) => batch.delete(d.ref));

    batch.delete(orgRef);
    await batch.commit();

    return NextResponse.json(
      { message: "Organization and related data deleted successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/organizations error:", error);
    return NextResponse.json(
      { message: "Error deleting organization." },
      { status: 500 }
    );
  }
}
