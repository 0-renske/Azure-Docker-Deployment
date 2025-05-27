export const config = {
  database: {
    apiKey: process.env.DATABASE_API_KEY,
    baseUrl: process.env.DATABASE_API_BASE_URL || 'https://v92qgjfo7l.execute-api.eu-central-1.amazonaws.com/prod',
    subnets: ["subnet-069da970533284526", "subnet-0d959c80c14bd08a5"],
    securityGroups: ["sg-01b735d961a022b68"]
  },
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
};
export function validateDatabaseApiConfig() {
  const missing = [];
  
  if (!config.database.apiKey) {
    missing.push('DATABASE_API_KEY');
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

export function validateFirebaseConfig() {
  const missing = [];
  
  if (!config.firebase.apiKey) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!config.firebase.authDomain) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!config.firebase.projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  
  if (missing.length > 0) {
    throw new Error(`Missing required Firebase environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

// Helper to get database API endpoints
export function getDatabaseApiEndpoints() {
  return {
    deploy: `${config.database.baseUrl}/deploy-database`,
    delete: `${config.database.baseUrl}/delete-database`,
    status: `${config.database.baseUrl}/database-status`,
  };
}