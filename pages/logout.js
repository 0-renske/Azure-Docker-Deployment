import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import {initializeApp} from "firebase/app";

const firebaseConfig = {
    apiKey: "AIzaSyCQkmsPAJ0EVd1fOTcTIzEBtj197o1Rdlc",
    authDomain: "authentication-215cb.firebaseapp.com",
    projectId: "authentication-215cb",
    storageBucket: "authentication-215cb.firebasestorage.app",
    messagingSenderId: "988966492862",
    appId: "1:988966492862:web:f8d4faddbfecc8f2c51cef",
    measurementId: "G-Q485FWL12Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


export default function LogOut() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  async function handleLogout() {
    setLoading(true);
    
    try {
      await signOut(auth);
      console.log("User logged out successfully");
      router.push("/Group6");
    } catch (error) {
      console.error("Logout error:", error.message);
      alert(`Failed to log out: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <nav className="bg-blue-800 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/">
          <span className="text-xl font-bold">Vector databases solutions at your fingertips</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-sm">{user.email}</span>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {loading ? "..." : "Logout"}
              </button>
            </>
          ) : (
            <>
              <Link href="./Group6">
                <span className="text-sm hover:underline">Login</span>
              </Link>
              <Link href="./register">
                <span className="px-3 py-1 bg-white text-blue-800 text-sm rounded hover:bg-gray-100 transition-colors">Register</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}