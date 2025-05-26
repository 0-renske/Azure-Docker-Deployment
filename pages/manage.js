import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import DatabaseManagement from './DatabaseManagement';
import Logout from './logout';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('database'); 
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (!currentUser) {
        router.replace('/Group6');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">You must be logged in to access the dashboard.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">Group66 Dashboard</h1>
              
              {/* Tab Navigation - Only Database Management now */}
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('database')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'database'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Database Management
                </button>
                
                {/* You can add more tabs here in the future */}
                {/* <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Analytics
                </button> */}
              </div>
            </div>

            {/* User Info and Logout */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.email || 'User'}
              </span>
              <Logout />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'database' && <DatabaseManagement />}
        
        {/* Add future components here */}
        {/* {activeTab === 'analytics' && <Analytics />} */}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Group66. Katchow :)</p>
        </div>
      </footer>
    </div>
  );
}
