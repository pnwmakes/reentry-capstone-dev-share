import { NextRequest, NextResponse } from "next/server";
import {
  initializeApp,
  cert,
  getApps,
  App,
  ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, Timestamp, Firestore } from "firebase-admin/firestore";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { User } from "@/types";

// ============================================================================
// Firebase Admin SDK Initialization
// ============================================================================
let adminApp: App;
let db: Firestore;
let adminAuth: ReturnType<typeof getAuth>;

(() => {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
  } else {
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      console.error(
        "❌ Missing Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)"
      );
      throw new Error("Missing Firebase Admin SDK credentials.");
    }
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }
      const serviceAccountKey: ServiceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID!,
        privateKey: privateKey!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      };
      adminApp = initializeApp({
        credential: cert(serviceAccountKey),
        projectId: serviceAccountKey.projectId,
      });
    } catch (error: unknown) {
      console.error(
        "❌ Error initializing Firebase Admin SDK for schedules API:",
        error
      );
      let errorMessage =
        "Unknown error during Firebase Admin SDK initialization.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(
        `Failed to initialize Firebase Admin SDK: ${errorMessage}. Check environment variables.`
      );
    }
  }
  db = getFirestore(adminApp, "reentry");
  adminAuth = getAuth(adminApp);
})();

// ============================================================================
// Authentication Helper
// ============================================================================
async function authenticateAdmin(request: NextRequest): Promise<{
  authenticated: boolean;
  decodedToken?: DecodedIdToken;
  errorMessage?: string;
}> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      errorMessage: "No authorization token provided.",
    };
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userUid = decodedToken.uid;
    const userProfileRef = db.collection("users").doc(userUid);
    const userProfileDoc = await userProfileRef.get();
    if (!userProfileDoc.exists) {
      console.warn(`User profile not found for UID: ${userUid}`);
      return { authenticated: false, errorMessage: "User profile not found." };
    }
    const userProfile = userProfileDoc.data() as User;
    if (userProfile.role !== "admin") {
      console.warn(
        `Unauthorized access attempt by non-admin role: ${userProfile.role} for UID: ${userUid}`
      );
      return {
        authenticated: false,
        errorMessage: "User does not have administrative privileges.",
      };
    }
    return { authenticated: true, decodedToken };
  } catch (error) {
    console.error(
      "Error verifying Firebase ID token or fetching user profile:",
      error
    );
    return {
      authenticated: false,
      errorMessage: "Invalid or expired authentication token.",
    };
  }
}

// ============================================================================
// GET Method: Fetch all schedules (collection-level)
// ============================================================================
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { message: authResult.errorMessage || "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const snapshot = await db.collection("schedules").get();
    const schedules = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(schedules, { status: 200 });
  } catch (error: unknown) {
    console.error("Error fetching schedules:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: `Error fetching schedules: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Method: Create a new schedule (collection-level)
// ============================================================================
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { message: authResult.errorMessage || "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const newScheduleData = await request.json();
    const docRef = await db.collection("schedules").add({
      ...newScheduleData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return NextResponse.json(
      { message: "Schedule created successfully!", id: docRef.id },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating schedule:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: `Error creating schedule: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// No DELETE method for collection-level route
