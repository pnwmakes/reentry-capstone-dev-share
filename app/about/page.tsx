export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white flex flex-col text-center">
      <header className="w-full py-10 px-6 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-zinc-800 dark:to-zinc-900 shadow">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            About Victory Connect
          </h1>
          <p className="mt-3 text-lg md:text-xl text-blue-100 dark:text-zinc-300">
            Connecting People. Creating Opportunities. Changing Lives.
          </p>
        </div>
        {/* Main Description */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg text-gray-300">
          <p className="text-lg leading-relaxed">
            Victory Connect is more than an app, It is a movement. Designed for
            individuals seeking growth, connection, and second chances, Victory
            Connect bridges the gap between resources, mentors, employers, and
            community support networks.
          </p>
        </div>

        {/* Mission & Vision Grid */}
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-4 flex items-center text-blue-600">
              <span>Our Mission</span>
            </h2>
            <p className="text-gray-300">
              To empower individuals through connection, education, and
              opportunity, helping them unlock their full potential and create
              lasting change for themselves and their communities.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-4 flex items-center text-blue-600">
              <span>Our Vision</span>
            </h2>
            <p className="text-gray-300">
              To build a world where second chances are the norm, not the
              exception, and every person has access to tools, resources, and
              relationships that help them thrive.
            </p>
          </div>
        </div>

        <section className="mt-10 max-w-5xl w-full">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-blue-50 dark:bg-zinc-800 rounded-lg shadow p-6 text-left">
              <h3 className="text-xl font-bold text-blue-800 dark:text-blue-100 mb-4">
                What We Offer
              </h3>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                    Resource Directory
                  </h4>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    Find housing, mental health support, job training, and
                    financial assistance.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                    Career & Job Matching
                  </h4>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    Connect with employers and organizations offering
                    second-chance opportunities.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                    Community Support
                  </h4>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    Join a safe and uplifting network of mentors, peers, and
                    advocates.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                    Skill Development
                  </h4>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    Access digital literacy, entrepreneurship, and personal
                    development resources.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-zinc-800 rounded-lg shadow p-6 text-left">
              <h3 className="text-xl font-bold text-blue-800 dark:text-blue-100 mb-2">
                Why Victory Connect?
              </h3>
              <p className="text-zinc-700 dark:text-zinc-300">
                We believe everyone deserves a fresh start. By leveraging
                technology, community partnerships, and lived experience,
                Victory Connect creates a safe, inclusive space where
                individuals can rise above barriers and achieve their goals.
              </p>
            </div>
          </div>
        </section>

        {/* Why Victory Connect Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-blue-600">
            <span className="mr-2">Why Victory Connect?</span>
          </h2>
          <p className="text-gray-300">
            We believe everyone deserves a fresh start. By leveraging
            technology, community partnerships, and lived experience, Victory
            Connect creates a safe, inclusive space where individuals can rise
            above barriers and achieve their goals.
          </p>
        </div>
      </header>
    </div>
  );
}
