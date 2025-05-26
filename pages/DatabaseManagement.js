import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase'; // Same path as Dashboard - same directory

export default function DatabaseManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [error, setError] = useState('');
  
  // Form state - Updated to include vector databases
  const [formData, setFormData] = useState({
    engine: 'Postgres', // Fixed spelling
    dbName: '',
    dbPassword: '',
    storage: 20,
    // Vector DB specific fields
    apiKey: '',
    environment: '',
    region: 'us-east-1'
  });

  const router = useRouter();

  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (!currentUser) {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Listen to user's databases - only if user exists
  useEffect(() => {
    if (!user?.uid) return; 

    const databasesQuery = query(
      collection(db, 'user_databases'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(databasesQuery, (snapshot) => {
      const databaseList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDatabases(databaseList);
    }, (error) => {
      console.error('Error listening to databases:', error);
      setDatabases([]); 
    });

    return () => unsubscribe();
  }, [user?.uid]); 

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate form data - Updated for vector databases
  const validateForm = () => {
    if (formData.dbName.length < 4) {
      setError('Database name must be at least 4 characters');
      return false;
    }
    if (formData.dbName.includes(' ')) {
      setError('Database name cannot contain spaces');
      return false;
    }
    
    // Traditional database validations
    if (['Postgres'].includes(formData.engine) && formData.dbPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    
    // Vector database validations
    if (formData.engine === 'Pinecone' && !formData.apiKey) {
      setError('API Key is required for Pinecone');
      return false;
    }
    if (formData.engine === 'Pinecone' && !formData.environment) {
      setError('Environment is required for Pinecone');
      return false;
    }
    
    if (formData.storage < 20) {
      setError('Storage must be at least 20 GB');
      return false;
    }
    return true;
  };

  // Handle database creation
  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    
    if (!user?.uid || !user?.email) { // Use optional chaining
      setError('You must be logged in to create databases');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setCreating(true);
    setError('');

    try {
      // Get user's ID token for authentication
      const idToken = await user.getIdToken();
      
      if (!idToken) {
        throw new Error('Failed to get authentication token');
      }

      // Call your API to create the database
      const response = await fetch('/api/create-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          engine: formData.engine,
          dbName: formData.dbName,
          dbPassword: formData.dbPassword || '', // Provide default for vector DBs
          storage: parseInt(formData.storage),
          // Vector DB specific fields
          apiKey: formData.apiKey || '',
          environment: formData.environment || '',
          region: formData.region || 'us-east-1',
          userId: user.uid,
          userEmail: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result || !result.executionId) {
        throw new Error('Invalid response from server');
      }

      // Save database creation record to Firestore
      await addDoc(collection(db, 'user_databases'), {
        userId: user.uid,
        userEmail: user.email,
        dbName: formData.dbName,
        engine: formData.engine,
        storage: formData.storage,
        region: formData.region,
        executionId: result.executionId,
        status: 'CREATING',
        createdAt: new Date().toISOString(),
      });

      // Reset form
      setFormData({
        engine: 'Postgress',
        dbName: '',
        dbPassword: '',
        storage: 20,
        apiKey: '',
        environment: '',
        region: 'us-east-1'
      });

      alert('Database creation started successfully!');
    } catch (error) {
      console.error('Database creation error:', error);
      setError(error.message || 'Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  // Check database status
  const checkDatabaseStatus = async (database) => {
    if (!database?.executionId || !user?.uid) { // Use optional chaining
      console.error('Missing required data for status check');
      alert('Cannot check status: missing required information');
      return;
    }

    try {
      const idToken = await user.getIdToken();
      
      if (!idToken) {
        throw new Error('Failed to get authentication token');
      }
      
      const response = await fetch('/api/check-database-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          executionId: database.executionId,
          databaseId: database.id || '',
          userId: user.uid,
          engine: database.engine || '', // Pass engine for connection info parsing
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const statusData = await response.json();
      
      if (!statusData) {
        throw new Error('No status data received');
      }
      
      console.log('Database status:', statusData);
      
      // Show user-friendly status message
      if (statusData.userFriendlyStatus) {
        const message = `Database Status: ${statusData.userFriendlyStatus}${statusData.estimatedTimeRemaining ? ' - ' + statusData.estimatedTimeRemaining : ''}`;
        alert(message);
      } else {
        alert(`Database Status: ${statusData.status || 'Unknown'}`);
      }
    } catch (error) {
      console.error('Error checking database status:', error);
      alert(`Failed to check database status: ${error.message}`);
    }
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // If user is not authenticated
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">You must be logged in to manage databases.</p>
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* User info header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800">
          <span className="font-semibold">Logged in as:</span> {user?.email || 'Loading...'}
        </p>
      </div>

      <h1 className="text-2xl font-bold mb-6">Database Management</h1>

      {/* Create Database Form */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Database</h2>
        
        <form onSubmit={handleCreateDatabase} className="space-y-4">
          {/* Database Engine */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Database Engine *
            </label>
            <select
              name="engine"
              value={formData.engine}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <optgroup label="Traditional Databases">
                <option value="Postgres">PostgreSQL</option>
              </optgroup>
              <optgroup label="Vector Databases">
                <option value="Weaviate">Weaviate (Open Source Vector DB)</option>
                <option value="Chroma">ChromaDB</option>
                <option value="Pinecone">Pinecone (Managed)</option>
              </optgroup>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose your preferred database technology
            </p>
          </div>

          {/* Database Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.engine === 'Pinecone' ? 'Index Name *' : 'Database Name *'}
            </label>
            <input
              type="text"
              name="dbName"
              value={formData.dbName}
              onChange={handleInputChange}
              placeholder={`Enter ${formData.engine === 'pinecone' ? 'index' : 'database'} name (min 4 characters, no spaces)`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={4}
              pattern="^[^\s]+$"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 4 characters and contain no spaces
            </p>
          </div>

          {/* Database Password - Only for traditional databases */}
          {['Postgres'].includes(formData.engine) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Database Password *
              </label>
              <input
                type="password"
                name="dbPassword"
                value={formData.dbPassword}
                onChange={handleInputChange}
                placeholder="Enter database password (min 8 characters)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters
              </p>
            </div>
          )}

          {/* API Key - Only for Pinecone */}
          {formData.engine === 'pinecone' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pinecone API Key *
              </label>
              <input
                type="password"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleInputChange}
                placeholder="Enter your Pinecone API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Pinecone API key from the console
              </p>
            </div>
          )}

          {/* Environment - Only for Pinecone */}
          {formData.engine === 'pinecone' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Environment *
              </label>
              <input
                type="text"
                name="environment"
                value={formData.environment}
                onChange={handleInputChange}
                placeholder="e.g., us-east-1-aws"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Pinecone environment name
              </p>
            </div>
          )}

          {/* Region - For vector databases */}
          {['Weaviate', 'Chroma', 'Pinecone'].includes(formData.engine) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region *
              </label>
              <select
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">Europe (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose the deployment region
              </p>
            </div>
          )}

          {/* Storage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Storage (GB) *
            </label>
            <input
              type="number"
              name="storage"
              value={formData.storage}
              onChange={handleInputChange}
              placeholder="Storage in GB (minimum 20)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min={20}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 20 GB required
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={creating}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {creating ? 'Creating Database...' : 'Create Database'}
          </button>
        </form>
      </div>

      {/* User's Databases */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Databases</h2>
        
        {databases?.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No databases found. Create your first database above!
          </div>
        ) : (
          <div className="space-y-4">
            {databases?.map((database) => (
              <div key={database.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-semibold">{database?.dbName || 'Unnamed Database'}</h3>
                    <p className="text-sm text-gray-600">
                      Engine: {database?.engine || 'Unknown'} | Storage: {database?.storage || 'Unknown'} GB
                    </p>
                    <p className="text-sm text-gray-600">
                      Created: {database?.createdAt ? new Date(database.createdAt).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    database?.status === 'CREATING' ? 'bg-yellow-100 text-yellow-800' :
                    database?.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    database?.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {database?.status || 'Unknown'}
                  </span>
                </div>
                
                {database?.executionId && (
                  <div className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Execution ID:</span>
                    <span className="font-mono text-xs ml-1">{database.executionId}</span>
                  </div>
                )}

                {database?.status === 'CREATING' && (
                  <button
                    onClick={() => checkDatabaseStatus(database)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    disabled={!database?.executionId}
                  >
                    Check Status
                  </button>
                )}

                {database?.connectionInfo && (
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <h4 className="font-medium mb-2">Connection Information:</h4>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(database.connectionInfo, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )) || []}
          </div>
        )}
      </div>
    </div>
  );
}
