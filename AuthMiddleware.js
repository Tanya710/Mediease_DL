// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    // Verify req.user exists and has userId
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'User ID not found in session' });
    }
    return next();
  }
  res.status(401).json({ message: 'Unauthorized: Please log in to access this resource' });
};

// Middleware to check if user is not authenticated (for routes like login/register)
export const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.status(400).json({ message: 'You are already logged in' });
};


export {isAuthenticated}