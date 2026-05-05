"use client";

import dynamic from "next/dynamic";
import ResourceList from "@/components/ResourceList";

const ResourceMap = dynamic(() => import("@/components/ResourceMap"), {
  ssr: false,
});

export default function ResourcesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Resources</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ResourceList />
        </div>
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <ResourceMap />
          </div>
        </div>
      </div>
    </div>
  );
}
