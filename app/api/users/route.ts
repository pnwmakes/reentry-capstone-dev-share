import { type NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { User, UserRole } from '@/types';

// ============================================================================
// Firebase Admin SDK Initialization
// ============================================================================
let adminApp: App;
if (!getApps().length) {
    if (
        !process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_CLIENT_EMAIL ||
        !process.env.FIREBASE_PRIVATE_KEY
    ) {
        console.error(
            'Missing Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)'
        );
        throw new Error('Missing Firebase Admin SDK credentials.');
    }

    try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        const serviceAccountKey: ServiceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: privateKey,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };

        adminApp = initializeApp({
            credential: cert(serviceAccountKey),
            projectId: serviceAccountKey.projectId,
        });
    } catch (error) {
        console.error('Error initializing Firebase Admin SDK for users API:', error);
        throw new Error('Failed to initialize Firebase Admin SDK. Check environment variables.');
    }
} else {
    adminApp = getApps()[0];
}

const adminAuth = getAuth(adminApp);
const db = getFirestore(adminApp, 'reentry');

// ============================================================================
// Authentication Helper
// ============================================================================
async function authenticateAdmin(request: NextRequest): Promise<{
    authenticated: boolean;
    decodedToken?: DecodedIdToken;
    errorMessage?: string;
}> {
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
// GET Method: Fetch all users
// ============================================================================
export async function GET(request: NextRequest) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ message: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();

        const users: User[] = snapshot.docs.map((doc) => ({
            uid: doc.id,
            ...doc.data() as Omit<User, 'uid'>,
        }));

        return NextResponse.json(users, { status: 200 });
    } catch (error: unknown) {
        console.error('Error fetching users:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ message: `Error fetching users: ${errorMessage}` }, { status: 500 });
    }
}

// ============================================================================
// PUT Method: Update an existing user
// ============================================================================
export async function PUT(request: NextRequest) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ message: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const updatedFields: Partial<User> & { uid?: string } = await request.json();

        if (!updatedFields.uid) {
            return NextResponse.json({ message: 'Error: User UID is required for update.' }, { status: 400 });
        }

        // Validate role if provided
        if (updatedFields.role) {
            const validRoles: UserRole[] = ['admin', 'moderator', 'organization_admin', 'user'];
            if (!validRoles.includes(updatedFields.role)) {
                return NextResponse.json({ message: 'Error: Invalid user role provided.' }, { status: 400 });
            }
        }

        const userRef = db.collection('users').doc(updatedFields.uid);
        const existingUser = await userRef.get();

        if (!existingUser.exists) {
            return NextResponse.json({ message: 'Error: User not found.' }, { status: 404 });
        }

        const fieldsToUpdate = { ...updatedFields };
        delete fieldsToUpdate.uid;

        // Convert Date objects to Timestamps if needed
        if (fieldsToUpdate.createdAt && fieldsToUpdate.createdAt instanceof Date) {
            fieldsToUpdate.createdAt = AdminTimestamp.fromDate(fieldsToUpdate.createdAt);
        }
        if (fieldsToUpdate.lastLogin && fieldsToUpdate.lastLogin instanceof Date) {
            fieldsToUpdate.lastLogin = AdminTimestamp.fromDate(fieldsToUpdate.lastLogin);
        }

        await userRef.update(fieldsToUpdate);

        return NextResponse.json({ message: 'User updated successfully!' }, { status: 200 });
    } catch (error: unknown) {
        console.error('Error updating user:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ message: `Error updating user: ${errorMessage}` }, { status: 500 });
    }
}

// ============================================================================
// DELETE Method: Delete a user
// ============================================================================
export async function DELETE(request: NextRequest) {
    const authResult = await authenticateAdmin(request);
    if (!authResult.authenticated) {
        return NextResponse.json({ message: authResult.errorMessage || 'Unauthorized.' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ message: 'Error: User ID is required for deletion.' }, { status: 400 });
        }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return NextResponse.json({ message: 'Error: User not found.' }, { status: 404 });
        }

        // Check if trying to delete the last admin
        const userData = userDoc.data() as User;
        if (userData.role === 'admin') {
            const adminUsersSnapshot = await db.collection('users').where('role', '==', 'admin').get();
            if (adminUsersSnapshot.size <= 1) {
                return NextResponse.json({
                    message: 'Error: Cannot delete the last admin user.'
                }, { status: 400 });
            }
        }

        const batch = db.batch();

        // Delete related user data
        const favoritesQuery = db.collection('userFavorites').where('userId', '==', userId);
        const favoritesSnapshot = await favoritesQuery.get();
        favoritesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const applicationsQuery = db.collection('applications').where('userId', '==', userId);
        const applicationsSnapshot = await applicationsQuery.get();
        applicationsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const reviewsQuery = db.collection('reviews').where('userId', '==', userId);
        const reviewsSnapshot = await reviewsQuery.get();
        reviewsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const notificationsQuery = db.collection('notifications').where('userId', '==', userId);
        const notificationsSnapshot = await notificationsQuery.get();
        notificationsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Delete the user document
        batch.delete(userRef);

        await batch.commit();

        // Also delete from Firebase Auth
        try {
            await adminAuth.deleteUser(userId);
        } catch (authError) {
            console.warn('Failed to delete user from Firebase Auth:', authError);
            // Continue anyway as the Firestore data is deleted
        }

        return NextResponse.json(
            { message: 'User and associated data deleted successfully!' },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error('Error deleting user:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ message: `Error deleting user: ${errorMessage}` }, { status: 500 });
    }
}