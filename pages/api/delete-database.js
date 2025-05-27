
const API_KEY = process.env.DATABASE_API_KEY;
const API_BASE_URL = process.env.DATABASE_API_BASE_URL || 'https://v92qgjfo7l.execute-api.eu-central-1.amazonaws.com/prod';
const DELETE_API_URL = `${API_BASE_URL}/delete-database`;

if (!API_KEY) {
  console.error('DATABASE_API_KEY environment variable is not set');
}

function validateAuthToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authentication token provided');
  }  
  return true;
}

function validateContainerName(containerName) {
  if (!containerName) {
    return 'Container name is required';
  }
  
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(containerName)) {
    return 'Invalid container name format';
  }
  
  if (containerName.length > 63) {
    return 'Container name too long (max 63 characters)';
  }
  
  return null;
}

function validateEngine(engine) {
  const supportedEngines = ['Postgres', 'Weaviate', 'Chroma', 'Pinecone'];
  
  if (engine && !supportedEngines.includes(engine)) {
    return `Unsupported engine: ${engine}. Supported engines: ${supportedEngines.join(', ')}`;
  }
  
  return null; 
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Only DELETE requests are supported.' 
    });
  }
  
  try {
    validateAuthToken(req);
    
    if (!API_KEY) {
      console.error('DATABASE_API_KEY is not configured');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error: API key not configured' 
      });
    }
    
    const { databaseId, containerName, userId, engine } = req.body;
    
    if (!databaseId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required field: databaseId' 
      });
    }
    
    if (!containerName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required field: containerName' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required field: userId' 
      });
    }

    const containerError = validateContainerName(containerName);
    if (containerError) {
      return res.status(400).json({ 
        success: false, 
        message: containerError 
      });
    }

    const engineError = validateEngine(engine);
    if (engineError) {
      return res.status(400).json({ 
        success: false, 
        message: engineError 
      });
    }

    console.log('Database deletion requested:', {
      databaseId,
      containerName,
      userId: userId.substring(0, 8) + '...', 
      engine: engine || 'unknown',
      timestamp: new Date().toISOString(),
    });

    const deletePayload = {
      containerName: containerName,
      userId: userId,
      databaseId: databaseId,
      ...(engine && { engine: engine.toLowerCase() })
    };

    console.log('Delete API Payload:', {
      ...deletePayload,
      userId: deletePayload.userId.substring(0, 8) + '...'
    });

    const response = await fetch(DELETE_API_URL, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(deletePayload),
    });

    console.log('Delete API Response Status:', response.status);
    console.log('Delete API Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External delete API error response:', errorText);
      
      if (response.status === 404) {
        throw new Error(`Database not found: ${errorText}`);
      } else if (response.status === 403) {
        throw new Error(`Access denied: ${errorText}`);
      } else if (response.status >= 500) {
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      } else {
        throw new Error(`External API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }

    const result = await response.json();
    console.log('Delete API result:', result);

    const deletionId = result.deletionId || result.id || result.executionId || `delete-${Date.now()}`;
    const status = result.status || 'DELETING';

    res.status(200).json({
      success: true,
      message: 'Database deletion started successfully',
      deletionId: deletionId,
      containerName: containerName,
      status: status,
      estimatedDeletionTime: getEstimatedDeletionTime(engine),
      ...(result.additionalInfo && { additionalInfo: result.additionalInfo })
    });

  } catch (error) {
    console.error('Database deletion error:', error);
    
    if (error.message.includes('No authentication token provided')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
      console.warn('Delete API not available or unreachable, performing soft delete');
      return res.status(200).json({
        success: true,
        message: 'Database marked for deletion (API temporarily unavailable - removing from dashboard)',
        deletionId: `soft-delete-${Date.now()}`,
        containerName: req.body.containerName,
        status: 'DELETED',
        softDelete: true,
        warning: 'Physical deletion may need to be completed manually'
      });
    }
    
    if (error.message.includes('Database not found') || error.message.includes('404')) {
      console.warn('Database not found in external system, treating as already deleted');
      return res.status(200).json({
        success: true,
        message: 'Database appears to be already deleted',
        deletionId: `not-found-${Date.now()}`,
        containerName: req.body.containerName,
        status: 'DELETED',
        softDelete: true,
        warning: 'Database was not found in the system - may have been deleted previously'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete database',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      containerName: req.body.containerName
    });
  }
}

function getEstimatedDeletionTime(engine) {
  const estimates = {
    'Postgres': '2-3 minutes',
    'Weaviate': '1-2 minutes',
    'Chroma': '1-2 minutes',
    'Pinecone': '30-60 seconds',
  };
  
  return estimates[engine] || '1-3 minutes';
}