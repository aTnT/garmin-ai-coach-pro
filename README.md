# Garmin AI Coach Pro - MVP

AI-powered endurance training analysis and personalized coaching platform.

## Overview

Garmin AI Coach Pro is a SaaS web application that provides athletes with personalized training insights, readiness scoring, and workout generation. This MVP version focuses on core functionality:

- **User Authentication**: Secure email/password authentication
- **Readiness Scoring**: Daily readiness scores based on HRV, training load, recovery, and sleep metrics
- **Workout Generation**: Template-based personalized workout creation
- **CSV Data Upload**: Manual import of training metrics
- **Dashboard**: Visualize key metrics and training status

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Charts**: Recharts
- **File Parsing**: PapaParse

## Prerequisites

- Node.js 18+ and npm/pnpm
- Docker and Docker Compose (for PostgreSQL)
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd garmin-ai-coach-pro
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/garmin_ai_coach?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

# App
NODE_ENV="development"
```

### 4. Start PostgreSQL Database

Using Docker Compose:

```bash
docker-compose up -d
```

This will start a PostgreSQL instance on `localhost:5432`.

### 5. Set Up the Database

Generate Prisma client and push schema to database:

```bash
npx prisma generate
npx prisma db push
```

### 6. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### 1. Create an Account

1. Navigate to http://localhost:3000
2. Click "Get Started" or "Sign Up"
3. Enter your email, password, and optionally your name
4. Click "Sign Up"

### 2. Upload Training Data

1. After logging in, click "Upload Data" in the navigation or from the dashboard
2. Download the sample CSV to see the format
3. Prepare your CSV file with columns: `date,type,value,unit`
4. Upload your CSV file

**Supported Metric Types:**
- `HRV` - Heart Rate Variability (ms)
- `VO2MAX` - VO2 Max (ml/kg/min)
- `RESTING_HR` - Resting Heart Rate (bpm)
- `MAX_HR` - Maximum Heart Rate (bpm)
- `FTP` - Functional Threshold Power (watts)
- `TRAINING_LOAD` - Training Load
- `RECOVERY_TIME` - Recovery Time (hours)
- `SLEEP_HOURS` - Sleep Duration (hours)
- `STRESS_LEVEL` - Stress Level (0-100)

**Example CSV:**
```csv
date,type,value,unit
2024-01-15,HRV,65,ms
2024-01-15,TRAINING_LOAD,450,
2024-01-15,VO2MAX,52,ml/kg/min
2024-01-15,SLEEP_HOURS,7.5,hours
```

### 3. View Dashboard

The dashboard displays:
- **Readiness Score**: 0-100 score based on multiple factors
- **Contributing Factors**: HRV, Training Load, Recovery, Sleep
- **Latest Metrics**: VO2 Max, HRV, Training Load
- **Quick Actions**: Generate workouts, upload data

### 4. Generate Workouts

1. Click "Workouts" in navigation or "Generate Workout" from dashboard
2. Select:
   - **Sport**: Running, Cycling, Swimming, Triathlon, Other
   - **Type**: Easy, Tempo, Interval, Long, Recovery
   - **Duration**: 10-180 minutes
3. Click "Generate Workout"
4. View structured workout with segments, pacing guidance, and training notes

## Project Structure

```
garmin-ai-coach-pro/
├── src/
│   ├── app/                      # Next.js app directory
│   │   ├── api/                  # API routes
│   │   │   ├── auth/            # Authentication endpoints
│   │   │   ├── readiness/       # Readiness score API
│   │   │   ├── metrics/         # Metrics API
│   │   │   ├── workouts/        # Workout generation API
│   │   │   └── upload/          # CSV upload API
│   │   ├── auth/                # Auth pages (login, signup)
│   │   ├── dashboard/           # Dashboard pages
│   │   │   ├── workouts/        # Workout generation page
│   │   │   └── upload/          # Data upload page
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Landing page
│   ├── components/              # React components
│   │   ├── Navbar.tsx
│   │   ├── ReadinessCard.tsx
│   │   ├── MetricCard.tsx
│   │   └── SessionProvider.tsx
│   ├── lib/                     # Utility functions
│   │   ├── calculations/        # Business logic
│   │   │   ├── readiness.ts    # Readiness calculation
│   │   │   └── workouts.ts     # Workout generation
│   │   ├── auth.ts             # NextAuth configuration
│   │   ├── prisma.ts           # Prisma client
│   │   └── utils.ts            # Helper functions
│   └── types/                   # TypeScript type definitions
├── prisma/
│   └── schema.prisma            # Database schema
├── docker-compose.yml           # Docker services
├── next.config.js               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies
```

## Database Schema

### User
- Authentication and profile data
- Relationships: Metrics, Workouts, Training Plans

### Metric
- Training metrics (HRV, VO2max, Training Load, etc.)
- Timestamped with date
- Linked to user

### Workout
- Generated or completed workouts
- Structured segments with zones and pacing
- Linked to user and optionally to training plan

### TrainingPlan
- Multi-week training plans
- Contains workout schedule
- Status tracking (active, completed, archived)

## Features

### Readiness Scoring Algorithm

The readiness score (0-100) is calculated using a weighted formula:

```
Readiness = (HRV Score × 0.35) +
            (Training Load Score × 0.35) +
            (Recovery Score × 0.20) +
            (Sleep Score × 0.10)
```

**HRV Score**: Based on current HRV vs 7-day average
- >10% above average: 100 points
- Within 5% of average: 70 points
- >15% below average: 30 points

**Training Load Score**: Based on Acute:Chronic Workload Ratio (ACWR)
- Optimal range (0.8-1.3): 100 points
- Overreaching risk (>1.5): 40 points

**Recovery Score**: Based on recovery time remaining
- <12 hours: 100 points
- >48 hours: 20 points

**Sleep Score**: Based on average sleep hours
- ≥8 hours: 100 points
- <5 hours: 20 points

### Workout Templates

Five workout types with structured segments:

1. **Easy**: Sustained aerobic effort, Zone 2, conversational pace
2. **Tempo**: Lactate threshold work, Zone 4, comfortably hard
3. **Interval**: High-intensity intervals, Zone 5, VO2max development
4. **Long**: Extended aerobic endurance, Zone 2, mental toughness
5. **Recovery**: Active recovery, Zone 1, very easy pace

Each workout includes:
- Warm-up and cool-down phases
- Heart rate zone guidance
- Pace guidance
- Duration estimates
- Distance estimates (sport-specific)
- Training notes and tips

## Development

### Database Management

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Create migration
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication

### Metrics
- `GET /api/metrics?days=30` - Get user metrics
- `POST /api/upload` - Upload metrics from CSV

### Readiness
- `GET /api/readiness` - Get current readiness score

### Workouts
- `POST /api/workouts/generate` - Generate workout
  ```json
  {
    "sport": "RUNNING",
    "type": "TEMPO",
    "duration": 60
  }
  ```

## Security Features

- Password hashing with bcryptjs (12 rounds)
- JWT-based session management
- Protected API routes with authentication middleware
- Input validation with Zod schemas
- SQL injection prevention via Prisma ORM
- XSS protection via React's automatic escaping

## Future Enhancements

### Planned for Full Version
- **Garmin OAuth Integration**: Direct sync from Garmin Connect
- **AI-Powered Insights**: LLM-based coaching recommendations
- **Training Plans**: Multi-week periodized plan generation
- **Team Features**: Coach-athlete relationships
- **Subscription Tiers**: Free and premium plans with Stripe
- **Advanced Analytics**: Trend analysis, performance predictions
- **Mobile Optimization**: Progressive Web App features
- **Real-time Updates**: WebSocket-based notifications

### Technical Improvements
- Add comprehensive test coverage (Jest, Playwright)
- Implement caching layer (Redis)
- Add background job processing (BullMQ)
- Set up monitoring and error tracking (Sentry)
- Add performance optimization (React Query)
- Implement API rate limiting
- Add data export functionality

## Troubleshooting

### Database Connection Issues

If you see `Can't reach database server`:

1. Ensure Docker is running: `docker ps`
2. Check PostgreSQL container: `docker-compose ps`
3. Restart database: `docker-compose restart`
4. Verify DATABASE_URL in `.env`

### Prisma Generation Errors

```bash
# Clear Prisma cache and regenerate
rm -rf node_modules/.prisma
npx prisma generate
```

### NextAuth Session Issues

1. Ensure NEXTAUTH_SECRET is set
2. Clear browser cookies and localStorage
3. Restart development server

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

## Contributing

This is an MVP version. For the full production version, consider:

1. Add comprehensive error handling
2. Implement logging and monitoring
3. Add unit and integration tests
4. Optimize database queries with indexes
5. Add input validation on all forms
6. Implement CSRF protection
7. Add GDPR compliance features
8. Create user documentation

## License

MIT License - feel free to use this as a foundation for your own projects.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the code comments and type definitions
3. Consult Next.js, Prisma, and NextAuth.js documentation

---

**Built with** ❤️ **using Next.js, TypeScript, and Prisma**
