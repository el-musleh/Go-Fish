# Design Guidelines

A portable, skill-friendly reference for design decisions. Use this document when making architectural choices, designing APIs, or building user interfaces.

---

## Table of Contents

1. [Principles](#principles)
2. [Architecture](#architecture)
3. [API Design](#api-design)
4. [Database](#database)
5. [Frontend](#frontend)
6. [Security](#security)
7. [Testing](#testing)

---

## Principles

### Core Philosophy

- **Simplicity first** - Prefer simple solutions over clever ones (YAGNI)
- **Fail fast, recover gracefully** - Detect errors early, handle them clearly
- **Convention over configuration** - Follow established patterns unless there's a good reason not to
- **Write self-documenting code** - Clear naming > comments > code

### Decision Framework

When facing a design choice:

1. **What's the simplest thing that works?** → Start there
2. **What could go wrong?** → Plan for failures
3. **Will this scale?** → Design for growth, not premature optimization
4. **Is this reversible?** → Prefer reversible decisions

---

## Architecture

### Layered vs Hexagonal

**Decision Tree:**

```
Does the project have clear separation between:
- External interfaces (API, UI, webhooks)
- Business logic
- Data access

If YES to all → Layered architecture is fine
If NO → Consider hexagonal (ports & adapters)
```

| Approach | When to Use |
|----------|-------------|
| **Layered** | Standard web apps, CRUD apps, clear separation of concerns |
| **Hexagonal** | Complex domain logic, multiple external interfaces, testability critical |

### Monolith vs Microservices

**Decision Tree:**

```
Is the team small (< 10 developers)?
→ YES → Use monolith, split later if needed

Is the team large (> 50 developers)?
→ Consider microservices by domain

Do different parts have different scaling needs?
→ YES → Extract to service with its own database

Is there strong domain boundaries?
→ YES → Microservices may help enforce boundaries

Otherwise → Start with monolith
```

| Approach | When to Use |
|----------|-------------|
| **Monolith** | Small teams, startups, proven domain |
| **Microservices** | Large teams, different scaling needs, distinct bounded contexts |

### Project Structure

**Decision Tree:**

```
Is this a full-stack application?
  → YES → Use monorepo with clear /client and /server separation

Is this a library or shared package?
  → YES → Single package, use workspaces if needed

Is this multiple services?
  → YES → One repo per service OR monorepo with /services
```

**Recommended structure:**
```
/src           # Source code
  /api         # API routes/endpoints
  /services    # Business logic
  /repositories # Data access
  /models      # Domain models
  /utils       # Shared utilities
/tests         # Test files (colocated)
/docs          # Documentation
/migrations    # Database migrations
```

---

## API Design

### REST vs GraphQL vs gRPC

**Decision Tree:**

```
Is this a public API with diverse clients?
  → YES → Consider GraphQL

Do you need real-time updates?
  → YES → WebSockets or GraphQL Subscriptions

Is performance critical (internal service communication)?
  → YES → Consider gRPC

Otherwise → REST is a solid default
```

| Approach | When to Use |
|----------|-------------|
| **REST** | Most web APIs, CRUD operations, standard conventions |
| **GraphQL** | Complex data requirements, mobile apps, multiple clients |
| **gRPC** | High-performance internal services, streaming |

### Resource Naming

**Conventions:**

| Concept | Naming | Example |
|---------|--------|---------|
| Collection | Plural noun | `/users` |
| Single resource | Plural + ID | `/users/123` |
| Action | RESTful verb | `POST /users/123/activate` |
| Sub-resource | Nested path | `/users/123/posts` |

**Decision Tree:**

```
Is this a noun (thing)?
  → YES → Use REST resource naming

Is this an action/verb?
  → Can you make it a resource? (e.g., /activation)
  → If not, use POST with action in body

Is this a search/filter?
  → Use query parameters: GET /users?status=active
```

### Pagination

**Decision Tree:**

```
How many items typically in the response?
  < 50 items → Return all (no pagination needed)
  50-1000 items → Use cursor-based pagination
  > 1000 items → Use offset-based pagination OR cursor-based

Is ordering important?
  → YES → Use cursor-based (more reliable for real-time data)
  → NO → Either works
```

| Method | Pros | Cons |
|--------|------|------|
| **Cursor** | Consistent, fast for large datasets | Can't jump to arbitrary page |
| **Offset** | Simple, can jump to page | Slow for large offsets |
| **Keyset** | Fast like cursor, simpler | Only works with single sort order |

### Error Responses

**Decision Tree:**

```
What type of error occurred?

Client error (4xx)
  → Return 4xx with error details in body

Validation error
  → Return 422 with field-specific errors

Not found
  → Return 404 with error message

Server error (5xx)
  → Return 500, log details server-side
  → Return generic message to client (don't leak internals)

Rate limited
  → Return 429 with Retry-After header
```

**Standard error format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [
      { "field": "email", "message": "Invalid format" }
    ]
  }
}
```

---

## Database

### Relational vs Document vs Other

**Decision Tree:**

```
Do you have structured data with relationships?
  → YES → Consider relational (PostgreSQL, MySQL)

Do you have flexible/evolving schemas?
  → YES → Consider document (MongoDB, CouchDB)

Do you need complex queries, ACID, or transactions?
  → YES → Use relational

Is this primarily key-value access?
  → YES → Consider Redis, DynamoDB

Is this for analytics/OLAP?
  → YES → Consider ClickHouse, BigQuery, Snowflake
```

| Type | When to Use |
|------|-------------|
| **Relational** | Structured data, complex queries, ACID compliance |
| **Document** | Flexible schemas, hierarchical data, rapid iteration |
| **Key-Value** | Caching, sessions, simple lookups |
| **Time-series** | Metrics, logs, IoT data |

### Indexing Strategy

**Decision Tree:**

```
Is the field queried frequently?
  → YES → Add index

Is this a foreign key?
  → YES → Always add index

Is this a composite query?
  → YES → Consider composite index

Is the table large (> 1M rows)?
  → YES → Index carefully, monitor query plans

Is the write-heavy table?
  → YES → Fewer indexes, only critical ones
```

**Index guidelines:**
- Index foreign keys always
- Index columns in WHERE, JOIN, ORDER BY
- Use composite indexes for multi-column queries
- Avoid over-indexing (slows writes)
- Use EXPLAIN to verify index usage

### Migration Strategy

**Decision Tree:**

```
Is this a schema change?
  → YES → Use migrations

Is this new data from external source?
  → Consider ETL or data migration script

Is this a breaking change?
  → Add migration with backward compatibility
  → OR use feature flags
  → OR deploy in stages
```

**Migration best practices:**
- Always use migrations (never manual changes)
- Make migrations reversible (down migrations)
- One migration = one change
- Test migrations on copy of production data
- Never commit secrets in migrations

### Soft Deletes

**Decision Tree:**

```
Is data regulatory/compliance sensitive?
  → YES → Use soft delete (keep audit trail)

Is data rarely deleted but needs cleanup?
  → YES → Use soft delete with archive job

Is it a high-volume operational table?
  → Consider hard delete, or soft delete with regular purge

Is this reference data (lookups)?
  → Hard delete is fine
```

---

## Frontend

### Component Organization

**Decision Tree:**

```
Is this a shared UI component?
  → YES → /components/common or /ui

Is this a page-specific component?
  → YES → /components/PageName

Is this a feature with multiple components?
  → YES → /features/FeatureName with sub-components

Does it have business logic?
  → YES → Consider /components + /hooks separation
```

| Folder | Purpose |
|--------|---------|
| `/components` | Reusable UI components |
| `/components/common` | Buttons, inputs, cards |
| `/components/layout` | Header, footer, sidebar |
| `/features` | Feature-specific code |
| `/hooks` | Custom React hooks |
| `/pages` or `/views` | Page components |
| `/context` | React context providers |

### Modal vs Page

**Decision Tree:**

```
Is the action quick (< 3 steps)?
  → YES → Modal is appropriate

Is the action complex or multi-step?
  → Consider page with steps

Does the user need to reference main content while using it?
  → YES → Modal or side panel

Is this a primary workflow?
  → Page is more appropriate

Does this change URL?
  → YES → Use page (deep linking important)
```

| Pattern | Use When |
|---------|----------|
| **Modal** | Quick actions, confirmations, forms < 3 fields |
| **Page** | Complex workflows, primary actions |
| **Side panel** | Details view, editing with context |
| **Drawer** | Settings, filters, secondary actions |

### Form Validation

**Decision Tree:**

```
When to validate?

Real-time (onChange)
  → Format validation (email, phone)
  → Password strength
  → Instant feedback

On blur
  → Required fields
  → When user leaves field

On submit
  → All validations
  → Duplicate check (username, email)
  → Server-side validation (always!)
```

**Validation strategy:**
- Validate on client for UX
- ALWAYS validate on server for security
- Show specific field errors
- Show general errors at top of form

### Loading States

**Decision Tree:**

```
How long will the operation take?

< 200ms
  → No loading state needed
  → Optimistic UI may work

200ms - 1s
  → Skeleton loader OR spinner
  → Don't block interaction

> 1s
  → Progress indicator (if measurable)
  → OR skeleton loader with message
  → Block interaction if unsafe

Unknown / Variable
  → Spinner with descriptive message
```

### State Management

**Decision Tree:**

```
Is this local component state?
  → YES → useState, useReducer

Is this shared but simple?
  → YES → React Context

Is this global app state?
  → YES → State library (Zustand, Redux, Jotai)

Is this server data?
  → YES → React Query, SWR, TanStack Query

Is this URL state?
  → YES → React Router state
```

| Solution | When to Use |
|----------|-------------|
| **useState** | Local component state |
| **useReducer** | Complex local state |
| **Context** | Shared simple state (theme, auth) |
| **React Query** | Server state, caching, sync |
| **Zustand/Redux** | Complex global state |

---

## Security

### Authentication

**Decision Tree:**

```
Do you need social login?
  → YES → Use Supabase Auth, Auth0, or Firebase

Do you need password reset?
  → YES → Implement or use managed service

Is this a SPA with API backend?
  → YES → JWT (access + refresh tokens) OR session

Is this a mobile app?
  → YES → OAuth 2.0 with PKCE
```

| Method | When to Use |
|--------|-------------|
| **Managed service** | Fastest, less security burden |
| **JWT** | SPA + API, microservices |
| **Session** | Traditional web apps |
| **OAuth 2.0 + PKCE** | Mobile apps, SPAs |

### Authorization

**Decision Tree:**

```
How complex are permissions?

Simple (admin vs user)
  → Role-based (RBAC)

Complex (resource-level)
  → Permission-based

Document-level or row-level
  → Consider policy-based (or database policies)

Does ownership matter?
  → YES → Add owner check
```

**Best practices:**
- Check permissions on server (never trust client)
- Deny by default
- Log authorization failures
- Use established libraries

### Input Validation

**Decision Tree:**

```
What type of input?

User-facing form
  → Client + Server validation

API request
  → Server validation only

External API response
  → Validate schema, sanitize before use
```

**Validation rules:**
- Validate on server always
- Use schema validation (Zod, Yup, Joi)
- Sanitize before database queries (prevent SQL injection)
- Sanitize before rendering (prevent XSS)

---

## Testing

### Test Strategy

**Decision Tree:**

```
What are you testing?

Business logic / algorithms
  → Unit tests

API endpoints
  → Integration tests

User workflows
  → E2E tests

UI components
  → Component tests
```

| Test Type | Coverage Target | Speed |
|-----------|-----------------|-------|
| **Unit** | 70-80% | Fast (< 1ms) |
| **Integration** | 20-30% | Medium (< 1s) |
| **E2E** | Critical paths | Slow |

### Test Naming

**Decision Tree:**

```
What's the test describing?

[Unit] function should [do something]
  → describe('functionName', () => { it('should do something', ...) })

[Integration] API endpoint should [respond]
  → describe('GET /users', () => { it('should return users', ...) })

[Component] should [render/behave]
  → describe('UserCard', () => { it('should render name', ...) })
```

### When to Mock

**Decision Tree:**

```
Is this a unit test?
  → YES → Mock external dependencies (DB, API, file system)

Is this an integration test?
  → Mock only external services (Stripe, SendGrid)
  → Use real database

Is this an E2E test?
  → No mocks (or very few)
  → Use test environment
```

---

## Quick Reference

### Common Patterns

| Pattern | Use When |
|---------|----------|
| **Repository** | Data access abstraction |
| **Service layer** | Business logic separation |
| **Middleware** | Cross-cutting concerns (auth, logging) |
| **DTO** | Data transfer between layers |
| **Factory** | Complex object creation |
| **Builder** | Complex configuration |

### Anti-Patterns to Avoid

- ❌ Premature optimization
- ❌ Over-abstraction ( innecesary interfaces)
- ❌ Tight coupling
- ❌ God objects / God classes
- ❌ Circular dependencies
- ❌ Silent error swallowing
- ❌ Magic numbers / strings
- ❌ Commented-out code
- ❌ Feature envy (class accessing too much of another's data)

---

## Contributing to This Guide

This is a living document. When you encounter a design decision that wasn't covered:

1. **Add it here** with the decision tree format
2. **Include the rationale** - why this choice was made
3. **Note tradeoffs** - what was sacrificed
4. **Add examples** - both good and bad

This ensures knowledge is shared, not lost.
