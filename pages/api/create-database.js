const API_KEY = process.env.DATABASE_API_KEY;
const API_BASE_URL = process.env.DATABASE_API_BASE_URL || 'https://v92qgjfo7l.execute-api.eu-central-1.amazonaws.com/prod';
const EXTERNAL_API_URL = `${API_BASE_URL}/deploy-database`;

if (!API_KEY) {
  console.error('DATABASE_API_KEY environment variable is not set');
}

const SUBNETS = ["subnet-069da970533284526", "subnet-0d959c80c14bd08a5"];
const SECURITY_GROUPS = ["sg-01b735d961a022b68"];

function validateAuthToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  return true;
}

function validateDatabaseName(name, engine) {
  const errors = [];
  
  if (!name || name.length < 4) {
    errors.push('Database name must be at least 4 characters');
  }
  
  if (name.includes(' ')) {
    errors.push('Database name cannot contain spaces');
  }
  
  if (engine === 'Pinecone') {
    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push('Pinecone index names can only contain lowercase letters, numbers, and hyphens');
    }
  }
  
  if (['Postgres', 'Weaviate', 'Chroma'].includes(engine)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      errors.push('Database name must start with a letter and contain only letters, numbers, and underscores');
    }
  }
  
  return errors;
}

function validateEngineRequirements(engine, data) {
  const errors = [];
  
  switch (engine) {
    case 'Postgres':
      if (!data.dbPassword || data.dbPassword.length < 8) {
        errors.push('PostgreSQL password must be at least 8 characters');
      }
      break;
      
    case 'Pinecone':
      if (!data.apiKey) {
        errors.push('Pinecone API key is required');
      }
      if (!data.environment) {
        errors.push('Pinecone environment is required');
      }
      break;
      
    case 'Weaviate':
    case 'Chroma':
      if (!data.dbPassword || data.dbPassword.length < 8) {
        errors.push(`${engine} password must be at least 8 characters (required for Step Function)`);
      }
      break;
      
    default:
      errors.push(`Unsupported database engine: ${engine}`);
  }
  
  return errors;
}

function createApiPayload(engine, data, userId, userEmail) {
  const engineMapping = {
    'Postgres': 'postgres',
    'Weaviate': 'weaviate', 
    'Chroma': 'chroma',
    'Pinecone': 'pinecone'
  };
  
  const databaseType = engineMapping[engine];
  if (!databaseType) {
    throw new Error(`Unsupported engine: ${engine}`);
  }

  const cleanDbName = data.dbName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')        
    .replace(/^-|-$/g, '');      
  
  const userIdShort = userId.substring(0, 8).toLowerCase();
  const containerName = `${databaseType}-${cleanDbName}-${userIdShort}`;
  
  if (containerName.length > 63) {
    throw new Error('Container name too long. Please use a shorter database name.');
  }
  
  console.log('Creating payload:', {
    engine,
    databaseType,
    containerName,
    cleanDbName,
    originalDbName: data.dbName
  });
  
  const basePayload = {
    databaseType: databaseType,
    containerName: containerName,
    username: 'admin',
    subnets: SUBNETS,
    securityGroups: SECURITY_GROUPS
  };
  
  if (engine === 'Pinecone') {
    return {
      ...basePayload,
      password: data.apiKey,
      pineconeEnvironment: data.environment,
      pineconeApiKey: data.apiKey
    };
  }
  
  return {
    ...basePayload,
    password: data.dbPassword
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    validateAuthToken(req);
    
    const { 
      engine, 
      dbName, 
      dbPassword, 
      storage, 
      userId,
      userEmail,
      apiKey,
      environment
    } = req.body;
    
    if (!engine || !dbName || !userId) {
      return res.status(400).json({ message: 'Engine, database name, and user ID are required' });
    }
    if (!userEmail || !userEmail.includes('@')) {
      return res.status(400).json({ message: 'Valid user email is required' });
    }

    const nameErrors = validateDatabaseName(dbName, engine);
    if (nameErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid database name', 
        errors: nameErrors 
      });
    }

    const engineErrors = validateEngineRequirements(engine, req.body);
    if (engineErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid engine configuration', 
        errors: engineErrors 
      });
    }
    if (!storage || storage < 20) {
      return res.status(400).json({ message: 'Storage must be at least 20 GB' });
    }

    const supportedEngines = ['Postgres', 'Weaviate', 'Chroma', 'Pinecone'];
    if (!supportedEngines.includes(engine)) {
      return res.status(400).json({ 
        message: `Invalid database engine. Supported engines: ${supportedEngines.join(', ')}` 
      });
    }

    if (engine !== 'Pinecone' && (!dbPassword || dbPassword.length < 8)) {
      return res.status(400).json({ 
        message: `Password is required for ${engine} and must be at least 8 characters (needed for Step Function execution)` 
      });
    }

    const apiPayload = createApiPayload(engine, req.body, userId, userEmail);
    
    const logPayload = { ...apiPayload };
    if (logPayload.password) {
      logPayload.password = '[MASKED]';
    }
    if (logPayload.pineconeApiKey) {
      logPayload.pineconeApiKey = '[MASKED]';
    }
    console.log('API Payload being sent:', JSON.stringify(logPayload, null, 2));

    const response = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(apiPayload),
    });
    console.log('API Response Status:', response.status);
    console.log('API Response Headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error response:', errorText);
      throw new Error(`External API failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    const deploymentId = result.deploymentId || result.id || `deploy-${Date.now()}`;

    console.log('Database creation started:', {
      userId,
      userEmail,
      engine,
      dbName,
      deploymentId,
      hasPassword: !!dbPassword,
      hasApiKey: !!apiKey,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Database creation started successfully',
      executionId: deploymentId, 
      deploymentId: deploymentId,
      databaseEngine: engine,
      databaseName: dbName,
      containerName: apiPayload.containerName,
      estimatedCompletionTime: getEstimatedCompletionTime(engine),
    });
  } catch (error) {
    console.error('Database creation error:', error);
    
    if (error.message.includes('No authentication token provided')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to create database',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

function getEstimatedCompletionTime(engine) {
  const estimates = {
    'Postgres': '3-5 minutes',
    'Weaviate': '2-4 minutes',
    'Chroma': '2-4 minutes',
    'Pinecone': '1-2 minutes',
  };
  
  return estimates[engine] || '3-5 minutes';
}