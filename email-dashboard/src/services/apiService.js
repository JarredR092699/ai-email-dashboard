const API_BASE_URL = import.meta.env.PROD 
  ? `${window.location.protocol}//${window.location.host}/api`
  : 'http://localhost:3001/api';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for session cookies
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Authentication methods
  async getAuthUrl() {
    return this.request('/auth/url');
  }

  async handleAuthCallback(code) {
    return this.request('/auth/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getAuthStatus() {
    return this.request('/auth/status');
  }

  async signOut() {
    return this.request('/auth/signout', {
      method: 'POST',
    });
  }

  // Email methods
  async fetchEmails(limit = 50) {
    return this.request(`/emails?limit=${limit}`);
  }
}

export default new ApiService();