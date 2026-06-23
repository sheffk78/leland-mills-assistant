# Leland Mills Mock Agent

A standalone Express server that mocks the real Hermes agent API for the Leland Mills feed mill assistant. This allows the full application to be developed and tested without needing the actual Hermes agent running.

## What It Does

Simulates an AI assistant ("Jake") that answers questions about feed mill operations, including:

- Truck and fleet DOT pre-trip inspection requirements
- Delivery documentation (BOLs, delivery confirmation, unloading procedures)
- Feed inventory management (bin levels, reorder points, FIFO rotation)
- Equipment preventative maintenance schedules
- DOT Hours of Service (HOS) regulations for drivers
- OSHA safety protocols, PPE, and lockout/tagout procedures

The assistant uses a keyword-matching system to detect the topic from the user's message and returns a realistic, detailed response.

## Getting Started

```bash
# Install dependencies
npm install

# Start the server (production)
npm start

# Start with auto-reload on file changes (development)
npm run dev
```

The server runs on **http://localhost:3001** by default.

## API Endpoints

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T14:30:00.000Z"
}
```

### `POST /api/chat`

Send a message to the assistant and receive a response.

**Request body:**
```json
{
  "message": "What are the DOT pre-trip inspection requirements?",
  "conversationId": "optional-uuid-here"
}
```

**Response:**
```json
{
  "response": "Here's a rundown of DOT truck inspection requirements...",
  "conversationId": "abc123-uuid",
  "createdAt": "2026-01-15T14:30:00.000Z"
}
```

If `conversationId` is omitted, a new UUID is generated and returned.

### `GET /api/conversations/:id`

Retrieve mock conversation history for a given conversation ID.

**Response:**
```json
{
  "id": "conversation-uuid",
  "messages": [
    {
      "role": "user",
      "content": "What are the DOT pre-trip inspection requirements?",
      "createdAt": "2026-01-15T14:20:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Here's a summary...",
      "createdAt": "2026-01-15T14:20:05.000Z"
    }
  ]
}
```

## Environment Variable

The main Leland Mills application connects to this mock agent using `HERMES_API_URL`, which defaults to `http://localhost:3001`.

## Tech Stack

- **Express** — HTTP server framework
- **CORS** — Cross-origin resource sharing (all origins enabled)
- **UUID** — Conversation ID generation
- **ESM** — Native ES module imports