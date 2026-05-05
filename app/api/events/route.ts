import { type NextRequest, NextResponse } from "next/server";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  getApps,
  initializeApp,
  cert,
  App,
  ServiceAccount,
} from "firebase-admin/app";
import { Event } from "@/types";

// --- Firebase Admin SDK Initialization (reuse your existing logic) ---
let adminApp: App;
if (!getApps().length) {
  // --- Copy your Firebase Admin SDK initialization logic here ---
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.error(
      "Missing Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)"
    );
    throw new Error("Missing Firebase Admin SDK credentials.");
  }

  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  const serviceAccountKey: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  adminApp = initializeApp({
    credential: cert(serviceAccountKey),
    projectId: serviceAccountKey.projectId,
  });
} else {
  adminApp = getApps()[0];
}
const db = getFirestore(adminApp);

async function createNewEvent(
  eventData: Omit<Event, "id" | "createdAt" | "updatedAt">
) {
  const now = Timestamp.now();
  const eventToSave = {
    ...eventData,
    createdAt: now,
    updatedAt: now,
    isPublished: eventData.isPublished ?? false,
  };
  const docRef = await db.collection("events").add(eventToSave);
  console.log("New event created with ID:", docRef.id);
  return docRef.id;
}
// --- GET: List all events ---
export async function GET() {
  const snapshot = await db.collection("events").orderBy("date", "asc").get();
  const events: Event[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Event, "id">),
  }));
  return NextResponse.json(events, { status: 200 });
}

// --- POST: Add a new event ---
export async function POST(request: NextRequest) {
  const data = await request.json();
  try {
    const id = await createNewEvent(data);
    return NextResponse.json({ message: "Event added!", id }, { status: 201 });
  } catch (error) {
    console.error("Error creating new event:", error);
    return NextResponse.json(
      { message: "Failed to create event." },
      { status: 500 }
    );
  }
}

// ...existing code...