# Reusable Full-Stack Project Context

> A project-independent architecture guide for building new applications with a React + TypeScript frontend and a Python + FastAPI backend.
>
> Put this file in the root of a new repository as `PROJECT_CONTEXT.md`. Treat it as the default structure and coding guide for the project. Fill in product-specific requirements separately.

---

## 1. Purpose

Build every new project with a clear, maintainable separation between the user interface, HTTP/API layer, business logic, and data access.

Use two applications at the repository root:

- **`ui/`** — React + TypeScript. Pages, components, API client services, hooks, types, and shared UI utilities.
- **`backend/`** — Python + FastAPI. API routes, business services, repositories/data access, request/response schemas, and shared backend utilities.

The structure is designed to work for dashboards, SaaS products, internal tools, marketplaces, management systems, AI-powered products, and other full-stack applications. Domain features, authentication choices, database systems, and integrations depend on the particular project.

### Core principle

**Each layer should have one clear responsibility.**

```text
FRONTEND                                   BACKEND

Page / UI Component
        |
        v
UI Hook / Page State
        |
        v
Frontend Feature Service
        |
        v
Shared API Client  ------ HTTP ------> API Router
                                         |
                                         v
                                    Business Service
                                         |
                             +-----------+-----------+
                             |                       |
                             v                       v
                         Repository             External Client
                             |                       |
                             v                       v
                          Database              External API
```

Architecture rules:

1. A component renders UI and responds to user interactions; it does not own raw API configuration or database operations.
2. A frontend service knows how to call an endpoint; it does not render UI.
3. A backend API router defines endpoints, validates inputs, authorizes requests, and delegates work; it does not implement large business workflows.
4. A backend service implements business rules, calculations, validations, and workflows; it delegates persistence to repositories.
5. A repository/data-access layer owns database queries and persistence; it does not handle HTTP requests or React state.
6. Shared code is centralized in the appropriate application's utilities, configuration, and types.

---

## 2. Standard repository structure

Start with this layout. Add feature folders only when the project requires them.

```text
my-project/
|
|-- PROJECT_CONTEXT.md
|-- README.md
|-- .gitignore
|-- .editorconfig
|
|-- ui/                                  # Frontend application
|   |-- package.json
|   |-- tsconfig.json
|   |-- .env.example
|   |-- public/
|   |-- src/
|   |   |-- main.tsx                     # React entry point (or index.tsx)
|   |   |-- App.tsx                      # Root providers and application shell
|   |   |-- pages/
|   |   |   |-- Routes.tsx               # Route declarations
|   |   |   |-- Home/
|   |   |   |   `-- HomePage.tsx
|   |   |   `-- Items/                  # Example feature
|   |   |       |-- ItemsPage.tsx
|   |   |       |-- ItemsPage.scss
|   |   |       `-- ItemsPage.test.tsx
|   |   |-- components/
|   |   |   |-- common/                 # Buttons, dialogs, tables, etc.
|   |   |   `-- items/                  # Feature-specific UI pieces
|   |   |       |-- ItemList.tsx
|   |   |       `-- ItemForm.tsx
|   |   |-- services/
|   |   |   |-- ApiBase.ts              # Shared HTTP/Axios client
|   |   |   `-- ItemsService.ts         # Typed endpoint calls
|   |   |-- hooks/
|   |   |   `-- useItems.ts
|   |   |-- types/
|   |   |   `-- item.ts
|   |   |-- utils/
|   |   |-- constants/
|   |   |-- context/                    # Shared state, only when useful
|   |   |-- layouts/                    # Main/public layouts
|   |   |-- auth/                       # Authentication, if required
|   |   |-- assets/
|   |   `-- styles/                     # Shared theme/style definitions
|   `-- e2e/                            # Optional end-to-end tests
|
`-- backend/                             # Backend application
    |-- main.py                         # Application launch entry point
    |-- requirements.txt               # Or pyproject.toml
    |-- .env.example
    |-- Dockerfile                      # When container deployment is used
    |-- migrations/                     # When the app has a relational DB
    `-- source/
        |-- __init__.py
        |-- api/
        |   |-- __init__.py
        |   |-- AppAPI.py               # FastAPI app and router registration
        |   |-- HealthAPI.py            # Health/readiness endpoints
        |   `-- ItemsAPI.py             # Feature routes only
        |-- service/
        |   |-- __init__.py
        |   |-- ItemsService.py         # Business rules and orchestration
        |   `-- clients/                # Optional external API adapters
        |-- dal/                        # Data access layer
        |   |-- __init__.py
        |   |-- db_session.py           # Database connections and sessions
        |   |-- ItemsRepository.py      # Database operations
        |   `-- models/                 # ORM/database models
        |-- schemas/
        |   |-- __init__.py
        |   `-- item.py                  # Pydantic request/response models
        |-- utils/
        |   |-- __init__.py
        |   |-- config.py               # Environment-based settings
        |   |-- auth.py                 # Auth helpers, if required
        |   |-- errors.py               # Shared application exceptions
        |   `-- logging_utils.py
        `-- tests/
            |-- test_items_api.py
            |-- test_items_service.py
            `-- test_items_repository.py
```

### Structure notes

- Keep `ui/` and `backend/` independently installable, runnable, testable, and deployable.
- Keep `source/api/`, `source/service/`, and `source/dal/` as distinct backend layers.
- Put page-level UI under `src/pages/`; put reusable UI under `src/components/`.
- Put frontend HTTP operations under `src/services/` and reuse `ApiBase.ts`.
- A separate `schemas/` directory keeps request and response models reusable across routes, services, and tests.
- `clients/`, `auth/`, `context/`, `migrations/`, and `e2e/` are optional: create them when justified by real requirements.
- Prefer consistent names and imports over mechanically adding empty folders.

---

## 3. Frontend architecture (`ui/`)

### 3.1 Technology defaults

- React with TypeScript (`.tsx` for components, `.ts` for logic and types).
- React Router for navigation.
- Axios or an equivalent HTTP library behind a single shared client.
- Functional React components and hooks.
- A consistent UI component library and theme (for example MUI) if the product needs one.
- SCSS, CSS modules, or another consistent styling system.
- React Testing Library and a suitable test runner for component tests.
- Playwright or a similar browser testing tool for important end-to-end workflows.

The build tool can be Vite or another appropriate React toolchain. **The architectural separation matters more than the build tool.** Add GraphQL/Apollo only if the application's backend exposes GraphQL.

### 3.2 Folder responsibilities

| Folder | Responsibility |
|---|---|
| `src/pages/` | Route-level screens; coordinate the feature's UI and behavior |
| `src/components/` | Small reusable components and feature-specific visual elements |
| `src/services/` | Typed API calls and request/response mapping |
| `src/services/ApiBase.ts` | Shared HTTP client: base URL, headers, credentials, timeouts, error normalization |
| `src/hooks/` | Reusable stateful logic, data loading, forms, mutations, derived state |
| `src/types/` | TypeScript domain types, UI types, API request/response contracts |
| `src/utils/` | Pure formatting, mapping, date, and validation helpers |
| `src/constants/` | Shared constants, enumerations, and configuration values |
| `src/layouts/` | Page shell, navigation, headers, sidebars, public/authenticated layouts |
| `src/context/` | Cross-page or cross-feature state, only where required |
| `src/auth/` | Login/session integration and auth-related client behavior |
| `src/assets/` | Static media and icons |

### 3.3 Frontend development rules

1. Create a page in `src/pages/<Feature>/` for each route-level screen.
2. Split large screens into meaningful child components in `src/components/<feature>/`.
3. Add all feature HTTP calls to `src/services/<Feature>Service.ts`.
4. Make all HTTP operations use `src/services/ApiBase.ts`, not separate ad-hoc clients.
5. Use types from `src/types/`; define explicit request and response shapes.
6. Keep server data fetching/mutations in services, hooks, or page controllers—not reusable display components.
7. Keep visual-only components focused on props, rendering, and user interaction.
8. Show useful loading, empty, success, validation-error, and server-error states.
9. Use local component state for local concerns; introduce shared context/store only when multiple consumers need it.
10. Centralize colors, spacing, typography, and component tokens in the chosen design system.
11. Store API URLs in environment configuration; never hardcode production addresses throughout components.
12. Write tests for user-visible behavior and service error handling.

### 3.4 Frontend example: one feature

```text
ui/src/pages/Items/ItemsPage.tsx
ui/src/pages/Items/ItemsPage.scss
ui/src/components/items/ItemList.tsx
ui/src/components/items/ItemForm.tsx
ui/src/hooks/useItems.ts
ui/src/services/ItemsService.ts
ui/src/types/item.ts
```

Ownership:

- `ItemsPage.tsx`: page composition and user journey.
- `ItemList.tsx`: table/list UI and item actions through props.
- `ItemForm.tsx`: field presentation and form events.
- `useItems.ts`: loading, state, event coordination, and refetch/mutation logic.
- `ItemsService.ts`: API URLs, request payloads, and typed endpoint functions.
- `ApiBase.ts`: shared HTTP mechanics.
- `item.ts`: `Item`, `CreateItemRequest`, `UpdateItemRequest`, and related types.

For a small feature, a hook is optional. Do not introduce an abstraction that merely forwards one function without improving readability or reuse.

---

## 4. Backend architecture (`backend/`)

### 4.1 Technology defaults

- Python + FastAPI, started with Uvicorn.
- `APIRouter` for feature endpoints.
- Pydantic for request and response validation.
- Business functions/classes in `source/service/`.
- Repository classes/functions in `source/dal/` for persistence.
- SQLAlchemy and migrations when a relational database is used.
- Centralized environment-based configuration, logging, and exception handling.
- `pytest` with mocks and test clients for automated tests.

Choose databases and integrations based on actual application requirements. A project that does not need a database should not get unused database boilerplate.

### 4.2 Backend layer responsibilities

| Layer | Owns | Does not own |
|---|---|---|
| `main.py` | Application process startup | Individual feature logic |
| `source/api/AppAPI.py` | FastAPI app construction, middleware, router registration | Business calculations or SQL |
| `source/api/<Feature>API.py` | Routes, request parsing, dependencies, authorization, status codes | Long workflows or provider-specific internals |
| `source/schemas/` | Input/output DTOs and validation constraints | Database connection lifecycle |
| `source/service/<Feature>Service.py` | Business rules, validation, transformations, orchestration | Route decorators or JSX |
| `source/service/clients/` | Optional integration HTTP adapters | Application UI or unrelated workflows |
| `source/dal/<Feature>Repository.py` | Reads, writes, queries, persistence mapping | HTTP response formatting |
| `source/dal/db_session.py` | Engine/session setup and transaction lifecycle | User interface behavior |
| `source/dal/models/` | Persisted model definitions | User-facing message copy |
| `source/utils/` | Configuration, security helpers, logging, shared errors | Feature-specific logic that belongs in services |
| `source/tests/` | API, service, integration and repository verification | Production credentials or data |

### 4.3 API layer rules

1. Use one router per cohesive feature or domain: `ItemsAPI.py`, `UsersAPI.py`, `ReportsAPI.py`.
2. Register routers centrally in `AppAPI.py`.
3. Use Pydantic models for structured requests/responses; expose validation errors clearly.
4. Enforce authentication and authorization on protected endpoints—not only in the frontend.
5. Call the service layer for business behavior. Keep route handlers small and readable.
6. Map known exceptions to meaningful HTTP status codes and safe error messages.
7. Choose predictable, versioned API paths when the app will have external/long-lived clients.
8. Provide health and readiness endpoints, appropriate CORS settings, and request logging.
9. Use `async` only when the code path is non-blocking; avoid blocking calls inside async routes.
10. Keep API schemas stable, and coordinate deliberate breaking changes with frontend types.

### 4.4 Service layer rules

1. Implement domain rules, calculations, policies, multi-step operations, and workflow transitions here.
2. Receive validated inputs and trusted identity/context where applicable.
3. Use repositories for persistence; call external client adapters for third-party services.
4. Make operations testable by passing repositories/clients as dependencies instead of hiding all construction in global code.
5. Separate complex workflows into focused service methods. Avoid one giant service file.
6. Decide how duplicate requests, retries, and idempotency should work for operations that create side effects.
7. Return structured results or raise explicit application exceptions.
8. Use structured logs where useful, while keeping secrets and sensitive data out of logs.

### 4.5 Data-access layer rules

1. Put database reads and writes in `source/dal/`, never in API routes.
2. Keep connection and session lifecycle in `db_session.py` or a consistent equivalent.
3. Define transaction ownership: successful operations commit; errors roll back; sessions close reliably.
4. Keep ORM/database models separate from public API request/response schemas.
5. Add migrations for schema changes rather than editing production tables manually.
6. Implement pagination, sorting, filtering, uniqueness constraints, and indexes where the data workload needs them.
7. When the project has multiple users, organizations, or workspaces, scope queries to the caller's authorized data.
8. Prefer repository APIs that express domain operations (`get_item`, `list_items`, `save_item`) over leaking raw SQL throughout services.

### 4.6 External integrations

When a project calls another system, isolate provider-specific code in a dedicated client/adapter:

```text
backend/source/service/
|-- OrdersService.py                 # Application workflow
`-- clients/
    |-- PaymentClient.py            # External payment API adapter, if needed
    `-- NotificationClient.py       # External messaging API adapter, if needed
```

- A client owns external HTTP requests, provider credentials, provider-specific errors, and response mapping.
- The domain service decides *when* and *why* to invoke the client.
- Keep callbacks/webhooks in API routers and verify their signatures or equivalent trust mechanism.
- Set timeouts; consider retries with backoff only when safe, and ensure write retries do not create accidental duplicates.
- Store credentials only in server-side secret configuration.

### 4.7 Backend example: one feature

```text
backend/source/api/ItemsAPI.py
backend/source/service/ItemsService.py
backend/source/dal/ItemsRepository.py
backend/source/dal/models/item.py
backend/source/schemas/item.py
backend/source/tests/test_items_api.py
backend/source/tests/test_items_service.py
backend/source/tests/test_items_repository.py
```

- `ItemsAPI.py`: `GET`, `POST`, `PATCH`, and `DELETE` endpoints as required.
- `ItemsService.py`: rules for creating, updating, listing, and removing items.
- `ItemsRepository.py`: query and persistence operations.
- `models/item.py`: database entity definition.
- `schemas/item.py`: validated API inputs and outputs.
- `tests/`: focused tests for each boundary.

---

## 5. Frontend-to-backend communication

Plan an API contract before implementing both sides.

| Contract element | Decide |
|---|---|
| Endpoint | HTTP method, path, API version |
| Authentication | Who can access the endpoint; how identity is verified |
| Authorization | Which resource/operation the caller may access |
| Request | Input fields, optional values, validation, content type |
| Response | Data types, success shape, pagination/metadata |
| Errors | HTTP statuses, consistent error codes and safe messages |
| Persistence | Tables/collections, transactional behavior, uniqueness rules |
| Operational behavior | Timeout, retry, idempotency, asynchronous work |
| UI states | Loading, success, no data, validation error, network/server error |
| Tests | Successful request and important failure scenarios |

Example contract (illustrative; adapt to project needs):

```http
POST /api/v1/items
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "Example item",
  "quantity": 2
}
```

Example success response:

```json
{
  "success": true,
  "data": {
    "id": "example-id",
    "name": "Example item",
    "quantity": 2
  }
}
```

Example failure response (with an appropriate non-2xx HTTP status):

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Please check the item details."
  }
}
```

The success/error envelope is a suggested convention, not a requirement of FastAPI itself. Once a project chooses a contract, keep the frontend and backend consistent. Use HTTP status codes correctly even if the body includes a success flag.

---

## 6. How to implement a feature

Follow this sequence for every meaningful new feature.

### Step 1 — Understand

- Identify the user goal and expected flow.
- Identify entities, permissions, important rules, and exceptional cases.
- Decide whether the feature requires persistence or a third-party integration.

### Step 2 — Map the files

Identify the relevant files before coding:

```text
UI page         -> ui/src/pages/<Feature>/
UI components   -> ui/src/components/<feature>/
UI state/hook   -> ui/src/hooks/
UI API calls    -> ui/src/services/<Feature>Service.ts
UI data types   -> ui/src/types/

Backend router  -> backend/source/api/<Feature>API.py
Business logic  -> backend/source/service/<Feature>Service.py
Persistence     -> backend/source/dal/<Feature>Repository.py
API schemas     -> backend/source/schemas/
Tests           -> corresponding frontend/backend tests
```

### Step 3 — Define the contract

Document the endpoints, request/response models, authorization, errors, and persistence before wiring UI calls.

### Step 4 — Build the backend

Implement schema -> repository (if needed) -> service -> API router, then register the router in the FastAPI app. Verify business rules and HTTP responses through tests.

### Step 5 — Build the frontend

Implement types -> frontend service -> hook/page state -> components/page -> route. Support meaningful loading, empty, and error states.

### Step 6 — Integrate and test

Run the actual UI-to-backend path. Test representative success and failure cases, authentication/authorization boundaries, and database behavior as applicable.

### Step 7 — Finish

Run lint/format, type checking, tests, and build checks. Update README, environment templates, migrations, and API documentation where relevant.

---

## 7. Naming and code conventions

| Topic | Frontend | Backend |
|---|---|---|
| Language | TypeScript / TSX | Python |
| Component / class | `ItemsPage`, `ItemForm` | `ItemsService`, `ItemsRepository` |
| File naming | `ItemsPage.tsx`, `ItemsService.ts` | `ItemsAPI.py`, `ItemsService.py`, `ItemsRepository.py` |
| Functions | `getItems()`, `createItem()` | `get_items()`, `create_item()` |
| React hooks | `useItems.ts` | Not applicable |
| DTOs / types | `CreateItemRequest` | `ItemCreateRequest` |
| Constants | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| Models / schema modules | `item.ts` | `models/item.py`, `schemas/item.py` |
| Unit tests | `*.test.ts` / `*.test.tsx` | `test_*.py` |

The PascalCase Python filenames above intentionally use a feature-oriented `API`/`Service`/`Repository` convention. Standard Python projects sometimes use lowercase `snake_case` filenames instead; either is workable. **Within a project, choose one consistent naming pattern and use it throughout.**

Code quality guidelines:

- Prefer focused, readable functions over giant files.
- Define clear inputs/outputs and avoid unnecessary `any` types.
- Keep duplicate logic in one shared location.
- Preserve existing public API contracts when extending a live project.
- Handle errors intentionally and log enough context to diagnose failures.
- Document non-obvious business decisions rather than every self-evident line.
- Use reusable components and utilities where they add real value; avoid overengineering.

---

## 8. Configuration, security, and operations

### Configuration

- Keep frontend and backend environment variables separate.
- Include `.env.example` with variable names and safe placeholder values.
- Configure backend URLs, database connections, and integration settings by environment.
- Do not commit credentials, tokens, private keys, or production `.env` files.
- Never expose server-side secrets to browser-delivered JavaScript.

### Authentication and authorization

- Choose the appropriate auth model for the product (sessions, OAuth/OIDC, or another suitable approach).
- Check backend permissions for each protected resource or action.
- Treat client-supplied IDs and role claims as untrusted until verified.
- If the product supports multiple organizations/workspaces, enforce data isolation in queries and services.
- Secure third-party webhooks/callbacks through signature checks, validated state, or another provider-appropriate mechanism.

### Runtime and reliability

- Use a centralized logging policy, request correlation where valuable, and safe error messages.
- Limit CORS to intended frontend origins and required methods/headers.
- Provide health checks and graceful startup/shutdown behavior.
- Add suitable timeouts and resilience for database and third-party operations.
- Move long-running tasks to background workers/queues when warranted by actual workloads.
- Use migrations, automated tests, and CI checks before deployment.
- Keep frontend and backend build/deployment pipelines independently maintainable.

---

## 9. Testing expectations

### Frontend

- Test reusable components and important page interactions.
- Mock frontend service calls when testing UI behavior.
- Verify form validation, loading, empty states, error handling, and successful user feedback.
- Cover major flows with end-to-end browser tests when practical.

### Backend

- API tests: request validation, status codes, authentication, authorization, error mapping.
- Service tests: business rules, decisions, edge cases, dependencies, retry/idempotency behavior.
- Repository tests: database filters, persistence, constraints, and transaction behavior.
- Integration tests: real serialization and service boundaries using safe test environments.

### Definition of done

- [ ] New code follows `ui/` and `backend/` separation.
- [ ] Frontend page, components, services, and types are in their intended folders.
- [ ] Frontend calls use the shared API client.
- [ ] Backend endpoints are in `source/api/`.
- [ ] Business rules are in `source/service/`.
- [ ] Persistence logic is in `source/dal/` when needed.
- [ ] Request/response schemas are defined and consistent with frontend types.
- [ ] Errors, empty states, and loading states are handled.
- [ ] Auth and resource permissions are enforced where needed.
- [ ] Configuration and secrets are safe.
- [ ] Relevant tests pass; lint/typecheck/build checks pass.
- [ ] Documentation is updated for new setup, endpoints, or migrations.

---

## 10. Instructions to an AI coding assistant

This section is an operating guide when the context file is provided to an AI assistant that will build or modify a project.

### Treat as defaults

1. Build a React/TypeScript application under `ui/` and a Python/FastAPI application under `backend/`, unless the project owner specifically requests another stack.
2. Use the folder and responsibility boundaries in this file as the default project architecture.
3. Before implementing a significant feature, inspect the existing code and provide a compact file map showing what will be created or changed.
4. Keep UI presentation, frontend HTTP calls, backend routing, business logic, and persistence in separate layers.
5. Reuse shared clients, components, schemas, authentication helpers, and utilities when they already exist.
6. Keep business/domain decisions driven by the new project's requirements. This document describes architecture, not the product's business rules.
7. Implement both sides of API contracts coherently. Ensure the TypeScript shapes match the Pydantic responses.
8. Implement useful error handling and appropriate tests as part of feature completion.
9. Do not claim that tests, builds, or integrations were verified unless they were actually run.
10. If the existing project has an intentional, established convention that differs from this starter guide, follow the established convention unless explicitly asked to refactor it.

### Avoid

- Raw Axios calls spread throughout UI components.
- Backend route handlers containing large business calculations or database queries.
- Database sessions created independently in many unrelated files.
- Third-party credentials embedded in the UI or repository.
- Large modules that combine unrelated features.
- Duplicate HTTP client implementations or scattered error-handling formats.
- Unnecessary infrastructure or dependencies before a feature actually needs them.
- Copying example domain entities into a product that uses a different domain.

### When starting from an empty repository

1. Establish `ui/` and `backend/` folder boundaries.
2. Create the shared HTTP client, FastAPI application entry point, and basic health endpoint.
3. Add the first real feature using the full page -> frontend service -> backend API -> backend service -> repository (if applicable) path.
4. Set up minimal project-appropriate testing, configuration, and documentation.
5. Expand the structure as requirements grow without mixing architectural responsibilities.

### When extending an existing repository

1. Read the existing file organization and inspect similar nearby features.
2. Follow current naming, error, authentication, database, and API conventions that are intentional and safe.
3. Change the smallest appropriate set of files across the correct layers.
4. Keep public behavior backward compatible unless the requested change requires otherwise.
5. Add only the abstractions needed for maintainability.

---

## 11. Project-specific information to fill in

This architecture remains the same across projects, but fill in the following for each new application. Values here are deliberately placeholders.

```yaml
project:
  name: "<project-name>"
  purpose: "<what-the-application-does>"
  primary_users: ["<user-types>"]

frontend:
  framework: "React + TypeScript"
  routing: "React Router"
  component_library: "<chosen-library-or-custom>"
  styling: "<chosen-styling-approach>"

backend:
  framework: "FastAPI"
  api_prefix: "/api/v1"
  auth_strategy: "<chosen-auth-model>"
  database: "<database-or-none>"

features:
  - "<feature-one>"
  - "<feature-two>"

integrations:
  - "<optional-external-service>"

deployment:
  ui: "<hosting-environment>"
  backend: "<hosting-environment>"
```

Use project-specific requirements, designs, data models, and API specifications alongside this file. Do not infer product behavior, entity names, integrations, or infrastructure from the architecture alone.

---

## 12. One-page architecture summary

```text
my-project/
|
|-- ui/
|   `-- src/
|       |-- pages/          # Pages/screens
|       |-- components/     # UI elements
|       |-- services/       # API client and endpoint wrappers
|       |-- hooks/          # Reusable React logic
|       |-- types/          # TypeScript contracts
|       `-- utils/          # Shared frontend helpers
|
`-- backend/
    `-- source/
        |-- api/            # FastAPI routes only
        |-- service/        # Business logic and workflows
        |-- dal/            # Database access/repositories
        |-- schemas/        # Pydantic contracts
        |-- utils/          # Shared backend helpers
        `-- tests/          # Backend tests
```

**Golden rule:** Keep the architecture predictable: UI handles presentation, frontend services handle HTTP calls, backend APIs handle requests, backend services handle business behavior, and repositories handle data persistence.
