# Deployment Guide - Garmin AI Coach Pro

This guide covers deploying the Garmin AI Coach Pro SaaS application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Deployment Platforms](#deployment-platforms)
5. [Post-Deployment Checklist](#post-deployment-checklist)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### Required Services

- **Hosting**: Vercel (recommended) or any Next.js-compatible platform
- **Database**: PostgreSQL (Neon, Supabase, or Railway recommended)
- **AI API**: Anthropic Claude API key
- **Payment Processing**: Stripe account (for SaaS monetization)
- **OAuth**: Garmin Connect Developer Account

### Development Tools

```bash
Node.js >= 18.x
npm >= 9.x
Git
```

---

## Environment Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd garmin-ai-coach-pro
npm install
```

### 2. Configure Environment Variables

Create `.env.production` (never commit this file):

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/garmin_ai_coach?schema=public"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="<generate-with: openssl rand -base64 32>"

# Application
NODE_ENV="production"

# AI Integration
ANTHROPIC_API_KEY="sk-ant-..."

# Garmin Connect OAuth (OAuth 1.0a)
GARMIN_CONSUMER_KEY="your-garmin-consumer-key"
GARMIN_CONSUMER_SECRET="your-garmin-consumer-secret"
GARMIN_CALLBACK_URL="https://your-domain.com/api/garmin/callback"

# Stripe Payments
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PREMIUM_PRICE_ID="price_..."
STRIPE_TEAM_PRICE_ID="price_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# Cron Jobs
CRON_SECRET="<generate-with: openssl rand -base64 32>"
```

### 3. Generate Required Secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -base64 32
```

---

## Database Setup

### Option 1: Neon (Recommended)

1. **Create Database**
   - Sign up at [neon.tech](https://neon.tech)
   - Create new project
   - Copy connection string

2. **Run Migrations**
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

3. **Verify Schema**
   ```bash
   npx prisma db pull
   npx prisma generate
   ```

### Option 2: Supabase

1. **Create Project**
   - Sign up at [supabase.com](https://supabase.com)
   - Create new project
   - Navigate to Database Settings → Connection String

2. **Configure Pooling**
   - Enable connection pooling
   - Use transaction mode for Prisma
   - Copy pooled connection string

3. **Run Migrations**
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

### Migration Commands

```bash
# Deploy all pending migrations
npx prisma migrate deploy

# Reset database (DEV ONLY - destroys data)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## Deployment Platforms

### Vercel (Recommended)

#### Initial Setup

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Link Project**
   ```bash
   vercel link
   ```

3. **Configure Environment Variables**
   ```bash
   # Add all environment variables from .env.production
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   vercel env add ANTHROPIC_API_KEY production
   # ... repeat for all variables
   ```

   Or use Vercel Dashboard:
   - Project Settings → Environment Variables
   - Add each variable for Production environment

4. **Deploy**
   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

#### Cron Jobs Configuration

The `vercel.json` already contains cron configurations:

```json
{
  "crons": [
    {
      "path": "/api/cron/garmin-sync",
      "schedule": "0 6 * * *"  // Daily at 6 AM UTC
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    }
  ]
}
```

**Important**: Cron jobs require Vercel Pro plan or higher.

#### Custom Domain

1. **Add Domain**
   - Vercel Dashboard → Domains
   - Add your domain
   - Update DNS records as instructed

2. **Update Environment Variables**
   ```bash
   vercel env add NEXTAUTH_URL production
   # Value: https://your-domain.com

   vercel env add GARMIN_CALLBACK_URL production
   # Value: https://your-domain.com/api/garmin/callback
   ```

3. **Redeploy**
   ```bash
   vercel --prod
   ```

### Alternative: Railway

1. **Create Project**
   - Sign up at [railway.app](https://railway.app)
   - New Project → Deploy from GitHub

2. **Add PostgreSQL**
   - Add Plugin → PostgreSQL
   - Copy DATABASE_URL from variables

3. **Configure Environment**
   - Settings → Variables
   - Add all production environment variables

4. **Deploy**
   - Connect GitHub repository
   - Automatic deployments on push to main

---

## Post-Deployment Checklist

### 1. Database Verification

```bash
# Check migrations are applied
npx prisma migrate status

# Verify tables exist
npx prisma studio
```

### 2. Stripe Webhook Setup

1. **Create Webhook Endpoint**
   - Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe/webhook`
   - Select events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Copy Webhook Secret**
   - Save as `STRIPE_WEBHOOK_SECRET`
   - Update in Vercel environment variables

3. **Test Webhook**
   ```bash
   stripe trigger customer.subscription.created
   ```

### 3. Garmin OAuth Configuration

1. **Update Callback URL**
   - Garmin Connect Developer Portal
   - Update OAuth callback URL to production domain
   - Save changes

2. **Test OAuth Flow**
   - Visit: `https://your-domain.com/dashboard/settings`
   - Click "Connect Garmin"
   - Complete authorization
   - Verify token storage

### 4. Cron Job Verification

```bash
# Test cleanup cron (requires CRON_SECRET)
curl -X POST "https://your-domain.com/api/cron/cleanup?secret=YOUR_CRON_SECRET"

# Test Garmin sync cron
curl -X POST "https://your-domain.com/api/cron/garmin-sync?secret=YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "timestamp": "...",
  "results": { ... }
}
```

### 5. Security Headers

Verify security headers are set (check browser DevTools → Network):

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HTTPS only)

Add to `next.config.js` if missing:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}
```

### 6. Test Critical Flows

- [ ] User signup and login
- [ ] Stripe subscription (use test mode first)
- [ ] Garmin OAuth connection
- [ ] Manual CSV upload
- [ ] Readiness score calculation
- [ ] AI workout generation
- [ ] Training plan creation
- [ ] Plan adaptation recommendations
- [ ] Notification system
- [ ] Team invite flow (if TEAM tier)

---

## Monitoring & Maintenance

### Application Monitoring

#### Vercel Analytics (Built-in)

- **Dashboard**: Vercel Project → Analytics
- **Metrics**: Page views, unique visitors, top pages
- **Web Vitals**: Core Web Vitals monitoring

#### Error Tracking (Recommended: Sentry)

1. **Install Sentry**
   ```bash
   npm install @sentry/nextjs
   ```

2. **Initialize**
   ```bash
   npx @sentry/wizard -i nextjs
   ```

3. **Configure**
   - Add `SENTRY_DSN` to environment variables
   - Automatic error reporting enabled

### Database Monitoring

#### Connection Pooling

Monitor database connections in Neon/Supabase dashboard:

- Connection count
- Query performance
- Slow queries

#### Query Optimization

```bash
# Check for missing indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

# Analyze query performance
EXPLAIN ANALYZE SELECT ...;
```

### Cron Job Monitoring

Check cron execution logs:

```bash
# Vercel deployment logs
vercel logs --follow

# Filter for cron jobs
vercel logs --filter="cron"
```

### Backup Strategy

#### Database Backups

**Neon**: Automatic daily backups (7-day retention)
**Supabase**: Automatic daily backups (7-day retention on Pro plan)

**Manual Backup**:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Restore**:
```bash
psql $DATABASE_URL < backup_20241115.sql
```

### Scaling Considerations

#### Database

- Monitor connection pool usage
- Add read replicas for read-heavy operations
- Consider caching layer (Redis) for readiness scores

#### API Rate Limiting

Already implemented in `/src/lib/rate-limit.ts`:
- 100 requests per 15 minutes per user
- Redis-based (upgrade from in-memory for production)

#### Cost Optimization

**Anthropic API**:
- Monitor token usage in dashboard
- Cache AI responses where possible
- Set usage alerts

**Stripe**:
- Monitor active subscriptions
- Track payment failures
- Set up dunning management

**Vercel**:
- Monitor bandwidth usage
- Optimize images with Next.js Image component
- Enable ISR for static content

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
Error: P1001: Can't reach database server
```

**Solution**:
- Verify DATABASE_URL format
- Check database server status
- Verify IP whitelist (if applicable)
- Test connection: `psql $DATABASE_URL`

#### 2. Prisma Client Not Generated

```bash
Error: @prisma/client did not initialize yet
```

**Solution**:
```bash
npx prisma generate
vercel --prod --force
```

#### 3. Stripe Webhook Signature Verification Failed

```bash
Error: No signatures found matching the expected signature
```

**Solution**:
- Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard
- Check endpoint URL is correct
- Ensure request body is raw (not parsed)

#### 4. Garmin OAuth Fails

```bash
Error: Invalid OAuth signature
```

**Solution**:
- Verify GARMIN_CONSUMER_KEY and GARMIN_CONSUMER_SECRET
- Check callback URL matches exactly (including protocol)
- Ensure time synchronization on server

#### 5. Cron Jobs Not Running

**Solution**:
- Verify Vercel Pro plan (required for cron)
- Check `vercel.json` syntax
- Verify CRON_SECRET environment variable
- Check Vercel deployment logs

---

## Rollback Procedure

If a deployment causes issues:

1. **Revert to Previous Deployment**
   ```bash
   # Vercel Dashboard → Deployments
   # Click on previous working deployment → Promote to Production
   ```

2. **Rollback Database Migration** (if needed)
   ```bash
   # This is destructive - only if absolutely necessary
   npx prisma migrate resolve --rolled-back <migration-name>
   ```

3. **Verify Services**
   - Test critical user flows
   - Check error logs
   - Monitor for issues

---

## Security Best Practices

- ✅ Never commit `.env*` files
- ✅ Use environment-specific secrets
- ✅ Rotate secrets regularly (quarterly)
- ✅ Enable 2FA on all service accounts
- ✅ Review audit logs weekly
- ✅ Keep dependencies updated
- ✅ Monitor for security advisories
- ✅ Use HTTPS everywhere
- ✅ Implement rate limiting
- ✅ Validate all user inputs
- ✅ Sanitize database queries (Prisma does this)
- ✅ Enable CORS only for your domain

---

## Support

### Documentation

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Stripe Integration](https://stripe.com/docs/webhooks)
- [Garmin OAuth](https://developer.garmin.com/connect-api/docs/auth/)

### Monitoring Dashboards

- **Application**: `https://vercel.com/your-org/your-project`
- **Database**: Neon/Supabase dashboard
- **Payments**: `https://dashboard.stripe.com`
- **Analytics**: `https://vercel.com/your-project/analytics`

---

**Last Updated**: November 2024
**Version**: 1.0.0
