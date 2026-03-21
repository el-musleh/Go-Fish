# Implementation Plan: Go Fish

## Overview

Incremental implementation of the Go Fish web application: Docker infrastructure first, then database models, backend API layer (auth → events → responses → AI generation → selection → email), and finally the React frontend. Each step builds on the previous, with property and unit tests woven in close to the code they validate.

## Tasks

- [x] 1. Set up Docker infrastructure and project scaffolding
  - [x] 1.1 Create Docker Compose configuration with Node.js backend and PostgreSQL containers on a shared network
    - Create `docker-compose.yml` with `backend` and `db` services
    - Create `Dockerfile` for the Node.js backend
    - Configure Docker network so backend connects to database
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 1.2 Initialize Node.js/Express backend project with TypeScript and Vitest
    - Initialize `package.json` with Express, TypeScript, Vitest, fast-check dependencies
    - Create `tsconfig.json` and `vitest.config.ts`
    - Create Express app entry point (`src/index.ts`) with health check route
    - _Requirements: 9.1_
  - [x] 1.3 Implement database connection module with retry logic
    - Create `src/db/connection.ts` using a PostgreSQL client (e.g., `pg` or Knex)
    - Implement retry logic: up to 5 retries with 3-second intervals
    - Log descriptive error on container start failure
    - _Requirements: 9.4, 9.5_
  - [ ]* 1.4 Write property test for database connection retry (Property 16)
    - **Property 16: Database connection retry does not exceed five**
    - Mock the database client to simulate failures, verify retry count ≤ 5 with 3-second intervals, and verify error logging after exhaustion
    - **Validates: Requirements 9.5**

- [x] 2. Implement database schema and data models
  - [x] 2.1 Create database migration for all tables
    - Create migration file(s) defining USER, TASTE_BENCHMARK, EVENT, INVITATION_LINK, RESPONSE, ACTIVITY_OPTION, and EMAIL_LOG tables
    - Add unique constraint on RESPONSE(event_id, invitee_id)
    - Add unique index on INVITATION_LINK(token)
    - Define EVENT status enum: `collecting`, `generating`, `options_ready`, `finalized`
    - _Requirements: 3.1, 4.4, 5.5_
  - [x] 2.2 Create TypeScript data model interfaces and repository modules
    - Define interfaces for User, TasteBenchmark, Event, InvitationLink, Response, ActivityOption, EmailLog in `src/models/`
    - Create repository modules (`src/repositories/`) with CRUD functions for each entity
    - _Requirements: 3.1, 5.2, 6.3_

- [x] 3. Implement authentication module
  - [x] 3.1 Implement Google OAuth 2.0 flow
    - Create `src/routes/authRouter.ts` with `POST /api/auth/google` endpoint
    - Implement OAuth callback handling, user creation/lookup, and session creation
    - Return descriptive error messages on authentication failure
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 3.2 Implement email-based authentication flow
    - Add `POST /api/auth/email` endpoint to `authRouter`
    - Implement email verification flow and session creation
    - Return descriptive error messages on failure
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 3.3 Implement session management and role-based redirect logic
    - Add `GET /api/auth/session` endpoint
    - Implement middleware to check authentication on protected routes
    - Return redirect destination based on user context (direct login → dashboard, invitation link → event response form)
    - _Requirements: 1.5_
  - [ ]* 3.4 Write property tests for authentication (Properties 1, 2)
    - **Property 1: Failed authentication returns a non-empty error message**
    - Generate random invalid credential inputs; verify response always contains a non-empty error string
    - **Property 2: Authenticated user redirect is role-based**
    - Generate random authenticated users with/without invitation context; verify redirect destination matches expected role
    - **Validates: Requirements 1.4, 1.5**

- [x] 4. Checkpoint - Ensure infrastructure and auth tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Taste Benchmark module
  - [x] 5.1 Implement Taste Benchmark endpoints
    - Create `src/routes/tasteBenchmarkRouter.ts`
    - Add `POST /api/taste-benchmark` — validate all 10 questions answered, store in DB, set `has_taste_benchmark` flag
    - Add `GET /api/taste-benchmark` — return current user's benchmark
    - Return 400 with `missingQuestions` array if submission is incomplete
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 5.2 Implement Taste Benchmark gating middleware
    - Create middleware that checks `has_taste_benchmark` before allowing access to event response forms
    - Redirect to benchmark form if not completed; skip if already completed
    - _Requirements: 2.2, 2.4_
  - [ ]* 5.3 Write property tests for Taste Benchmark (Properties 3, 4, 5)
    - **Property 3: Taste Benchmark gates Event response access**
    - Generate random Invitees with/without benchmarks; verify access is granted/denied correctly
    - **Property 4: Taste Benchmark round trip**
    - Generate random valid 10-question submissions; verify store-then-retrieve produces equivalent answers
    - **Property 5: Incomplete Taste Benchmark is rejected with specific errors**
    - Generate random submissions missing at least one question; verify rejection with correct missing question IDs
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 6. Implement Event creation and Invitation Link modules
  - [x] 6.1 Implement Event creation endpoint
    - Create `src/routes/eventRouter.ts`
    - Add `POST /api/events` — validate title and description, create Event with status `collecting`, set `response_window_end` to start + 24 hours, associate with authenticated Inviter
    - Add `GET /api/events/:eventId` — return event details
    - Return 400 with missing field list on validation failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.2 Implement Invitation Link generation and resolution
    - Add `POST /api/events/:eventId/link` — generate a cryptographically random URL-safe token, store as InvitationLink
    - Add `GET /api/invite/:linkToken` — resolve token to Event, redirect unauthenticated users to auth first
    - Ensure token uniqueness via unique index
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 6.3 Write property tests for Event and Invitation Link (Properties 6, 7, 8)
    - **Property 6: Event creation persists with correct owner and window**
    - Generate random valid event inputs; verify persisted event matches input, correct Inviter, and 24-hour window
    - **Property 7: Invalid event creation is rejected with field errors**
    - Generate random event inputs with missing fields; verify rejection with correct field list
    - **Property 8: Invitation link uniqueness and resolution**
    - Generate multiple invitation links; verify all tokens are distinct and each resolves to exactly one Event
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.3, 4.4**

- [x] 7. Implement Invitee Response module
  - [x] 7.1 Implement response submission endpoint
    - Create `src/routes/responseRouter.ts`
    - Add `POST /api/events/:eventId/responses` — validate dates, check Response_Window is open, enforce one response per Invitee per Event, store response
    - Add `GET /api/events/:eventId/responses` — return responses (Inviter only)
    - Return 403 if window closed, 409 if duplicate response
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 7.2 Write property tests for Responses (Properties 9, 10, 11)
    - **Property 9: Response storage round trip**
    - Generate random valid responses during open windows; verify store-then-retrieve produces same data
    - **Property 10: Response acceptance depends on window state**
    - Generate random responses with timestamps inside/outside the window; verify acceptance/rejection
    - **Property 11: One response per Invitee per Event**
    - Generate duplicate response attempts; verify second is rejected and first remains unchanged
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 8. Checkpoint - Ensure all core backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Decision Agent (Gemini AI) module
  - [x] 9.1 Implement activity option generation
    - Create `src/services/decisionAgent.ts`
    - here is the api keyAIzaSyAoyrIMgGKwoa6ERJykqjJqwOQV95awSkI
    - Build Gemini API prompt from collected Taste_Benchmarks and available dates
    - Parse Gemini response into three ActivityOptions with title, description, suggested_date, and rank (1-3)
    - Implement exponential backoff retry (up to 3 attempts) on Gemini API failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 9.2 Implement Response Window scheduler
    - Create `src/services/responseWindowScheduler.ts`
    - Schedule activity generation trigger at Response_Window expiry
    - Handle early trigger when all Invitees have responded
    - Handle fewer-than-2-responses case: notify Inviter with extend/proceed options
    - _Requirements: 6.1, 6.2, 6.5_
  - [x] 9.3 Wire generation endpoints
    - Add `POST /api/events/:eventId/generate` — manually trigger generation (Inviter only)
    - Add `GET /api/events/:eventId/options` — return generated activity options
    - Transition Event status from `collecting` → `generating` → `options_ready`
    - _Requirements: 6.1, 6.2, 7.1_
  - [ ]* 9.4 Write property test for activity generation (Property 12)
    - **Property 12: Activity option generation produces valid structured output**
    - Mock Gemini API; generate random sets of responses and benchmarks; verify exactly 3 options with non-empty title/description, valid date, and distinct ranks {1,2,3}
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 10. Implement Activity Selection and Email Notification modules
  - [x] 10.1 Implement activity selection endpoint
    - Add `POST /api/events/:eventId/select` to `eventRouter`
    - Mark selected ActivityOption's `is_selected = true`, transition Event status to `finalized`
    - Enforce exactly one selection per Event; return 409 if already finalized
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 10.2 Implement email notification service
    - Create `src/services/emailService.ts`
    - On Event finalization, send email to all responding Invitees and the Inviter
    - Include activity title, description, and date in email body
    - Implement retry logic: up to 3 retries at 5-minute intervals, log to EMAIL_LOG
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 10.3 Write property tests for selection and email (Properties 13, 14, 15)
    - **Property 13: Exactly one Activity_Option is selected per finalized Event**
    - Generate random selection actions; verify exactly one option is marked selected and Event status is `finalized`
    - **Property 14: Finalization emails are sent to all respondents and Inviter with correct content**
    - Generate random finalized events; verify email sent to each respondent + Inviter with correct title/description/date
    - **Property 15: Email retry count does not exceed three**
    - Simulate email failures; verify retry count ≤ 3 and status becomes `failed` after exhaustion
    - **Validates: Requirements 7.2, 7.3, 8.1, 8.2, 8.3, 8.4**

- [x] 11. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement React frontend
  - [x] 12.1 Set up React project and routing
    - Initialize React app (e.g., Vite + React + TypeScript) in `client/` directory
    - Set up React Router with routes for login, benchmark, event creation, invitation, response, options, and confirmation pages
    - Create shared API client module for backend communication
    - _Requirements: 1.1, 1.5_
  - [x] 12.2 Implement AuthPage component
    - Render Google OAuth and email login buttons
    - Handle OAuth redirect flow and email verification flow
    - Display error messages on authentication failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 12.3 Implement TasteBenchmarkForm component
    - Render 10-question checkbox form
    - Validate all questions answered before submission
    - Display validation errors for unanswered questions
    - Redirect to event response form on successful submission
    - _Requirements: 2.1, 2.2, 2.5_
  - [x] 12.4 Implement EventCreationForm and InvitationLinkPanel components
    - EventCreationForm: title and description inputs with validation
    - InvitationLinkPanel: display generated link with copy-to-clipboard button
    - _Requirements: 3.1, 3.4, 4.1, 4.2_
  - [x] 12.5 Implement EventResponseForm component
    - Date selection interface for Invitees
    - Display "response period ended" message if window is closed
    - _Requirements: 5.1, 5.3, 5.4_
  - [x] 12.6 Implement ActivityOptionsView and EventConfirmation components
    - ActivityOptionsView: display three ranked options, allow Inviter to select one
    - EventConfirmation: display selected activity details
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 13. Integration wiring and final verification
  - [x] 13.1 Wire frontend to backend API and verify end-to-end flows
    - Connect all frontend components to backend endpoints
    - Verify invitation link flow: open link → auth → benchmark (if needed) → response form
    - Verify event lifecycle: create → invite → respond → generate → select → email
    - Add Docker Compose configuration for frontend service
    - _Requirements: 1.5, 4.3_
  - [ ]* 13.2 Write integration tests for critical flows
    - Test invitation link redirect flow (unauthenticated → auth → benchmark gate → response form)
    - Test response window scheduler triggers generation at 24-hour expiry
    - Test Gemini API integration with mocked responses
    - Test email retry exhaustion flow
    - _Requirements: 2.2, 4.3, 6.2, 8.4_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code uses TypeScript with Vitest + fast-check for testing
