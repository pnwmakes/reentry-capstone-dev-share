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
  Timestamp,
  FieldValue,
  Firestore,
} from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Resource, User } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin Initialization
// ─────────────────────────────────────────────────────────────────────────────
let adminApp: App;
let db: Firestore;
let adminAuth: ReturnType<typeof getAuth>;

(() => {
  if (getApps().length) {
    adminApp = getApps()[0];
  } else {
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      console.error("❌ Missing Firebase env");
      throw new Error("Missing Firebase Admin SDK credentials.");
    }
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
    const sa: ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    };
    adminApp = initializeApp({ credential: cert(sa), projectId: sa.projectId });
  }
  db = getFirestore(adminApp, "reentry");
  adminAuth = getAuth(adminApp);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Auth Context
// ─────────────────────────────────────────────────────────────────────────────
type AuthCtx = {
  ok: boolean;
  uid: string | null;
  role: string | null;
  orgId: string | null;
  error?: string;
};

const normRole = (r?: string | null): string | null => {
  const s = (r ?? "").toLowerCase();
  if (["organizationadmin", "orgadmin", "organization_admin"].includes(s))
    return "organization_admin";
  if (s === "admin") return "admin";
  return s || null;
};

async function getAuthCtx(req: NextRequest): Promise<AuthCtx> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
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
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      return {
        ok: false,
        uid,
        role: null,
        orgId: null,
        error: "User profile not found.",
      };
    }
    const user = snap.data() as User;
    return {
      ok: true,
      uid,
      role: normRole(user.role),
      orgId: user.organizationId ?? null,
    };
  } catch (e) {
    console.error("verifyIdToken error:", e);
    return {
      ok: false,
      uid: null,
      role: null,
      orgId: null,
      error: "Invalid or expired authentication token.",
    };
  }
}

function forbid(msg: string, code = 403) {
  return NextResponse.json({ message: msg }, { status: code });
}

async function userAdminOrgIds(uid: string): Promise<string[]> {
  const a = await db
    .collection("organizations")
    .where("adminUserIds", "array-contains", uid)
    .get();
  const b = await db
    .collection("organizations")
    .where("adminUsers", "array-contains", uid)
    .get();
  const set = new Set<string>([
    ...a.docs.map((d) => d.id),
    ...b.docs.map((d) => d.id),
  ]);
  return [...set.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: resources
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
  if (!isAdmin && !isOrgAdmin)
    return forbid("User does not have administrative privileges.");

  try {
    const col = db.collection("resources");

    if (isAdmin) {
      const snap = await col.get();
      return NextResponse.json(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Resource, "id">) })),
        { status: 200 }
      );
    }

    const ids: string[] = [];
    if (auth.orgId) ids.push(auth.orgId);
    const extra = await userAdminOrgIds(auth.uid!);
    extra.forEach((id) => {
      if (!ids.includes(id)) ids.push(id);
    });

    if (ids.length === 0) return NextResponse.json([], { status: 200 });

    const out: Resource[] = [];
    for (const id of ids) {
      const q = await col.where("organizationId", "==", id).get();
      q.forEach((d) =>
        out.push({ id: d.id, ...(d.data() as Omit<Resource, "id">) })
      );
    }
    return NextResponse.json(out, { status: 200 });
  } catch (error) {
    console.error("GET /api/resources error:", error);
    return NextResponse.json(
      { message: "Error fetching resources." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: add resource
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await getAuthCtx(request);
  if (!auth.ok || !auth.uid) {
    return NextResponse.json(
      { message: auth.error || "Unauthorized." },
      { status: 401 }
    );
  }

  const isAdmin = auth.role === "admin";
  const isOrgAdmin = auth.role === "organization_admin";
  if (!isAdmin && !isOrgAdmin)
    return forbid("User does not have administrative privileges.");

  try {
    const newResource: Omit<
      Resource,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "viewsCount"
      | "averageRating"
      | "totalReviews"
      | "createdBy"
    > = await request.json();

    if (
      !newResource.name ||
      !newResource.description ||
      !newResource.category ||
      !newResource.organizationId
    ) {
      return NextResponse.json(
        {
          message:
            "Error: Name, description, category, and organizationId are required.",
        },
        { status: 400 }
      );
    }

    if (!isAdmin) {
      const allowedIds = new Set<string>([
        ...(auth.orgId ? [auth.orgId] : []),
        ...(await userAdminOrgIds(auth.uid!)),
      ]);
      if (!allowedIds.has(newResource.organizationId)) {
        return forbid(
          "You are not allowed to create resources for this organization."
        );
      }
    }

    const resourcesRef = db.collection("resources");
    const organizationsRef = db.collection("organizations");

    const docRef = await resourcesRef.add({
      ...newResource,
      subcategory: newResource.subcategory || null,
      eligibilityRequirements:
        newResource.eligibilityRequirements?.filter(Boolean) || [],
      applicationProcess: newResource.applicationProcess || null,
      documentsRequired: newResource.documentsRequired?.filter(Boolean) || [],
      cost: newResource.cost || null,
      capacity: newResource.capacity || null,
      currentOccupancy: newResource.currentOccupancy ?? null,
      waitlistAvailable: newResource.waitlistAvailable ?? false,
      tags: newResource.tags?.filter(Boolean) || [],
      contactInfo: newResource.contactInfo || null,
      status: newResource.status || "pending_review",
      priority: newResource.priority || 0,
      imageUrl: newResource.imageUrl || null,
      locationIds: newResource.locationIds?.filter(Boolean) || [],
      viewsCount: 0,
      averageRating: 0,
      totalReviews: 0,
      createdBy: auth.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await organizationsRef.doc(newResource.organizationId).update({
      totalResources: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json(
      { message: "Resource added successfully!", id: docRef.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/resources error:", error);
    return NextResponse.json(
      { message: "Error adding resource." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT: update resource
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
  if (!isAdmin && !isOrgAdmin)
    return forbid("User does not have administrative privileges.");

  try {
    const updated: Resource = await request.json();
    if (!updated.id) {
      return NextResponse.json(
        { message: "Error: Resource ID is required for update." },
        { status: 400 }
      );
    }

    const ref = db.collection("resources").doc(updated.id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { message: "Error: Resource not found." },
        { status: 404 }
      );
    }

    const current = doc.data() as Resource;

    if (!isAdmin) {
      const allowedIds = new Set<string>([
        ...(auth.orgId ? [auth.orgId] : []),
        ...(await userAdminOrgIds(auth.uid!)),
      ]);
      const targetOrgId = updated.organizationId ?? current.organizationId;
      if (!allowedIds.has(targetOrgId)) {
        return forbid("You are not allowed to update this resource.");
      }
    }

    const filtered: Partial<Resource> = {};
    (Object.entries(updated) as [keyof Resource, unknown][]).forEach(
      ([k, v]) => {
        if (k !== "id" && v !== undefined) {
          (filtered[k] as unknown) = v;
        }
      }
    );
    filtered.updatedAt = Timestamp.now() as unknown as Resource["updatedAt"];

    await ref.update(filtered);
    return NextResponse.json(
      { message: "Resource updated successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT /api/resources error:", error);
    return NextResponse.json(
      { message: "Error updating resource." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: delete resource
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
  if (!isAdmin && !isOrgAdmin)
    return forbid("User does not have administrative privileges.");

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { message: "Error: Resource ID is required for deletion." },
        { status: 400 }
      );
    }

    const ref = db.collection("resources").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { message: "Error: Resource not found." },
        { status: 404 }
      );
    }

    const data = doc.data() as Resource;

    if (!isAdmin) {
      const allowedIds = new Set<string>([
        ...(auth.orgId ? [auth.orgId] : []),
        ...(await userAdminOrgIds(auth.uid!)),
      ]);
      if (!allowedIds.has(data.organizationId)) {
        return forbid("You are not allowed to delete this resource.");
      }
    }

    await ref.delete();

    if (data.organizationId) {
      await db
        .collection("organizations")
        .doc(data.organizationId)
        .update({
          totalResources: FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
    }

    return NextResponse.json(
      { message: "Resource deleted successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/resources error:", error);
    return NextResponse.json(
      { message: "Error deleting resource." },
      { status: 500 }
    );
  }
}
