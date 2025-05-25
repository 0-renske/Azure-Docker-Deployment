// /api/check-database-status.js

// External API configuration
const EXTERNAL_API_BASE_URL = 'https://aofz0s8s39.execute-api.eu-central-1.amazonaws.com/alpha/execution';
const API_KEY = 'XjUWxEyUER6u3s8jdmZlz6B6EKa1T0Yra2SWQgo9';

// Simple token validation (since we don't have Firebase Admin)
function validateAuthTokenForStatus(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  // For now, we'll trust the token exists and rely on client-side validation
  // In production, you'd want to verify this token with Firebase Auth REST API
  return true;
}

// Parse connection info based on database engine
function parseConnectionInfo(output, engine) {
  if (!output) return null;
  
  try {
    const parsedOutput = typeof output === 'string' ? JSON.parse(output) : output;
    
    switch (engine) {
      case 'Postgres': // Fixed spelling
        return {
          host: parsedOutput.host || parsedOutput.endpoint,
          port: parsedOutput.port || 5432,
          database: parsedOutput.database || parsedOutput.dbName,
          username: parsedOutput.username || parsedOutput.user,
          // Don't store password in connection info for security
          connectionString: `postgresql://${parsedOutput.username}@${parsedOutput.host}:${parsedOutput.port || 5432}/${parsedOutput.database}`,
        };
        
      case 'Weaviate': // Capitalized
        return {
          url: parsedOutput.url || parsedOutput.endpoint,
          host: parsedOutput.host,
          port: parsedOutput.port || 8080,
          scheme: parsedOutput.scheme || 'http',
          apiKey: parsedOutput.apiKey,
        };
        
      case 'Chroma': // Capitalized
        return {
          url: parsedOutput.url || parsedOutput.endpoint,
          host: parsedOutput.host,
          port: parsedOutput.port || 8000,
          apiEndpoint: `${parsedOutput.url || parsedOutput.endpoint}/api/v1`,
        };
        
      case 'Pinecone': // Capitalized
        return {
          indexName: parsedOutput.indexName || parsedOutput.dbName,
          environment: parsedOutput.environment,
          apiKey: parsedOutput.apiKey,
          indexUrl: parsedOutput.indexUrl,
          dimension: parsedOutput.dimension || 1536,
          metric: parsedOutput.metric || 'cosine',
        };
        
      default:
        return parsedOutput;
    }
  } catch (error) {
    console.warn('Could not parse connection info:', error);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Basic auth validation (without Firebase Admin)
    validateAuthTokenForStatus(req);
    
    const { executionId, databaseId, userId, engine } = req.body;
    
    if (!executionId) {
      return res.status(400).json({ message: 'Execution ID is required' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Call the external API to get status
    const statusUrl = `${EXTERNAL_API_BASE_URL}/${executionId}`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('External API status error:', errorText);
      throw new Error(`Failed to get status: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    // Handle potentially malformed JSON
    let statusData;
    try {
      const responseText = await statusResponse.text();
      console.log('Raw response:', responseText); // Debug log
      
      // Try to fix common JSON issues
      let cleanedResponse = responseText
        .replace(/,\s*}/g, '}')           // Remove trailing commas before }
        .replace(/,\s*]/g, ']')           // Remove trailing commas before ]
        .replace(/:\s*,/g, ': null,')     // Replace empty values with null
        .replace(/,\s*,/g, ',')           // Remove double commas
        .replace(/,(\s*[}\]])/g, '$1');   // Remove trailing commas
      
      statusData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text:', await statusResponse.text());
      
      // Return a basic response if JSON parsing fails
      statusData = {
        status: 'UNKNOWN',
        error: 'Failed to parse status response',
        executionArn: executionId
      };
    }
    
    // Parse connection information if available
    let connectionInfo = null;
    if (statusData.status === 'SUCCEEDED' && statusData.output && engine) {
      try {
        connectionInfo = parseConnectionInfo(statusData.output, engine);
      } catch (connError) {
        console.warn('Failed to parse connection info:', connError);
        connectionInfo = null;
      }
    }

    // Map the external API status to user-friendly status
    const statusMapping = {
      'SUCCEEDED': 'Completed',
      'FAILED': 'Failed',
      'RUNNING': 'Creating',
      'CREATING': 'Creating',
      'TIMED_OUT': 'Failed (Timeout)',
      'ABORTED': 'Failed (Aborted)',
      'PENDING': 'Pending',
      'STARTING': 'Starting',
    };

    const userFriendlyStatus = statusMapping[statusData.status] || statusData.status;

    // Calculate progress percentage
    let progressPercentage = 0;
    if (statusData.status === 'SUCCEEDED') {
      progressPercentage = 100;
    } else if (statusData.status === 'RUNNING') {
      // Estimate progress based on elapsed time
      if (statusData.startDate) {
        const started = new Date(statusData.startDate);
        const now = new Date();
        const elapsed = Math.floor((now - started) / 1000 / 60); // minutes elapsed
        
        const estimatedTotalTimes = {
          'Postgress': 8,
          'weaviate': 4,
          'chroma': 4,
          'pinecone': 2,
        };
        
        const totalTime = estimatedTotalTimes[engine] || 8;
        progressPercentage = Math.min(90, Math.floor((elapsed / totalTime) * 100));
      } else {
        progressPercentage = 25; // Default progress if no start date
      }
    } else if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(statusData.status)) {
      progressPercentage = 0;
    }

    res.status(200).json({
      executionId: executionId,
      status: statusData.status || 'UNKNOWN',
      userFriendlyStatus: userFriendlyStatus,
      progressPercentage: progressPercentage,
      startDate: statusData.startDate || null,
      stopDate: statusData.stopDate || null,
      input: statusData.input || null,
      output: statusData.output || null,
      error: statusData.error || null,
      connectionInfo: connectionInfo,
      estimatedTimeRemaining: getEstimatedTimeRemaining(statusData.status, statusData.startDate, engine),
      lastChecked: new Date().toISOString(),
      rawResponse: process.env.NODE_ENV === 'development' ? statusData : undefined, // Debug info
    });
  } catch (error) {
    console.error('Status check error:', error);
    
    // Handle specific error types
    if (error.message.includes('No authentication token provided')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (error.message.includes('Failed to get status: 404')) {
      return res.status(404).json({ message: 'Execution not found or has expired' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to check database status',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Helper function to estimate remaining time
function getEstimatedTimeRemaining(status, startDate, engine) {
  if (!['RUNNING', 'CREATING'].includes(status) || !startDate) {
    return null;
  }
  
  const started = new Date(startDate);
  const now = new Date();
  const elapsed = Math.floor((now - started) / 1000 / 60); // minutes elapsed
  
  const estimatedTotalTimes = {
    'Postgres': 8, // Fixed spelling - minutes
    'Weaviate': 4, // Capitalized
    'Chroma': 4,   // Capitalized
    'Pinecone': 2, // Capitalized
  };
  
  const totalTime = estimatedTotalTimes[engine] || 8;
  const remaining = Math.max(0, totalTime - elapsed);
  
  if (remaining === 0) {
    return 'Should complete shortly';
  }
  
  return `Approximately ${remaining} minute${remaining !== 1 ? 's' : ''} remaining`;
}