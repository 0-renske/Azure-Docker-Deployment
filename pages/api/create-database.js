// /api/create-database.js

// External API configuration
const EXTERNAL_API_URL = 'https://aofz0s8s39.execute-api.eu-central-1.amazonaws.com/alpha/execution';
const API_KEY = 'XjUWxEyUER6u3s8jdmZlz6B6EKa1T0Yra2SWQgo9';
const STATE_MACHINE_ARN = 'arn:aws:states:eu-central-1:842702268167:stateMachine:DBCreation-statemachine';

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
    case 'Postgres': // Fixed spelling
      if (!data.dbPassword || data.dbPassword.length < 8) {
        errors.push('PostgreSQL password must be at least 8 characters');
      }
      break;
      
    case 'Pinecone': // Capitalized
      if (!data.apiKey) {
        errors.push('Pinecone API key is required');
      }
      if (!data.environment) {
        errors.push('Pinecone environment is required');
      }
      break;
      
    case 'Weaviate': // Capitalized
    case 'Chroma':   // Capitalized
      // These don't require additional validation for now
      break;
      
    default:
      errors.push(`Unsupported database engine: ${engine}`);
  }
  
  return errors;
}

// Create Step Function input based on database type
function createStepFunctionInput(engine, data, userId, userEmail) {
  const baseInput = {
    userId,
    userEmail,
    databaseEngine: engine,
    databaseName: data.dbName,
    storage: data.storage,
    region: data.region || 'us-east-1',
    timestamp: new Date().toISOString(),
  };
  
  switch (engine) {
    case 'Postgres': // Fixed spelling
      return {
        ...baseInput,
        Engine: engine, // Keep original format for your Step Function
        dbName: data.dbName,
        dbPassword: data.dbPassword,
        storage: data.storage,
        databaseType: 'postgresql',
        instanceClass: data.storage <= 50 ? 'db.t3.micro' : 'db.t3.small',
        allocatedStorage: data.storage,
        engineVersion: '15.4',
      };
      
    case 'Weaviate': // Capitalized
      return {
        ...baseInput,
        Engine: engine,
        dbName: data.dbName,
        storage: data.storage,
        databaseType: 'weaviate',
        containerImage: 'semitechnologies/weaviate:latest',
        containerPort: 8080,
        memory: data.storage <= 50 ? 1024 : 2048,
        cpu: data.storage <= 50 ? 512 : 1024,
      };
      
    case 'Chroma': // Capitalized
      return {
        ...baseInput,
        Engine: engine,
        dbName: data.dbName,
        storage: data.storage,
        databaseType: 'chroma',
        containerImage: 'chromadb/chroma:latest',
        containerPort: 8000,
        memory: data.storage <= 50 ? 1024 : 2048,
        cpu: data.storage <= 50 ? 512 : 1024,
      };
      
    case 'Pinecone': // Capitalized
      return {
        ...baseInput,
        Engine: engine,
        dbName: data.dbName,
        storage: data.storage,
        databaseType: 'pinecone',
        pineconeApiKey: data.apiKey,
        pineconeEnvironment: data.environment,
        indexDimension: 1536, // OpenAI embeddings dimension
        indexMetric: 'cosine',
        pods: 1,
        replicas: 1,
        podType: 'p1.x1',
      };
      
    default:
      throw new Error(`Unsupported engine: ${engine}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Basic auth validation (without Firebase Admin)
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
    const supportedEngines = ['Postgres', 'Weaviate', 'Chroma', 'Pinecone']; // Updated with correct naming
    if (!supportedEngines.includes(engine)) {
      return res.status(400).json({ 
        message: `Invalid database engine. Supported engines: ${supportedEngines.join(', ')}` 
      });
    }

    // Create Step Function input based on engine type
    const stepFunctionInput = createStepFunctionInput(engine, req.body, userId, userEmail);

    // Prepare the payload for the external API
    const payload = {
      input: JSON.stringify(stepFunctionInput),
      stateMachineArn: STATE_MACHINE_ARN
    };

    // Call the external API
    const externalResponse = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error('External API error:', errorText);
      throw new Error(`External API failed: ${externalResponse.status} ${externalResponse.statusText}`);
    }

    const externalResult = await externalResponse.json();
    
    // Extract execution ID from the response
    const executionId = externalResult.executionArn?.split(':').pop() || externalResult.executionId || externalResult.name;

    // Log the database creation request
    console.log('Database creation started:', {
      userId,
      userEmail,
      engine,
      dbName,
      executionArn: externalResult.executionArn,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: 'Database creation started successfully',
      executionId: executionId,
      executionArn: externalResult.executionArn,
      status: 'STARTED',
      dbName: dbName,
      engine: engine,
      storage: storage,
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
    'Postgres': '5-10 minutes',  // Fixed spelling
    'Weaviate': '3-5 minutes',   // Capitalized
    'Chroma': '3-5 minutes',     // Capitalized
    'Pinecone': '1-2 minutes',   // Capitalized
  };
  
  return estimates[engine] || '5-10 minutes';
}