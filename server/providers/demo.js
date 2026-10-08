function countTokens(value) {
  return Math.max(1, Math.ceil(String(value || '').length / 4));
}

export function createDemoProvider() {
  return {
    id: 'demo',

    async chat({ model, messages }) {
      const lastUser = [...messages].reverse().find((item) => item.role === 'user');
      const content = lastUser?.content || 'Hello from 4N DEV Core.';
      return {
        model: model || 'demo-chat',
        message: {
          role: 'assistant',
          content: `4N DEV Core demo response: ${content}`
        },
        inputTokens: countTokens(JSON.stringify(messages)),
        outputTokens: countTokens(content)
      };
    },

    async coding({ model, prompt, language }) {
      const lang = language || 'text';
      return {
        model: model || 'demo-coding',
        output: `// 4N DEV Core demo response
// language: ${lang}

${prompt || 'No coding prompt provided.'}`,
        language: lang,
        inputTokens: countTokens(prompt),
        outputTokens: countTokens(prompt)
      };
    },

    async image({ model, prompt, size }) {
      const safePrompt = String(prompt || '4N DEV Core demo image').replace(/[<>&"']/g, '');
      const imageSize = size || '1024x1024';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#111827"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="42" font-family="Arial">4N DEV CORE</text><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" fill="#a78bfa" font-size="24" font-family="Arial">${safePrompt.slice(0, 80)}</text></svg>`;
      return {
        model: model || 'demo-image',
        images: [{ url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }],
        size: imageSize
      };
    }
  };
}
