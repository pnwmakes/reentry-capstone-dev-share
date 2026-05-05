import { NextResponse } from "next/server";
import { db } from "@/lib/Firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { rating, clarity, improvements, issues, recommend } =
      await req.json();

    if (!rating || !clarity) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const docRef = await addDoc(collection(db, "feedback"), {
      rating,
      clarity,
      improvements: improvements || "",
      issues: issues || "",
      recommend: recommend || "",
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: docRef.id }, { status: 200 });
  } catch (err) {
    console.error("Error saving feedback:", err);
    return NextResponse.json(
      { message: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
