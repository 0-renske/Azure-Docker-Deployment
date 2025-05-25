import { useRouter } from "next/router";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from '../lib/firebase';

export default function Register(){
    const [username, createUser] = useState('');
    const [password, createPassword] = useState('');
    const [email, createEmail] = useState('');
    const [newPassword, createNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
        
    const router = useRouter();

    async function HandleRegistration(e) {
        e.preventDefault();
        if (!username || !password || !newPassword || !email){
            alert("Please fill in all fields");
            return;
        }
        if (password != newPassword){
          alert("Password does not match");
            return;
        }
        setLoading(true);
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          console.log("Authentication successful!");
          
          // Then try to add the user to Firestore
          try {
            await setDoc(doc(db, "users", user.uid), {
              username: username,
              email: email,
              createdAt: new Date().toISOString(), // Using ISO string for better compatibility
              uid: user.uid
            });
            
            console.log("User added to Firestore successfully!");
            router.push('/Group6');
          } catch (firestoreError) {
            console.error("Firestore error:", firestoreError);
            if (firestoreError.code === 'permission-denied') {
              alert("Account created successfully, but user profile couldn't be saved due to permission issues. Some features may be limited.");
              router.push('/Group6');
            } else {
              alert("Account created but failed to save user info: " + firestoreError.message);
              router.push('/Group6');
            }
          }
        } catch (authError) {
          console.error("Authentication error:", authError);
          alert("Registration failed: " + authError.message);
        } finally {
          setLoading(false);
        }
    }
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
          <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
            <form onSubmit={HandleRegistration} className="space-y-6">
              <header className="text-2xl font-bold text-center text-gray-800">Create Account</header>   
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => createUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Choose a username"
                  required
                />
              </div>       
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => createEmail(e.target.value)}
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
                  onChange={(e) => createPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Create a password"
                  required
                />
              </div>    
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => createNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Confirm your password"
                  required
                />
              </div>  
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-500 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200"
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </div>   
              <div className="text-sm text-center">
                <p className="text-gray-600">
                  Already have an account?{' '}
                  <a href="./Group6" className="font-medium text-sky-600 hover:text-sky-500">
                    Log in
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      );
}
