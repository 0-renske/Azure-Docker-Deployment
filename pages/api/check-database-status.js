const EXTERNAL_API_BASE_URL = 'https://aofz0s8s39.execute-api.eu-central-1.amazonaws.com/alpha/execution';
const API_KEY = 'XjUWxEyUER6u3s8jdmZlz6B6EKa1T0Yra2SWQgo9';

function validateAuthTokenForStatus(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  return true;
}

function parseConnectionInfo(output, engine) {
  if (!output) return null;
  
  try {
    const parsedOutput = typeof output === 'string' ? JSON.parse(output) : output;
    
    switch (engine) {
      case 'Postgres': 
        return {
          host: parsedOutput.host || parsedOutput.endpoint,
          port: parsedOutput.port || 5432,
          database: parsedOutput.database || parsedOutput.dbName,
          username: parsedOutput.username || parsedOutput.user,
          connectionString: `postgresql://${parsedOutput.username}@${parsedOutput.host}:${parsedOutput.port || 5432}/${parsedOutput.database}`,
        };
        
      case 'Weaviate': 
        return {
          url: parsedOutput.url || parsedOutput.endpoint,
          host: parsedOutput.host,
          port: parsedOutput.port || 8080,
          scheme: parsedOutput.scheme || 'http',
          apiKey: parsedOutput.apiKey,
        };
        
      case 'Chroma':
        return {
          url: parsedOutput.url || parsedOutput.endpoint,
          host: parsedOutput.host,
          port: parsedOutput.port || 8000,
          apiEndpoint: `${parsedOutput.url || parsedOutput.endpoint}/api/v1`,
        };
        
      case 'Pinecone': 
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
    validateAuthTokenForStatus(req);
    
    const { executionId, databaseId, userId, engine } = req.body;
    
    if (!executionId) {
      return res.status(400).json({ message: 'Execution ID is required' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

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

    let statusData;
    try {
      const responseText = await statusResponse.text();
      console.log('Raw response:', responseText);
      
      let cleanedResponse = responseText
        .replace(/,\s*}/g, '}')          
        .replace(/,\s*]/g, ']')           
        .replace(/:\s*,/g, ': null,')     
        .replace(/,\s*,/g, ',')           
        .replace(/,(\s*[}\]])/g, '$1');   
      
      statusData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text:', await statusResponse.text());
      
      statusData = {
        status: 'UNKNOWN',
        error: 'Failed to parse status response',
        executionArn: executionId
      };
    }
    
    let connectionInfo = null;
    if (statusData.status === 'SUCCEEDED' && statusData.output && engine) {
      try {
        connectionInfo = parseConnectionInfo(statusData.output, engine);
      } catch (connError) {
        console.warn('Failed to parse connection info:', connError);
        connectionInfo = null;
      }
    }

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

    let progressPercentage = 0;
    if (statusData.status === 'SUCCEEDED') {
      progressPercentage = 100;
    } else if (statusData.status === 'RUNNING') {
      if (statusData.startDate) {
        const started = new Date(statusData.startDate);
        const now = new Date();
        const elapsed = Math.floor((now - started) / 1000 / 60);
        
        const estimatedTotalTimes = {
          'Postgress': 8,
          'weaviate': 4,
          'chroma': 4,
          'pinecone': 2,
        };
        
        const totalTime = estimatedTotalTimes[engine] || 8;
        progressPercentage = Math.min(90, Math.floor((elapsed / totalTime) * 100));
      } else {
        progressPercentage = 25;
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
      rawResponse: process.env.NODE_ENV === 'development' ? statusData : undefined, 
    });
  } catch (error) {
    console.error('Status check error:', error);
    
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

function getEstimatedTimeRemaining(status, startDate, engine) {
  if (!['RUNNING', 'CREATING'].includes(status) || !startDate) {
    return null;
  }
  
  const started = new Date(startDate);
  const now = new Date();
  const elapsed = Math.floor((now - started) / 1000 / 60); 
  
  const estimatedTotalTimes = {
    'Postgres': 8, 
    'Weaviate': 4,
    'Chroma': 4,   
    'Pinecone': 2, 
  };
  
  const totalTime = estimatedTotalTimes[engine] || 8;
  const remaining = Math.max(0, totalTime - elapsed);
  
  if (remaining === 0) {
    return 'Should complete shortly';
  }
  
  return `Approximately ${remaining} minute${remaining !== 1 ? 's' : ''} remaining`;
}