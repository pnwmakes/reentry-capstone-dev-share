import { NextRequest, NextResponse } from "next/server";
import { getExternalResourceById } from "@/lib/externalResources";
import { getResourceWithDetailsById } from "@/lib/firestore";
import { Location, Organization, ResourceWithDetails } from "@/types";

function serializeTimestamp(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function serializeGeoPoint(
  point: unknown
): { latitude: number; longitude: number } | undefined {
  if (!point) {
    return undefined;
  }
  if (
    typeof point === "object" &&
    point !== null &&
    "latitude" in point &&
    "longitude" in point
  ) {
    const { latitude, longitude } = point as {
      latitude: unknown;
      longitude: unknown;
    };
    if (typeof latitude === "number" && typeof longitude === "number") {
      return { latitude, longitude };
    }
  }
  if (
    typeof point === "object" &&
    point !== null &&
    "_lat" in point &&
    "_long" in point
  ) {
    const { _lat, _long } = point as { _lat: unknown; _long: unknown };
    if (typeof _lat === "number" && typeof _long === "number") {
      return { latitude: _lat, longitude: _long };
    }
  }
  return undefined;
}

function serializeLocation(location: Location) {
  return {
    ...location,
    coordinates: serializeGeoPoint(location.coordinates),
    createdAt: serializeTimestamp(location.createdAt),
    updatedAt: serializeTimestamp(location.updatedAt),
  };
}

function serializeOrganization(organization: Organization | undefined) {
  if (!organization) {
    return undefined;
  }
  return {
    ...organization,
    createdAt: serializeTimestamp(organization.createdAt),
    updatedAt: serializeTimestamp(organization.updatedAt),
  };
}

function serializeResourceDetail(resource: ResourceWithDetails) {
  const base: Record<string, unknown> = {
    ...resource,
    createdAt: serializeTimestamp(resource.createdAt),
    updatedAt: serializeTimestamp(resource.updatedAt),
    organization: serializeOrganization(resource.organization),
    locations: (resource.locations ?? []).map(serializeLocation),
  };

  if (resource.averageRating !== undefined) {
    base.averageRating = resource.averageRating;
  }
  if (resource.totalReviews !== undefined) {
    base.totalReviews = resource.totalReviews;
  }

  if (resource.hours !== undefined) {
    base.hours = resource.hours;
  }

  return base;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await params;
    const resourceId = resolved.id;

    if (!resourceId) {
      return NextResponse.json(
        { message: "Resource ID is required" },
        { status: 400 }
      );
    }

    const dataSource = (process.env.RESOURCE_DATA_SOURCE || "").toLowerCase();

    if (dataSource === "firestore") {
      const firestoreDetail = await getResourceWithDetailsById(resourceId);
      if (firestoreDetail) {
        return NextResponse.json(serializeResourceDetail(firestoreDetail));
      }
    }

    const detail = await getExternalResourceById(resourceId);
    if (!detail) {
      return NextResponse.json(
        { message: "Resource not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...detail.resource,
      organization: detail.organization,
      locations: detail.locations,
    });
  } catch (error) {
    console.error("External resource detail error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
