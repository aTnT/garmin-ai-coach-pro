import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { canAccessAIChat } from '@/lib/subscription-limits';
import { subDays } from 'date-fns';
import { runMultiAgentAnalysis, type AgentState } from '@/lib/agents/multi-agent-system';
import { logAIOperation } from '@/lib/audit-log';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check subscription access for AI chat
    let subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    // Create FREE subscription if none exists
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          tier: 'FREE',
          status: 'ACTIVE',
        },
      });
    }

    const chatCheck = canAccessAIChat(subscription.tier);

    if (!chatCheck.allowed) {
      return NextResponse.json(
        {
          error: 'AI Chat not available',
          message: chatCheck.reason,
          upgradeRequired: chatCheck.upgradeRequired,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { message, conversationId } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: session.user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          title: message.substring(0, 50),
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    });

    // Get user's training context
    const trainingContext = await getUserTrainingContext(session.user.id);

    // Determine which AI mode to use
    // Multi-agent analysis for PREMIUM/TEAM users, simple chat for FREE
    const useMultiAgent = subscription.tier !== 'FREE' || process.env.ENABLE_MULTI_AGENT_FOR_ALL === 'true';

    let assistantMessage: string;

    if (useMultiAgent) {
      // Use multi-agent LangGraph analysis
      try {
        const agentState: AgentState = {
          userId: session.user.id,
          userContext: {
            name: trainingContext.user?.name || 'Athlete',
            age: trainingContext.user?.age || undefined,
            gender: trainingContext.user?.gender || undefined,
            sports: [], // TODO: Add sports from user profile
            goals: trainingContext.activePlans[0]?.goal || undefined,
          },
          metrics: (trainingContext.fullMetrics || []).map(m => ({
            date: m.date,
            type: m.type,
            value: m.value,
            unit: m.unit || undefined,
          })),
          workouts: (trainingContext.fullWorkouts || []).map(w => ({
            date: w.date,
            sport: w.sport,
            type: w.type,
            duration: w.duration || undefined,
            distance: w.distance || undefined,
            completed: w.completed,
          })),
          plans: trainingContext.activePlans.map(p => ({
            name: p.name,
            sport: p.sport,
            goal: p.goal || '',
            status: 'ACTIVE',
          })),
          query: message,
        };

        assistantMessage = await runMultiAgentAnalysis(agentState);

        // Log AI operation for cost tracking
        await logAIOperation({
          userId: session.user.id,
          action: 'AI_CHAT',
          req,
        });
      } catch (error: any) {
        console.error('Multi-agent analysis failed, falling back to simple chat:', error);
        // Fallback to simple chat if multi-agent fails
        assistantMessage = await runSimpleChat(conversation, message, trainingContext);
      }
    } else {
      // Use simple single-agent chat for FREE tier
      assistantMessage = await runSimpleChat(conversation, message, trainingContext);
    }

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: assistantMessage,
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: assistantMessage,
    });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    );
  }
}

async function runSimpleChat(conversation: any, message: string, trainingContext: any): Promise<string> {
  // Build messages for Claude
  const messages = [
    ...conversation.messages.map((msg: any) => ({
      role: msg.role.toLowerCase() as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: message,
    },
  ];

  // Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    system: getCoachingSystemPrompt(trainingContext),
    messages,
  });

  return response.content[0].type === 'text'
    ? response.content[0].text
    : '';
}

async function getUserTrainingContext(userId: string) {
  const [user, recentMetrics, recentWorkouts, activePlans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, age: true, gender: true, weight: true },
    }),
    prisma.metric.findMany({
      where: {
        userId,
        date: { gte: subDays(new Date(), 30) },
      },
      orderBy: { date: 'desc' },
      take: 100,
    }),
    prisma.workout.findMany({
      where: {
        userId,
        date: { gte: subDays(new Date(), 30) },
      },
      orderBy: { date: 'desc' },
      take: 20,
    }),
    prisma.trainingPlan.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      take: 3,
    }),
  ]);

  // Calculate summary stats
  const hrvMetrics = recentMetrics.filter(m => m.type === 'HRV');
  const avgHRV = hrvMetrics.length > 0
    ? hrvMetrics.reduce((sum, m) => sum + m.value, 0) / hrvMetrics.length
    : null;

  const trainingLoadMetrics = recentMetrics.filter(m => m.type === 'TRAINING_LOAD');
  const avgTrainingLoad = trainingLoadMetrics.length > 0
    ? trainingLoadMetrics.reduce((sum, m) => sum + m.value, 0) / trainingLoadMetrics.length
    : null;

  const totalWorkouts = recentWorkouts.length;
  const completedWorkouts = recentWorkouts.filter(w => w.completed).length;

  return {
    user,
    stats: {
      avgHRV,
      avgTrainingLoad,
      totalWorkouts,
      completedWorkouts,
      workoutCompliance: totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0,
    },
    recentWorkouts: recentWorkouts.slice(0, 5).map(w => ({
      date: w.date,
      sport: w.sport,
      type: w.type,
      duration: w.duration,
      completed: w.completed,
    })),
    activePlans: activePlans.map(p => ({
      name: p.name,
      sport: p.sport,
      goal: p.goal,
      weeks: p.weeks,
    })),
    // Full data for multi-agent system
    fullMetrics: recentMetrics,
    fullWorkouts: recentWorkouts,
  };
}

function getCoachingSystemPrompt(context: any) {
  return `You are an expert AI endurance training coach for Garmin AI Coach Pro. Your role is to provide personalized, science-based coaching advice for runners, cyclists, swimmers, and triathletes.

ATHLETE PROFILE:
${context.user?.name ? `Name: ${context.user.name}` : ''}
${context.user?.age ? `Age: ${context.user.age}` : ''}
${context.user?.gender ? `Gender: ${context.user.gender}` : ''}
${context.user?.weight ? `Weight: ${context.user.weight} kg` : ''}

RECENT TRAINING DATA (Last 30 days):
- Average HRV: ${context.stats.avgHRV ? `${context.stats.avgHRV.toFixed(1)} ms` : 'No data'}
- Average Training Load: ${context.stats.avgTrainingLoad ? context.stats.avgTrainingLoad.toFixed(0) : 'No data'}
- Workouts: ${context.stats.totalWorkouts} planned, ${context.stats.completedWorkouts} completed (${context.stats.workoutCompliance.toFixed(0)}% compliance)

${context.activePlans.length > 0 ? `ACTIVE TRAINING PLANS:\n${context.activePlans.map((p: any) => `- ${p.name} (${p.sport}, ${p.weeks} weeks, Goal: ${p.goal || 'Not specified'})`).join('\n')}` : ''}

${context.recentWorkouts.length > 0 ? `RECENT WORKOUTS:\n${context.recentWorkouts.map((w: any) => `- ${w.date.toISOString().split('T')[0]}: ${w.sport} ${w.type} - ${w.duration}min ${w.completed ? '✓' : '✗'}`).join('\n')}` : ''}

COACHING GUIDELINES:
1. **Personalization**: Always reference the athlete's data when giving advice
2. **Science-Based**: Use principles of periodization, progressive overload, and recovery
3. **Practical**: Give actionable, specific recommendations
4. **Encouraging**: Be supportive while being honest about areas for improvement
5. **Context-Aware**: Consider their current training load, HRV trends, and workout compliance

CAPABILITIES YOU CAN HELP WITH:
- Analyzing training trends and readiness
- Explaining workout purposes and training zones
- Adjusting training plans based on life constraints
- Recovery and injury prevention advice
- Race preparation strategies
- Nutrition and hydration guidance for endurance sports
- Motivation and mental strategies

TONE: Professional yet friendly, like a knowledgeable coach who cares about the athlete's success.

Be concise but thorough. Use bullet points for clarity when appropriate.`;
}
