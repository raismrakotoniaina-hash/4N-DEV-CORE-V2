import React, { useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import './documentation.css';

const examples = {
  JavaScript: `const response = await fetch(
  'https://api.4ndev.dev/v1/chat',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CORE_API_KEY}`,
    },
    body: JSON.stringify({
      model: '4n-chat',
      messages: [
        { role: 'user', content: 'Hello from my app' },
      ],
    }),
  }
);

if (!response.ok) {
  throw new Error(`Core API error: ${response.status}`);
}

const result = await response.json();
console.log(result.data?.message);`,
  Python: `import os
import requests

response = requests.post(
    "https://api.4ndev.dev/v1/chat",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ['CORE_API_KEY']}",
    },
    json={
        "model": "4n-chat",
        "messages": [
            {"role": "user", "content": "Hello from my app"}
        ],
    },
    timeout=60,
)
response.raise_for_status()
print(response.json())`,
  cURL: `curl https://api.4ndev.dev/v1/chat \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $CORE_API_KEY" \\
  -d '{
    "model": "4n-chat",
    "messages": [
      {"role": "user", "content": "Hello from my app"}
    ]
  }'`
};

const sections = [
  ['quick-start', 'Quick start'],
  ['authentication', 'Authentication'],
  ['chat', 'Chat API'],
  ['other-services', 'Coding & Image'],
  ['errors', 'Errors'],
  ['usage', 'Credits & usage'],
];

export default function Documentation({ notify = () => {} }) {
  const [language, setLanguage] = useState('JavaScript');
  const [copied, setCopied] = useState(false);

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(examples[language]);
      setCopied(true);
      notify('Code copied');
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      notify('Copy unavailable on this device');
    }
  }

  return (
    <div className="core-docs">
      <div className="page-head">
        <div>
          <p className="kicker">DEVELOPER PLATFORM</p>
          <h1>Documentation</h1>
          <p className="subtitle">Build independent applications with the 4N DEV Core API.</p>
        </div>
      </div>

      <div className="core-docs-layout">
        <nav className="core-docs-nav card" aria-label="Documentation sections">
          <strong>ON THIS PAGE</strong>
          {sections.map(([id, label], index) => (
            <a key={id} href={`#docs-${id}`} className={index === 0 ? 'current' : ''}>
              {label}
            </a>
          ))}
        </nav>

        <div className="core-docs-content">
          <section className="card core-docs-card" id="docs-quick-start">
            <span className="core-docs-eyebrow">QUICK START</span>
            <h2>Connect your application</h2>
            <p>4N DEV Core provides AI services through a centralized API. Your product remains a separate application and connects using its own API key.</p>
            <div className="core-docs-facts">
              <div><span>API base URL</span><code>https://api.4ndev.dev</code></div>
              <div><span>API version</span><code>/v1</code></div>
              <div><span>Authentication</span><code>Bearer API key</code></div>
            </div>
            <div className="core-docs-notice">
              <ShieldCheck aria-hidden="true" />
              <p>Create an API key in the Developer Console. Keep the full secret on your server; never embed it in browser code or a public repository.</p>
            </div>
          </section>

          <section className="card core-docs-card" id="docs-authentication">
            <span className="core-docs-eyebrow">AUTHENTICATION</span>
            <h2>Authenticate each request</h2>
            <p>Send your secret key in the HTTP Authorization header.</p>
            <pre className="core-docs-code"><code>Authorization: Bearer 4ndev_sk_…</code></pre>
            <p className="core-docs-muted">The example above is a placeholder. Use the actual key created for your application.</p>
          </section>

          <section className="card core-docs-card" id="docs-chat">
            <span className="core-docs-eyebrow">CHAT API</span>
            <h2>Send a chat request</h2>
            <p>Use <code>POST /v1/chat</code>. A chat request requires a model and a non-empty array of messages. Each message contains a role and string content.</p>
            <div className="core-docs-code-toolbar" role="group" aria-label="Code example language">
              {Object.keys(examples).map(name => (
                <button key={name} type="button" className={language === name ? 'active' : ''} onClick={() => { setLanguage(name); setCopied(false); }}>{name}</button>
              ))}
              <button type="button" className="copy" onClick={copyExample}><Copy aria-hidden="true" />{copied ? 'Copied' : 'Copy code'}</button>
            </div>
            <pre className="core-docs-code core-docs-example"><code>{examples[language]}</code></pre>
            <h3>Request fields</h3>
            <div className="core-docs-table">
              <div><code>model</code><span>Use an available public model ID, for example <code>4n-chat</code>.</span></div>
              <div><code>messages</code><span>A non-empty array of messages with role <code>system</code>, <code>user</code>, or <code>assistant</code> and string <code>content</code>.</span></div>
              <div><code>max_output_tokens</code><span>Optional. Chat accepts values from 1 to 1200.</span></div>
              <div><code>temperature</code><span>Optional number from 0 to 2.</span></div>
            </div>
          </section>

          <section className="card core-docs-card" id="docs-other-services">
            <span className="core-docs-eyebrow">OTHER SERVICES</span>
            <h2>Coding and image generation</h2>
            <div className="core-docs-endpoint">
              <div><span>POST</span><code>/v1/coding</code></div>
              <p>Send a non-empty <code>prompt</code> and a coding model ID such as <code>4n-code</code>. Optional <code>max_output_tokens</code> supports values from 1 to 3000.</p>
            </div>
            <div className="core-docs-endpoint">
              <div><span>POST</span><code>/v1/image</code></div>
              <p>Use the Image API with an available image model ID such as <code>4n-image</code>. Image options and output details depend on the configured provider.</p>
            </div>
            <p className="core-docs-muted">All API requests require a valid API key. Available models can be checked with <code>GET /v1/models</code>.</p>
          </section>

          <section className="card core-docs-card" id="docs-errors">
            <span className="core-docs-eyebrow">ERRORS</span>
            <h2>When a request fails</h2>
            <div className="core-docs-table">
              <div><code>400</code><span>The request or one of its parameters is invalid.</span></div>
              <div><code>401</code><span>The API key is missing, invalid, or revoked.</span></div>
              <div><code>402</code><span>The account may have insufficient credits or a billing restriction.</span></div>
              <div><code>429</code><span>The request rate limit has been reached. Retry with backoff.</span></div>
              <div><code>503</code><span>A required Core service, provider, or pricing configuration is unavailable.</span></div>
            </div>
            <p className="core-docs-muted">Error responses may include a request ID. Keep it when contacting support so the request can be investigated.</p>
          </section>

          <section className="card core-docs-card" id="docs-usage">
            <span className="core-docs-eyebrow">CREDITS & USAGE</span>
            <h2>Track usage and credits</h2>
            <p>Use the Developer Console to review your balance and usage. Charges depend on the configured provider, model pricing, and actual usage; this page does not promise a fixed cost per request.</p>
            <div className="core-docs-facts">
              <div><span>Credits endpoint</span><code>GET /v1/credits</code></div>
              <div><span>Usage endpoint</span><code>GET /v1/usage</code></div>
              <div><span>Model list</span><code>GET /v1/models</code></div>
            </div>
            <p className="core-docs-muted">The credits and usage endpoints require API-key authentication. Model listing is public.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
