# Garmin AI Coach Pro

An AI-powered endurance training platform that provides personalized coaching, adaptive training plans, and intelligent insights for runners, cyclists, swimmers, and triathletes.

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748?logo=prisma)
![Claude AI](https://img.shields.io/badge/Claude-3.5%20Sonnet-orange)

## 🚀 Features

### 🤖 AI-Powered Coaching
- **Conversational AI Coach**: Chat with Claude 3.5 Sonnet for personalized training advice
- **Context-Aware Insights**: AI analyzes your last 30 days of training history, metrics, and goals
- **Science-Based Recommendations**: Periodization, recovery, and injury prevention guidance
- **Persistent Conversations**: Chat history saved across sessions

### 📊 Training Management
- **Readiness Scoring**: Daily 0-100 scores based on HRV, training load, recovery, and sleep
- **Workout Generation**: Personalized sessions for all endurance sports
- **Training Plans**: Adaptive, periodized plans (16-24 weeks) with Base/Build/Peak/Taper phases
- **Workout Tracking**: Complete history with filtering, completion tracking, and notes

### 📈 Data & Analytics
- **Interactive Charts**: HRV trends, Training Load, ACWR (injury risk), Readiness Score
- **Flexible CSV Import**: Auto-detect and map Garmin Connect and Strava exports
- **Smart Data Mapping**: Handles various column names and formats automatically
- **Sample Data Generator**: 60-day realistic training history for testing
- **Data Preview**: Review imported data before confirming

### 👤 User Experience
- **Modern Dashboard**: Real-time overview with quick actions and today's workout
- **Profile Management**: Settings, password changes, data deletion
- **Responsive Design**: Desktop and mobile-friendly
- **Suggested Questions**: AI coach starter prompts

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js for authentication
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: Anthropic Claude API (Claude 3.5 Sonnet)
- **Charts**: Recharts for data visualization
- **CSV Parsing**: PapaParse with intelligent format detection

### Project Structure
```
src/
├── app/
│   ├── api/                  # API endpoints
│   │   ├── auth/             # Authentication (signup, NextAuth)
│   │   ├── chat/             # AI coaching chat ✨
│   │   ├── metrics/          # Training metrics & charts
│   │   ├── plans/            # Training plan generation
│   │   ├── workouts/         # Workout management
│   │   ├── upload/           # CSV data import
│   │   ├── seed/             # Sample data generation
│   │   └── user/             # User profile & settings
│   ├── auth/                 # Auth pages (login, signup)
│   └── dashboard/            # Protected dashboard pages
│       ├── chat/             # AI Coach chat interface ✨
│       ├── plans/            # Training plans (list, detail, create)
│       ├── workouts/         # Workout history & details
│       ├── upload/           # Data upload with preview
│       └── settings/         # User profile settings
├── components/               # Reusable React components
│   ├── charts/              # Chart components
│   ├── Navbar.tsx
│   ├── ReadinessCard.tsx
│   └── MetricCard.tsx
├── lib/
│   ├── calculations/         # Training algorithms
│   │   ├── readiness.ts      # Readiness scoring
│   │   ├── workouts.ts       # Workout generation
│   │   └── plans.ts          # Plan periodization (800+ lines)
│   ├── csv-mapper.ts         # CSV format detection & mapping
│   ├── seed-data.ts          # Sample data generation
│   ├── auth.ts               # NextAuth configuration
│   └── prisma.ts             # Prisma client
└── prisma/
    └── schema.prisma         # Database schema
```

## 🚀 Quick Start (< 30 minutes)

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+ (or Docker)
- Anthropic API key ([get one here](https://console.anthropic.com))

### 1. Clone and Install
```bash
git clone <repository-url>
cd garmin-ai-coach-pro
npm install
```

### 2. Database Setup

**Option A: Docker (Recommended)**
```bash
docker run --name garmin-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=garmin_ai_coach \
  -p 5432:5432 -d postgres:14
```

**Option B: Local PostgreSQL**
```bash
createdb garmin_ai_coach
# Or: psql -U postgres -c "CREATE DATABASE garmin_ai_coach;"
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/garmin_ai_coach?schema=public"

# NextAuth (generate secret: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"

# AI Integration (REQUIRED for AI Coach chat)
ANTHROPIC_API_KEY="sk-ant-your-key-here"

# App
NODE_ENV="development"
```

### 4. Database Migration
```bash
npx prisma db push
npx prisma generate
```

### 5. Run Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and create an account!

### 6. Load Sample Data
1. Sign up and log in
2. Go to Dashboard
3. Click **"Load Sample Data"** button
4. Explore 60 days of realistic training data (488 metrics + 40 workouts)

### 7. Try AI Coach
1. Navigate to **AI Coach** in the navigation
2. Try suggested questions like "How am I doing with my training lately?"
3. Get personalized advice based on your sample data!

## 📊 Database Schema

### Core Models
- **User**: Authentication, profile (age, gender, weight)
- **Metric**: Training metrics (HRV, VO2max, Training Load, Sleep, Stress)
- **Workout**: Training sessions with structured segments and completion tracking
- **TrainingPlan**: Periodized multi-week plans with weekly progression
- **Conversation**: AI coaching chat sessions
- **Message**: Chat messages (USER/ASSISTANT/SYSTEM roles)

### Key Relationships
```
User → Metrics (1:many)
User → Workouts (1:many)
User → TrainingPlans (1:many)
User → Conversations (1:many)
TrainingPlan → Workouts (1:many)
Conversation → Messages (1:many)
```

See [`prisma/schema.prisma`](./prisma/schema.prisma) for full schema details.

## 🎯 Feature Guide

### 🤖 AI Coaching Chat

The AI coach has full context of your training:
- **Last 30 days** of metrics (HRV, Training Load averages)
- **Recent workouts** and completion rates (%)
- **Active training plans** and goals
- **User profile** information (age, gender, weight)

**System Prompt**: Intelligent coaching system that provides:
- Personalized, science-based advice
- Training trend analysis
- Workout purpose explanations
- Plan adjustments based on constraints
- Recovery and injury prevention
- Race preparation strategies
- Nutrition guidance
- Motivational support

**Example Conversations:**
```
User: "How am I doing with my training lately?"
AI: Based on your last 30 days, your avg HRV is 62ms (good) and
    training load is balanced at 420. You've completed 85% of
    planned workouts - excellent adherence! Your readiness trends
    show you're recovering well. Consider...

User: "Should I take a rest day today?"
AI: Looking at your data: HRV is 8% below average and you've had
    4 hard days in a row. Yes, a rest day would be wise to avoid
    overtraining. Try a 30min easy walk or yoga...

User: "What workout should I do tomorrow?"
AI: Given your current Base phase training and good recovery,
    I'd recommend a 60min Tempo run at Zone 4. This will...
```

### 📈 Training Plans

Generate comprehensive periodized training plans:

**Customization Options:**
- **Sport**: Running, Cycling, Swimming, Triathlon
- **Fitness Level**: Beginner (16 weeks), Intermediate (20 weeks), Advanced (24 weeks)
- **Schedule**: 3-7 days/week, 3-15 hours/week
- **Race Date**: Target event date
- **Goal**: Race distance and objective

**Periodization Phases:**
1. **Base Phase** (40-50% of plan)
   - Aerobic foundation building
   - High volume, low intensity
   - Emphasis on easy runs and endurance

2. **Build Phase** (25-35% of plan)
   - Add tempo and threshold work
   - Progressive intensity increase
   - Sport-specific training

3. **Peak Phase** (15-20% of plan)
   - Race-specific intensity
   - Highest quality workouts
   - Maintain volume

4. **Taper Phase** (5-10% of plan)
   - Volume reduction (60-70%)
   - Maintain intensity
   - Race preparation

**Recovery Weeks**: Every 4th week reduces volume by 40%

**Plan Features:**
- Pre-generated workouts for entire plan
- Weekly/Calendar view modes
- Progress tracking with completion %
- CSV export for external calendars
- Workout structure with segments, zones, pacing

### 💪 Workout Management

**Generate Single Workouts:**
- Sport selection
- Type: Easy, Tempo, Interval, Long, Recovery
- Duration: 10-180 minutes
- Structured segments with HR zones and pacing

**Workout History:**
- Filter by All/Completed/Upcoming
- Filter by sport type
- One-click completion toggle
- Add personal notes
- View full workout details
- Delete standalone workouts

**Today's Workout Widget:**
- Shows current or next scheduled workout
- Quick access from dashboard
- Smart date display (Today/Tomorrow/Next)

### 📊 Readiness Scoring

**Algorithm** (0-100 score):
```
Readiness = (HRV Score × 30%) +
            (Training Load Score × 30%) +
            (Recovery Score × 20%) +
            (Sleep Score × 20%)
```

**Scoring Components:**
- **HRV**: Current vs 7-day average (±10% range)
- **Training Load**: ACWR optimal range (0.8-1.3)
- **Recovery**: Time since last hard workout
- **Sleep**: Average hours (7-9 optimal)

**Visual Indicators:**
- 🟢 Green (80-100): Ready to train hard
- 🟡 Yellow (60-79): Moderate training recommended
- 🔴 Red (0-59): Recovery needed

### 📈 Interactive Charts

**1. HRV Trend Chart**
- 30-day line chart
- Average reference line
- Daily variation visualization

**2. Training Load Chart**
- Bar chart showing daily load
- 7-day rolling average line
- Volume trend analysis

**3. ACWR Chart** (Acute:Chronic Workload Ratio)
- Injury risk visualization
- Color-coded zones:
  - 🟢 Green (0.8-1.3): Safe training
  - 🟡 Yellow (<0.8 or 1.3-1.5): Caution
  - 🔴 Red (>1.5): High injury risk
- Educational panel explaining zones

**4. Readiness Score Trend**
- 30-day trend line
- Visual progress tracking

### 📂 CSV Upload

**Intelligent Import System:**
- **Auto-detection**: Identifies metrics vs workouts
- **Format Flexibility**: Handles Garmin, Strava, custom CSVs
- **Column Mapping**: Recognizes various column name patterns
- **Validation**: Row-by-row error reporting
- **Preview**: Review first 10 records before import
- **Dual Import**: Can import metrics AND workouts

**Supported Metrics:**
- HRV, VO2MAX, RESTING_HR, MAX_HR, FTP
- TRAINING_LOAD, RECOVERY_TIME
- SLEEP_HOURS, STRESS_LEVEL

**Supported Workout Fields:**
- Date, Sport, Name, Duration, Distance
- Auto-maps workout types from activity names

**Example Workflow:**
1. Upload CSV file
2. System auto-detects format
3. Preview shows parsed data
4. Errors highlighted with row numbers
5. Confirm to import
6. Success message with counts

### ⚙️ User Settings

**Profile Management:**
- Name, age, gender, weight
- Account creation date
- Email (cannot be changed)

**Security:**
- Change password (requires current password)
- Minimum 8 characters

**Data Management:**
- Delete all training data
- Account remains active
- Confirmation required (type "DELETE")

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio    # Open Prisma database GUI
npx prisma db push   # Push schema changes to database
npx prisma generate  # Generate Prisma Client
```

### Database Migrations
```bash
# Push schema changes
npx prisma db push

# Generate Prisma Client (after schema changes)
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma db push --force-reset

# View database in browser
npx prisma studio
```

### Adding New Features

**1. Add Database Model:**
```prisma
// prisma/schema.prisma
model NewFeature {
  id        String   @id @default(cuid())
  userId    String
  data      Json
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

**2. Update Schema:**
```bash
npx prisma db push
npx prisma generate
```

**3. Create API Endpoint:**
```typescript
// src/app/api/new-feature/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await prisma.newFeature.findMany({
    where: { userId: session.user.id }
  });

  return NextResponse.json(data);
}
```

**4. Build UI Component:**
```typescript
// src/app/dashboard/new-feature/page.tsx
'use client';

export default function NewFeaturePage() {
  // Your component logic
}
```

**5. Update Navigation:**
```typescript
// src/components/Navbar.tsx
const navItems = [
  // ... existing items
  { href: '/dashboard/new-feature', label: 'New Feature', icon: IconName },
];
```

## 📡 API Reference

### Authentication
- `POST /api/auth/signup` - Create new user account
  ```json
  { "email": "user@example.com", "password": "password123", "name": "John" }
  ```
- `POST /api/auth/signin` - Sign in (NextAuth)
- `POST /api/auth/signout` - Sign out

### AI Coaching
- `POST /api/chat` - Send message to AI coach
  ```json
  {
    "message": "How am I doing?",
    "conversationId": "optional-existing-id"
  }
  ```
  **Response:**
  ```json
  {
    "conversationId": "clxxx...",
    "message": "Based on your last 30 days..."
  }
  ```

### Metrics
- `GET /api/metrics?days=30` - Get recent metrics
- `GET /api/metrics/charts?days=30` - Get chart data
  ```json
  {
    "hrv": { "data": [...], "average": 65 },
    "trainingLoad": { "data": [...], "sevenDayAvg": 420 },
    "acwr": { "data": [...] },
    "readiness": { "data": [...] }
  }
  ```
- `GET /api/readiness` - Calculate readiness score

### Workouts
- `GET /api/workouts?sport=RUNNING&completed=true` - List workouts
- `GET /api/workouts/[id]` - Get workout details
- `PUT /api/workouts/[id]` - Update workout
  ```json
  { "completed": true, "notes": "Great workout!" }
  ```
- `DELETE /api/workouts/[id]` - Delete standalone workout
- `POST /api/workouts/generate` - Generate single workout
  ```json
  { "sport": "RUNNING", "type": "TEMPO", "duration": 60 }
  ```

### Training Plans
- `GET /api/plans` - List user's training plans
- `GET /api/plans/[id]` - Get plan with all workouts
- `POST /api/plans/generate` - Generate new training plan
  ```json
  {
    "sport": "RUNNING",
    "raceDate": "2024-12-01",
    "currentFitnessLevel": "intermediate",
    "daysPerWeek": 5,
    "hoursPerWeek": 8,
    "goal": "Half Marathon",
    "raceDistance": 21.1
  }
  ```
- `PUT /api/plans/[id]` - Update plan status

### Data Management
- `POST /api/upload` - Import CSV data
  ```json
  {
    "metrics": [{"date": "2024-01-15", "type": "HRV", "value": 65}],
    "workouts": [{"date": "2024-01-15", "sport": "RUNNING", "duration": 60}]
  }
  ```
- `POST /api/seed` - Load sample data (60 days)
- `DELETE /api/seed` - Delete all training data

### User Profile
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
  ```json
  { "name": "John", "age": 35, "gender": "MALE", "weight": 75.5 }
  ```
- `PUT /api/user/password` - Change password
  ```json
  { "currentPassword": "old", "newPassword": "new123" }
  ```

## 🚀 Deployment

### Vercel (Recommended)

**1. Prepare Database**
- Create PostgreSQL database (Vercel Postgres, Supabase, Railway, AWS RDS)
- Get connection string

**2. Deploy to Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
```

**3. Environment Variables**
```env
DATABASE_URL="postgresql://user:password@host:5432/garmin_ai_coach?schema=public"
NEXTAUTH_URL="https://yourdomain.vercel.app"
NEXTAUTH_SECRET="production-secret-here"
ANTHROPIC_API_KEY="sk-ant-your-key"
NODE_ENV="production"
```

**4. Run Database Migration**
```bash
# In Vercel project settings, add build command:
npx prisma generate && npx prisma db push && next build
```

### Alternative Hosting Options

**Railway:**
- Built-in PostgreSQL
- Auto-deploys from GitHub
- Simple environment variable management

**Fly.io:**
- Global edge deployment
- PostgreSQL add-on available
- Docker-based deployment

**AWS/GCP:**
- Production-grade infrastructure
- RDS/Cloud SQL for database
- More configuration required

## 🧪 Testing

### Manual Testing Workflow

**1. Test Authentication:**
```bash
# Sign up new user
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**2. Load Sample Data:**
- Log in to dashboard
- Click "Load Sample Data"
- Verify 488 metrics + 40 workouts created

**3. Test AI Chat:**
- Navigate to AI Coach
- Try: "Analyze my last week of training"
- Verify contextual response with your data

**4. Test CSV Upload:**
- Download sample CSV
- Upload and preview
- Confirm import
- Check data appears in dashboard

**5. Generate Training Plan:**
- Go to Training Plans → New Plan
- Fill in race date, fitness level, schedule
- Generate plan
- Verify 16-24 weeks of workouts

**6. Test Workout Tracking:**
- View workout history
- Mark workout as completed
- Add notes
- Filter by sport/status

### Load Testing
```bash
# Test readiness endpoint
curl http://localhost:3000/api/readiness \
  -H "Cookie: next-auth.session-token=..."

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"message":"Test message"}'
```

## 🔐 Security

### Implemented Security Features
- **Authentication**: JWT sessions via NextAuth.js
- **Password Hashing**: bcrypt with 12 rounds
- **HTTPS**: Enforced in production
- **API Protection**: All endpoints require authentication
- **Input Validation**: Zod schemas on all API routes
- **SQL Injection**: Protected by Prisma ORM
- **XSS Protection**: React's built-in escaping
- **CSRF Protection**: NextAuth.js CSRF tokens

### Security Best Practices
```typescript
// Always validate user owns resource
const workout = await prisma.workout.findFirst({
  where: {
    id: params.id,
    userId: session.user.id // ✅ Verify ownership
  }
});

// Use Zod for input validation
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
const validated = schema.parse(body);

// Never expose sensitive data
return NextResponse.json({
  id: user.id,
  email: user.email,
  // ❌ Never return: passwordHash
});
```

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check Docker container
docker ps

# View logs
docker logs garmin-postgres

# Restart database
docker restart garmin-postgres

# Test connection
psql "postgresql://user:password@localhost:5432/garmin_ai_coach"
```

### Prisma Issues
```bash
# Clear cache and regenerate
rm -rf node_modules/.prisma
npx prisma generate

# Reset database (WARNING: deletes data)
npx prisma db push --force-reset
```

### Next.js Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

### API Errors
```bash
# Check server logs
npm run dev

# Test endpoint
curl -v http://localhost:3000/api/metrics

# Verify environment variables
echo $ANTHROPIC_API_KEY
```

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

## 📝 Future Roadmap

### Planned Features
- [ ] **Garmin Connect OAuth**: Direct sync with Garmin devices
- [ ] **Strava Integration**: Import activities from Strava
- [ ] **SaaS Monetization**: Stripe subscriptions (Free/Premium tiers)
- [ ] **Team Features**: Coach-athlete relationships
- [ ] **Mobile App**: React Native companion app
- [ ] **Wearable Sync**: Real-time data from watches
- [ ] **Race Calendar**: Integration with race databases
- [ ] **Advanced Analytics**: Performance predictions, trend analysis
- [ ] **Social Features**: Share workouts, compete with friends
- [ ] **Workout Library**: Community-contributed workouts

### Technical Improvements
- [ ] Add comprehensive test suite (Jest, Playwright)
- [ ] Implement caching layer (Redis)
- [ ] Background job processing (BullMQ)
- [ ] Monitoring (Sentry, DataDog)
- [ ] Performance optimization (React Query)
- [ ] API rate limiting
- [ ] Data export (PDF reports, calendar sync)
- [ ] Internationalization (i18n)
- [ ] PWA features (offline mode)
- [ ] WebSocket real-time updates

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Development Guidelines:**
- Follow TypeScript best practices
- Add proper type definitions
- Validate inputs with Zod
- Write meaningful commit messages
- Update documentation
- Test thoroughly before submitting

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Inspired by [Garmin AI Coach](https://github.com/aTnT/garmin-ai-coach)
- Powered by [Anthropic Claude API](https://www.anthropic.com)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)

## 📧 Support

For issues and questions:
- **GitHub Issues**: [Create an issue](https://github.com/yourusername/garmin-ai-coach-pro/issues)
- **Documentation**: Check this README
- **Community**: Join discussions

---

**Built with ❤️ for endurance athletes by athletes**

*Transform your training with AI-powered coaching*
