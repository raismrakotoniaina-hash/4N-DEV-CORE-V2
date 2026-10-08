export function createProviderError(code, message, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.expose = true;
  return error;
}

export function createProvider() {
  throw new Error('Provider adapter is not configured.');
}
