import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Garmin AI Coach Pro
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            AI-powered endurance training analysis and personalized coaching
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition border border-blue-600"
            >
              Login
            </Link>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-gray-900">
                Readiness Scoring
              </h3>
              <p className="text-gray-600">
                Daily readiness scores based on your metrics, recovery status, and training load
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-gray-900">
                Personalized Workouts
              </h3>
              <p className="text-gray-600">
                Generate custom workouts tailored to your goals, fitness level, and available time
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-gray-900">
                Training Plans
              </h3>
              <p className="text-gray-600">
                Adaptive periodized plans that adjust to your progress and recovery
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
