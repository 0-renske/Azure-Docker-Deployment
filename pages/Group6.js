import Login from './login';
import Link from 'next/link';

export default function MainPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-800">Group66</span>
            </div>
            <div>
              <Link href="./More">
                <span className="text-gray-600 hover:text-blue-800 mr-4 cursor-pointer">About</span>
              </Link>
              <Link href="./contact">
                <span className="text-gray-600 hover:text-blue-800 cursor-pointer">Contact</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-center">
          <div className="md:w-1/2 max-w-md mb-8 md:mb-0 md:mr-12">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Group66</h1>
            <h2 className="text-xl text-gray-600 mb-6">Vector database solutions at your fingertips</h2>
            <p className="text-gray-600 mb-4">
              Manage and deploy vector databases for your LLMs within your own infrastructure.
              Keep your proprietary models and data secure while unlocking powerful AI capabilities.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-blue-700">
              <p>New to Group66? Our platform enables you to:</p>
              <ul className="list-disc list-inside mt-2 ml-2">
                <li>Easily deploy vector databases</li>
                <li>Securely embed your data</li>
                <li>Scale with your growing needs</li>
              </ul>
            </div>
          </div>
          <div className="md:w-1/2 max-w-md w-full">
            <div className="bg-white shadow-md rounded-lg p-8">
              <Login />              
              <div className="mt-6 text-center">
                <span className="text-gray-600">New User? </span>
                <Link href="./register">
                  <button 
                    type="button"
                    className="ml-2 inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Create new account
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="bg-gray-50 border-t border-gray-200 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} Group66. Katchow :)</p>
            <div className="mt-2">
              <a href="#" className="text-gray-500 hover:text-blue-600 mx-2">Privacy Policy</a>
              <a href="#" className="text-gray-500 hover:text-blue-600 mx-2">Terms of Service</a>
              <a href="#" className="text-gray-500 hover:text-blue-600 mx-2">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
