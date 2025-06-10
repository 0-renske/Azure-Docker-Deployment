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
  doc 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export default function PDFUploadManager() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [databases, setDatabases] = useState([]);
  const [uploadJobs, setUploadJobs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [uploadData, setUploadData] = useState({
    selectedDatabase: '',
    files: [],
    embeddingModel: 'amazon.titan-embed-text-v1',
    chunkSize: 1000,
    chunkOverlap: 200,
    metadata: {
      source: '',
      category: '',
      tags: ''
    }
  });

  const router = useRouter();
  const embeddingModels = [
    { value: 'amazon.titan-embed-text-v1', label: 'Amazon Titan Text Embeddings v1' },
    { value: 'amazon.titan-embed-text-v2', label: 'Amazon Titan Text Embeddings v2' },
    { value: 'cohere.embed-english-v3', label: 'Cohere Embed English v3' },
    { value: 'cohere.embed-multilingual-v3', label: 'Cohere Embed Multilingual v3' }
  ];

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
      where('status', '==', 'COMPLETED'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(databasesQuery, (snapshot) => {
      const databaseList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDatabases(databaseList);
    }, (error) => {
      console.error('Error loading databases:', error);
      setError('Failed to load databases');
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const uploadsQuery = query(
      collection(db, 'pdf_uploads'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(uploadsQuery, (snapshot) => {
      const uploadList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUploadJobs(uploadList);
    }, (error) => {
      console.error('Error loading upload jobs:', error);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== selectedFiles.length) {
      setError('Only PDF files are allowed');
      return;
    }

    if (pdfFiles.length > 10) {
      setError('Maximum 10 files allowed per upload');
      return;
    }

    setUploadData(prev => ({ ...prev, files: pdfFiles }));
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('metadata.')) {
      const metadataField = name.split('.')[1];
      setUploadData(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataField]: value
        }
      }));
    } else {
      setUploadData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateUpload = () => {
    if (!uploadData.selectedDatabase) {
      setError('Please select a database');
      return false;
    }
    
    if (uploadData.files.length === 0) {
      setError('Please select at least one PDF file');
      return false;
    }

    if (uploadData.chunkSize < 100 || uploadData.chunkSize > 8000) {
      setError('Chunk size must be between 100 and 8000 characters');
      return false;
    }

    if (uploadData.chunkOverlap < 0 || uploadData.chunkOverlap >= uploadData.chunkSize) {
      setError('Chunk overlap must be less than chunk size');
      return false;
    }

    return true;
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!validateUpload()) return;
    
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const idToken = await user.getIdToken();
      const selectedDb = databases.find(db => db.id === uploadData.selectedDatabase);
      
      if (!selectedDb) {
        throw new Error('Selected database not found');
      }

      const formData = new FormData();      
      uploadData.files.forEach((file, index) => {
        formData.append(`files`, file);
      });
      formData.append('config', JSON.stringify({
        databaseId: uploadData.selectedDatabase,
        databaseName: selectedDb.dbName,
        databaseEngine: selectedDb.engine,
        embeddingModel: uploadData.embeddingModel,
        chunkSize: parseInt(uploadData.chunkSize),
        chunkOverlap: parseInt(uploadData.chunkOverlap),
        metadata: uploadData.metadata,
        userId: user.uid,
        userEmail: user.email
      }));

      const response = await fetch('/api/upload-pdf-embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      await addDoc(collection(db, 'pdf_uploads'), {
        userId: user.uid,
        userEmail: user.email,
        databaseId: uploadData.selectedDatabase,
        databaseName: selectedDb.dbName,
        databaseEngine: selectedDb.engine,
        jobId: result.jobId,
        executionId: result.executionId,
        fileNames: uploadData.files.map(f => f.name),
        fileCount: uploadData.files.length,
        embeddingModel: uploadData.embeddingModel,
        chunkSize: uploadData.chunkSize,
        chunkOverlap: uploadData.chunkOverlap,
        metadata: uploadData.metadata,
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
      });
      setSuccess(`Successfully started processing ${uploadData.files.length} PDF file(s)!`);
      setUploadData({
        selectedDatabase: uploadData.selectedDatabase, 
        files: [],
        embeddingModel: 'amazon.titan-embed-text-v1',
        chunkSize: 1000,
        chunkOverlap: 200,
        metadata: {
          source: '',
          category: '',
          tags: ''
        }
      });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload PDFs');
    } finally {
      setUploading(false);
    }
  };



  const deleteUploadJob = async (job) => {
    const confirmDelete = window.confirm(
      `Delete upload job for "${job.fileNames?.join(', ') || 'files'}"?\n\nThis will remove the job record but won't delete already embedded data.`
    );
    
    if (!confirmDelete) return;

    try {
      await updateDoc(doc(db, 'pdf_uploads', job.id), {
        status: 'DELETED',
        deletedAt: new Date().toISOString()
      });
      
      setSuccess('Upload job deleted successfully');
    } catch (error) {
      console.error('Error deleting job:', error);
      setError(`Failed to delete job: ${error.message}`);
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
          <p className="text-red-600 mb-4">You must be logged in to upload PDFs.</p>
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

      <h1 className="text-2xl font-bold mb-6">PDF Upload & Embedding</h1>

      {databases.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            <span className="font-semibold">No databases available.</span> You need to create and complete at least one database before uploading PDFs.
          </p>
          <button
            onClick={() => router.push('/database-management')}
            className="mt-2 bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
          >
            Go to Database Management
          </button>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload PDF Documents</h2>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Database *
            </label>
            <select
              name="selectedDatabase"
              value={uploadData.selectedDatabase}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={databases.length === 0}
            >
              <option value="">Select a database...</option>
              {databases.map(db => (
                <option key={db.id} value={db.id}>
                  {db.dbName} ({db.engine})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Only completed databases are shown
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF Files * (Max 10 files)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {uploadData.files.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                Selected files: {uploadData.files.map(f => f.name).join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Embedding Model
            </label>
            <select
              name="embeddingModel"
              value={uploadData.embeddingModel}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {embeddingModels.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chunk Size (characters)
              </label>
              <input
                type="number"
                name="chunkSize"
                value={uploadData.chunkSize}
                onChange={handleInputChange}
                min="100"
                max="8000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">100-8000 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chunk Overlap (characters)
              </label>
              <input
                type="number"
                name="chunkOverlap"
                value={uploadData.chunkOverlap}
                onChange={handleInputChange}
                min="0"
                max={uploadData.chunkSize - 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Overlap between chunks</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Optional Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Source</label>
                <input
                  type="text"
                  name="metadata.source"
                  value={uploadData.metadata.source}
                  onChange={handleInputChange}
                  placeholder="e.g., Internal Documents"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
                <input
                  type="text"
                  name="metadata.category"
                  value={uploadData.metadata.category}
                  onChange={handleInputChange}
                  placeholder="e.g., Technical Manual"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Tags</label>
                <input
                  type="text"
                  name="metadata.tags"
                  value={uploadData.metadata.tags}
                  onChange={handleInputChange}
                  placeholder="e.g., important, v2.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-600 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || databases.length === 0}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing Upload...' : 'Upload & Generate Embeddings'}
          </button>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Upload History</h2>
        
        {uploadJobs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No upload jobs found. Upload your first PDF above!
          </div>
        ) : (
          <div className="space-y-4">
            {uploadJobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {job.fileNames?.join(', ') || 'Unknown Files'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Database: {job.databaseName} ({job.databaseEngine}) | 
                      Model: {job.embeddingModel?.split('.').pop() || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Files: {job.fileCount} | 
                      Chunk Size: {job.chunkSize} | 
                      Created: {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    job.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' :
                    job.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    job.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    job.status === 'DELETED' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {job.status || 'Unknown'}
                  </span>
                </div>

                {job.metadata && Object.values(job.metadata).some(v => v) && (
                  <div className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Metadata:</span>
                    {job.metadata.source && ` Source: ${job.metadata.source}`}
                    {job.metadata.category && ` | Category: ${job.metadata.category}`}
                    {job.metadata.tags && ` | Tags: ${job.metadata.tags}`}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {['COMPLETED', 'FAILED', 'DELETED'].includes(job.status) && (
                    <button
                      onClick={() => deleteUploadJob(job)}
                      className="px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                    >
                      Remove Record
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}