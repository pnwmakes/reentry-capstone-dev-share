/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  ResourceCategory,
  ResourceCategoryType,
  ResourceWithDetails,
  SearchFilters,
} from "@/types/index";
import { queryExternalResources } from "@/lib/externalResources";
import { getResourcesWithDetails } from "@/lib/firestore";

const VALID_CATEGORIES = new Set<ResourceCategoryType>(
  Object.values(ResourceCategory)
);
function isValidResourceCategory(
  category: string
): category is ResourceCategoryType {
  return VALID_CATEGORIES.has(category as ResourceCategoryType);
}

const DEFAULT_LIMIT = 20;

function serializeTimestamp(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as any).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function serializeGeoPoint(
  point: any
): { latitude: number; longitude: number } | undefined {
  if (!point) {
    return undefined;
  }
  if (
    typeof point.latitude === "number" &&
    typeof point.longitude === "number"
  ) {
    return { latitude: point.latitude, longitude: point.longitude };
  }
  if (typeof point._lat === "number" && typeof point._long === "number") {
    return { latitude: point._lat, longitude: point._long };
  }
  return undefined;
}

function serializeLocation(location: any) {
  return {
    ...location,
    coordinates: serializeGeoPoint(location?.coordinates),
    createdAt: serializeTimestamp(location?.createdAt),
    updatedAt: serializeTimestamp(location?.updatedAt),
  };
}

function serializeOrganization(organization: any) {
  if (!organization) {
    return undefined;
  }
  return {
    ...organization,
    coordinates: serializeGeoPoint(organization?.coordinates),
    createdAt: serializeTimestamp(organization?.createdAt),
    updatedAt: serializeTimestamp(organization?.updatedAt),
  };
}

function serializeResource(
  resource: ResourceWithDetails,
  includeLocations: boolean
) {
  const base = {
    ...resource,
    createdAt: serializeTimestamp(resource.createdAt),
    updatedAt: serializeTimestamp(resource.updatedAt),
  } as Record<string, unknown>;

  if (includeLocations) {
    base.locations = (resource.locations ?? []).map(serializeLocation);
    base.organization = serializeOrganization(resource.organization);
  } else {
    delete base.locations;
    delete base.organization;
  }

  return base;
}

async function queryResourcesFromFirestore(options: {
  category?: ResourceCategoryType;
  limit?: number;
  cursor?: number;
  includeLocations: boolean;
}) {
  const offset = Math.max(0, options.cursor ?? 0);
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const fetchLimit = offset + limit + 1; // fetch an extra to determine hasMore

  const filters: SearchFilters | undefined = options.category
    ? { category: options.category }
    : undefined;

  const detailedResources = await getResourcesWithDetails(filters, fetchLimit);
  const hasMore = detailedResources.length > offset + limit;
  const slice = detailedResources.slice(offset, offset + limit);

  const serialized = slice.map((resource) =>
    serializeResource(resource, options.includeLocations)
  );

  return {
    resources: serialized,
    nextCursor: hasMore ? offset + limit : null,
    total: detailedResources.length,
    hasMore,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get("category");
    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");
    const includeLocationsParam = searchParams.get("includeLocations");

    let category: ResourceCategoryType | undefined;
    if (
      typeof categoryParam === "string" &&
      isValidResourceCategory(categoryParam)
    ) {
      category = categoryParam as ResourceCategoryType;
    }

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : undefined;
    const includeLocations =
      includeLocationsParam === "true" || includeLocationsParam === "1";

    const dataSource = (process.env.RESOURCE_DATA_SOURCE || "").toLowerCase();

    if (dataSource === "firestore") {
      const { resources, nextCursor, total, hasMore } =
        await queryResourcesFromFirestore({
          category,
          limit,
          cursor,
          includeLocations,
        });

      return NextResponse.json({
        resources,
        nextCursor,
        total,
        hasMore,
      });
    }

    const { resources, nextCursor, total, hasMore } =
      await queryExternalResources({
        category,
        limit,
        cursor,
        includeLocations,
      });

    return NextResponse.json({
      resources,
      nextCursor,
      total,
      hasMore,
    });
  } catch (error) {
    console.error("External resources API error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
