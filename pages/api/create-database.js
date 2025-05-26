
const EXTERNAL_API_URL = 'https://v92qgjfo7l.execute-api.eu-central-1.amazonaws.com/prod/deploy-database';
const API_KEY = 'XjUWxEyUER6u3s8jdmZlz6B6EKa1T0Yra2SWQgo9';

const SUBNETS = ["subnet-069da970533284526", "subnet-0d959c80c14bd08a5"];
const SECURITY_GROUPS = ["sg-01b735d961a022b68"];

function validateAuthToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  return true;
}

// Validate database name format
function validateDatabaseName(name, engine) {
  const errors = [];
  
  if (!name || name.length < 4) {
    errors.push('Database name must be at least 4 characters');
  }
  
  if (name.includes(' ')) {
    errors.push('Database name cannot contain spaces');
  }
  
  // Engine-specific validations
  if (engine === 'pinecone') {
    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push('Pinecone index names can only contain lowercase letters, numbers, and hyphens');
    }
  }
  
  if (['Postgress', 'weaviate', 'chroma'].includes(engine)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      errors.push('Database name must start with a letter and contain only letters, numbers, and underscores');
    }
  }
  
  return errors;
}

// Validate engine-specific requirements
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
        errors.push('Password must be at least 8 characters');
      }
      break;
      
    default:
      errors.push(`Unsupported database engine: ${engine}`);
  }
  
  return errors;
}

// Create API payload for the new endpoint
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
  
  // Clean and validate database name for container naming
  const cleanDbName = data.dbName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')         // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens
  
  // Generate container name (must be valid container name format)
  const userIdShort = userId.substring(0, 8).toLowerCase();
  const containerName = `${databaseType}-${cleanDbName}-${userIdShort}`;
  
  // Validate container name length (Docker container names have limits)
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
  
  // For Pinecone, we might need different parameters
  if (engine === 'Pinecone') {
    return {
      databaseType: databaseType,
      containerName: containerName,
      username: 'admin',
      password: data.apiKey, // Use API key as password for Pinecone
      subnets: SUBNETS,
      securityGroups: SECURITY_GROUPS,
      // Additional Pinecone-specific data
      pineconeEnvironment: data.environment,
      pineconeApiKey: data.apiKey
    };
  }
  
  return {
    databaseType: databaseType,
    containerName: containerName,
    username: 'admin',
    password: data.dbPassword,
    subnets: SUBNETS,
    securityGroups: SECURITY_GROUPS
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
      environment,
      region
    } = req.body;
    
    // Validate required fields
    if (!engine || !dbName || !userId) {
      return res.status(400).json({ message: 'Engine, database name, and user ID are required' });
    }

    // Validate user email (basic check)
    if (!userEmail || !userEmail.includes('@')) {
      return res.status(400).json({ message: 'Valid user email is required' });
    }

    // Validate database name
    const nameErrors = validateDatabaseName(dbName, engine);
    if (nameErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid database name', 
        errors: nameErrors 
      });
    }

    // Validate engine-specific requirements
    const engineErrors = validateEngineRequirements(engine, req.body);
    if (engineErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid engine configuration', 
        errors: engineErrors 
      });
    }

    // Validate storage
    if (!storage || storage < 20) {
      return res.status(400).json({ message: 'Storage must be at least 20 GB' });
    }

    // Validate engine
    const supportedEngines = ['Postgres', 'Weaviate', 'Chroma', 'Pinecone']; 
    if (!supportedEngines.includes(engine)) {
      return res.status(400).json({ 
        message: `Invalid database engine. Supported engines: ${supportedEngines.join(', ')}` 
      });
    }

    // Create API payload for the new endpoint
    const apiPayload = createApiPayload(engine, req.body, userId, userEmail);
    
    // Log the payload for debugging
    console.log('API Payload being sent:', JSON.stringify(apiPayload, null, 2));

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
    
    // Extract deployment ID or use a generated one
    const deploymentId = result.deploymentId || result.id || `deploy-${Date.now()}`;

    // Log the database creation request
    console.log('Database creation started:', {
      userId,
      userEmail,
      engine,
      dbName,
      deploymentId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Database creation started successfully',
      executionId: deploymentId, // Keep same field name for compatibility
      deploymentId: deploymentId,
      databaseEngine: engine,
      databaseName: dbName,
      containerName: apiPayload.containerName,
      estimatedCompletionTime: getEstimatedCompletionTime(engine),
    });
  } catch (error) {
    console.error('Database creation error:', error);
    
    // Handle specific error types
    if (error.message.includes('No authentication token provided')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to create database',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Helper function to estimate completion time based on database type
function getEstimatedCompletionTime(engine) {
  const estimates = {
    'Postgres': '3-5 minutes',   
    'Weaviate': '2-4 minutes',   
    'Chroma': '2-4 minutes',     
    'Pinecone': '1-2 minutes',   
  };
  
  return estimates[engine] || '3-5 minutes';
}