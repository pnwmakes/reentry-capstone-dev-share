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
// GET Method: Fetch a single schedule by ID
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { message: authResult.errorMessage || "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { scheduleId } = await params;

    if (!scheduleId) {
      return NextResponse.json(
        { message: "Error: Schedule ID is required." },
        { status: 400 }
      );
    }

    const scheduleRef = db.collection("schedules").doc(scheduleId);
    const scheduleDoc = await scheduleRef.get();

    if (!scheduleDoc.exists) {
      return NextResponse.json(
        { message: "Error: Schedule not found." },
        { status: 404 }
      );
    }

    const scheduleData = {
      id: scheduleDoc.id,
      ...scheduleDoc.data(),
    };

    return NextResponse.json(scheduleData, { status: 200 });
  } catch (error: unknown) {
    console.error("Error fetching schedule:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: `Error fetching schedule: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT Method: Update an existing schedule
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { message: authResult.errorMessage || "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { scheduleId } = await params;
    const updatedScheduleData = await request.json();

    if (!scheduleId) {
      return NextResponse.json(
        { message: "Error: Schedule ID is required for update." },
        { status: 400 }
      );
    }

    const scheduleRef = db.collection("schedules").doc(scheduleId);
    const existingSchedule = await scheduleRef.get();

    if (!existingSchedule.exists) {
      return NextResponse.json(
        { message: "Error: Schedule not found." },
        { status: 404 }
      );
    }

    // Destructure the id from the incoming data to ensure it's not saved to Firestore
    const { ...dataWithoutId } = updatedScheduleData;

    const updatePayload = {
      ...dataWithoutId,
      updatedAt: Timestamp.now(),
    };

    await scheduleRef.update(updatePayload);

    return NextResponse.json(
      { message: "Schedule updated successfully!" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error updating schedule:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: `Error updating schedule: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Method: Delete a schedule
// ============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { message: authResult.errorMessage || "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { scheduleId } = await params;

    if (!scheduleId) {
      return NextResponse.json(
        { message: "Error: Schedule ID is required for deletion." },
        { status: 400 }
      );
    }

    const scheduleRef = db.collection("schedules").doc(scheduleId);
    const scheduleDoc = await scheduleRef.get();

    if (!scheduleDoc.exists) {
      return NextResponse.json(
        { message: "Error: Schedule not found." },
        { status: 404 }
      );
    }

    await scheduleRef.delete();

    return NextResponse.json(
      { message: "Schedule deleted successfully!" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error deleting schedule:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: `Error deleting schedule: ${errorMessage}` },
      { status: 500 }
    );
  }
}
