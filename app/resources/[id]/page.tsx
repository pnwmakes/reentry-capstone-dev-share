// app/resources/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Resource, Organization, Location } from "@/types";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Mail,
  Clock,
  Users,
  Star,
} from "lucide-react";

interface ResourceWithDetails extends Resource {
  organization: Organization;
  locations: Location[];
  avgRating?: number;
  reviewCount?: number;
}

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [resource, setResource] = useState<ResourceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResource() {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/resources/${params.id}`);
        if (!response.ok) {
          throw new Error("Resource not found");
        }
        const data = await response.json();
        setResource(data);
      } catch (err) {
        console.error("Error fetching resource:", err);
        setError("Failed to load resource details");
      } finally {
        setLoading(false);
      }
    }

    fetchResource();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading resource details...</p>
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Resource Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            {error || "The requested resource could not be found."}
          </p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {resource.name}
              </h1>
              <p className="text-lg text-blue-600 font-medium">
                {resource.organization.name}
              </p>
              <span className="inline-block mt-2 bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                {resource.category}
              </span>
            </div>

            {resource.avgRating && (
              <div className="flex items-center bg-yellow-50 px-3 py-2 rounded-lg">
                <Star className="w-5 h-5 text-yellow-400 fill-current mr-1" />
                <span className="font-semibold">
                  {resource.avgRating.toFixed(1)}
                </span>
                <span className="text-gray-500 text-sm ml-1">
                  ({resource.reviewCount} reviews)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Description */}
            <section className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                About This Resource
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {resource.description}
              </p>
            </section>

            {/* Services */}
            {resource.services && resource.services.length > 0 && (
              <section className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Services Offered
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {resource.services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center text-gray-700"
                    >
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      {service}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Eligibility */}
            {resource.eligibilityRequirements &&
              resource.eligibilityRequirements.length > 0 && (
                <section className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Eligibility Requirements
                  </h2>
                  <div className="space-y-2">
                    {resource.eligibilityRequirements.map(
                      (requirement, index) => (
                        <div
                          key={index}
                          className="flex items-start text-gray-700"
                        >
                          <div className="w-2 h-2 bg-green-600 rounded-full mr-3 mt-2"></div>
                          {requirement}
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

            {/* Locations */}
            <section className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Locations
              </h2>
              <div className="space-y-4">
                {resource.locations.map((location) => (
                  <div
                    key={location.id}
                    className="border-l-4 border-blue-600 pl-4"
                  >
                    <h3 className="font-medium text-gray-900">
                      {location.name}
                    </h3>
                    <div className="flex items-start text-gray-600 mt-1">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <div>{location.address.street}</div>
                        <div>
                          {location.address.city}, {location.address.state}{" "}
                          {location.address.zipCode}
                        </div>
                      </div>
                    </div>
                    {location.contactInfo?.phone && (
                      <div className="flex items-center text-gray-600 mt-2">
                        <Phone className="w-4 h-4 mr-2" />
                        <a
                          href={`tel:${location.contactInfo.phone}`}
                          className="hover:text-blue-600"
                        >
                          {location.contactInfo.phone}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Contact Information
              </h3>
              <div className="space-y-3">
                {resource.organization.contactInfo?.phone && (
                  <div className="flex items-center text-gray-700">
                    <Phone className="w-5 h-5 mr-3 text-gray-400" />
                    <a
                      href={`tel:${resource.organization.contactInfo.phone}`}
                      className="hover:text-blue-600"
                    >
                      {resource.organization.contactInfo.phone}
                    </a>
                  </div>
                )}
                {resource.organization.contactInfo?.email && (
                  <div className="flex items-center text-gray-700">
                    <Mail className="w-5 h-5 mr-3 text-gray-400" />
                    <a
                      href={`mailto:${resource.organization.contactInfo.email}`}
                      className="hover:text-blue-600"
                    >
                      {resource.organization.contactInfo.email}
                    </a>
                  </div>
                )}
                {resource.organization.website && (
                  <div className="flex items-center text-gray-700">
                    <Globe className="w-5 h-5 mr-3 text-gray-400" />
                    <a
                      href={resource.organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Hours */}
            {resource.locations && resource.locations.length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Hours
                </h3>
                {resource.locations.map(
                  (location) =>
                    location.hours && (
                      <div key={location.id} className="mb-4">
                        <div className="flex items-start text-gray-700">
                          <Clock className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                          <div>
                            {location.name && (
                              <h4 className="font-medium text-gray-800">
                                {location.name}
                              </h4>
                            )}
                            <div className="whitespace-pre-line">
                              {Object.entries(location.hours).map(
                                ([day, time]) => (
                                  <div key={day}>
                                    <span className="font-semibold">
                                      {day}:
                                    </span>{" "}
                                    {time}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                )}
              </div>
            )}
            {/* Capacity */}
            {resource.capacity && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Availability
                </h3>
                <div className="flex items-center text-gray-700">
                  <Users className="w-5 h-5 mr-3 text-gray-400" />
                  <div>
                    <div className="font-medium">
                      {resource.capacity.available || 0} /{" "}
                      {resource.capacity.total || 0} Available
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Current capacity
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Apply Button */}
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
              Apply for This Resource
            </button>

            <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors">
              Save to Favorites
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
