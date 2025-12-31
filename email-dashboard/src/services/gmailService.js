const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let gapi;

export const initializeGapi = async () => {
  if (typeof window !== 'undefined' && window.gapi) {
    gapi = window.gapi;
    
    await gapi.load('client:auth2', async () => {
      await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
        scope: SCOPES
      });
    });
    
    return gapi;
  }
  throw new Error('Google API not loaded');
};

export const signIn = async (clientId) => {
  if (!gapi) {
    throw new Error('GAPI not initialized');
  }
  
  await gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
    scope: SCOPES,
    clientId: clientId
  });
  
  const authInstance = gapi.auth2.getAuthInstance();
  
  if (!authInstance.isSignedIn.get()) {
    await authInstance.signIn();
  }
  
  return authInstance.currentUser.get();
};

export const signOut = async () => {
  if (gapi && gapi.auth2) {
    const authInstance = gapi.auth2.getAuthInstance();
    await authInstance.signOut();
  }
};

export const isSignedIn = () => {
  if (gapi && gapi.auth2) {
    const authInstance = gapi.auth2.getAuthInstance();
    return authInstance.isSignedIn.get();
  }
  return false;
};

const decodeBase64 = (str) => {
  try {
    const decodedBytes = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return decodeURIComponent(escape(decodedBytes));
  } catch (e) {
    return str;
  }
};

const extractEmailBody = (payload) => {
  if (payload.body && payload.body.data) {
    return decodeBase64(payload.body.data);
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64(part.body.data);
      }
    }
    
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = decodeBase64(part.body.data);
        return html.replace(/<[^>]*>/g, '').substring(0, 300);
      }
    }
  }
  
  return '';
};

const getHeader = (headers, name) => {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
};

export const fetchEmails = async (maxResults = 20) => {
  if (!gapi || !isSignedIn()) {
    throw new Error('User not signed in');
  }
  
  try {
    const response = await gapi.client.gmail.users.messages.list({
      userId: 'me',
      maxResults: maxResults,
      q: 'in:inbox'
    });
    
    const messages = response.result.messages || [];
    const emailPromises = messages.map(async (message) => {
      const emailResponse = await gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      const email = emailResponse.result;
      const headers = email.payload.headers;
      
      const from = getHeader(headers, 'From');
      const subject = getHeader(headers, 'Subject');
      const date = getHeader(headers, 'Date');
      const body = extractEmailBody(email.payload);
      
      const isUnread = email.labelIds && email.labelIds.includes('UNREAD');
      
      return {
        id: email.id,
        from: from,
        subject: subject || '(No Subject)',
        body: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
        timestamp: new Date(date),
        isRead: !isUnread,
        threadId: email.threadId
      };
    });
    
    const emails = await Promise.all(emailPromises);
    return emails;
    
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};