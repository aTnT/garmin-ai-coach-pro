# Email Notification Setup Guide

This guide covers integrating email notifications with the Garmin AI Coach Pro notification system.

## Overview

The application has a complete notification system with database persistence but currently logs emails to console. This guide helps you integrate with an email service provider.

## Current Implementation

Location: `src/lib/notifications/index.ts`

Current TODOs for email integration:
- Line 119: `// TODO: Send email notification for high priority`
- Line 139: `// TODO: Send push notification for urgent alerts`
- Line 196: `// TODO: Send email invitation`
- Line 252: `// TODO: Send celebration email`

## Recommended Email Providers

### Option 1: Resend (Recommended)

**Pros**: Developer-friendly, React Email templates, affordable
**Pricing**: Free tier: 3,000 emails/month, then $20/month for 50,000 emails

#### Setup

1. **Install Resend**
   ```bash
   npm install resend react-email @react-email/components
   ```

2. **Get API Key**
   - Sign up at [resend.com](https://resend.com)
   - Navigate to API Keys
   - Create new API key
   - Add to environment variables:
     ```bash
     RESEND_API_KEY=re_...
     ```

3. **Verify Domain**
   - Resend Dashboard → Domains
   - Add your domain (e.g., `your-domain.com`)
   - Add DNS records (SPF, DKIM)
   - Verify domain

4. **Create Email Service**

   Create `src/lib/email.ts`:

   ```typescript
   import { Resend } from 'resend';

   const resend = new Resend(process.env.RESEND_API_KEY);

   export interface SendEmailParams {
     to: string;
     subject: string;
     html: string;
     text?: string;
   }

   export async function sendEmail(params: SendEmailParams): Promise<void> {
     try {
       await resend.emails.send({
         from: 'Garmin AI Coach <noreply@your-domain.com>',
         to: params.to,
         subject: params.subject,
         html: params.html,
         text: params.text || params.html.replace(/<[^>]*>/g, ''),
       });
       console.log('[Email] Sent:', params.subject, 'to', params.to);
     } catch (error) {
       console.error('[Email] Error sending:', error);
       throw error;
     }
   }
   ```

5. **Create Email Templates**

   Create `src/emails/` directory:

   ```typescript
   // src/emails/adaptation-recommended.tsx
   import {
     Html,
     Head,
     Body,
     Container,
     Section,
     Heading,
     Text,
     Button,
     Hr,
   } from '@react-email/components';

   interface AdaptationEmailProps {
     planName: string;
     reasoning: string;
     urgency: string;
     actionUrl: string;
   }

   export default function AdaptationRecommendedEmail({
     planName,
     reasoning,
     urgency,
     actionUrl,
   }: AdaptationEmailProps) {
     const urgencyColor = urgency === 'critical' || urgency === 'high' ? '#dc2626' : '#ea580c';

     return (
       <Html>
         <Head />
         <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f5' }}>
           <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
             <Section style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '8px' }}>
               <Heading style={{ color: '#18181b', fontSize: '24px', marginBottom: '16px' }}>
                 Training Plan Adaptation Recommended
               </Heading>

               <Text style={{ color: '#71717a', fontSize: '14px', marginBottom: '8px' }}>
                 Plan: <strong>{planName}</strong>
               </Text>

               <Text style={{ color: '#71717a', fontSize: '14px', marginBottom: '16px' }}>
                 Urgency:{' '}
                 <span style={{ color: urgencyColor, fontWeight: '600', textTransform: 'uppercase' }}>
                   {urgency}
                 </span>
               </Text>

               <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0' }} />

               <Text style={{ color: '#18181b', fontSize: '16px', marginBottom: '16px' }}>
                 {reasoning}
               </Text>

               <Button
                 href={actionUrl}
                 style={{
                   backgroundColor: '#3b82f6',
                   color: '#ffffff',
                   padding: '12px 24px',
                   borderRadius: '6px',
                   textDecoration: 'none',
                   display: 'inline-block',
                   fontWeight: '600',
                 }}
               >
                 Review Adaptation
               </Button>

               <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0' }} />

               <Text style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '0' }}>
                 Garmin AI Coach Pro - Personalized Training Intelligence
               </Text>
             </Section>
           </Container>
         </Body>
       </Html>
     );
   }
   ```

6. **Update Notification Functions**

   Update `src/lib/notifications/index.ts`:

   ```typescript
   import { sendEmail } from '@/lib/email';
   import { render } from '@react-email/render';
   import AdaptationRecommendedEmail from '@/emails/adaptation-recommended';
   import CriticalReadinessEmail from '@/emails/critical-readiness';
   import TeamInviteEmail from '@/emails/team-invite';
   import PlanCompletedEmail from '@/emails/plan-completed';

   export async function notifyAdaptationRecommended(params: {
     userId: string;
     planId: string;
     planName: string;
     adaptationId: string;
     urgency: string;
     reasoning: string;
   }): Promise<void> {
     const priority: NotificationPriority =
       params.urgency === 'critical' || params.urgency === 'high' ? 'HIGH' : 'MEDIUM';

     await createNotification({
       userId: params.userId,
       type: 'ADAPTATION_RECOMMENDED',
       priority,
       title: `Training Plan Adaptation Recommended`,
       message: `Your "${params.planName}" plan needs adjustments. ${params.reasoning.substring(0, 100)}...`,
       actionUrl: `/dashboard/plans/${params.planId}?adaptation=${params.adaptationId}`,
       actionLabel: 'Review Changes',
       metadata: {
         planId: params.planId,
         adaptationId: params.adaptationId,
         urgency: params.urgency,
       },
     });

     // Send email for high priority
     if (priority === 'HIGH') {
       const user = await prisma.user.findUnique({
         where: { id: params.userId },
         select: { email: true },
       });

       if (user?.email) {
         const actionUrl = `${process.env.NEXTAUTH_URL}/dashboard/plans/${params.planId}?adaptation=${params.adaptationId}`;

         const html = render(
           <AdaptationRecommendedEmail
             planName={params.planName}
             reasoning={params.reasoning}
             urgency={params.urgency}
             actionUrl={actionUrl}
           />
         );

         await sendEmail({
           to: user.email,
           subject: `⚠️ Training Plan Adaptation Recommended: ${params.planName}`,
           html,
         });
       }
     }
   }
   ```

7. **Test Email Sending**

   Create `scripts/test-email.ts`:

   ```typescript
   import { sendEmail } from '../src/lib/email';
   import { render } from '@react-email/render';
   import AdaptationRecommendedEmail from '../src/emails/adaptation-recommended';

   async function testEmail() {
     const html = render(
       <AdaptationRecommendedEmail
         planName="Marathon Training 2024"
         reasoning="Your readiness has been below 40 for the past 5 days. Consider reducing training load and adding recovery."
         urgency="high"
         actionUrl="https://your-domain.com/dashboard/plans/123"
       />
     );

     await sendEmail({
       to: 'your-email@example.com',
       subject: 'Test: Adaptation Recommended',
       html,
     });

     console.log('Test email sent!');
   }

   testEmail();
   ```

   Run test:
   ```bash
   npx tsx scripts/test-email.ts
   ```

---

### Option 2: SendGrid

**Pros**: Established provider, generous free tier
**Pricing**: Free tier: 100 emails/day, then $19.95/month for 50,000 emails

#### Setup

1. **Install SendGrid**
   ```bash
   npm install @sendgrid/mail
   ```

2. **Get API Key**
   - Sign up at [sendgrid.com](https://sendgrid.com)
   - Settings → API Keys → Create API Key
   - Add to environment variables:
     ```bash
     SENDGRID_API_KEY=SG....
     ```

3. **Verify Sender**
   - Settings → Sender Authentication
   - Verify single sender email OR authenticate domain

4. **Create Email Service**

   ```typescript
   // src/lib/email.ts
   import sgMail from '@sendgrid/mail';

   sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

   export async function sendEmail(params: SendEmailParams): Promise<void> {
     try {
       await sgMail.send({
         from: 'noreply@your-domain.com',
         to: params.to,
         subject: params.subject,
         html: params.html,
         text: params.text,
       });
       console.log('[Email] Sent:', params.subject);
     } catch (error) {
       console.error('[Email] Error:', error);
       throw error;
     }
   }
   ```

---

### Option 3: AWS SES

**Pros**: Lowest cost for high volume, AWS ecosystem integration
**Pricing**: $0.10 per 1,000 emails

#### Setup

1. **Install AWS SDK**
   ```bash
   npm install @aws-sdk/client-ses
   ```

2. **Configure AWS Credentials**
   ```bash
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   ```

3. **Verify Domain/Email**
   - AWS SES Console → Verified Identities
   - Add email or domain
   - Verify via DNS or email

4. **Request Production Access**
   - By default, SES is in sandbox mode
   - Request production access via AWS Support

5. **Create Email Service**

   ```typescript
   // src/lib/email.ts
   import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

   const client = new SESClient({ region: process.env.AWS_REGION });

   export async function sendEmail(params: SendEmailParams): Promise<void> {
     const command = new SendEmailCommand({
       Source: 'noreply@your-domain.com',
       Destination: { ToAddresses: [params.to] },
       Message: {
         Subject: { Data: params.subject },
         Body: {
           Html: { Data: params.html },
           Text: { Data: params.text || '' },
         },
       },
     });

     await client.send(command);
   }
   ```

---

## Email Templates to Create

### 1. Adaptation Recommended
- **When**: Plan adaptation detected
- **Priority**: HIGH for critical/high urgency
- **Content**: Reasoning, urgency level, action button

### 2. Critical Readiness
- **When**: Readiness < 30
- **Priority**: URGENT
- **Content**: Current score, contributing factors, rest recommendations

### 3. Readiness Improved
- **When**: Significant improvement (e.g., 40 → 70+)
- **Priority**: LOW
- **Content**: Previous vs current score, congratulations message

### 4. Team Invite
- **When**: Coach invites athlete
- **Priority**: MEDIUM
- **Content**: Coach name, invitation message, accept/decline buttons

### 5. Workout Reminder
- **When**: 1 hour before scheduled workout
- **Priority**: LOW
- **Content**: Workout name, time, quick view link

### 6. Plan Completed
- **When**: Training plan end date reached
- **Priority**: MEDIUM
- **Content**: Stats (completion rate), celebration message, next steps

### 7. Subscription Updated
- **When**: Subscription created/upgraded/downgraded/cancelled
- **Priority**: MEDIUM
- **Content**: New tier, features, billing info

---

## Email Best Practices

### Design

- **Mobile-first**: 50%+ of emails opened on mobile
- **Clear CTA**: Single, prominent call-to-action button
- **Branding**: Consistent with web app design
- **Accessibility**: Alt text for images, sufficient color contrast

### Content

- **Subject Lines**:
  - Keep under 50 characters
  - Use emojis sparingly (⚠️ for critical, 🎉 for celebration)
  - Be specific: "Training Plan Needs Adjustment" > "Update"

- **Personalization**:
  - Use recipient's name
  - Reference their specific plan/goal
  - Include relevant metrics

- **Tone**:
  - Professional but friendly
  - Encouraging for achievements
  - Supportive for challenges

### Deliverability

- **SPF/DKIM/DMARC**: Configure properly
- **Unsubscribe Link**: Required by law (CAN-SPAM, GDPR)
- **List Hygiene**: Remove bounced emails
- **Engagement**: Monitor open rates, adjust frequency

### User Preferences

Add email preference settings:

```typescript
// src/app/api/user/email-preferences/route.ts
export async function POST(req: Request) {
  const { userId, preferences } = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailPreferences: {
        adaptations: preferences.adaptations ?? true,
        readiness: preferences.readiness ?? true,
        workouts: preferences.workouts ?? true,
        team: preferences.team ?? true,
        marketing: preferences.marketing ?? false,
      },
    },
  });

  return NextResponse.json({ success: true });
}
```

Update notification functions to check preferences before sending:

```typescript
const user = await prisma.user.findUnique({
  where: { id: params.userId },
  select: { email: true, emailPreferences: true },
});

if (user?.email && user.emailPreferences?.adaptations !== false) {
  await sendEmail({ ... });
}
```

---

## Testing

### Development

1. **Use Test Email Services**
   - [Mailtrap](https://mailtrap.io): Email testing sandbox
   - [MailHog](https://github.com/mailhog/MailHog): Local SMTP server

2. **Preview Templates**
   ```bash
   # React Email provides preview server
   npm install -g react-email
   react-email dev
   ```

   Open `http://localhost:3000` to preview all templates

### Production

1. **Start with Test Mode**
   - Use provider's test mode initially
   - Send to your own email
   - Verify formatting across clients (Gmail, Outlook, Apple Mail)

2. **Gradual Rollout**
   - Start with small user segment
   - Monitor bounce rates, spam reports
   - Adjust as needed

---

## Monitoring

### Email Metrics

Track in provider dashboard:
- **Delivery Rate**: Should be >95%
- **Open Rate**: Aim for 15-25%
- **Click Rate**: Aim for 2-5%
- **Bounce Rate**: Keep below 2%
- **Spam Rate**: Keep below 0.1%

### Application Metrics

Log email events:

```typescript
await prisma.emailLog.create({
  data: {
    userId: params.userId,
    type: 'ADAPTATION_RECOMMENDED',
    to: user.email,
    subject: params.subject,
    status: 'sent',
    provider: 'resend',
    messageId: result.id,
  },
});
```

### Webhooks

Set up provider webhooks to track:
- Delivered
- Opened
- Clicked
- Bounced
- Spam complained

Example for Resend:

```typescript
// src/app/api/webhooks/resend/route.ts
export async function POST(req: Request) {
  const event = await req.json();

  switch (event.type) {
    case 'email.delivered':
      await prisma.emailLog.update({
        where: { messageId: event.data.email_id },
        data: { status: 'delivered', deliveredAt: new Date() },
      });
      break;

    case 'email.opened':
      await prisma.emailLog.update({
        where: { messageId: event.data.email_id },
        data: { openedAt: new Date() },
      });
      break;

    // ... handle other events
  }

  return NextResponse.json({ received: true });
}
```

---

## Cost Optimization

### Strategies

1. **Batch Non-Urgent Emails**
   - Daily digest for low-priority notifications
   - Reduces email volume by 50-70%

2. **Smart Frequency**
   - Don't email if user was active recently
   - Respect "quiet hours" (11 PM - 7 AM)

3. **Progressive Engagement**
   - Start with in-app notifications
   - Email only if not acknowledged after X hours

4. **Segment Users**
   - Premium users: More frequent updates
   - Free users: Weekly summaries only

### Implementation

```typescript
// Check if user was recently active
const recentActivity = await prisma.auditLog.findFirst({
  where: {
    userId: params.userId,
    createdAt: { gte: subHours(new Date(), 2) },
  },
});

if (!recentActivity) {
  // User hasn't been active, send email
  await sendEmail({ ... });
}
```

---

## Compliance

### GDPR/CAN-SPAM Requirements

- ✅ Unsubscribe link in every email
- ✅ Physical address in footer
- ✅ Clear sender identity
- ✅ Accurate subject lines
- ✅ Honor unsubscribe requests within 10 days
- ✅ Get consent before sending marketing emails

### Unsubscribe Implementation

```typescript
// src/app/api/email/unsubscribe/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token'); // Signed token with userId

  const userId = verifyUnsubscribeToken(token);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailPreferences: {
        adaptations: false,
        readiness: false,
        workouts: false,
        team: false,
        marketing: false,
      },
    },
  });

  return new Response('You have been unsubscribed from all emails.', {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

Add unsubscribe link to all emails:

```typescript
<Text style={{ fontSize: '12px', color: '#a1a1aa' }}>
  Don't want these emails?{' '}
  <a href={unsubscribeUrl} style={{ color: '#71717a' }}>
    Unsubscribe
  </a>
</Text>
```

---

**Last Updated**: November 2024
**Next**: Implement email templates and test with real data
