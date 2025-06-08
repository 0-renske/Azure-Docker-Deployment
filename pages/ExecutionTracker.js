import React from 'react';
import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';

export default function ExecutionTracker() {
  const [user, setUser] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for user's executions
    const executionsQuery = query(
      collection(db, 'executions'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribeExecutions = onSnapshot(executionsQuery, (snapshot) => {
      const executionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExecutions(executionsList);
    });

    return () => unsubscribeExecutions();
  }, [user]);

  const checkExecutionStatus = async (execution) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/check-step-function-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          executionArn: execution.executionArn,
        }),
      });

      if (response.ok) {
        const statusData = await response.json();
        
        if (execution.status !== statusData.status) {
          await updateExecutionInFirestore(execution.id, statusData);
        }
      }
    } catch (error) {
      console.error('Error checking execution status:', error);
    }
  };

  const updateExecutionInFirestore = async (executionId, statusData) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'executions', executionId), {
        status: statusData.status,
        stopTime: statusData.stopDate,
        output: statusData.output,
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating execution:', error);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading executions...</div>;
  }

  if (!user) {
    return <div>Please log in to view your executions.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Your PDF Processing History</h2>
      
      {executions.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No processing jobs found. Upload a PDF to get started!
        </div>
      ) : (
        <div className="space-y-4">
          {executions.map((execution) => (
            <div key={execution.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{execution.fileName}</h3>
                  <p className="text-sm text-gray-600">
                    Started: {new Date(execution.startTime).toLocaleString()}
                  </p>
                  {execution.stopTime && (
                    <p className="text-sm text-gray-600">
                      Completed: {new Date(execution.stopTime).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    execution.status === 'RUNNING' ? 'bg-yellow-100 text-yellow-800' :
                    execution.status === 'SUCCEEDED' ? 'bg-green-100 text-green-800' :
                    execution.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {execution.status}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">File Size:</span> {formatFileSize(execution.fileSize)}
                </div>
                <div>
                  <span className="font-medium">Execution ID:</span> 
                  <span className="font-mono text-xs">{execution.executionName}</span>
                </div>
                <div>
                  <span className="font-medium">Last Checked:</span> 
                  {execution.lastChecked ? new Date(execution.lastChecked).toLocaleString() : 'Never'}
                </div>
              </div>
              
              {execution.status === 'RUNNING' && (
                <button
                  onClick={() => checkExecutionStatus(execution)}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Check Status
                </button>
              )}
              
              {execution.status === 'SUCCEEDED' && execution.output && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                    View Results
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-50 rounded text-sm overflow-x-auto">
                    {JSON.stringify(JSON.parse(execution.output), null, 2)}
                  </pre>
                </details>
              )}
              
              {execution.status === 'FAILED' && execution.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-800 font-medium">Error Details:</p>
                  <p className="text-red-600 text-sm">{execution.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to save execution to Firestore (call this when starting an execution)
export async function saveExecutionToFirestore(executionData) {
  try {
    const docRef = await addDoc(collection(db, 'executions'), {
      ...executionData,
      startTime: new Date().toISOString(),
      lastChecked: null,
    });
    console.log('Execution saved with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving execution: ', error);
    throw error;
  }
}
