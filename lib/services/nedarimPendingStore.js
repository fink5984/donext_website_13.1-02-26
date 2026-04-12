// Store for pending Nedarim Plus transactions
// In production, this should be Redis or database
// For now, we'll use a simple in-memory Map with expiration

const pendingTransactions = new Map();

// Cleanup old transactions periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const expireTime = 10 * 60 * 1000; // 10 minutes
  
  for (const [key, value] of pendingTransactions.entries()) {
    if (now - value.createdAt > expireTime) {
      pendingTransactions.delete(key);
    }
  }
}, 5 * 60 * 1000);

export { pendingTransactions };
