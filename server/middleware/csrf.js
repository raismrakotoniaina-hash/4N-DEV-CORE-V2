export function requireSameOrigin({ allowedOrigin } = {}) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.get('origin');
    if (!allowedOrigin || !origin || origin !== allowedOrigin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'csrf_origin_rejected',
          message: 'Cross-site request rejected.'
        },
        requestId: req.requestId
      });
    }

    return next();
  };
}
