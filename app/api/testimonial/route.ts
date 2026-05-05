// app/api/testimonial/route.ts
import { db } from "@/lib/Firebase";
import { collection, addDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstname, lastname, email, testimonial } = body;

    // Add document to Firestore
    const testimonialRef = collection(db, "testimonials");
    const docRef = await addDoc(testimonialRef, {
      firstname,
      lastname,
      email,
      testimonial,
      createdAt: new Date().toISOString()
    });

    console.log("Testimonial saved with ID:", docRef.id);
    return NextResponse.json({ 
      success: true, 
      message: "Testimonial saved",
      id: docRef.id 
    });
  } catch (err) {
    console.error("Error saving testimonial:", err);
    return NextResponse.json(
      { success: false, message: "Error saving testimonial" },
      { status: 500 }
    );
  }
}