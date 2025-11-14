You are an expert full-stack developer and AI integration specialist tasked with building a production-ready SaaS web application called "Garmin AI Coach Pro." This app transforms the open-source Garmin AI Coach—a Python-based multi-agent AI system for personalized endurance training analysis and planning—into a user-friendly, subscription-based web platform. Users (athletes and coaches) should be able to securely connect their Garmin accounts, sync training data, and receive AI-generated insights like readiness scores, personalized workouts, adaptive plans, and reports through an intuitive dashboard. Premium features are gated behind subscriptions, with support for team management.

Key Inputs:
- Adapt and integrate the Garmin AI Coach codebase from https://github.com/aTnT/garmin-ai-coach/tree/claude/codebase-analysis-011CUzxnN9oso9NhezXgpJSn as the foundation for the AI analysis and planning logic (e.g., multi-agent workflows for metrics, physiology, and coaching).
- Use the Next.js SaaS Starter from https://github.com/nextjs/saas-starter as a reference for bootstrapping the web application structure, including authentication, payments, and database setup—feel free to extend or modify it as needed.

Focus on delivering core value: Secure data handling, accurate AI-driven personalization, seamless user experiences, and sustainable monetization. Make your own architectural decisions based on best practices for scalability, security, and maintainability—e.g., choose frameworks, databases, deployment options, and integrations that fit the requirements without external constraints.

### Functional Requirements
- **User Onboarding and Authentication**:
  - Allow users to sign up, log in, and manage profiles (e.g., basic info like age, goals, sports preferences).
  - Securely connect to Garmin Connect for data access (e.g., via OAuth or API tokens). Guide users through authorization and handle token storage/refresh.
  - Support role-based access: Individual athletes (free/premium), coaches (team management, multi-user oversight).

- **Data Sync and Management**:
  - Enable one-time or automated sync of Garmin training data (activities, metrics like VO2max, HRV, FTP, training load).
  - Process data transiently: Analyze without long-term storage of raw files; retain only anonymized summaries or derived insights (e.g., scores, plans) as needed.
  - Provide options for manual data upload (e.g., FIT/CSV files) as a fallback.

- **AI-Powered Core Features**:
  - **Readiness Scoring**: Compute daily scores (0-100) based on recent metrics, recoverable stress, and trends; display with explanations.
  - **Workout Generation**: Create personalized sessions for running, cycling, swimming, etc., tailored to user goals, fitness level, and constraints (e.g., time, equipment).
  - **Training Plans**: Generate adaptive, periodized plans (weekly to seasonal) incorporating races, recovery, and progression; allow refinements via user input.
  - **Reports and Insights**: Produce visual summaries (charts for trends like ACWR, power curves) and textual analysis (e.g., physiological recommendations).
  - **Conversational Refinements**: Offer a chat-like interface for users to tweak plans/goals with AI (human-in-the-loop style).

- **SaaS Monetization**:
  - Free tier: Basic access (e.g., limited syncs, 7-day analysis).
  - Premium tiers: Enhanced features (e.g., unlimited syncs, full plans, team sharing) via subscription (handle payments, upgrades, cancellations).
  - Include pricing display, trial periods, and webhook-driven status updates.

- **Team and Collaboration**:
  - Coaches can invite/manage athletes, view shared data/plans (with consent), and generate group insights.

- **User Interface and Experience**:
  - Dashboard: Overview of readiness, recent activities, load trends, and quick actions (sync, generate workout).
  - Dedicated pages/sections: Plans (calendar view, exports), Reports (filterable), Chat, Settings.
  - Responsive design for desktop/mobile; intuitive navigation, loading states, and error messages (e.g., "Sync failed—retry or upload manually?").
  - Support basic accessibility (e.g., screen reader compatibility) and internationalization (e.g., English default, multi-language readiness).

### Non-Functional Requirements
- **Security and Privacy**:
  - Encrypt sensitive data (e.g., API tokens); comply with GDPR/CCPA (user consent, data minimization, deletion requests).
  - No persistent raw data storage; audit logs for access.
  - Protect against common vulnerabilities (e.g., input validation, rate limiting).

- **Performance and Scalability**:
  - Handle concurrent users (aim for 1,000+ active); optimize AI processing (e.g., async, caching for repeated queries).
  - Fast response times (<5s for syncs, <30s for plan generation); monitor costs for AI calls.

- **Reliability**:
  - Graceful error handling for integrations (e.g., API downtime fallbacks).
  - Backup essential data (e.g., user plans); uptime >99%.

- **Testing and Quality**:
  - Cover key flows (unit, integration, end-to-end); include edge cases like invalid data or offline modes.
  - Ensure cross-browser/device compatibility.

- **Deployment and Maintenance**:
  - Easy setup for local dev/production (e.g., env-based config).
  - Include monitoring for usage analytics, errors, and AI performance.
  - Documentation: README with setup/run instructions, architecture overview, and API references.

### Integration Guidelines
- External APIs: Garmin for data, payments provider for subscriptions, optional race calendars.
- Output: Structure the complete codebase as a repo (folders/files with code). Make it launchable quickly (e.g., <30 min setup with defaults like a test LLM). Start by outlining your chosen architecture (e.g., high-level diagram), then build iteratively, explaining decisions.
