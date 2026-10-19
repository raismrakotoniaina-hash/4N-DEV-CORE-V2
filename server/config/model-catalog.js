// Canonical public model identifiers are intentionally separate from provider IDs.
export const modelCatalog = Object.freeze([
  Object.freeze({ id: '4n-chat-naya-5.6', name: 'Luna 5.6', service: 'chat', provider: 'openai', status: 'active' }),
  Object.freeze({ id: '4n-chat-naya-6', name: 'Luna 6', service: 'chat', provider: 'openai', status: 'active' }),
  Object.freeze({ id: '4n-code-nael-5.6', name: 'Sol 5.6', service: 'coding', provider: 'openai', status: 'active' }),
  Object.freeze({ id: '4n-code-nael-6.1', name: 'Sol 6.1', service: 'coding', provider: 'openai', status: 'active' })
]);

// Keep image generation available internally without advertising a fifth text model.
export const aiServiceModelCatalog = Object.freeze([
  ...modelCatalog,
  Object.freeze({ id: '4n-image', name: '4N Image', service: 'image', status: 'active' })
]);

export const providerModelCatalog = Object.freeze({
  '4n-chat-naya-5.6': 'gpt-5.6-luna',
  '4n-chat-naya-6': 'gpt-6-luna',
  '4n-code-nael-5.6': 'gpt-5.6-sol',
  '4n-code-nael-6.1': 'gpt-6.1-sol',
  '4n-image': 'gpt-image-2.5-flare'
});
