export function notFound(req, res) {
  res.status(404).json({
    success: false,
    request_id: req.requestId,
    error: { code: 'not_found', message: 'Endpoint not found.' },
  });
}

export function errorHandler(err, req, res, _next) {
  console.error(err);
  if (res.headersSent) return;

  res.status(err.status || 500).json({
    success: false,
    request_id: req.requestId,
    error: {
      code: err.code || 'internal_error',
      message: err.expose ? err.message : 'Internal Core error.',
    },
  });
}
