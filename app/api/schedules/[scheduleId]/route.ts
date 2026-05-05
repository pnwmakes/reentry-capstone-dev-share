import { type NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { User, Location } from '@/types';

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
            console.error("❌ Error initializing Firebase Admin SDK for schedules API:", error);
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

interface ScheduleUpdateData {
    hours?: {
        [key: string]: string; // e.g., { 'Monday': '9:00 AM - 5:00 PM', 'Tuesday': 'Closed' }
    };
    specialHours?: {
        date: string; // YYYY-MM-DD
        hours: string; // e.g., 'Closed', '10:00 AM - 2:00 PM'
    }[];
}

// ============================================================================
// GET Method: Fetch a location's schedule by location ID
// ============================================================================
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ error: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { scheduleId: locationId } = await params;

        if (!locationId) {
            return NextResponse.json({ error: 'Location ID is required.' }, { status: 400 });
        }

        // Get the location from the locations collection
        const locationRef = db.collection('locations').doc(locationId);
        const locationDoc = await locationRef.get();

        if (!locationDoc.exists) {
            return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
        }

        const locationData = locationDoc.data() as Location;

        // Return just the schedule-related data
        const scheduleData = {
            hours: locationData.hours || {},
            specialHours: locationData.specialHours || []
        };

        return NextResponse.json(scheduleData, { status: 200 });

    } catch (error: unknown) {
        console.error("Error fetching location schedule:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { error: `Error fetching schedule: ${errorMessage}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// PUT Method: Update a location's schedule
// ============================================================================
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ error: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { scheduleId: locationId } = await params;
        const scheduleData: ScheduleUpdateData = await request.json();

        if (!locationId) {
            return NextResponse.json({ error: 'Location ID is required for update.' }, { status: 400 });
        }

        if (!scheduleData || (typeof scheduleData !== 'object')) {
            return NextResponse.json({ error: 'Invalid schedule data provided.' }, { status: 400 });
        }

        // Get the location reference
        const locationRef = db.collection('locations').doc(locationId);
        const existingLocation = await locationRef.get();

        if (!existingLocation.exists) {
            console.error('Schedule API: Location not found in database:', locationId);

            const allLocationsSnapshot = await db.collection('locations').limit(5).get();
            const allLocationIds = allLocationsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

            return NextResponse.json({
                error: 'Location not found.',
                locationId: locationId,
                sampleLocations: allLocationIds
            }, { status: 404 });
        }

        // Prepare the update payload
        const updatePayload: Partial<Location> = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedAt: new Date() as any,
        };

        // Add hours if provided
        if (scheduleData.hours !== undefined) {
            updatePayload.hours = scheduleData.hours;
        }

        // Add special hours if provided
        if (scheduleData.specialHours !== undefined) {
            updatePayload.specialHours = scheduleData.specialHours;
        }

        await locationRef.update(updatePayload);

        // Get the updated location
        const updatedLocationDoc = await locationRef.get();
        const updatedLocation = {
            id: updatedLocationDoc.id,
            ...updatedLocationDoc.data()
        } as Location;

        return NextResponse.json({
            message: 'Schedule updated successfully!',
            location: updatedLocation
        }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error updating location schedule:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { error: `Error updating schedule: ${errorMessage}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE Method: Clear a location's schedule
// ============================================================================
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ error: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { scheduleId: locationId } = await params;

        if (!locationId) {
            return NextResponse.json({ error: 'Location ID is required.' }, { status: 400 });
        }

        const locationRef = db.collection('locations').doc(locationId);
        const locationDoc = await locationRef.get();

        if (!locationDoc.exists) {
            return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
        }

        // Clear the schedule data
        await locationRef.update({
            hours: {},
            specialHours: [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedAt: new Date() as any
        });

        return NextResponse.json({ message: 'Schedule cleared successfully!' }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error clearing location schedule:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { error: `Error clearing schedule: ${errorMessage}` },
            { status: 500 }
        );
    }
}
