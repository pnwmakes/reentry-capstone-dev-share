// app/dashboard/layout.tsx
'use client';

import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className='min-h-screen flex flex-col'>
            <main className='flex-1'>{children}</main>
        </div>
    );
}
