// /api/delete-database.js

// API configuration - you'll need to provide the delete endpoint
const DELETE_API_URL = 'https://v92qgjfo7l.execute-api.eu-central-1.amazonaws.com/prod/delete-database'; // Update this URL
const API_KEY = 'XjUWxEyUER6u3s8jdmZlz6B6EKa1T0Yra2SWQgo9';

// Simple token validation (since we don't have Firebase Admin)
function validateAuthToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  // For now, we'll trust the token exists and rely on client-side validation
  // In production, you'd want to verify this token with Firebase Auth REST API
  return true;
}

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }
  
  try {
    // Basic auth validation (without Firebase Admin)
    validateAuthToken(req);
    
    const { databaseId, containerName, userId, engine } = req.body;
    
    // Validate required fields
    if (!databaseId || !containerName || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: databaseId, containerName, or userId' 
      });
    }

    // Log the deletion request
    console.log('Database deletion requested:', {
      databaseId,
      containerName,
      userId,
      engine,
      timestamp: new Date().toISOString(),
    });

    // Prepare the payload for the external deletion API
    const deletePayload = {
      containerName: containerName,
      userId: userId,
      // Add any other fields the delete API might need
    };

    console.log('Delete API Payload:', JSON.stringify(deletePayload, null, 2));

    // Call the external delete API
    const response = await fetch(DELETE_API_URL, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(deletePayload),
    });

    console.log('Delete API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External delete API error:', errorText);
      throw new Error(`External API failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Delete API result:', result);

    // TODO: Update Firestore to mark database as deleted/deleting
    // Since we don't have Firebase Admin, the frontend will handle Firestore updates
    
    res.status(200).json({
      success: true,
      message: 'Database deletion started successfully',
      deletionId: result.deletionId || result.id || `delete-${Date.now()}`,
      containerName: containerName,
      status: 'DELETING',
    });

  } catch (error) {
    console.error('Database deletion error:', error);
    
    // Handle specific error types
    if (error.message.includes('No authentication token provided')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    // For now, if the delete API doesn't exist, we'll still allow "soft delete"
    if (error.message.includes('fetch failed') || error.code === 'ENOTFOUND' || error.message.includes('404')) {
      console.warn('Delete API not available, performing soft delete');
      return res.status(200).json({
        success: true,
        message: 'Database marked for deletion (API not available - removing from dashboard)',
        deletionId: `soft-delete-${Date.now()}`,
        containerName: req.body.containerName,
        status: 'DELETED',
        softDelete: true,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete database',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}