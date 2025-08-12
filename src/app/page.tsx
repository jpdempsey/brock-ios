export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Brock Brain API</h1>
        <p className="text-lg text-gray-600 mb-8">
          Backend API for your personal Brock iOS App
        </p>
        
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Available endpoints:</div>
          <ul className="text-sm space-y-1 text-left">
            <li><code className="bg-gray-100 px-2 py-1 rounded">GET /api/goals</code> - Fetch goals</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">POST /api/goals</code> - Create goal</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">GET /api/activities</code> - Fetch activities</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">POST /api/activities</code> - Create activity</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">GET /api/nutrition</code> - Fetch nutrition data</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">POST /api/nutrition/upload</code> - Upload HealthKit data</li>
            <li><code className="bg-blue-100 px-2 py-1 rounded">GET /api/threads</code> - Fetch chat threads</li>
            <li><code className="bg-blue-100 px-2 py-1 rounded">POST /api/threads</code> - Create new thread</li>
            <li><code className="bg-blue-100 px-2 py-1 rounded">POST /api/chat</code> - Stream chat with Brock AI</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

