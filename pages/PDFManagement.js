import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

export default function PDFManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
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
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setErrorMessage('');
    } else {
      setFile(null);
      setFileName('');
      setErrorMessage('Please select a valid PDF file.');
    }
  };
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setErrorMessage('You must be logged in to upload files.');
      return;
    }
    
    if (!file) {
      setErrorMessage('Please select a PDF file first.');
      return;
    }

    setUploading(true);
    setErrorMessage('');
    
    try {
      const idToken = await user.getIdToken();
      
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('userId', user.uid); 
      
      const uploadResponse = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || 'File upload failed');
      }
      
      const uploadResult = await uploadResponse.json();
      
      const stepFunctionResponse = await fetch('/api/start-step-function', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, 
        },
        body: JSON.stringify({
          fileKey: uploadResult.fileKey,
          fileName: fileName,
          fileSize: file.size,
          contentType: file.type,
          userId: user.uid, 
        }),
      });
      
      if (!stepFunctionResponse.ok) {
        const errorData = await stepFunctionResponse.json();
        throw new Error(errorData.message || 'Failed to start processing workflow');
      }
      
      const stepFunctionResult = await stepFunctionResponse.json();
      
      // Save execution to Firestore for tracking
      const { saveExecutionToFirestore } = await import('./ExecutionTracker');
      await saveExecutionToFirestore({
        userId: user.uid,
        userEmail: user.email,
        fileName: fileName,
        fileKey: uploadResult.fileKey,
        fileSize: file.size,
        executionArn: stepFunctionResult.executionArn,
        executionName: stepFunctionResult.executionName,
        status: 'RUNNING',
      });

      // Update status with the execution ARN
      setProcessingStatus({
        executionArn: stepFunctionResult.executionArn,
        status: 'RUNNING',
        startTime: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage(error.message || 'An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const checkStatus = async () => {
    if (!processingStatus || !processingStatus.executionArn || !user) {
      return;
    }
    
    try {
      const idToken = await user.getIdToken();
      
      const statusResponse = await fetch('/api/check-step-function-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Include auth token
        },
        body: JSON.stringify({
          executionArn: processingStatus.executionArn,
          userId: user.uid, // Include user ID for verification
        }),
      });
      
      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        throw new Error(errorData.message || 'Failed to check workflow status');
      }
      
      const statusResult = await statusResponse.json();
      
      setProcessingStatus({
        ...processingStatus,
        status: statusResult.status,
        output: statusResult.output,
        stopTime: statusResult.stopTime,
      });
      
    } catch (error) {
      console.error('Error checking status:', error);
      setErrorMessage('Failed to retrieve workflow status');
    }
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">You must be logged in to access this page.</p>
          <button
            onClick={() => router.push('/Group6')}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800">
          <span className="font-semibold">Logged in as:</span> {user.email}
        </p>
      </div>

      <h1 className="text-2xl font-bold mb-6">PDF Document Management</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload PDF Document</h2>
        
        <form onSubmit={handleUpload}>
          <div className="mb-4">
            <label 
              htmlFor="pdf-upload" 
              className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-all"
            >
              {fileName ? (
                <span className="text-blue-600">{fileName}</span>
              ) : (
                <span className="text-gray-500">
                  Click to select a PDF file or drag and drop here
                </span>
              )}
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {errorMessage}
            </div>
          )}
          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {uploading ? 'Uploading...' : 'Upload and Process PDF'}
          </button>
        </form>
      </div>
      {processingStatus && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Processing Status</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <span className={`${
                processingStatus.status === 'RUNNING' ? 'text-yellow-600' : 
                processingStatus.status === 'SUCCEEDED' ? 'text-green-600' : 'text-red-600'
              }`}>
                {processingStatus.status}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="font-medium">File:</span>
              <span>{fileName}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="font-medium">Started:</span>
              <span>{new Date(processingStatus.startTime).toLocaleString()}</span>
            </div>
            
            {processingStatus.stopTime && (
              <div className="flex justify-between">
                <span className="font-medium">Completed:</span>
                <span>{new Date(processingStatus.stopTime).toLocaleString()}</span>
              </div>
            )}      
            {processingStatus.status === 'RUNNING' && (
              <button
                onClick={checkStatus}
                className="w-full mt-4 bg-gray-100 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Refresh Status
              </button>
            )}       
            {processingStatus.status === 'SUCCEEDED' && processingStatus.output && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <h3 className="text-md font-medium mb-2">Processing Results:</h3>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(JSON.parse(processingStatus.output), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
