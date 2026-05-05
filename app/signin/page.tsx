'use client';

import { useState } from 'react';
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as fbSignOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { auth } from '@/lib/Firebase';
import { getUserProfile, createUserProfile } from '@/lib/firestore';
import type { User, UserRole } from '@/types';

export default function SignInPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Email/password sign-in
    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { user } = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            if (user.emailVerified) {
                router.push('/dashboard');
            } else {
                setError(
                    'Please verify your email address before signing in. A verification email might have been sent to your inbox.'
                );
                console.warn(
                    '⚠️ User signed in but email not verified:',
                    user.email
                );
                await auth.signOut();
            }
        } catch (err) {
            if (err instanceof FirebaseError) {
                switch (err.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        setError('Invalid email or password.');
                        break;
                    case 'auth/invalid-email':
                        setError('The email address is not valid.');
                        break;
                    case 'auth/too-many-requests':
                        setError(
                            'Too many sign-in attempts. Please try again later.'
                        );
                        break;
                    default:
                        setError(`Sign in failed: ${err.message}`);
                }
                console.error(
                    '❌ Firebase Sign in error:',
                    err.code,
                    err.message
                );
            } else if (err instanceof Error) {
                setError(`An unexpected error occurred: ${err.message}`);
                console.error('❌ General Sign in error:', err.message);
            } else {
                setError('An unknown error occurred during sign in.');
                console.error('❌ Unknown Sign in error:', err);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Google sign-in (ensure verified email + profile exists)
    const handleGoogleSignIn = async () => {
        setError('');
        setIsLoading(true);

        try {
            const provider = new GoogleAuthProvider();
            const { user: firebaseUser } = await signInWithPopup(
                auth,
                provider
            );

            if (!firebaseUser.emailVerified) {
                console.warn(
                    '⚠️ Google user signed in, but email is not verified:',
                    firebaseUser.email
                );
                await fbSignOut(auth);
                setError(
                    'Your Google account email is not verified. Please verify your email with Google before signing in.'
                );
                return;
            }

            let userProfile: User | null = await getUserProfile(
                firebaseUser.uid
            );
            if (!userProfile) {
                try {
                    userProfile = await createUserProfile(
                        firebaseUser,
                        'user' as UserRole
                    );
                } catch (createErr) {
                    console.error('❌ Error creating user profile:', createErr);
                    await fbSignOut(auth);
                    setError(
                        'Failed to create user profile. Please try again or contact support.'
                    );
                    return;
                }
            }

            if (userProfile && userProfile.role) {
                router.push('/dashboard');
            } else {
                console.error('❌ User profile incomplete after Google login.');
                await fbSignOut(auth);
                setError(
                    'Your user profile data is incomplete. Please contact support.'
                );
            }
        } catch (err) {
            setError(
                `Login failed: ${
                    err instanceof Error
                        ? err.message
                        : 'An unknown error occurred.'
                }`
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className='min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-900 px-4'>
            <div className='max-w-md w-full bg-white dark:bg-zinc-800 p-8 rounded-xl shadow'>
                <h1 className='text-2xl font-bold mb-6 text-center text-zinc-800 dark:text-white'>
                    Sign In
                </h1>

                {error && (
                    <p className='text-red-600 mb-4 text-sm text-center'>
                        {error}
                    </p>
                )}

                <form onSubmit={handleSignIn} className='space-y-4'>
                    <input
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder='Email'
                        required
                        className='w-full p-3 border rounded-md dark:bg-zinc-700 dark:text-white'
                        disabled={isLoading}
                    />
                    <input
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder='Password'
                        required
                        className='w-full p-3 border rounded-md dark:bg-zinc-700 dark:text-white'
                        disabled={isLoading}
                    />
                    <button
                        type='submit'
                        className='w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className='mt-6 text-center'>
                    <p className='text-zinc-600 dark:text-zinc-300 mb-2'>
                        Or sign in with Google:
                    </p>
                    <button
                        onClick={handleGoogleSignIn}
                        className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md shadow-md transition-colors duration-200 disabled:opacity-50'
                        disabled={isLoading}
                    >
                        Sign in with Google
                    </button>
                </div>

                <p className='mt-6 text-sm text-center text-zinc-600 dark:text-zinc-300'>
                    Don&apos;t have an account?{' '}
                    <Link
                        href='/signup'
                        className='text-blue-600 hover:underline dark:text-blue-400'
                    >
                        Create one
                    </Link>
                </p>
            </div>
        </main>
    );
}
