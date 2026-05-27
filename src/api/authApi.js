import { requestJson } from './httpClient';

export default {
  register(payload) {
    return requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  login(payload) {
    return requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  logout() {
    return requestJson('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  getMe() {
    return requestJson('/api/me');
  },

  mockPurchase(payload) {
    return requestJson('/api/purchase/mock', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  listUsers() {
    return requestJson('/api/admin/users');
  },

  updateAccess(payload) {
    return requestJson('/api/admin/access', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }
};
