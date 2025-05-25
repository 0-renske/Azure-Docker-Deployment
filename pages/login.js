import { useRouter } from "next/router";
import { useState } from "react";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { auth, db } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!email || !password) {
      alert('Email and password required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log("Authentication successful for:", user.uid);
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
         router.push("/home");
        } else {
          console.warn("User authenticated but not found in Firestore database");
        }
      } catch (firestoreError) {
        console.error("Error checking user in Firestore:", firestoreError);
      }
      console.log("Login successful! Redirecting...");
      await router.push('/Group6');
      
    } catch (error) {
      console.error("Login error:", error.code, error.message);
      setError(`Failed to log in: ${error.message}`);
      alert(`Failed to log in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <header className="text-2xl font-bold text-center text-gray-800">Login</header>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <div>
            <button 
              type="submit" 
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-500 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Login'}
            </button>
          </div>
          
          <div className="text-sm text-center">
            <a href="#" className="font-medium text-sky-600 hover:text-sky-500">
              Forgot your password?
            </a>
          </div>
          
          <div className="text-sm text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <a href="./register" className="font-medium text-sky-600 hover:text-sky-500">
                Register
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
