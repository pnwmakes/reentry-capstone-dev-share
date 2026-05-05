import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../../lib/Firebase";
import { Organization } from "@/types";

// GET: Retrieve all organizations
export async function GET() {
  try {
    const orgCollectionRef = collection(db, "organizations");
    const querySnapshot = await getDocs(orgCollectionRef);

    const organizations: Organization[] = [];
    querySnapshot.forEach((doc) => {
      organizations.push({
        id: doc.id,
        ...(doc.data() as Omit<Organization, "id">),
      });
    });

    return NextResponse.json(organizations, { status: 200 });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { message: "Error fetching organizations" },
      { status: 500 }
    );
  }
}

/**
 * POST: Store a new feedback entry.
 */
export async function POST(request: NextRequest) {
  try {
    const { name, feedback } = await request.json();

    if (!feedback) {
      return NextResponse.json(
        { message: "Feedback is required." },
        { status: 400 }
      );
    }

    const feedbackCollectionRef = collection(db, "feedback");
    const newFeedback = {
      name: name || "Anonymous",
      feedback,
      createdAt: new Date(),
    };

    const docRef = await addDoc(feedbackCollectionRef, newFeedback);

    return NextResponse.json(
      { message: "Feedback submitted!", id: docRef.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving feedback:", error);
    return NextResponse.json(
      { message: "Error saving feedback" },
      { status: 500 }
    );
  }
}
