// Auth-specific handler for Netlify Functions
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'silver_fin_monitor_jwt_secret_dev';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// Mock user for demo mode
const DEMO_USER = {
  id: 'demo-user-id',
  email: 'admin@silverfin.com',
  fullName: 'Demo Admin',
  role: 'admin',
  subscriptionTier: 'enterprise',
  subscriptionStatus: 'active',
  preferences: {},
  usageLimits: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerified: true
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Main handler
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Determine which auth endpoint based on the path
    const path = event.path.replace('/.netlify/functions/auth', '');
    const endpoint = path.split('/').filter(Boolean)[0];
    
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    switch (endpoint) {
      case 'login':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }
        
        const { email, password } = body;
        
        // Demo credentials
        if (email === 'admin@silverfin.com' && password === 'password') {
          const token = generateToken(DEMO_USER);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: {
                user: DEMO_USER,
                token,
                accessToken: token,
                refreshToken: token
              }
            })
          };
        }
        
        // If Supabase is configured, try real authentication
        if (supabase) {
          // Note: This is a simplified version. In production, you'd use Supabase Auth
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
            
          if (user) {
            // In production, verify password hash
            const token = generateToken(user);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                data: {
                  user,
                  token,
                  accessToken: token,
                  refreshToken: token
                }
              })
            };
          }
        }
        
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid email or password'
          })
        };
        
      case 'logout':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Logged out successfully'
          })
        };
        
      case 'me':
        if (event.httpMethod !== 'GET') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }
        
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'No authentication token provided'
            })
          };
        }
        
        const decoded = verifyToken(token);
        if (!decoded) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Invalid or expired token'
            })
          };
        }
        
        // Return demo user for demo token
        if (decoded.id === 'demo-user-id') {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: DEMO_USER
            })
          };
        }
        
        // Try to get user from database
        if (supabase) {
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id)
            .single();
            
          if (user) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                data: user
              })
            };
          }
        }
        
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User not found'
          })
        };
        
      case 'register':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }
        
        // Registration not implemented in serverless mode
        return {
          statusCode: 501,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Registration not available in serverless environment'
          })
        };
        
      case 'refresh':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }
        
        const { refreshToken } = body;
        
        if (!refreshToken) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Refresh token required'
            })
          };
        }
        
        const refreshDecoded = verifyToken(refreshToken);
        if (!refreshDecoded) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Invalid refresh token'
            })
          };
        }
        
        // Generate new access token
        const newToken = generateToken({
          id: refreshDecoded.id,
          email: refreshDecoded.email,
          role: refreshDecoded.role
        });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              accessToken: newToken,
              refreshToken: refreshToken // Return same refresh token
            }
          })
        };
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Auth endpoint not found' })
        };
    }
    
  } catch (error) {
    console.error('Auth API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      })
    };
  }
};