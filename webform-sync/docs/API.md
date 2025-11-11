# Webform Sync Service - API Documentation

Version: 1.0.0  
Base URL: `http://localhost:8765/api/v1`  
Content-Type: `application/json`

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Presets](#presets)
  - [Devices](#devices)
  - [Sync Operations](#sync-operations)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The Webform Sync Service provides a RESTful API for managing webform presets across devices and browsers. The service runs locally on your machine and stores encrypted preset data in an SQLite database.

**Key Features:**
- Local-first: Runs on localhost by default
- Secure: IP filtering and URL whitelisting
- Cross-platform: Windows, Linux, macOS, Docker
- Browser-agnostic: Works with any Chromium-based browser

**Default Configuration:**
- Host: `localhost` (configurable to `0.0.0.0` for network access)
- Port: `8765` (with fallback ports: 8766, 8767, 8768)
- CORS: Enabled for browser extension access

---

## Authentication

**Current Version:** No authentication required for localhost access.

**Security Model:**
- IP-based filtering (whitelist/blacklist)
- URL pattern filtering for preset scope validation
- Data is encrypted end-to-end by the browser extension
- Service stores encrypted blobs without access to plaintext

**Network Access:**
If exposing the service on a network, ensure:
1. Update IP whitelist in `webform-sync.yml`
2. Configure firewall rules appropriately
3. Use trusted networks only (not public internet)

---

## Response Format

All endpoints return JSON responses with a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "Human-readable success message"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

---

## Endpoints

### Health Check

#### `GET /health`

Check if the service is running and get basic status information.

**Query Parameters:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "uptime": "2h34m12s"
  },
  "message": "Service is healthy"
}
```

**Example:**

```bash
curl http://localhost:8765/api/v1/health
```

---

### Presets

#### `GET /presets`

List all presets for a specific device.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id` | string | Yes | Unique device identifier (UUID) |
| `limit` | integer | No | Maximum number of results (default: 100) |
| `offset` | integer | No | Pagination offset (default: 0) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "preset_1762824194543919911",
      "name": "Login Form",
      "scopeType": "url",
      "scopeValue": "https://example.com/login",
      "fields": {
        "username": "john@example.com",
        "email": "john@example.com"
      },
      "encryptedFields": "base64-encoded-encrypted-data",
      "createdAt": "2025-11-11T10:30:00Z",
      "updatedAt": "2025-11-11T10:30:00Z",
      "lastUsed": "2025-11-11T12:15:00Z",
      "useCount": 5
    }
  ],
  "message": "Retrieved 1 presets"
}
```

**Example:**

```bash
curl "http://localhost:8765/api/v1/presets?device_id=550e8400-e29b-41d4-a716-446655440000"
```

---

#### `POST /presets`

Create a new preset.

**Request Body:**

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Login Form",
  "scopeType": "url",
  "scopeValue": "https://example.com/login",
  "fields": {
    "username": "john@example.com",
    "email": "john@example.com"
  },
  "encrypted": false
}
```

**Or with encrypted fields:**

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Login Form",
  "scopeType": "url",
  "scopeValue": "https://example.com/login",
  "encryptedFields": "base64-encoded-encrypted-data",
  "encrypted": true
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | string | Yes | Device identifier (UUID) |
| `name` | string | Yes | User-friendly preset name |
| `scopeType` | string | Yes | Either "url" or "domain" |
| `scopeValue` | string | Yes | URL or domain pattern |
| `fields` | object | No* | Plaintext field data (key-value pairs) |
| `encryptedFields` | string | No* | Encrypted field data (base64) |
| `encrypted` | boolean | No | Whether using encrypted fields (default: false) |

*Either `fields` or `encryptedFields` must be provided.

**Response:**

```json
{
  "success": true,
  "data": {
    "preset": {
      "id": "preset_1762824194543919911",
      "name": "Login Form",
      "scopeType": "url",
      "scopeValue": "https://example.com/login",
      "fields": { /* ... */ },
      "createdAt": "2025-11-11T10:30:00Z",
      "updatedAt": "2025-11-11T10:30:00Z"
    }
  },
  "message": "Preset created successfully"
}
```

**Example:**

```bash
curl -X POST http://localhost:8765/api/v1/presets \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Login Form",
    "scopeType": "url",
    "scopeValue": "https://example.com/login",
    "fields": {
      "username": "john@example.com"
    }
  }'
```

---

#### `GET /presets/{id}`

Get a specific preset by ID.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Preset ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id` | string | Yes | Device identifier for ownership verification |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "preset_1762824194543919911",
    "name": "Login Form",
    "scopeType": "url",
    "scopeValue": "https://example.com/login",
    "fields": { /* ... */ },
    "createdAt": "2025-11-11T10:30:00Z",
    "updatedAt": "2025-11-11T10:30:00Z",
    "lastUsed": "2025-11-11T12:15:00Z",
    "useCount": 5
  },
  "message": "Preset retrieved successfully"
}
```

**Example:**

```bash
curl "http://localhost:8765/api/v1/presets/preset_1762824194543919911?device_id=550e8400-e29b-41d4-a716-446655440000"
```

---

#### `PUT /presets/{id}`

Update an existing preset.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Preset ID |

**Request Body:**

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Login Form",
  "fields": {
    "username": "jane@example.com",
    "email": "jane@example.com"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "preset": {
      "id": "preset_1762824194543919911",
      "name": "Updated Login Form",
      "scopeType": "url",
      "scopeValue": "https://example.com/login",
      "fields": { /* ... */ },
      "updatedAt": "2025-11-11T14:30:00Z"
    }
  },
  "message": "Preset updated successfully"
}
```

**Example:**

```bash
curl -X PUT http://localhost:8765/api/v1/presets/preset_1762824194543919911 \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Login Form"
  }'
```

---

#### `DELETE /presets/{id}`

Delete a preset.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Preset ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id` | string | Yes | Device identifier for ownership verification |

**Response:**

```json
{
  "success": true,
  "data": null,
  "message": "Preset deleted successfully"
}
```

**Example:**

```bash
curl -X DELETE "http://localhost:8765/api/v1/presets/preset_1762824194543919911?device_id=550e8400-e29b-41d4-a716-446655440000"
```

---

#### `GET /presets/scope/{scope_type}/{scope_value}`

Get all presets matching a specific scope.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scope_type` | string | Yes | Either "url" or "domain" |
| `scope_value` | string | Yes | URL or domain (URL-encoded) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "preset_1762824194543919911",
      "name": "Login Form",
      "scopeType": "url",
      "scopeValue": "https://example.com/login",
      "fields": { /* ... */ }
    }
  ],
  "message": "Retrieved 1 presets"
}
```

**Example:**

```bash
# Get presets for a specific URL
curl "http://localhost:8765/api/v1/presets/scope/url/https%3A%2F%2Fexample.com%2Flogin"

# Get presets for a domain
curl "http://localhost:8765/api/v1/presets/scope/domain/example.com"
```

---

### Devices

#### `GET /devices`

List all device IDs that have stored presets.

**Query Parameters:** None

**Response:**

```json
{
  "success": true,
  "data": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "message": "Retrieved 2 devices"
}
```

**Example:**

```bash
curl http://localhost:8765/api/v1/devices
```

---

### Sync Operations

#### `GET /sync/log`

Get the sync operation log showing recent activity.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of entries (default: 100) |
| `offset` | integer | No | Pagination offset (default: 0) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "log_1762824194543919911",
      "timestamp": "2025-11-11T12:15:00Z",
      "operation": "CREATE",
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "presetId": "preset_1762824194543919911",
      "status": "success"
    }
  ],
  "message": "Sync log retrieved"
}
```

**Example:**

```bash
curl "http://localhost:8765/api/v1/sync/log?limit=50"
```

---

#### `POST /sync/cleanup`

Clean up old or unused presets based on age.

**Request Body:**

```json
{
  "days": 90
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `days` | integer | No | Delete presets not used in X days (default: 90) |

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "removed_count": 15,
    "days": 90
  },
  "message": "Cleanup completed: 15 presets removed"
}
```

**Example:**

```bash
curl -X POST http://localhost:8765/api/v1/sync/cleanup \
  -H "Content-Type: application/json" \
  -d '{"days": 180}'
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request - Missing Required Field

```json
{
  "success": false,
  "error": "Missing required field: deviceId",
  "code": "MISSING_FIELD"
}
```

#### 400 Bad Request - Invalid Scope Type

```json
{
  "success": false,
  "error": "Invalid scope type. Must be 'url' or 'domain'",
  "code": "INVALID_SCOPE_TYPE"
}
```

#### 403 Forbidden - URL Not Whitelisted

```json
{
  "success": false,
  "error": "URL not in whitelist: example.com",
  "code": "URL_NOT_ALLOWED"
}
```

#### 404 Not Found - Preset Not Found

```json
{
  "success": false,
  "error": "Preset not found: preset_1762824194543919911",
  "code": "PRESET_NOT_FOUND"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Database error: unable to save preset",
  "code": "DATABASE_ERROR"
}
```

---

## Examples

### Complete Workflow: Save and Retrieve Preset

#### 1. Create a new preset

```bash
curl -X POST http://localhost:8765/api/v1/presets \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "GitHub Login",
    "scopeType": "url",
    "scopeValue": "https://github.com/login",
    "fields": {
      "login": "john_doe",
      "email": "john@example.com"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "preset": {
      "id": "preset_abc123",
      "name": "GitHub Login",
      "scopeType": "url",
      "scopeValue": "https://github.com/login",
      "fields": {
        "login": "john_doe",
        "email": "john@example.com"
      },
      "createdAt": "2025-11-11T10:30:00Z",
      "updatedAt": "2025-11-11T10:30:00Z"
    }
  },
  "message": "Preset created successfully"
}
```

#### 2. List all presets for device

```bash
curl "http://localhost:8765/api/v1/presets?device_id=550e8400-e29b-41d4-a716-446655440000"
```

#### 3. Get presets for specific URL

```bash
curl "http://localhost:8765/api/v1/presets/scope/url/https%3A%2F%2Fgithub.com%2Flogin"
```

#### 4. Update the preset

```bash
curl -X PUT http://localhost:8765/api/v1/presets/preset_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "fields": {
      "login": "jane_doe",
      "email": "jane@example.com"
    }
  }'
```

#### 5. Delete the preset

```bash
curl -X DELETE "http://localhost:8765/api/v1/presets/preset_abc123?device_id=550e8400-e29b-41d4-a716-446655440000"
```

---

### Browser Extension Integration

#### JavaScript Example (from browser extension)

```javascript
// Get sync service URL from storage
async function getSyncServiceUrl() {
  const result = await chrome.storage.local.get(['syncHost', 'syncPort']);
  const host = result.syncHost || 'localhost';
  const port = result.syncPort || '8765';
  return `http://${host}:${port}/api/v1`;
}

// Create a preset
async function createPreset(deviceId, name, scopeType, scopeValue, fields) {
  const baseUrl = await getSyncServiceUrl();
  
  const response = await fetch(`${baseUrl}/presets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      deviceId,
      name,
      scopeType,
      scopeValue,
      fields
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

// Get presets for current page
async function getPresetsForPage(url) {
  const baseUrl = await getSyncServiceUrl();
  const urlObj = new URL(url);
  const encodedUrl = encodeURIComponent(url);
  
  const response = await fetch(`${baseUrl}/presets/scope/url/${encodedUrl}`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data; // Array of presets
}
```

---

## Rate Limiting

**Current Implementation:** Basic rate limiting configured in `webform-sync.yml`

- Default: 60 requests per minute per IP
- Configurable via `performance.rate_limit` setting
- Returns `429 Too Many Requests` when limit exceeded

---

## CORS Configuration

CORS is enabled by default to allow browser extension access:

```yaml
cors:
  enabled: true
  allowed_origins: ["*"]
  allowed_methods: [GET, POST, PUT, DELETE, OPTIONS]
  allowed_headers: [Content-Type, Authorization]
  max_age: 3600
```

---

## Database Schema

For reference, presets are stored with the following schema:

```sql
CREATE TABLE presets (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    name TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    scope_value TEXT NOT NULL,
    fields TEXT NOT NULL,
    encrypted_fields TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    use_count INTEGER DEFAULT 0
);

CREATE INDEX idx_device_scope ON presets(device_id, scope_type, scope_value);
```

---

## Troubleshooting

### Connection Refused

**Problem:** `curl: (7) Failed to connect to localhost port 8765`

**Solutions:**
1. Check if service is running: `ps aux | grep webform-sync` (Linux/Mac) or Task Manager (Windows)
2. Verify port is correct in configuration
3. Check if port is already in use: `netstat -an | grep 8765`

### 403 Forbidden

**Problem:** `{"success":false,"error":"IP not in whitelist"}`

**Solutions:**
1. Add your IP to the whitelist in `webform-sync.yml`
2. For localhost access, ensure `127.0.0.1` is in whitelist
3. For network access, change host from `127.0.0.1` to `0.0.0.0`

### 404 Not Found

**Problem:** `{"success":false,"error":"Preset not found"}`

**Solutions:**
1. Verify the preset ID is correct
2. Check that device_id matches the preset owner
3. Ensure preset wasn't deleted

---

## Additional Resources

- [Main README](../README.md) - Overview and setup
- [Quick Start Guide](../QUICKSTART.md) - Get up and running quickly
- [Configuration Reference](../webform-sync.yml) - Full configuration options
- [Troubleshooting Guide](../README.md#troubleshooting) - Common issues and solutions

---

## Support

For issues, questions, or contributions:
- GitHub: https://github.com/tezza1971/webform-presets
- Issues: https://github.com/tezza1971/webform-presets/issues
