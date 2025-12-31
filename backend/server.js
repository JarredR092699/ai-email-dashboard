require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { google } = require('googleapis');
const aiService = require('./services/aiService');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Configure CORS
app.use(cors({
  origin: isProduction ? true : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: true
}));

app.use(express.json());

// Configure session
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // Use secure cookies in production (HTTPS)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax'
  },
  name: 'email.dashboard.sid'
}));

// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  isProduction 
    ? `https://${process.env.RAILWAY_STATIC_URL || 'your-app.railway.app'}/auth/callback`
    : `http://localhost:3001/auth/callback`
);

// Set the scope for Gmail read access
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Routes

// Serve OAuth callback page
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  
  const callbackPage = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div>
        <div class="spinner"></div>
        <h2>Completing authentication...</h2>
        <p>This window will close automatically.</p>
      </div>
      <script>
        const code = '${code}';
        const error = '${error}';
        
        if (code) {
          // Send code to backend
          fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code })
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              window.opener.postMessage({ type: 'GMAIL_AUTH_SUCCESS' }, 'http://localhost:5173');
            } else {
              window.opener.postMessage({ 
                type: 'GMAIL_AUTH_ERROR', 
                error: data.error || 'Authentication failed' 
              }, 'http://localhost:5173');
            }
            window.close();
          })
          .catch(err => {
            window.opener.postMessage({ 
              type: 'GMAIL_AUTH_ERROR', 
              error: err.message 
            }, 'http://localhost:5173');
            window.close();
          });
        } else if (error) {
          window.opener.postMessage({ 
            type: 'GMAIL_AUTH_ERROR', 
            error: error 
          }, 'http://localhost:5173');
          window.close();
        }
      </script>
    </body>
    </html>
  `;
  
  res.send(callbackPage);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Email Dashboard API is running' });
});

// Get authentication URL
app.get('/api/auth/url', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    include_granted_scopes: true
  });
  
  console.log('🔗 Generated auth URL:', authUrl);
  console.log('🔗 Redirect URI configured:', oauth2Client.redirectUri);
  
  res.json({ authUrl });
});

// Handle OAuth callback
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;
  
  console.log('📧 Received OAuth callback with code:', code ? 'YES' : 'NO');
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens in session
    req.session.tokens = tokens;
    req.session.isAuthenticated = true;
    
    console.log('✅ OAuth successful, tokens stored in session');
    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Authentication failed',
      details: error.message 
    });
  }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  const status = {
    isAuthenticated: !!req.session.isAuthenticated,
    hasTokens: !!req.session.tokens 
  };
  console.log('📊 Auth status check:', status);
  res.json(status);
});

// Sign out
app.post('/api/auth/signout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to sign out' });
    }
    res.json({ success: true, message: 'Signed out successfully' });
  });
});

// Fetch emails
app.get('/api/emails', async (req, res) => {
  if (!req.session.isAuthenticated || !req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Set credentials for this request
    oauth2Client.setCredentials(req.session.tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const maxResults = parseInt(req.query.limit) || 50;
    
    // Get list of messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxResults,
      q: 'in:inbox'
    });
    
    const messages = response.data.messages || [];
    
    // Get full details for each message
    const emailPromises = messages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      const email = emailResponse.data;
      const headers = email.payload.headers;
      
      // Helper function to get header value
      const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
      };
      
      // Helper function to extract email body
      const extractBody = (payload) => {
        if (payload.body && payload.body.data) {
          return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        
        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }
          
          for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body && part.body.data) {
              const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
              return html.replace(/<[^>]*>/g, '').substring(0, 300);
            }
          }
        }
        
        return '';
      };
      
      const from = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');
      const body = extractBody(email.payload);
      
      const isUnread = email.labelIds && email.labelIds.includes('UNREAD');
      
      return {
        id: email.id,
        from: from,
        subject: subject || '(No Subject)',
        body: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
        timestamp: new Date(date).toISOString(),
        isRead: !isUnread,
        threadId: email.threadId
      };
    });
    
    const emails = await Promise.all(emailPromises);
    
    // Add AI prioritization
    console.log('🤖 Starting AI analysis for', emails.length, 'emails...');
    const emailsWithAI = await Promise.all(
      emails.map(async (email) => {
        const aiAnalysis = await aiService.hybridAnalysis(email);
        return {
          ...email,
          aiPriority: aiAnalysis
        };
      })
    );
    
    console.log('✅ AI analysis complete');
    res.json({ emails: emailsWithAI });
    
  } catch (error) {
    console.error('Error fetching emails:', error);
    
    // Handle token expiration
    if (error.code === 401) {
      req.session.destroy();
      return res.status(401).json({ 
        error: 'Authentication expired', 
        message: 'Please sign in again' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch emails',
      details: error.message 
    });
  }
});

// Serve frontend static files in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../email-dashboard/dist')));
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Catch-all handler for React Router (must be last!)
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../email-dashboard/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Email Dashboard ${isProduction ? 'PRODUCTION' : 'DEV'} running on port ${PORT}`);
  if (!isProduction) {
    console.log(`📧 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  }
});

module.exports = app;