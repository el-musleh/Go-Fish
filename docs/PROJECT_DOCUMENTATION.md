# Go Fish - Project Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend API](#backend-api)
5. [Frontend Application](#frontend-application)
6. [Services](#services)
7. [AI Decision Agent](#ai-decision-agent)
8. [External Integrations](#external-integrations)
9. [Development Setup](#development-setup)
10. [Deployment](#deployment)

---

## Project Overview

**Go Fish** is an AI-assisted group activity planning application designed for people who want to make decisions quickly. The application streamlines the process of planning shared activities by eliminating the common pain points of group coordination:

- Too many chat messages
- Unclear availability
- No structured way to compare preferences
- No obvious final decision owner

### Core Features

1. **Event Creation** - Create events with title, description, city, and response window
2. **Invitation System** - Share a single invite link with the group
3. **Availability Collection** - Structured availability collection from invitees
4. **Taste Benchmarking** - Preference benchmarking to improve recommendation quality
5. **AI-Assisted Suggestions** - AI-ranked activity options for the organizer
6. **Finalization & Notifications** - Email confirmation to all participants when an activity is selected

### Technology Stack

| Layer          | Technology                            |
| -------------- | ------------------------------------- |
| Frontend       | React, Vite, TypeScript, React Router |
| Backend        | Express, TypeScript                   |
| Database       | PostgreSQL                            |
| Authentication | Supabase Auth                         |
| AI             | OpenRouter (LangChain)                |
| Email          | Resend                                |
| Infrastructure | Docker, GitHub Actions, Railway       |

---

## Architecture

### Project Structure

```
go-fish/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── api/           # API client utilities
│   │   ├── components/    # Reusable React components
│   │   ├── lib/           # Utilities (theme, auth, supabase)
│   │   ├── pages/         # Page components
│   │   └── styles/        # CSS styles
│   └── public/            # Static assets
├── src/                   # Express backend
│   ├── db/                # Database connection and migrations
│   ├── middleware/        # Express middleware (auth)
│   ├── models/            # TypeScript type definitions
│   ├── repositories/      # Data access layer
│   ├── routes/            # API route handlers
│   └── services/          # Business logic services
├── docs/                  # Documentation
└── .github/               # CI/CD workflows
```

### System Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Backend   │────▶│  Database   │
│  (React)    │◀────│  (Express)  │◀────│ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  AI Agent   │
                    │ (LangChain) │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Resend    │
                    │   (Email)   │
                    └─────────────┘
```

---

## Database Schema

### Tables

#### 1. User Table (`user`)

Stores user information and authentication data.

```sql
CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    auth_provider auth_provider NOT NULL,
    has_taste_benchmark BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Column              | Type          | Description                                |
| ------------------- | ------------- | ------------------------------------------ |
| id                  | UUID          | Primary key                                |
| email               | VARCHAR(255)  | User's email (unique)                      |
| name                | VARCHAR(255)  | User's display name                        |
| auth_provider       | auth_provider | Authentication method (google/email)       |
| has_taste_benchmark | BOOLEAN       | Whether user has completed taste benchmark |
| created_at          | TIMESTAMPTZ   | Creation timestamp                         |

#### 2. Taste Benchmark Table (`taste_benchmark`)

Stores user preferences for activity recommendations.

```sql
CREATE TABLE IF NOT EXISTS taste_benchmark (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 3. Event Table (`event`)

Core table storing event information.

```sql
CREATE TABLE IF NOT EXISTS event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    response_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_window_end TIMESTAMPTZ NOT NULL,
    status event_status NOT NULL DEFAULT 'collecting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Event Status Values:**

- `collecting` - Collecting responses from invitees
- `generating` - AI is generating activity options
- `options_ready` - Options are available for selection
- `finalized` - An activity has been selected

#### 4. Invitation Link Table (`invitation_link`)

Stores unique invitation tokens for events.

```sql
CREATE TABLE IF NOT EXISTS invitation_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 5. Response Table (`response`)

Stores invitee availability responses.

```sql
CREATE TABLE IF NOT EXISTS response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    available_dates JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 6. Activity Option Table (`activity_option`)

Stores AI-generated activity options for events.

```sql
CREATE TABLE IF NOT EXISTS activity_option (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_date DATE NOT NULL,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 7. Email Log Table (`email_log`)

Tracks email delivery status.

```sql
CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status email_status NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count <= 3),
    last_attempt TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 8. Notification Type Enum (`notification_type`)

Defines the types of notifications that can be created.

```sql
CREATE TYPE notification_type AS ENUM (
    'rsvp_received',
    'event_finalized',
    'event_invited',
    'options_ready'
);
```

#### 9. User Preferences Table (`user_preferences`)

Stores user notification and display preferences.

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    email_on_event_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    email_on_new_rsvp BOOLEAN NOT NULL DEFAULT FALSE,
    email_on_options_ready BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 10. Notification Table (`notification`)

Stores user notifications with real-time delivery via SSE.

```sql
CREATE TABLE IF NOT EXISTS notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    link VARCHAR(500),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    expired BOOLEAN NOT NULL DEFAULT FALSE,
    event_id UUID REFERENCES event(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Notification Types:**

| Type             | Trigger                                    | Email?          |
| ---------------- | ------------------------------------------ | --------------- |
| `rsvp_received`  | User submits RSVP to event                 | User preference |
| `event_finalized` | Organizer finalizes event                 | Always          |
| `event_invited`  | User visits invite link                    | No              |
| `options_ready`  | Response window closes                     | User preference |

### Database Migrations

The project uses SQL migrations located in `src/db/migrations/`:

| Migration                              | Description                |
| -------------------------------------- | -------------------------- |
| 001_initial_schema.sql                 | Creates all initial tables |
| 002_add_suggested_time.sql             | Adds time suggestions      |
| 003_add_event_location.sql             | Adds location fields       |
| 004_add_activity_option_enrichment.sql | Adds enrichment data       |
| 005_add_event_scheduling.sql           | Adds scheduling fields     |
| 006_add_event_suggestions.sql          | Adds AI suggestions        |
| 007_add_event_archive.sql              | Adds archive functionality |
| 008_add_notifications.sql              | Adds notifications system  |

---

## Backend API

### Entry Point

The backend entry point is [`src/index.ts`](src/index.ts), which initializes the Express server and sets up all routes.

### API Routes

#### 1. Auth Router (`/api/auth`)

Handles authentication and user management.

| Method | Endpoint                 | Description                 |
| ------ | ------------------------ | --------------------------- |
| GET    | `/api/auth/me`           | Get current user profile    |
| PATCH  | `/api/auth/me`           | Update user profile         |
| GET    | `/api/auth/storage-info` | Get user storage statistics |
| POST   | `/api/auth/email`        | Email-based authentication  |
| POST   | `/api/auth/google`       | Google OAuth (stub)         |

#### 2. Event Router (`/api/events`)

Handles event CRUD operations and activity generation.

| Method | Endpoint                           | Description                                    |
| ------ | ---------------------------------- | ---------------------------------------------- |
| POST   | `/api/events`                      | Create a new event                             |
| GET    | `/api/events`                      | Get user's dashboard (created + joined events) |
| GET    | `/api/events/:eventId`             | Get event details                              |
| GET    | `/api/events/:eventId/suggestions` | Get AI-generated suggestions                   |
| POST   | `/api/events/:eventId/end-window`  | Close response window early                    |
| POST   | `/api/events/:eventId/link`        | Generate invitation link                       |
| POST   | `/api/events/:eventId/generate`    | Trigger activity option generation             |
| GET    | `/api/events/:eventId/options`     | Get activity options                           |
| POST   | `/api/events/:eventId/select`      | Select an activity option                      |
| DELETE | `/api/events/:eventId`             | Delete an event                                |
| GET    | `/api/events/:eventId/respondents` | Get list of respondents                        |

#### 3. Invite Router (`/api/invite`)

Handles invitation link resolution.

| Method | Endpoint             | Description                       |
| ------ | -------------------- | --------------------------------- |
| GET    | `/api/invite/:token` | Resolve invitation token to event |

#### 4. Response Router (`/api/responses`)

Handles event responses.

| Method | Endpoint                  | Description                  |
| ------ | ------------------------- | ---------------------------- |
| POST   | `/api/responses`          | Submit availability response |
| GET    | `/api/responses/:eventId` | Get responses for an event   |

#### 5. Taste Benchmark Router (`/api/benchmark`)

Handles taste benchmark submissions.

| Method | Endpoint         | Description            |
| ------ | ---------------- | ---------------------- |
| GET    | `/api/benchmark` | Get user's benchmark   |
| POST   | `/api/benchmark` | Submit taste benchmark |

#### 6. Notification Router (`/api/notifications`)

Handles notifications with real-time SSE delivery and user preferences.

| Method | Endpoint                        | Description                          |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/api/notifications/stream`     | SSE stream for real-time updates     |
| GET    | `/api/notifications`             | Get paginated notification history   |
| GET    | `/api/notifications/recent`     | Get recent notifications (for bell)  |
| GET    | `/api/notifications/unread-count` | Get unread notification count      |
| PATCH  | `/api/notifications/:id/read`   | Mark single notification as read     |
| POST   | `/api/notifications/mark-all-read` | Mark all notifications as read     |
| DELETE | `/api/notifications/:id`        | Delete a notification                |
| GET    | `/api/notifications/preferences` | Get email notification preferences   |
| PATCH  | `/api/notifications/preferences` | Update email notification preferences |

**SSE Authentication**: Uses cookie-based session with Supabase (not query param tokens).

### Middleware

#### Authentication Middleware (`src/middleware/auth.ts`)

The [`createRequireAuth()`](src/middleware/auth.ts:1) function creates middleware that:

1. Extracts the JWT token from the Authorization header
2. Verifies the token with Supabase
3. Attaches the user ID to the request object

#### Taste Benchmark Gate (`src/middleware/tasteBenchmarkGate.ts`)

Ensures users complete their taste benchmark before accessing certain features.

---

## Frontend Application

### Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **React Router** - Client-side routing
- **Supabase** - Authentication
- **Zod** - Form validation
- **React Hook Form** - Form management
- **Tailwind CSS** - Styling

### Pages

| Page                | Route                           | Description                      |
| ------------------- | ------------------------------- | -------------------------------- |
| LandingPage         | `/`                             | Public landing page              |
| Dashboard           | `/dashboard`                    | User's events (created + joined) |
| Settings            | `/settings`                     | User settings with notifications tab |
| EventCreationForm   | `/events/new`                   | Create new event                 |
| EventDetail         | `/events/:eventId`              | View event details               |
| InvitationResolver  | `/invite/:linkToken`            | Resolve invitation link          |
| EventResponseForm   | `/events/:eventId/respond`      | Submit availability              |
| ActivityOptionsView | `/events/:eventId/options`      | View AI-generated options        |
| EventConfirmation   | `/events/:eventId/confirmation` | Finalized event confirmation     |
| PrivacyPolicy       | `/privacy`                      | Privacy policy page              |
| TermsOfService      | `/terms`                        | Terms of service page            |

### Settings Page - Notifications Tab

The Settings page includes a Notifications tab (`/settings?tab=notifications`) with:

**Notification History:**
- Paginated list of notifications (10 per page)
- Shows notification type, title, description, and timestamp
- Unread notifications highlighted
- Click to navigate to related event
- Delete with confirmation dialog
- Expired notifications show "[Event no longer exists]"

**Email Preferences:**
- Toggle for "Event is confirmed" notifications
- Toggle for "New participant RSVPs" notifications
- Toggle for "Activity options are ready" notifications
- Preferences stored in `user_preferences` table

### Components

Key reusable components in [`client/src/components/`](client/src/components/):

- **AuthDialog** - Authentication modal
- **ConfirmationDialog** - Confirmation modal
- **EmptyState** - Empty state display
- **LoadingSpinner** - Loading indicator
- **OptionGenerationState** - AI generation progress
- **SkeletonLoader** - Skeleton loading
- **Toaster** - Toast notifications
- **ValidatedInput** - Form input with validation
- **ShareEvent** - Share event invite with social icons
- **Notifications** - Bell icon with notification dropdown
- **Onboarding** - Welcome modal for new users

### Dashboard Timeline

The Dashboard page includes a Timeline view with state-specific detail cards.

#### Event Status States

| Status | Label | Description |
|--------|-------|-------------|
| `collecting` | Collecting | Response window is open, collecting RSVPs |
| `generating` | Generating | AI is creating activity options |
| `options_ready` | Ready | Activity options are available for selection |
| `finalized` | Confirmed | An activity has been selected |

#### State-Specific Detail Components

Each event status displays a tailored detail card in the timeline:

1. **TimelineDetailCollecting** - For events in `collecting` status
   - Countdown timer showing remaining response window
   - Share invite button (for organizers)
   - Respondents list with date availability chips
   - "End window & generate" button for organizers
   - Waiting message for participants

2. **TimelineDetailReady** - For events in `options_ready` status
   - "Options ready" celebration message
   - "Pick Activity" CTA button (for organizers)
   - Waiting message (for participants)

3. **TimelineDetailConfirmed** - For events in `finalized` status
   - Selected activity info with icon
   - Full date/time details
   - Description
   - "View Confirmation" button
   - "Add to Calendar" dropdown (Google, Outlook, Apple, .ics)
   - "Map & Navigation" button

4. **TimelineDetailGenerating** - For events in `generating` status
   - Loading spinner animation
   - Context-aware message for organizer vs participant

#### Mobile Accordion

On mobile devices (< 720px), the timeline uses an accordion pattern:
- Tapping a timeline card expands it inline to show the state-specific detail
- Tapping another card collapses the previous and expands the new one
- Tapping the same card collapses it
- Chevron icons indicate expand/collapse state

#### CSS Classes

Timeline-related CSS classes in [`client/src/styles/layout.css`](client/src/styles/layout.css):

- `.gf-timeline-layout` - Main timeline grid layout
- `.gf-timeline-list` - Left panel with event list
- `.gf-timeline-card` - Individual event card
- `.gf-timeline-card--selected` - Selected event card (desktop)
- `.gf-timeline-card-wrapper` - Wrapper for accordion support
- `.gf-timeline-card-wrapper--expanded` - Expanded accordion card
- `.gf-timeline-detail-card` - State-specific detail card
- `.gf-timeline-filters` - Status filter chips
- `.gf-timeline-group__date` - Date group headers

### API Client

The API client is defined in [`client/src/api/client.ts`](client/src/api/client.ts) and provides:

- Request/response interceptors
- Authentication handling
- Error handling

---

## Services

### Email Service (`src/services/emailService.ts`)

Handles transactional email delivery using Resend.

**Key Functions:**

- [`sendNotificationEmails()`](src/services/emailService.ts:118) - Sends finalized event notifications
- [`sendWithRetry()`](src/services/emailService.ts:161) - Retry mechanism for failed emails
- [`buildEmailBody()`](src/services/emailService.ts:93) - HTML email template
- [`buildEmailText()`](src/services/emailService.ts:106) - Plain text email template

**Features:**

- Retry logic (up to 3 attempts)
- Email logging for tracking
- Rate limit handling

### Response Window Scheduler (`src/services/responseWindowScheduler.ts`)

Manages automatic triggering of AI generation when response windows close.

**Key Functions:**

- [`scheduleResponseWindow()`](src/services/responseWindowScheduler.ts:1) - Schedules generation trigger
- [`triggerGeneration()`](src/services/responseWindowScheduler.ts:1) - Triggers AI generation

### Event Preview Service (`src/services/eventPreviewService.ts`)

Generates AI-powered event suggestions.

### Real World Data Service (`src/services/realWorldData/`)

Enriches activity options with real-world data:

- **Google Places** - Venue information
- **Foursquare** - Venue details
- **Ticketmaster** - Event information
- **OpenWeatherMap** - Weather forecasts

### Notification Service (`src/services/notificationService.ts`)

Manages notifications with real-time SSE delivery and factory functions for creating notifications.

**Key Functions:**

- [`notifyRsvpReceived()`](src/services/notificationService.ts) - Creates notification when user submits RSVP
- [`notifyEventFinalized()`](src/services/notificationService.ts) - Creates notification for all participants when event is finalized
- [`notifyEventInvited()`](src/services/notificationService.ts) - Creates notification when user visits invite link
- [`notifyOptionsReady()`](src/services/notificationService.ts) - Creates notification when response window closes
- [`broadcastNotification()`](src/services/notificationService.ts) - Pushes notification via SSE

**SSE Integration:**

The service maintains a map of active SSE connections per user and broadcasts notifications in real-time. Requires `X-Accel-Buffering: no` header to disable nginx buffering.

**Notification Expiration:**

When an event is deleted or finalized:
- `event_finalized`: Related notifications are marked as expired
- Event deleted: `event_id = NULL`, `expired = true`
- Users can still view notification history with "[Event no longer exists]" message

---

## AI Decision Agent

### Overview

The AI Decision Agent uses LangChain and OpenRouter to generate personalized activity recommendations. It analyzes:

- Group availability overlap
- User taste preferences
- Real-world data (venues, events, weather)

### Architecture

The agent is implemented in [`src/services/decisionAgent/`](src/services/decisionAgent/):

| File         | Purpose                             |
| ------------ | ----------------------------------- |
| `runner.ts`  | Main agent execution logic          |
| `model.ts`   | OpenRouter model configuration      |
| `prompt.ts`  | Prompt templates                    |
| `tools.ts`   | Agent tools (search, date analysis) |
| `schemas.ts` | Output validation schemas           |

### Agent Flow

1. **Collect Data** - Gather availability, preferences, and real-world data
2. **Analyze Overlap** - Find common time slots among participants
3. **Search Options** - Query external APIs for relevant activities
4. **Rank Options** - Use AI to rank and select best options
5. **Finalize** - Return top 3 ranked options with details

### Tools

The agent has access to several tools:

- **search_venues** - Search for venues using Google Places/Foursquare
- **search_events** - Search for events using Ticketmaster
- **check_weather** - Get weather forecasts
- **analyze_availability** - Analyze group availability overlap

---

## External Integrations

### Supabase Auth

- **Purpose**: User authentication
- **Configuration**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### OpenRouter

- **Purpose**: AI model access (DeepSeek, etc.)
- **Configuration**: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`

### Resend

- **Purpose**: Transactional email delivery
- **Configuration**: `RESEND_API_KEY`, `RESEND_FROM`

### Optional Enrichment APIs

| Service        | Purpose       | Environment Variable     |
| -------------- | ------------- | ------------------------ |
| Google Places  | Venue search  | `GOOGLE_PLACES_API_KEY`  |
| Ticketmaster   | Event search  | `TICKETMASTER_API_KEY`   |
| OpenWeatherMap | Weather data  | `OPENWEATHERMAP_API_KEY` |
| Foursquare     | Venue details | `FOURSQUARE_API_KEY`     |

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- Docker (with Compose plugin)
- curl

### Quick Start

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Start all services:

```bash
./start.sh
```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - PostgreSQL: localhost:5433

### Running Services Individually

**Backend:**

```bash
npm install
npm run dev
```

**Frontend:**

```bash
cd client
npm install --legacy-peer-deps
npm run dev
```

### Environment Variables

| Variable                    | Required | Description                  |
| --------------------------- | -------- | ---------------------------- |
| `DATABASE_URL`              | Yes      | PostgreSQL connection string |
| `OPENROUTER_API_KEY`        | Yes      | AI provider key              |
| `OPENROUTER_MODEL`          | No       | AI model override            |
| `RESEND_API_KEY`            | Yes      | Email provider key           |
| `RESEND_FROM`               | Yes      | Verified sender identity     |
| `SUPABASE_URL`              | Yes      | Supabase project URL         |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key    |

### Testing

Run tests:

```bash
npm run test
```

---

## Deployment

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

1. **Pull Requests** - Run CI workflow
2. **Main Branch** - Deploy to Railway

### Railway Deployment

The application is deployed to Railway with:

- Backend service (port 3000)
- Client service (port 5173)
- PostgreSQL database

### Docker

The application can also be run using Docker Compose:

```bash
docker-compose up
```

This starts:

- `backend` - Express API server
- `client` - React frontend
- `db` - PostgreSQL database

---

## Version History

| Version | Date    | Changes               |
| ------- | ------- | --------------------- |
| 1.6.0   | Current | Latest stable release |

---

## License

Copyright © {year} Go Fish. All rights reserved.
