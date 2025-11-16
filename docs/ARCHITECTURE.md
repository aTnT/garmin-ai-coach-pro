# Architecture Overview

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Dashboard │  │ Workouts │  │  Plans   │  │   Chat   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                   Next.js API Layer                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Rate Limiting │ Authentication │ Authorization             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Workouts │ │  Plans   │ │  Metrics │ │  Races   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ Reports  │ │   AI     │ │ Garmin   │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                   Business Logic Layer                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Multi-Agent AI System (Claude 3.5 Sonnet + LangChain)     │ │
│  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │ │  Metrics     │  │ Physiology   │  │  Activity    │    │ │
│  │ │ Summarizer   │  │ Summarizer   │  │ Summarizer   │    │ │
│  │ └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │                           ↓                               │ │
│  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │ │ Dr. Aiden    │  │ Dr. Kwame    │  │ Coach Elena  │    │ │
│  │ │ (Metrics)    │  │ (Physiology) │  │ (Activity)   │    │ │
│  │ └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │                           ↓                               │ │
│  │                   ┌──────────────┐                        │ │
│  │                   │  Synthesis   │                        │ │
│  │                   │    Agent     │                        │ │
│  │                   └──────────────┘                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Core Calculation Modules                                   │ │
│  │ • Readiness (7-signal algorithm)                           │ │
│  │ • Power Curve (11 durations, FTP estimation)               │ │
│  │ • Trends (ACWR, HRV, Volume, Performance)                  │ │
│  │ • Race Calendar (Taper planning, Peak planning)            │ │
│  │ • Training Load (TSS, CTL, ATL)                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Advanced Reporting                                          │ │
│  │ • Unified Training Report                                   │ │
│  │ • Performance Progression Report                            │ │
│  │ • Readiness History Report                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                     Data Layer                                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │ PostgreSQL  │   │   Prisma    │   │   Stripe    │          │
│  │  Database   │◄──│     ORM     │   │     API     │          │
│  └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐                             │
│  │   Garmin    │   │  Anthropic  │                             │
│  │ Connect API │   │ Claude API  │                             │
│  └─────────────┘   └─────────────┘                             │
└──────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Readiness Calculation (`src/lib/calculations/readiness.ts`)

**Algorithm:** 7-Signal Weighted Scoring

```typescript
Signals:
1. HRV (Heart Rate Variability) - 20% weight
2. Training Load - 20% weight
3. Recovery Time - 15% weight
4. Sleep Hours - 15% weight
5. Resting HR - 10% weight
6. Stress Level - 10% weight
7. Workout Quality - 10% weight

Time Windows:
- Last 7 days: Recent state
- Last 28 days: Baseline for comparison
- Last 30 days: Activity context for training load

Output:
- Score: 0-100
- Level: 'low' | 'moderate' | 'good' | 'excellent'
- Confidence: 0-100 (based on data completeness)
- Factor Breakdown: Individual signal contributions
```

**Features:**
- Adaptive baselines (compares current to 28-day baseline)
- Missing data handling (calculates partial scores)
- Training load context (uses TSS from recent activities)
- Confidence scoring (penalizes missing signals)

### 2. Power Curve Analysis (`src/lib/analysis/power-curve.ts`)

**Durations Analyzed:** 11 standard durations
```
5s, 10s, 20s, 30s (Neuromuscular/Anaerobic)
1min, 2min, 5min (VO2max)
10min, 20min (Lactate Threshold)
30min, 1hr (Endurance)
```

**Algorithm:** Sliding Window Maximum

```typescript
For each duration:
  1. Sort power data by timestamp
  2. Create sliding window of target duration
  3. Calculate average power for each window
  4. Return maximum average

FTP Estimation:
  - 95% of 20-minute best power

Power Zones (Coggan Model):
  Z1: 0-55% FTP (Active Recovery)
  Z2: 56-75% FTP (Endurance)
  Z3: 76-90% FTP (Tempo)
  Z4: 91-105% FTP (Lactate Threshold)
  Z5: 106-120% FTP (VO2 Max)
  Z6: 121-150% FTP (Anaerobic)
  Z7: 150%+ FTP (Neuromuscular)
```

### 3. Historical Trends Analysis (`src/lib/analysis/trends.ts`)

**Trend Types:**

1. **Training Load Trend**
   - 7-day rolling average (smoothing)
   - ACWR calculation (Acute:Chronic Workload Ratio)
   - Injury risk detection (ACWR > 1.3)

2. **HRV Trend**
   - 7-day rolling average
   - Variability detection (CV > 10%)
   - Fatigue indicators (declining HRV + high load)

3. **Performance Trend**
   - Best efforts over time
   - Linear regression for trend direction
   - Performance zones (sprinter/endurance/all-rounder)

4. **Volume Trend**
   - Weekly aggregation
   - 10% rule monitoring (weekly increase limit)
   - Time period comparisons

### 4. Race Calendar & Taper Planning (`src/lib/training/race-calendar.ts`)

**Taper Duration Formula:**

```typescript
Base Duration (days):
  5K: 3, 10K: 5, Half Marathon: 7, Marathon: 14
  Ultra: 21, Sprint Tri: 3, Olympic: 5, Half IM: 10, Ironman: 21

Priority Adjustments:
  A-priority: +20% (e.g., marathon: 14 → 17 days)
  B-priority: baseline (e.g., marathon: 14 days)
  C-priority: -30% (e.g., marathon: 14 → 10 days)
```

**Taper Phases:**

```
Early Taper (50% of duration):
- Volume: -20% from baseline
- Intensity: Maintain
- Focus: Reduce volume gradually

Late Taper (50% of duration):
- Volume: -40% from baseline
- Intensity: Sharpen with short efforts
- Focus: Rest and recovery
```

**Peak Planning:**

```
Available Weeks Allocation:
├── Taper: 10-30% (based on race distance)
├── Peak: 20-30% (race-specific intensity)
└── Build: 40-70% (progressive volume increase)

Race Week:
- Last Hard Effort: 5 days before
- Last Workout: 2 days before
- Race Day: Fresh and ready
```

### 5. Advanced Reporting System (`src/lib/reporting/advanced-reports.ts`)

**Report Types:**

1. **Unified Training Report**
   ```typescript
   Combines:
   - Power curve analysis
   - Historical trends
   - Current readiness
   - Training load analysis
   - Activity summary by sport

   Insights:
   - FTP progression
   - ACWR status (injury risk)
   - HRV trends
   - Volume warnings
   ```

2. **Performance Progression Report**
   ```typescript
   Compares two time periods:
   - FTP change (watts + %)
   - Power curve improvements by duration
   - Volume progression
   - Consistency metrics (active days, streaks)
   ```

3. **Readiness History Report**
   ```typescript
   Daily readiness over period:
   - Score + level + confidence per day
   - Trend direction (improving/stable/declining)
   - Factor analysis (HRV, sleep, load, stress)
   - Recovery recommendations
   ```

**Export Formats:**
- JSON (structured data)
- CSV (readiness scores, activities)

### 6. Multi-Agent AI System (`src/lib/agents/multi-agent-system.ts`)

**3-Stage Architecture:**

**Stage 1: Parallel Summarizers**
```typescript
Input: Raw training data (30 days)

Metrics Summarizer:
- Analyzes: VO2max, HRV, FTP trends
- Output: Quantitative performance summary

Physiology Summarizer:
- Analyzes: Recovery metrics, readiness, fatigue signs
- Output: Physiological state assessment

Activity Summarizer:
- Analyzes: Training patterns, intensity distribution
- Output: Training load and consistency summary
```

**Stage 2: Expert Analysts**
```typescript
Input: Stage 1 summaries + user context

Dr. Aiden Nakamura (Metrics Expert):
- Specialization: Performance metrics, power, pace
- Focus: What the numbers say

Dr. Kwame Osei (Physiology Expert):
- Specialization: Recovery, adaptation, injury prevention
- Focus: Body's response and readiness

Coach Elena Petrova (Activity Expert):
- Specialization: Training patterns, periodization
- Focus: Training structure and progression
```

**Stage 3: Synthesis**
```typescript
Input: All expert analyses

Synthesis Agent:
- Combines insights from all experts
- Resolves conflicts
- Prioritizes recommendations
- Generates actionable advice
```

## Database Schema

### Key Models

**User**
- Authentication + profile
- Relations: metrics, workouts, plans, races, conversations, subscriptions

**Race** (NEW)
```typescript
{
  id, userId, name, date, sport
  distance: RaceDistance (5K, 10K, Marathon, Ironman, etc.)
  customDistance?: number (for custom races)
  priority: A | B | C
  location, notes, goalTime, resultTime
  completed: boolean
}
```

**TrainingPlan**
- Plan data, phases, status
- Relations: workouts, adaptations

**Workout**
- Activity data, completion tracking
- Relations: user, plan

**Metric**
- Health/performance metrics (HRV, VO2max, FTP, etc.)
- Indexed by userId + date + type

**PlanAdaptation**
- Automatic plan adjustments
- Trigger detection, recommendations, rollback support

**Subscription**
- Stripe integration
- Tier levels: FREE, PREMIUM, TEAM

## API Endpoints

### Races (NEW)

```
GET    /api/races
       ?upcoming=true&priority=A&sport=RUNNING

POST   /api/races
       {name, date, sport, distance, priority, location, goalTime}

GET    /api/races/[id]
PATCH  /api/races/[id]
DELETE /api/races/[id]

GET    /api/races/[id]/taper-plan
       ?type=peak&weeks=12&weeklyVolume=300
```

### Advanced Reports (NEW)

```
GET /api/reports/unified
    ?days=30&format=json

GET /api/reports/progression
    ?currentDays=14&comparisonDays=14&format=json

GET /api/reports/readiness
    ?days=14&format=csv
```

## Testing Strategy

### Test Coverage

- **Unit Tests:** Core algorithms (readiness, power curve, trends, race calendar)
- **Integration Tests:** Multi-agent AI workflows, API routes
- **E2E Tests:** Critical user flows (workout generation, plan creation)

### Test Organization

```
src/
├── lib/
│   ├── calculations/
│   │   └── __tests__/
│   │       ├── readiness.test.ts (60 tests)
│   │       └── training-load.test.ts
│   ├── analysis/
│   │   └── __tests__/
│   │       ├── power-curve.test.ts (23 tests)
│   │       └── trends.test.ts (15 tests)
│   ├── training/
│   │   └── __tests__/
│   │       └── race-calendar.test.ts (46 tests)
│   ├── reporting/
│   │   └── __tests__/
│   │       └── advanced-reports.test.ts (32 tests)
│   └── agents/
│       └── __tests__/
│           └── multi-agent-system.test.ts (17 tests)
│
└── app/api/
    └── __tests__/
        ├── readiness.test.ts (integration)
        ├── workout-generation-e2e.test.ts (8 tests)
        └── training-plan-e2e.test.ts (9 tests)
```

**Current Status:**
- Total Tests: 209+ passing
- Coverage: ~21% (targeting 70%+)

## Performance Considerations

### Optimization Strategies

1. **Database Queries**
   - Indexed lookups (userId + date + type)
   - Selective field retrieval
   - Batch operations where possible

2. **AI Calls**
   - Rate limiting (10 calls/min per user)
   - Response streaming for chat
   - Caching for repeated queries

3. **Calculations**
   - Power curve: O(n*m) where n=data points, m=durations
   - Readiness: O(n) where n=metrics (30 days max)
   - Trends: O(n) with rolling windows

4. **API Response Times**
   - Target: <5s for data sync
   - Target: <30s for AI plan generation
   - Target: <3s for readiness calculation

## Security

### Protection Layers

1. **Authentication:** NextAuth.js with session tokens
2. **Authorization:** User ownership checks on all resources
3. **Rate Limiting:** Per-user, per-endpoint throttling
4. **Input Validation:** Zod schemas on all API inputs
5. **SQL Injection:** Prisma ORM parameterized queries
6. **XSS:** React automatic escaping
7. **CSRF:** NextAuth built-in protection

### Privacy

- **No Raw Data Storage:** Activity files processed transiently
- **Data Minimization:** Only derived insights persisted
- **User Deletion:** Cascade deletes all related data
- **Audit Logs:** 90-day retention for compliance

## Deployment

### Environment Requirements

**Development:**
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for rate limiting)

**Production:**
- Vercel (recommended)
- PostgreSQL (Supabase/Neon/Railway)
- Anthropic API key
- Stripe account (for payments)
- Garmin Developer account (for OAuth)

### Environment Variables

```env
# Core
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL

# AI
ANTHROPIC_API_KEY
OPENAI_API_KEY (optional)

# Integrations
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GARMIN_CONSUMER_KEY
GARMIN_CONSUMER_SECRET
```

## Future Enhancements

### Planned Features

1. **Mobile App**
   - React Native
   - Offline-first architecture
   - Push notifications

2. **Additional Integrations**
   - Strava
   - TrainingPeaks
   - Wahoo

3. **Advanced Analytics**
   - Power duration modeling
   - VO2max prediction
   - Race time predictions

4. **Social Features**
   - Activity sharing
   - Leaderboards
   - Community challenges

5. **Enhanced AI**
   - GPT-4 integration
   - Custom training philosophies
   - Voice coach interaction

---

**Last Updated:** 2024-11-16
**Version:** 1.0.0
