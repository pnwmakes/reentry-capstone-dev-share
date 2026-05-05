"use client";

import React, { useEffect, useState } from "react";
import { Event } from "@/types";

export default function UpcomingEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-zinc-800 dark:text-zinc-100">
          Upcoming Events
        </h1>
        {loading ? (
          <p className="text-center text-zinc-500">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="text-center text-zinc-500">No upcoming events.</p>
        ) : (
          <ul className="space-y-6">
            {events.map((event) => (
              <li
                key={event.id}
                className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 border border-zinc-200 dark:border-zinc-700"
              >
                <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-2">
                  {event.title}
                </h2>
                <div className="text-zinc-600 dark:text-zinc-400 mb-1">
                  <span className="font-medium">Date:</span>{" "}
                  {new Date(event.date).toLocaleDateString()}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400 mb-2">
                  <span className="font-medium">Location:</span>{" "}
                  {event.location?.name}
                </div>
                <p className="text-zinc-700 dark:text-zinc-200">
                  {event.description}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
