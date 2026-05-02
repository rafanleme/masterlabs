module.exports = function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        type: 'https://httpstatuses.com/403',
        title: 'Forbidden',
        status: 403,
      });
    }
    next();
  };
};
