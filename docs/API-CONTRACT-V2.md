# 4N DEV Core V2 — Public API Contract

## 1. Contract principles

The public Core API is versioned under `/v1`.

Applications authenticate with a Core API key:

```
Authorization: Bearer 4ndev_sk_...
```

Applications must not send provider API keys.

Every response is JSON.

Every request that reaches the Core request layer receives a unique `request_id`.

The production Base URL is intentionally not fixed in this document until the production Core server is provisioned.

## 2. Common response envelope

### Success

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "<SERVICE>",
  "model": "<MODEL>",
  "usage": {
    "credits": 1
  },
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "request_id": "<REQUEST_ID>",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Clients should use `error.code` for programmatic handling and `message` for display/logging.

## 3. Authentication

All public AI endpoints require a valid Core API key.

Required header:

```
Authorization: Bearer 4ndev_sk_...
```

Recommended headers:

```
Content-Type: application/json
X-Client-Name: my-application
X-Client-Version: 1.0.0
```

Optional client headers are informational and must never override Core authentication, billing, model routing or authorization.

## 4. POST /v1/chat

Purpose: general conversational AI.

### Request

```json
{
  "model": "4n-chat",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "temperature": 0.7,
  "max_output_tokens": 1200
}
```

### Required fields

- `messages`

### Optional fields

- `model`
- `temperature`
- `max_output_tokens`

The final production model allow-list is server-controlled.

### Response

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "chat",
  "model": "4n-chat",
  "usage": {
    "credits": 1,
    "input_tokens": 120,
    "output_tokens": 80
  },
  "data": {
    "message": {
      "role": "assistant",
      "content": "<MODEL_OUTPUT>"
    }
  }
}
```

## 5. POST /v1/coding

Purpose: coding assistance, code generation and technical reasoning.

### Request

```json
{
  "model": "4n-code",
  "prompt": "Create a REST endpoint for user registration.",
  "language": "javascript",
  "max_output_tokens": 3000
}
```

### Optional fields

- `model`
- `language`
- `context`
- `max_output_tokens`

### Response

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "coding",
  "model": "4n-code",
  "usage": {
    "credits": 8,
    "input_tokens": 200,
    "output_tokens": 500
  },
  "data": {
    "output": "<MODEL_OUTPUT>",
    "language": "javascript"
  }
}
```

## 6. POST /v1/image

Purpose: image generation.

### Request

```json
{
  "model": "4n-image",
  "prompt": "A modern futuristic city at night",
  "size": "1024x1024",
  "quality": "standard"
}
```

### Optional fields

- `model`
- `size`
- `quality`
- future style/configuration fields

### Response

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "image",
  "model": "4n-image",
  "usage": {
    "credits": 50
  },
  "data": {
    "images": [
      {
        "url": "<IMAGE_URL>"
      }
    ]
  }
}
```

The exact image delivery mechanism may later support signed URLs or object storage without changing the semantic response contract.

## 7. GET /v1/credits

Returns the authenticated workspace credit state.

### Response

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "credits",
  "data": {
    "balance": 1250,
    "monthly_limit": 3500,
    "monthly_used": 2250,
    "reset_at": "<ISO_TIMESTAMP>"
  }
}
```

## 8. GET /v1/usage

Returns usage statistics for the authenticated workspace.

Supported query parameters:

- `from`
- `to`
- `service`
- `api_key_id`
- `limit`
- `cursor`

Example:

```
GET /v1/usage?service=chat&limit=50
```

### Response

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "usage",
  "data": {
    "items": [
      {
        "request_id": "<REQUEST_ID>",
        "service": "chat",
        "model": "4n-chat",
        "status": "success",
        "credits": 1,
        "created_at": "<ISO_TIMESTAMP>"
      }
    ],
    "next_cursor": null
  }
}
```

## 9. GET /v1/models

Returns models that the authenticated workspace is allowed to use.

### Response

```json
{
  "success": true,
  "request_id": "<REQUEST_ID>",
  "service": "models",
  "data": {
    "models": [
      {
        "id": "4n-chat",
        "service": "chat",
        "status": "active"
      }
    ]
  }
}
```

The public model IDs are stable 4N DEV Core identifiers:
- `4n-chat` — conversational AI
- `4n-code` — coding and technical assistance
- `4n-image` — image generation
- `4n-builder` — reserved for the Builder service when that public service is released
- `4n-reasoning` — future reasoning service, not enabled initially

Provider names and provider-specific model IDs are internal Core configuration and must never be exposed through this API.

## 10. HTTP status codes

### 200
Successful request.

### 201
Resource created by a management API.

### 400
Invalid request.

Error code examples:
- `invalid_request`
- `invalid_parameter`
- `invalid_model`

### 401
Authentication failure.

Error code examples:
- `missing_api_key`
- `invalid_api_key`
- `revoked_api_key`

### 402
Insufficient credits.

```json
{
  "success": false,
  "request_id": "<REQUEST_ID>",
  "error": {
    "code": "insufficient_credits",
    "message": "Insufficient credits for this request."
  }
}
```

### 403
Authenticated but not authorized.

### 404
Resource or endpoint not found.

### 409
Conflict or duplicate operation.

### 422
Semantically invalid request.

### 429
Rate limit exceeded.

Recommended response headers:
- `Retry-After`

### 500
Internal Core error.

### 502
Upstream provider failure.

### 503
Core or provider temporarily unavailable.

## 11. Error codes

Initial stable codes:

- `missing_api_key`
- `invalid_api_key`
- `revoked_api_key`
- `workspace_suspended`
- `invalid_request`
- `invalid_parameter`
- `invalid_model`
- `insufficient_credits`
- `rate_limit_exceeded`
- `provider_unavailable`
- `provider_timeout`
- `internal_error`

New error codes may be added without breaking existing clients.

## 12. Credit charging policy

The service cost is resolved server-side.

Initial configured costs:
- chat = 1 credit
- coding = 8 credits
- image = 50 credits

Clients must never calculate or submit the amount to charge.

The server remains authoritative.

## 13. Request limits

Initial documented limits:

### Chat
- maximum input: 12,000 units/tokens according to the final tokenizer policy
- maximum output: 1,200 tokens

### Coding
- maximum input: 24,000 units/tokens according to the final tokenizer policy
- maximum output: 3,000 tokens

### Image
- generation limits depend on the enabled model and plan.

These limits are server configuration and can evolve by plan/model.

## 14. Idempotency

Chargeable management operations and payment operations should support:

```
Idempotency-Key: <UNIQUE_VALUE>
```

AI inference requests use `request_id` for tracing. If future retry-safe inference is introduced, an explicit idempotency policy will be added without changing the basic response envelope.

## 15. Streaming

Streaming is not part of the initial V2 contract.

When introduced, it should be added as an explicit versioned capability rather than silently changing the JSON response format.

## 16. Provider abstraction

The public contract must not expose internal provider architecture.

Internally:

```
Core API
→ service router
→ model policy
→ provider adapter
→ provider
```

Changing provider or model routing must not require applications to change their Core authentication or basic service contract.

## 17. Compatibility rule

Once external applications depend on `/v1`, breaking changes require a new API version.

Backward-compatible additions are allowed.

Examples of compatible additions:
- new optional request fields
- new response metadata
- new error codes
- new models returned by `/v1/models`

Examples of breaking changes:
- changing required fields
- changing existing field types
- removing existing response fields
- changing authentication semantics
- changing the meaning of existing services

## 18. Official contract status

This document defines the intended Core V2 public API contract.

Production implementation must validate all provider-specific details before release, but application integrations should target this stable abstraction rather than provider-specific APIs.
