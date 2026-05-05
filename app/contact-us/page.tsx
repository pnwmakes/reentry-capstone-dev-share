"use client";

import React, { useState, DragEvent } from "react";
import Image from "next/image";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getStorage,
  deleteObject,
} from "firebase/storage";
import { useFirebase } from "@/components/FirebaseProvider";
import { X } from "lucide-react";

export default function ContactPage() {
  const { userId } = useFirebase();
  const storage = getStorage();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    images: [] as File[],
    imageUrls: [] as string[],
  });

  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Feedback form state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({
    rating: "",
    clarity: "",
    improvements: "",
    issues: "",
    recommend: "",
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });

      if (!res.ok) throw new Error("Failed to submit feedback");

      setFeedbackSubmitted(true); // mark as submitted
      setFeedback({
        rating: "",
        clarity: "",
        improvements: "",
        issues: "",
        recommend: "",
      });
    } catch (err) {
      console.error(err);
      alert("Failed to submit feedback. Please try again.");
    }
  };

  /** --- File upload --- */
  const handleFiles = (files: File[]) => {
    if (files.length && storage) {
      uploadImages(files); // upload only
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
  };

  const uploadImages = (files: File[]) => {
    setUploading(true);
    setError(null);

    const uploadPromises = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const storageRef = ref(
            storage,
            `user_uploads/${userId || "anonymous"}/${file.name}`
          );
          const uploadTask = uploadBytesResumable(storageRef, file);

          uploadTask.on(
            "state_changed",
            () => {},
            (err: Error) => reject(err),
            async () => {
              try {
                const downloadURL = await getDownloadURL(
                  uploadTask.snapshot.ref
                );
                setFormData((prev) => ({
                  ...prev,
                  imageUrls: [...prev.imageUrls, downloadURL],
                }));
                resolve(downloadURL);
              } catch (err) {
                reject(err);
              }
            }
          );
        })
    );

    Promise.allSettled(uploadPromises).finally(() => setUploading(false));
  };

  const removeFile = async (url: string) => {
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);

      setFormData((prev) => ({
        ...prev,
        imageUrls: prev.imageUrls.filter((u) => u !== url),
      }));

      // progress state removed
    } catch (err) {
      console.error("Failed to delete file:", err);
      setError("Failed to remove file. Please try again.");
    }
  };

  /** --- Contact form submission --- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          imageUrls: formData.imageUrls,
        }),
      });

      if (!res.ok) {
        const { message } = await res.json();
        throw new Error(message || "Something went wrong");
      }

      setSubmitted(true);
      setFormData({
        name: "",
        email: "",
        message: "",
        images: [],
        imageUrls: [],
      });
      // progress state removed
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  // (Removed duplicate handleFeedbackSubmit)

  return (
    <div className="relative">
      {/* Contact Form */}
      <div className="max-w-3xl mx-auto p-8 animate-fade-in mt-8 bg-white rounded-lg shadow">
        <h2 className="text-4xl font-bold text-gray-900 mb-6 text-center">
          Contact Us
        </h2>
        <p className="text-lg text-gray-600 mb-8 text-center">
          Have questions, feedback, or just want to say hello? Fill out the form
          below.
        </p>
        <div className="bg-gray-50 p-6 rounded-lg shadow-md">
          {submitted ? (
            <p className="text-green-600 text-center font-medium">
              ✅ Thanks for reaching out! We’ll be in touch soon.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Your Name"
                required
                className="w-full p-3 rounded-lg border border-gray-300"
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="Your Email"
                required
                className="w-full p-3 rounded-lg border border-gray-300"
              />
              <textarea
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder="Your Message"
                required
                rows={4}
                className="w-full p-3 rounded-lg border border-gray-300"
              />

              {/* Drag & Drop */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="w-full p-6 border-2 border-dashed border-gray-400 rounded-lg text-center cursor-pointer hover:border-blue-500 transition"
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                <p className="text-gray-600">
                  Drag & drop files here, or{" "}
                  <span className="text-blue-600">browse</span>
                </p>
                <input
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {/* Image previews */}
              {(formData.images.length > 0 ||
                formData.imageUrls.length > 0) && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {/* Image preview for formData.images.map was here. Removed to fix JSX syntax error. */}
                  {formData.imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <Image
                        src={url}
                        alt={`Uploaded ${idx}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(url)}
                        className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-red-600 text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || uploading}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Floating Feedback Button */}
      <button
        onClick={() => setShowFeedback(true)}
        className="fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-full shadow-lg z-50"
      >
        Feedback Form
      </button>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md relative">
            <button
              onClick={() => setShowFeedback(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              <X size={20} />
            </button>

            {feedbackSubmitted ? (
              <p className="text-green-600 text-center">
                ✅ Thanks for your feedback!
              </p>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                <h3 className="text-xl font-semibold mb-4 text-center">
                  Page Feedback
                </h3>

                <input
                  type="number"
                  min="1"
                  max="5"
                  value={feedback.rating}
                  onChange={(e) =>
                    setFeedback({ ...feedback, rating: e.target.value })
                  }
                  placeholder="Rate this page (1-5)"
                  className="w-full p-2 border rounded"
                  required
                />
                <input
                  type="text"
                  value={feedback.clarity}
                  onChange={(e) =>
                    setFeedback({ ...feedback, clarity: e.target.value })
                  }
                  placeholder="Was the information clear?"
                  className="w-full p-2 border rounded"
                  required
                />
                <textarea
                  value={feedback.improvements}
                  onChange={(e) =>
                    setFeedback({ ...feedback, improvements: e.target.value })
                  }
                  placeholder="What could be improved?"
                  className="w-full p-2 border rounded"
                />
                <textarea
                  value={feedback.issues}
                  onChange={(e) =>
                    setFeedback({ ...feedback, issues: e.target.value })
                  }
                  placeholder="Did you face any issues?"
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  value={feedback.recommend}
                  onChange={(e) =>
                    setFeedback({ ...feedback, recommend: e.target.value })
                  }
                  placeholder="Would you recommend this page?"
                  className="w-full p-2 border rounded"
                />

                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Submit Feedback
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
