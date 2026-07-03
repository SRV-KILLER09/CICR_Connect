const express = require('express');
const router = express.Router();
const { 
    generateInviteCode, 
    sendInviteEmail, // Ensure this matches the controller export
    getAllUsers, 
    deleteUser, 
    updateUserByAdmin,
    getPendingAdminActions,
    approveAdminAction,
    generatePasswordResetCode,
    getAuditLogs,
    grantTemporaryAccess,
    revokeTemporaryAccess,
    getTemporaryAccessUsers,
    sendBulkEmail,
} = require('../controllers/adminController');

const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Security: Applied to all routes below
const checkSeniorAccess = (req, res, next) => {
    const { isAdminOrHead, isAlumni, parseYear } = require('../utils/policyEngine');
    if (isAdminOrHead(req.user) || isAlumni(req.user.role) || parseYear(req.user.year) >= 2) {
        return next();
    }
    return res.status(403).json({ message: 'Only seniors or admins can access these features.' });
};

router.use(protect, checkSeniorAccess);

/* --- Invitation Routes --- */
router.post('/invite', authorize('Admin', 'Head'), generateInviteCode);
router.post('/send-invite', authorize('Admin', 'Head'), sendInviteEmail);

/* --- User Management --- */
router.get('/users', getAllUsers);
router.post('/users/bulk-email', authorize('Admin', 'Head'), sendBulkEmail);
router.route('/users/:id')
    .put(updateUserByAdmin) // update logic must check target year
    .delete(authorize('Admin', 'Head'), deleteUser);
router.post('/users/:id/password-reset-code', authorize('Admin', 'Head'), generatePasswordResetCode);
router.get('/users/temporary-access', authorize('Admin', 'Head'), getTemporaryAccessUsers);
router.post('/users/:id/temporary-access', authorize('Admin', 'Head'), grantTemporaryAccess);
router.post('/users/:id/temporary-access/revoke', authorize('Admin', 'Head'), revokeTemporaryAccess);

router.get('/actions/pending', getPendingAdminActions); // check year internally
router.post('/actions/:actionId/approve', authorize('Admin', 'Head'), approveAdminAction);
router.get('/audit/logs', authorize('Admin', 'Head'), getAuditLogs);

module.exports = router;
