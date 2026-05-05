"use client";

import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { testimonials } from "@/public/data/testimonials";

export default function Home() {
  return (
    <div className='min-h-screen bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white flex flex-col text-center'>
      <header className='w-full py-6 px-8 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-zinc-800 dark:to-zinc-900 shadow '>
        <h1 className='text-4xl font-bold text-white tracking-tight'>
          Washington Reentry Resource Finder
        </h1>
        <p className='mt-2 text-lg text-blue-100 dark:text-zinc-300'>
          Empowering formerly incarcerated individuals and their supporters to
          find reentry resources, support, and opportunities across Washington
          State.
        </p>
      </header>
      <main className='flex-1 flex flex-col items-center justify-center px-4 py-12'>
        <section className='max-w-2xl w-full text-center'>
          <h2 className='text-2xl font-semibold mb-4 text-blue-700 dark:text-blue-200'>
            What is this application?
          </h2>
          <p className='mb-6 text-lg text-zinc-700 dark:text-zinc-300'>
            The Washington Reentry Resource Finder is a free, AI-powered
            platform designed to help individuals reentering society after
            incarceration, as well as their families, case managers, and
            advocates. Easily search for housing, employment, education, legal
            aid, healthcare, and other vital resources tailored to your needs
            and location.
          </p>
          <div className='flex flex-col md:flex-row gap-6 justify-center mt-8'>
            <div className='flex-1 bg-blue-50 dark:bg-zinc-800 rounded-lg shadow p-6'>
              <h3 className='text-xl font-bold text-blue-800 dark:text-blue-100 mb-2'>
                Resource Search
              </h3>
              <p className='text-zinc-700 dark:text-zinc-300'>
                Find reentry resources by category, location, and eligibility.
                Our database is updated and curated for Washington State.
              </p>
            </div>
            <div className='flex-1 bg-blue-50 dark:bg-zinc-800 rounded-lg shadow p-6'>
              <h3 className='text-xl font-bold text-blue-800 dark:text-blue-100 mb-2'>
                Personalized Dashboard
              </h3>
              <p className='text-zinc-700 dark:text-zinc-300'>
                Sign up to save resources, track your progress, and access tools
                tailored to your reentry journey.
              </p>
            </div>
            <div className='flex-1 bg-blue-50 dark:bg-zinc-800 rounded-lg shadow p-6'>
              <h3 className='text-xl font-bold text-blue-800 dark:text-blue-100 mb-2'>
                Community & Support
              </h3>
              <p className='text-zinc-700 dark:text-zinc-300'>
                Read testimonials, connect with organizations, and discover
                events and programs to support your success.
              </p>
            </div>
          </div>
        </section>
        <section className='mt-12 w-full flex flex-col items-center'>
          <h2 className='text-xl font-semibold mb-3 text-blue-700 dark:text-blue-200'>
            What Our Users Say
          </h2>
          <div className='h-40 w-full max-w-2xl rounded-lg border border-blue-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow flex items-center justify-center px-2'>
            <InfiniteMovingCards
              items={testimonials.map(({ text, ...rest }) => ({
                quote: text,
                ...rest,
              }))}
              direction='right'
              speed='slow'
            />
          </div>
        </section>
        <div className='mt-12'>
          <a
            href='/signin'
            className='inline-block px-8 py-3 bg-zinc-600 text-black rounded-md text-lg font-semibold shadow hover:bg-zinc-400 transition'
          >
            Get Started
          </a>
        </div>
      </main>
    </div>
  );
}
