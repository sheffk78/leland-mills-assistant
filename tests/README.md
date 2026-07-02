# Test Suite — Leland Mills AI Assistant

## Running Tests

### Unit Tests (Vitest + Testing Library)
```bash
npm test                # Run all unit tests once
npm run test:watch      # Watch mode
npm run test:coverage    # With coverage report
```

**103 tests across 8 files:**
- `tests/unit/api/chat.test.ts` — Chat API (auth, validation, conversation creation, messaging, error handling)
- `tests/unit/api/conversations.test.ts` — Conversations API (list, create, fetch, delete, ownership)
- `tests/unit/api/admin-users.test.ts` — Admin Users API (CRUD, role validation, self-deletion protection)
- `tests/unit/components/LoginForm.test.tsx` — Login form (logo, mode switching, onboarding, submission)
- `tests/unit/components/ChatInterface.test.tsx` — Chat (empty state, prompts, messaging, errors)
- `tests/unit/components/Sidebar.test.tsx` — Sidebar (logo, conversations, search, mobile)
- `tests/unit/components/ChatMessage.test.tsx` — Message rendering (user/assistant/system, markdown, XSS)
- `tests/unit/branding/branding.test.ts` — Branding (correct logo file, real images, colors, no black bg)

### E2E Tests (Playwright)
```bash
npm run test:e2e:prod   # Against live Railway deployment
npm run test:e2e:local  # Against localhost:3000
```

**29 tests across 3 files:**
- `tests/e2e/login.spec.ts` — Login page branding, mode switching, auth flow, redirects
- `tests/e2e/chat.spec.ts` — Chat empty state, messaging, sidebar, logo presence
- `tests/e2e/admin.spec.ts` — Admin access, user management, settings, mobile responsive

### Run Everything
```bash
npm run test:all        # Unit tests then E2E
```

## Test Coverage

| Area | Tests | What's Covered |
|------|-------|----------------|
| **Auth** | 12 | Unauthenticated, wrong role, valid admin, session cookie |
| **Chat API** | 11 | Auth, validation, conversation creation, message storage, agent failure |
| **Conversations API** | 11 | List, create, fetch, delete, ownership enforcement |
| **Admin Users API** | 19 | CRUD, role validation, duplicate email, self-deletion, self-demotion |
| **LoginForm** | 13 | Logo, hero image, mode switching, onboarding, submission, branding |
| **ChatInterface** | 9 | Empty state, starter prompts, messaging, typing indicator, errors |
| **Sidebar** | 13 | Logo, conversations, search, active highlight, mobile close |
| **ChatMessage** | 15 | User/assistant/system, markdown, lists, code, XSS escaping, timestamps |
| **Branding** | 12 | Correct logo file, real product images, CSS colors, no black bg |
| **E2E Login** | 10 | Page rendering, auth flow, invalid creds, redirect protection |
| **E2E Chat** | 9 | Empty state, messaging, sidebar, logo, prompts |
| **E2E Admin** | 10 | Access, user management, settings, mobile responsive |

**Total: 132 tests** (103 unit + 29 E2E)