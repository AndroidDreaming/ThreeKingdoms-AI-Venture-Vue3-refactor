import { requestJson } from './httpClient';

export default {
  getManifest() {
    return requestJson('/api/admin/content/manifest');
  },

  list(type) {
    return requestJson(`/api/admin/content/${type}`);
  },

  create(type, payload) {
    return requestJson(`/api/admin/content/${type}`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  update(type, id, payload) {
    return requestJson(`/api/admin/content/${type}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload || {})
    });
  },

  remove(type, id) {
    return requestJson(`/api/admin/content/${type}/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  validate() {
    return requestJson('/api/admin/content/validate', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  publish() {
    return requestJson('/api/admin/content/publish', {
      method: 'POST',
      body: JSON.stringify({})
    });
  }
};
