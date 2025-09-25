/**
 * Middleware for Role-Based Access Control (RBAC).
 * Creates a middleware function that checks if the authenticated user's role
 * is included in the list of allowed roles.
 *
 * @param {string[]} allowedRoles - An array of roles that are allowed to access the route.
 * @returns {function} Express middleware function.
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        // This middleware assumes the `authenticateToken` middleware has already run
        // and attached the user object to the request.
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'Authentication error: User data is missing.' });
        }

        const userRole = req.user.role;

        // Check if the user's role is in the list of allowed roles
        if (allowedRoles.includes(userRole)) {
            next(); // Role is allowed, proceed to the next middleware/handler
        } else {
            // Role is not allowed, send a 403 Forbidden response
            res.status(403).json({ message: 'Forbidden: You do not have the required permissions to access this resource.' });
        }
    };
};

module.exports = checkRole;

