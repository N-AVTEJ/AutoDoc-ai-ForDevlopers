// KV storage client wrapper helper
// Placeholder file for @vercel/kv integration

export const kv = {
  get: async (key) => {
    console.log(`[KV] Mock get key: ${key}`);
    return null;
  },
  set: async (key, value) => {
    console.log(`[KV] Mock set key: ${key}`);
    return true;
  }
};
