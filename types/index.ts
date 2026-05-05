// src/types/index.ts - Comprehensive Database type definitions for Reentry Resource App

import { GeoPoint } from "firebase-admin/firestore";
import { Timestamp } from "@firebase/firestore";

import { User as FirebaseAuthUser } from "firebase/auth";

/**
 * User Roles: Defines the different access levels for users in the system.
 */
export type UserRole = "admin" | "moderator" | "organization_admin" | "user";

export interface AppUser extends FirebaseAuthUser {
  role: UserRole;
  isVerified: boolean;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  displayName: string | null;
  email: string | null;
  uid: string;
  organizationId?: string;
}
export interface FirestoreCompatibleTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  toJSON?(): { seconds: number; nanoseconds: number };
  isEqual(other: FirestoreCompatibleTimestamp): boolean;
}

/**
 * Resource Categories: Broad classifications for the types of resources available.
 */

export const ResourceCategory = {
  HOUSING: "Housing",
  EMPLOYMENT: "Employment",
  HEALTHCARE: "Healthcare",
  LEGAL: "Legal",
  EDUCATION: "Education",
  TRANSPORTATION: "Transportation",
  FOOD: "Food",
  MENTAL_HEALTH: "Mental Health",
  SUBSTANCE_ABUSE: "Substance Abuse",
  FAMILY_SERVICES: "Family Services",
  FINANCIAL_AID: "Financial Aid",
  CHILDCARE: "Childcare",
  VETERANS_SERVICES: "Veterans Services",
  DISABILITY_SERVICES: "Disability Services",
  OTHER: "Other",
} as const;

// Union type of all possible ResourceCategory values
export type ResourceCategoryType =
  (typeof ResourceCategory)[keyof typeof ResourceCategory];
/**
 * Resource Status: Indicates the current operational status of a resource.
 */
export const ResourceStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING_REVIEW: "pending_review",
  SUSPENDED: "suspended",
} as const;

// Infer the union type from the values of the ResourceStatus object
export type ResourceStatus =
  (typeof ResourceStatus)[keyof typeof ResourceStatus];

/**
 * Application Status: Tracks the progress of a user's application for a resource.
 */
export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "withdrawn";

/**
 * Notification Type: Defines different types of notifications users can receive.
 */
export type NotificationType =
  | "new_resource"
  | "status_update"
  | "application_update"
  | "message"
  | "admin_alert";

/**
 * Eligibility Requirement Types: Specific criteria for resources.
 */
export type EligibilityRequirement =
  | "formerly_incarcerated"
  | "veteran"
  | "homeless"
  | "low_income"
  | "family_with_children"
  | "disabled"
  | "age_restriction"
  | "gender_specific"
  | "substance_abuse_recovery"
  | "mental_health_support"
  | "other";

/**
 * User: Represents a user profile in the system.
 * Renamed from UserProfile to User to match user's lib/firestore.ts
 */
export interface User {
  uid: string; // Firebase Auth UID
  email: string;
  displayName?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: Date | FirestoreCompatibleTimestamp;
  lastLogin: FirestoreCompatibleTimestamp | Date;
  organizationId?: string;
  preferences?: {
    notifications: boolean;
    categories: ResourceCategoryType[];
  };
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
}

/**
 * Organization: Represents an organization providing resources.
 */
export interface Organization {
  id: string;
  name: string;
  description: string;
  website?: string;
  contactInfo: {
    phone?: string;
    email?: string;
    website?: string;
    contactName?: string;
    supportEmail?: string;
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
      youtube?: string;
    };
  };
  hours?: { [key: string]: string };
  specialHours?: { date: string; hours: string }[];
  coordinates?: {
    latitude: number;
    longitude: number;
    toJSON?: () => unknown;
    isEqual?: (other: unknown) => boolean;
    _lat?: number;
    _long?: number;
  };
  logoUrl?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  categories?: ResourceCategoryType[];
  status: "active" | "pending" | "rejected";
  isVerified: boolean;
  adminUsers: string[];
  totalResources: number;
  avgRating: number;
  totalReviews: number;
  createdAt: FirestoreCompatibleTimestamp;
  updatedAt: FirestoreCompatibleTimestamp;
}
/**
 * Location: Represents a physical location where an organization offers resources.
 */
export interface Location {
  id: string; // Firestore Document ID
  organizationId: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  coordinates:
    | GeoPoint
    | {
        latitude: number;
        longitude: number;
        toJSON?: () => unknown;
        isEqual?: (other: unknown) => boolean;
        _lat?: number;
        _long?: number;
      };
  accessibility: {
    wheelchairAccessible: boolean;
    publicTransportNearby: boolean;
    parkingAvailable: boolean;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
  };

  isMainLocation?: boolean;
  status: "active" | "inactive";
  phone?: string;
  email?: string;
  hours?: {
    [key: string]: string; // e.g., { 'Monday': '9:00 AM - 5:00 PM', 'Saturday': 'Closed' }
  };
  specialHours?: {
    // Special hours for specific dates (e.g., holidays)
    date: string; // YYYY-MM-DD
    hours: string; // e.g., 'Closed', '10:00 AM - 2:00 PM'
  }[];
  createdAt?: FirestoreCompatibleTimestamp;
  updatedAt?: FirestoreCompatibleTimestamp;
}
export interface Contact {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
}
export interface Feedback {
  id: string;
  name: string;
  feedback: string;
  createdAt: Date;
}

/**
 * Resource: Represents a specific service or item offered by an organization.
 * Updated to match fields in ResourceList.tsx and seed-database.ts
 */
export interface Resource {
  id: string;
  organizationId: string;
  locationIds?: string[];
  name: string;
  description: string;
  category: ResourceCategoryType;
  services?: string[];
  subcategory?: string;
  eligibilityRequirements: EligibilityRequirement[];
  applicationProcess?: string;
  documentsRequired?: string[];
  cost?: {
    isFree: boolean;
    amount?: number;
    description?: string;
  };
  capacity?: {
    total: number;
    available: number;
  };
  currentOccupancy?: number;
  waitlistAvailable?: boolean;
  tags?: string[];
  contactInfo: {
    phone?: string;
    email?: string;
    website?: string;
  };
  status: ResourceStatus;
  priority: number;
  imageUrl?: string;
  viewsCount?: number;
  averageRating?: number;
  totalReviews?: number;
  createdBy: string;
  createdAt: FirestoreCompatibleTimestamp;
  updatedAt: FirestoreCompatibleTimestamp;
}

/**
 * ResourceWithDetails: Resource combined with its related Organization and Location data, and user-specific info.
 * Used for detailed display on frontend.
 */
export interface ResourceWithDetails extends Resource {
  organization: Organization;
  locations: Location[];
  userHasFavorited?: boolean;
  userApplication?: ResourceApplication;
  distanceFromUser?: number;
  hours?: {
    [key: string]: string;
  };
}

/**
 * ResourceApplication: Tracks a user's application for a specific resource.
 * Renamed from Application to match user's lib/firestore.ts
 */
export interface ResourceApplication {
  id: string;
  userId: string;
  resourceId: string;
  organizationId: string;
  status: ApplicationStatus;
  submittedAt: FirestoreCompatibleTimestamp;
  updatedAt: FirestoreCompatibleTimestamp;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: FirestoreCompatibleTimestamp;
  adminNotes?: string;
  completedAt?: FirestoreCompatibleTimestamp;
  formData?: Record<string, unknown>;
}

/**
 * ResourceReview: User-submitted review for a resource.
 * Renamed from Review to match user's lib/firestore.ts
 */
export interface ResourceReview {
  id: string;
  userId: string;
  resourceId: string;
  rating: number; // 1-5 stars
  comment?: string;
  createdAt: FirestoreCompatibleTimestamp;
  updatedAt: FirestoreCompatibleTimestamp;
  isApproved: boolean;
}

/**
 * UserFavorite: Tracks a user's favorited resources.
 */
export interface UserFavorite {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: FirestoreCompatibleTimestamp;
}

/**
 * SearchLog: Records user searches for analytics.
 */
export interface SearchLog {
  id: string;
  userId?: string;
  query: string;
  timestamp: FirestoreCompatibleTimestamp;
  resultsCount: number;
  filtersUsed?: SearchFilters;
}

/**
 * ResourceView: Tracks when a user views a specific resource.
 */
export interface ResourceView {
  id: string;
  userId?: string;
  resourceId: string;
  timestamp: FirestoreCompatibleTimestamp;
}

/**
 * Notification: Stores notifications for users.
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: FirestoreCompatibleTimestamp;
  link?: string;
}

/**
 * SearchFilters: Defines the structure for search criteria.
 */
export interface SearchFilters {
  category?: ResourceCategoryType;
  location?: {
    lat: number;
    lng: number;
    radius: number; // in kilometers
  };
  hasCapacity?: boolean;
  eligibilityRequirements?: EligibilityRequirement[];
}

// ResourceFormState: Used for resource forms (create/edit) with optional and form-friendly fields
export interface ResourceFormState
  extends Omit<
    Resource,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "viewsCount"
    | "averageRating"
    | "totalReviews"
    | "createdBy"
    | "cost"
    | "capacity"
    | "currentOccupancy"
    | "locationIds"
  > {
  id?: string;
  cost: {
    isFree: boolean;
    amount: number | null;
    description: string;
  } | null;
  capacity: {
    total: number | null;
    available: number | null;
  } | null;
  currentOccupancy: number | null;
  locationIds: string[];
}

// OrganizationFormState: Used for organization forms (create/edit)
export interface OrganizationFormState
  extends Omit<Organization, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  hours?: { [key: string]: string };
  specialHours?: { date: string; hours: string }[];
  coordinates?: {
    latitude: number;
    longitude: number;
    toJSON?: () => unknown;
    isEqual?: (other: unknown) => boolean;
    _lat?: number;
    _long?: number;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
}
// Event type definition
export type Event = {
  id: string | number;
  title: string;
  date: string;
  location?: {
    name: string;
    // Add other location fields if needed
  };
  description: string;
  isPublished?: boolean; // Optional field for published status
  // Add other event fields if
  // OrganizationFormState: Used for organization forms (create/edit)
};
// --- Data for Create/Update Operations ---
export type CreateLocationData = Omit<
  Location,
  "id" | "createdAt" | "updatedAt"
>;
export type CreateResourceData = Omit<
  Resource,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "viewsCount"
  | "averageRating"
  | "totalReviews"
>;
export type UpdateResourceData = Partial<
  Omit<Resource, "id" | "createdAt" | "updatedAt">
>;
export type CreateOrganizationData = Omit<
  Organization,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "totalResources"
  | "avgRating"
  | "totalReviews"
>;
export type UpdateOrganizationData = Partial<
  Omit<Organization, "id" | "createdAt" | "updatedAt">
>;
export type CreateUserData = Omit<AppUser, "uid" | "createdAt" | "lastLogin">;
// types/index.ts
export interface Testimonial {
  id?: string;
  firstname: string;
  lastname: string;
  email: string;
  testimonial: string;
  createdAt?: string;
}

export type UpdateUserData = Partial<Omit<User, "uid" | "createdAt">>;
