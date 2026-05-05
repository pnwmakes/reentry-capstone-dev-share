import { NextResponse } from "next/server";
import { db } from "@/lib/Firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { name, email, message, imageUrls } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const docRef = await addDoc(collection(db, "contacts"), {
      name,
      email,
      message,
      imageUrls: imageUrls || [],
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: docRef.id }, { status: 200 });
  } catch (err) {
    console.error("Error saving contact:", err);
    return NextResponse.json(
      { message: "Failed to save contact" },
      { status: 500 }
    );
  }
}
console.log("DB instance:", db);
