import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase'; 

export default function DatabaseManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState({});
  
  const [formData, setFormData] = useState({
    engine: 'Postgres', 
    dbName: '',
    dbPassword: '',
    storage: 20,
    apiKey: '',
    environment: '',
    region: 'eu-central-1'
  });

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
      setError('Failed to load databases. Please refresh the page.');
      setDatabases([]);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const validateForm = () => {
    if (formData.dbName.length < 4) {
      setError('Database name must be at least 4 characters');
      return false;
    }
    
    if (formData.dbName.length > 16) {
      setError('Database name must be 16 characters or less for AWS compatibility');
      return false;
    }
    
    if (formData.dbName.includes(' ')) {
      setError('Database name cannot contain spaces');
      return false;
    }
    
    if (['Postgres', 'Weaviate', 'Chroma'].includes(formData.engine) && formData.dbPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    
    if (formData.engine === 'Pinecone') {
      if (!formData.apiKey) {
        setError('API Key is required for Pinecone');
        return false;
      }
      if (!formData.environment) {
        setError('Environment is required for Pinecone');
        return false;
      }
    }
    
    if (formData.storage < 20) {
      setError('Storage must be at least 20 GB');
      return false;
    }
    
    return true;
  };

  const generateShortResourceName = (engine, dbName, userId) => {
    const enginePrefix = {
      'Postgres': 'pg',
      'Weaviate': 'wv', 
      'Chroma': 'ch',
      'Pinecone': 'pc'
    };
    
    const prefix = enginePrefix[engine] || 'db';
    const shortUserId = userId.substring(0, 4); 
    const shortDbName = dbName.substring(0, 6); 
    const resourceName = `${prefix}-${shortDbName}-${shortUserId}`.toLowerCase();
    
    return resourceName.length > 20 ? resourceName.substring(0, 20) : resourceName;
  };

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    
    if (!user?.uid || !user?.email) {
      setError('You must be logged in to create databases');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setCreating(true);
    setError('');

    try {
      const idToken = await user.getIdToken();
      
      if (!idToken) {
        throw new Error('Failed to get authentication token');
      }

      const resourceName = generateShortResourceName(formData.engine, formData.dbName, user.uid);

      const payload = {
        engine: formData.engine,
        dbName: formData.dbName,
        dbPassword: formData.dbPassword || '',
        storage: parseInt(formData.storage),
        apiKey: formData.apiKey || '',
        environment: formData.environment || '',
        userId: user.uid,
        userEmail: user.email,
      };

      console.log('Sending payload to API:', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/create-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });
        
        if (errorData.message && errorData.message.includes('Listener') && errorData.message.includes('not found')) {
          throw new Error('AWS Infrastructure Error: The load balancer listener is missing or deleted. This is a backend infrastructure issue that needs to be fixed by recreating the Network Load Balancer.');
        }
        
        if (errorData.message && errorData.message.includes('Target group name') && errorData.message.includes('cannot be longer')) {
          throw new Error('Resource name too long. Please use a shorter database name.');
        }
        
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result || !result.executionId) {
        throw new Error('Invalid response from server');
      }

      await addDoc(collection(db, 'user_databases'), {
        userId: user.uid,
        userEmail: user.email,
        dbName: formData.dbName,
        engine: formData.engine,
        storage: formData.storage,
        region: formData.region,
        executionId: result.executionId,
        deploymentId: result.deploymentId,
        containerName: result.containerName || resourceName,
        resourceName: resourceName,
        estimatedCompletionTime: result.estimatedCompletionTime,
        status: 'COMPLETED', 
        createdAt: new Date().toISOString(),
      });

      setFormData({
        engine: 'Postgres',
        dbName: '',
        dbPassword: '',
        storage: 20,
        apiKey: '',
        environment: '',
        region: 'eu-central-1'
      });

      alert('Database created successfully! It should be ready to use.');
    } catch (error) {
      console.error('Database creation error:', error);
      setError(error.message || 'Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDatabase = async (database) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${database?.dbName || 'this database'}"?\n\nThis action cannot be undone and will permanently delete all data.`
    );
    
    if (!confirmDelete) {
      return;
    }

    setDeleting(prev => ({ ...prev, [database.id]: true }));

    try {
      const idToken = await user.getIdToken();
      
      if (!idToken) {
        throw new Error('Failed to get authentication token');
      }
      
      console.log('Marking database as deleting in Firestore...');
      await updateDoc(doc(db, 'user_databases', database.id), {
        status: 'DELETING',
        deletionStarted: new Date().toISOString(),
      });
      
      console.log('Calling delete API...');
      const response = await fetch('/api/delete-database', {
        method: 'DELETE', 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          databaseId: database.id,
          containerName: database.containerName || database.resourceName || `${database.engine?.toLowerCase()}-${database.dbName}`,
          userId: user.uid,
          engine: database.engine,
        }),
      });

      if (!response.ok) {
        console.log('API call failed, reverting status...');
        await updateDoc(doc(db, 'user_databases', database.id), {
          status: database.status,
          deletionError: new Date().toISOString(),
        });
        
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Database deletion result:', result);
      
      if (result.success) {
        if (result.softDelete) {
          console.log('Soft delete - removing from Firestore immediately');
          await deleteDoc(doc(db, 'user_databases', database.id));
          alert(`Database "${database.dbName}" removed successfully!`);
        } else {
          console.log('Real delete - updating Firestore with deletion tracking');
          await updateDoc(doc(db, 'user_databases', database.id), {
            status: 'DELETING',
            deletionId: result.deletionId,
            deletionStarted: new Date().toISOString(),
          });
          
          setTimeout(async () => {
            try {
              console.log('Auto-removing deleted database from Firestore after delay...');
              await deleteDoc(doc(db, 'user_databases', database.id));
            } catch (cleanupError) {
              console.warn('Could not auto-cleanup deleted database:', cleanupError);
            }
          }, 30000);
          
          alert(`Database "${database.dbName}" deletion started successfully!`);
        }
      } else {
        throw new Error(result.message || 'Deletion failed');
      }
      
    } catch (error) {
      console.error('Error deleting database:', error);
      alert(`Failed to delete database: ${error.message}`);
      
      try {
        await updateDoc(doc(db, 'user_databases', database.id), {
          status: database.status,
          deletionError: error.message,
          deletionErrorTime: new Date().toISOString(),
        });
      } catch (revertError) {
        console.warn('Could not revert database status:', revertError);
      }
    } finally {
      setDeleting(prev => ({ ...prev, [database.id]: false }));
    }
  };

  const handleRemoveRecord = async (database) => {
    const confirmRemove = window.confirm(
      `Remove "${database?.dbName || 'this database'}" from your list?\n\nThis will only remove the record from your dashboard. If the database still exists, you may need to delete it manually.`
    );
    
    if (!confirmRemove) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'user_databases', database.id));
      alert(`Record for "${database.dbName}" removed from your dashboard.`);
    } catch (error) {
      console.error('Error removing database record:', error);
      alert(`Failed to remove record: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800">
          <span className="font-semibold">Logged in as:</span> {user?.email || 'Loading...'}
        </p>
      </div>

      <h1 className="text-2xl font-bold mb-6">Database Management</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Database</h2>
        
        <form onSubmit={handleCreateDatabase} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.engine === 'Pinecone' ? 'Index Name *' : 'Database Name *'}
            </label>
            <input
              type="text"
              name="dbName"
              value={formData.dbName}
              onChange={handleInputChange}
              placeholder={`Enter ${formData.engine === 'Pinecone' ? 'index' : 'database'} name (4-16 chars, no spaces)`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={4}
              maxLength={16}
              pattern="^[^\s]+$"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be 4-16 characters and contain no spaces (will be shortened for AWS compatibility)
            </p>
          </div>

          {formData.engine !== 'Pinecone' && (
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
                Must be at least 8 characters - required for Step Function execution
              </p>
            </div>
          )}

          {formData.engine === 'Pinecone' && (
            <>
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
            </>
          )}

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

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating Database...' : 'Create Database'}
          </button>
        </form>
      </div>

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
                    database?.status === 'DELETING' ? 'bg-orange-100 text-orange-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {database?.status === 'DELETING' ? 'Deleting' : 'Ready'}
                  </span>
                </div>
                
                {database?.executionId && (
                  <div className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Execution ID:</span>
                    <span className="font-mono text-xs ml-1">{database.executionId}</span>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleRemoveRecord(database)}
                    className="px-3 py-2 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                  >
                    Remove Record
                  </button>

                  {database?.status !== 'DELETING' && (
                    <button
                      onClick={() => handleDeleteDatabase(database)}
                      disabled={deleting[database.id]}
                      className="px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {deleting[database.id] ? 'Deleting...' : 'Delete Database'}
                    </button>
                  )}

                  {database?.status === 'DELETING' && (
                    <div className="px-3 py-2 bg-orange-100 text-orange-800 text-sm rounded">
                      Deleting...
                    </div>
                  )}
                </div>

                {database?.connectionInfo && (
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <h4 className="font-medium mb-2">Connection Information:</h4>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(database.connectionInfo, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}