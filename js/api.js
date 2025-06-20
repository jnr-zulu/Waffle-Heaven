// api.js - Waffle Heaven Restaurant API Service

/**
 * API Service for Waffle Heaven Restaurant
 * This service handles all API calls to the backend
 */

class ApiService {
  constructor() {
    // Base URL for API requests - should be set from environment variables
    this.baseUrl = process.env.API_URL || 'https://api.waffleheaven.co.za/api';
    this.token = null;
  }

  /**
   * Set auth token for authenticated requests
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('wh_auth_token', token);
  }

  /**
   * Get stored auth token
   * @returns {string|null} - JWT token or null
   */
  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('wh_auth_token');
    }
    return this.token;
  }

  /**
   * Clear auth token (for logout)
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('wh_auth_token');
  }

  /**
   * Helper to build headers for requests
   * @param {boolean} includeAuth - Whether to include auth token
   * @returns {Object} - Headers object
   */
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.getToken()) {
      headers['Authorization'] = `Bearer ${this.getToken()}`;
    }

    return headers;
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {boolean} requiresAuth - Whether request requires authentication
   * @returns {Promise} - Promise resolving to response data
   */
  async get(endpoint, requiresAuth = true) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(requiresAuth)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API GET Error:', error);
      throw error;
    }
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Data to send
   * @param {boolean} requiresAuth - Whether request requires authentication
   * @returns {Promise} - Promise resolving to response data
   */
  async post(endpoint, data, requiresAuth = true) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(requiresAuth),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API POST Error:', error);
      throw error;
    }
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Data to send
   * @param {boolean} requiresAuth - Whether request requires authentication
   * @returns {Promise} - Promise resolving to response data
   */
  async put(endpoint, data, requiresAuth = true) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(requiresAuth),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API PUT Error:', error);
      throw error;
    }
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {boolean} requiresAuth - Whether request requires authentication
   * @returns {Promise} - Promise resolving to response data
   */
  async delete(endpoint, requiresAuth = true) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(requiresAuth)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API DELETE Error:', error);
      throw error;
    }
  }

  // Authentication endpoints
  async register(userData) {
    return this.post('/auth/register', userData, false);
  }

  async login(credentials) {
    const response = await this.post('/auth/login', credentials, false);
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout() {
    const result = await this.post('/auth/logout', {});
    this.clearToken();
    return result;
  }

  // User endpoints
  async getUserProfile() {
    return this.get('/users/profile');
  }

  async updateUserProfile(profileData) {
    return this.put('/users/profile', profileData);
  }

  // Menu endpoints
  async getMenuItems(category = null) {
    const endpoint = category ? `/menu?category=${category}` : '/menu';
    return this.get(endpoint, false);
  }

  async getMenuItem(id) {
    return this.get(`/menu/${id}`, false);
  }

  // For admin users
  async createMenuItem(itemData) {
    return this.post('/admin/menu', itemData);
  }

  async updateMenuItem(id, itemData) {
    return this.put(`/admin/menu/${id}`, itemData);
  }

  async deleteMenuItem(id) {
    return this.delete(`/admin/menu/${id}`);
  }

  // Categories endpoints
  async getCategories() {
    return this.get('/categories', false);
  }

  // Orders endpoints
  async createOrder(orderData) {
    return this.post('/orders', orderData);
  }

  async getUserOrders() {
    return this.get('/orders');
  }

  async getOrderDetails(orderId) {
    return this.get(`/orders/${orderId}`);
  }

  async updateOrderStatus(orderId, statusData) {
    return this.put(`/orders/${orderId}/status`, statusData);
  }

  // Reservations endpoints
  async createReservation(reservationData) {
    return this.post('/reservations', reservationData);
  }

  async getUserReservations() {
    return this.get('/reservations');
  }

  async updateReservation(reservationId, reservationData) {
    return this.put(`/reservations/${reservationId}`, reservationData);
  }

  async cancelReservation(reservationId) {
    return this.delete(`/reservations/${reservationId}`);
  }

  // Reviews endpoints
  async getReviews() {
    return this.get('/reviews', false);
  }

  async submitReview(reviewData) {
    return this.post('/reviews', reviewData);
  }

  // Admin endpoints
  async getUsers() {
    return this.get('/admin/users');
  }

  async getAllOrders() {
    return this.get('/admin/orders');
  }

  async getOrderStats() {
    return this.get('/admin/stats/orders');
  }

  async getRevenueStats() {
    return this.get('/admin/stats/revenue');
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;