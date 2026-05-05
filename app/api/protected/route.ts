import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app'; // Import ServiceAccount
import serviceAccount from '../../../serviceAccountKey.json';


if (!getApps().length) {
    initializeApp({

        credential: cert(serviceAccount as ServiceAccount),
    });
}

/**
 * Handles GET requests to the protected API route.
 * This route verifies a Firebase ID token from the Authorization header.
 *
 * @param req The NextRequest object containing the incoming request.
 * @returns A NextResponse object with authorization status and user data, or an error.
 */
export async function GET(req: NextRequest) {

    const token = req.headers.get('authorization')?.replace('Bearer ', '');


    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    try {

        const decodedToken = await getAuth().verifyIdToken(token);


        return NextResponse.json({
            message: 'Authorized',
            uid: decodedToken.uid,
            email: decodedToken.email,
        });
    } catch (error: unknown) {

        if (error instanceof Error) {
            console.error('Firebase ID token verification failed:', error.message);
        } else {
            console.error('An unknown error occurred during token verification:', error);
        }


        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}
