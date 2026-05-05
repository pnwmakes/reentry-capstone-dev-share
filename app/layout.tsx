// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import FirebaseProvider from '@/components/FirebaseProvider';

export const metadata: Metadata = {
    title: 'Firebase Next.js App',
    description: 'A Next.js app with Firebase integration.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang='en'>
            <body
                className='bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100'
                suppressHydrationWarning={true}
            >
                <FirebaseProvider>{children}</FirebaseProvider>
            </body>
        </html>
    );
}
