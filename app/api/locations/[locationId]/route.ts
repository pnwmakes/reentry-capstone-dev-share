import { type NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue, Firestore, GeoPoint } from 'firebase-admin/firestore';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { Location, Resource, User } from '@/types';

// ============================================================================
// Firebase Admin SDK Initialization
// ============================================================================

let adminApp: App;
let db: Firestore;
let adminAuth: ReturnType<typeof getAuth>;
(() => {
    if (getApps().length > 0) {
        adminApp = getApps()[0];
    } else {
        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
            console.error("❌ Missing Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)");
            throw new Error("Missing Firebase Admin SDK credentials.");
        }

        try {
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (privateKey) {
                privateKey = privateKey.replace(/\\n/g, '\n');
            }

            const serviceAccountKey: ServiceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID!,
                privateKey: privateKey!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            };

            adminApp = initializeApp({
                credential: cert(serviceAccountKey),
                projectId: serviceAccountKey.projectId,
            });
        } catch (error: unknown) {
            console.error("❌ Error initializing Firebase Admin SDK for locations API:", error);
            let errorMessage = 'Unknown error during Firebase Admin SDK initialization.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            throw new Error(`Failed to initialize Firebase Admin SDK: ${errorMessage}. Check environment variables.`);
        }
    }

    db = getFirestore(adminApp, 'reentry');
    adminAuth = getAuth(adminApp);
})();

// ============================================================================
// Authentication Helper
// ============================================================================
async function authenticateAdmin(request: NextRequest): Promise<{ authenticated: boolean, decodedToken?: DecodedIdToken, errorMessage?: string }> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, errorMessage: 'No authorization token provided.' };
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userUid = decodedToken.uid;

        const userProfileRef = db.collection('users').doc(userUid);
        const userProfileDoc = await userProfileRef.get();

        if (!userProfileDoc.exists) {
            console.warn(`User profile not found for UID: ${userUid}`);
            return { authenticated: false, errorMessage: 'User profile not found.' };
        }

        const userProfile = userProfileDoc.data() as User;
        if (userProfile.role !== 'admin') {
            console.warn(`Unauthorized access attempt by non-admin role: ${userProfile.role} for UID: ${userUid}`);
            return { authenticated: false, errorMessage: 'User does not have administrative privileges.' };
        }

        return { authenticated: true, decodedToken };
    } catch (error) {
        console.error('Error verifying Firebase ID token or fetching user profile:', error);
        return { authenticated: false, errorMessage: 'Invalid or expired authentication token.' };
    }
}

// ============================================================================
// GET Method: Fetch a single location by ID
// ============================================================================
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ locationId: string }> }
) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ message: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { locationId } = await context.params;

        if (!locationId) {
            return NextResponse.json({ message: 'Error: Location ID is required.' }, { status: 400 });
        }

        const locationRef = db.collection('locations').doc(locationId);
        const locationDoc = await locationRef.get();

        if (!locationDoc.exists) {
            return NextResponse.json({ message: 'Error: Location not found.' }, { status: 404 });
        }

        const locationData = {
            id: locationDoc.id,
            ...locationDoc.data() as Omit<Location, 'id'>
        };

        return NextResponse.json(locationData, { status: 200 });

    } catch (error: unknown) {
        console.error("Error fetching location:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { message: `Error fetching location: ${errorMessage}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// PUT Method: Update an existing location
// ============================================================================
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ locationId: string }> }
) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ message: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { locationId } = await context.params;
        const updatedLocationData: Partial<Location> = await request.json();

        if (!locationId) {
            return NextResponse.json({ message: 'Error: Location ID is required for update.' }, { status: 400 });
        }

        const locationRef = db.collection('locations').doc(locationId);
        const existingLocation = await locationRef.get();

        if (!existingLocation.exists) {
            return NextResponse.json({ message: 'Error: Location not found.' }, { status: 404 });
        }

        const processedData = { ...updatedLocationData };
        if (processedData.coordinates &&
            typeof processedData.coordinates.latitude === 'number' &&
            typeof processedData.coordinates.longitude === 'number') {
            processedData.coordinates = new GeoPoint(
                processedData.coordinates.latitude,
                processedData.coordinates.longitude
            );
        }

        const updatePayload = {
            ...processedData,
            updatedAt: Timestamp.now(),
        };

        // Remove the id from the payload to prevent it from being saved as a field
        delete updatePayload.id;

        await locationRef.update(updatePayload);

        return NextResponse.json({ message: 'Location updated successfully!' }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error updating location:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { message: `Error updating location: ${errorMessage}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE Method: Delete a location
// ============================================================================
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ locationId: string }> }
) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ message: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { locationId } = await context.params;

        if (!locationId) {
            return NextResponse.json({ message: 'Error: Location ID is required for deletion.' }, { status: 400 });
        }

        const locationRef = db.collection('locations').doc(locationId);
        const locationDoc = await locationRef.get();

        if (!locationDoc.exists) {
            return NextResponse.json({ message: 'Error: Location not found.' }, { status: 404 });
        }

        const locationData = locationDoc.data() as Location;
        const organizationId = locationData.organizationId;
        const locationIdToDelete = locationDoc.id;

        await db.runTransaction(async (transaction) => {
            // Check for resources tied to this location and update them
            const resourcesWithLocationRef = db.collection('resources').where('locationIds', 'array-contains', locationIdToDelete);
            const resourcesSnapshot = await transaction.get(resourcesWithLocationRef);

            resourcesSnapshot.docs.forEach(doc => {
                const resourceData = doc.data() as Resource;
                const newLocationIds = resourceData.locationIds ? resourceData.locationIds.filter(id => id !== locationIdToDelete) : [];
                transaction.update(doc.ref, { locationIds: newLocationIds, updatedAt: Timestamp.now() });
            });

            // Delete the location document
            transaction.delete(locationRef);

            // Decrement the totalLocations count on the parent organization
            if (organizationId) {
                const orgDocRef = db.collection('organizations').doc(organizationId);
                transaction.update(orgDocRef, {
                    totalLocations: FieldValue.increment(-1),
                    updatedAt: Timestamp.now()
                });
            }
        });

        return NextResponse.json({ message: 'Location and associated data deleted successfully!' }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error deleting location:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { message: `Error deleting location: ${errorMessage}` },
            { status: 500 }
        );
    }
}
