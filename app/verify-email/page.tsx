'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { applyActionCode } from 'firebase/auth';
import { auth } from '@/lib/Firebase';
import Link from 'next/link';

export default function VerifyEmailPage() {
    const searchParams = useSearchParams();
    const oobCode = searchParams.get('oobCode');
    const [message, setMessage] = useState('Verifying your email...');
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        if (oobCode) {
            applyActionCode(auth, oobCode)
                .then(() => {
                    setMessage('✅ Email verified! You can now sign in.');
                    setShowButton(true);
                })
                .catch((error) => {
                    console.error('❌ Verification error:', error);
                    setMessage(
                        '❌ Verification failed or code is invalid/expired.'
                    );
                    setShowButton(true); // Still show button even if failed
                });
        } else {
            setMessage('No verification code provided.');
            setShowButton(true); // Also show button in this case
        }
    }, [oobCode]);

    return (
        <main className='min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-900 px-4'>
            <div className='max-w-md w-full text-center p-6 bg-white dark:bg-zinc-800 rounded-xl shadow text-lg text-zinc-800 dark:text-white'>
                <p className='mb-6'>{message}</p>

                {showButton && (
                    <Link
                        href='/signin'
                        className='inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition'
                    >
                        Go to Sign In
                    </Link>
                )}
            </div>
        </main>
    );
}
