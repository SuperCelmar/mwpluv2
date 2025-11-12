import { supabase } from '../supabase';
import type { Profile, LoginHistory, City } from '../supabase';

/**
 * Get user profile
 * Note: last_sign_in_at should be fetched from auth.getUser() on the client side
 */
export async function getUserProfile(userId: string): Promise<{
  profile: Profile | null;
  error: Error | null;
}> {
  try {
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      return { profile: null, error: profileError };
    }

    return { profile, error: null };
  } catch (error) {
    return {
      profile: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Update user profile fields
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'first_name' | 'last_name' | 'full_name' | 'phone' | 'pseudo' | 'avatar_url'>>
): Promise<{ profile: Profile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (error) {
    return {
      profile: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}


/**
 * Get user statistics
 */
export async function getUserStatistics(userId: string): Promise<{
  projectsCount: number;
  documentsCount: number;
  starredProjectsCount: number;
  conversationsCount: number;
  error: Error | null;
}> {
  try {
    // Count projects
    const { count: projectsCount, error: projectsError } = await supabase
      .from('v2_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (projectsError) {
      return {
        projectsCount: 0,
        documentsCount: 0,
        starredProjectsCount: 0,
        conversationsCount: 0,
        error: projectsError,
      };
    }

    // Count starred projects
    const { count: starredProjectsCount, error: starredError } = await supabase
      .from('v2_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('starred', true);

    if (starredError) {
      return {
        projectsCount: projectsCount || 0,
        documentsCount: 0,
        starredProjectsCount: 0,
        conversationsCount: 0,
        error: starredError,
      };
    }

    // Get user's project IDs first
    const { data: userProjects, error: projectsListError } = await supabase
      .from('v2_projects')
      .select('id')
      .eq('user_id', userId);

    let documentsCount = 0;
    if (userProjects && userProjects.length > 0) {
      const projectIds = userProjects.map(p => p.id);
      const { count, error: docCountError } = await supabase
        .from('v2_project_documents')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds);

      if (!docCountError) {
        documentsCount = count || 0;
      }
    }

    // Count conversations
    const { count: conversationsCount, error: conversationsError } = await supabase
      .from('v2_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    return {
      projectsCount: projectsCount || 0,
      documentsCount: documentsCount,
      starredProjectsCount: starredProjectsCount || 0,
      conversationsCount: conversationsCount || 0,
      error: projectsListError || conversationsError || null,
    };
  } catch (error) {
    return {
      projectsCount: 0,
      documentsCount: 0,
      starredProjectsCount: 0,
      conversationsCount: 0,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get login history for user
 */
export async function getLoginHistory(
  userId: string,
  limit: number = 50
): Promise<{ history: LoginHistory[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { history: [], error };
    }

    return { history: data || [], error: null };
  } catch (error) {
    return {
      history: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Log login attempt to history
 */
export async function logLoginAttempt(
  userId: string,
  data: {
    ip_address?: string;
    user_agent?: string;
    device_type?: string;
    location?: string;
    success: boolean;
    failure_reason?: string;
  }
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('login_history').insert({
      user_id: userId,
      ...data,
    });

    return { error };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get active sessions from Supabase Auth
 */
export async function getActiveSessions(): Promise<{
  sessions: Array<{
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    factor_id: string | null;
    aal: string | null;
    not_after: string | null;
  }>;
  error: Error | null;
}> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { sessions: [], error: sessionError };
    }

    // Get all sessions for the user
    const { data: { sessions }, error: sessionsError } = await supabase.auth.getSessions();

    if (sessionsError) {
      return { sessions: [], error: sessionsError };
    }

    return {
      sessions: sessions || [],
      error: null,
    };
  } catch (error) {
    return {
      sessions: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Export user data as JSON
 */
export async function exportUserData(userId: string): Promise<{
  data: any;
  error: Error | null;
}> {
  try {
    // Fetch all user data
    const [profileResult, projectsResult, conversationsResult, messagesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('v2_projects').select('*').eq('user_id', userId),
      supabase.from('v2_conversations').select('*').eq('user_id', userId),
      (async () => {
        const { data: userConversations } = await supabase
          .from('v2_conversations')
          .select('id')
          .eq('user_id', userId);
        
        if (userConversations && userConversations.length > 0) {
          const conversationIds = userConversations.map(c => c.id);
          const { data } = await supabase
            .from('v2_messages')
            .select('*')
            .in('conversation_id', conversationIds);
          return { data, error: null };
        }
        return { data: [], error: null };
      })(),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profileResult.data,
      projects: projectsResult.data || [],
      conversations: conversationsResult.data || [],
      messages: messagesResult.data || [],
    };

    return { data: exportData, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Request account deletion (sets deletion_requested_at and schedules deletion)
 */
export async function requestAccountDeletion(
  userId: string,
  reason?: string
): Promise<{ error: Error | null }> {
  try {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

    const { error } = await supabase
      .from('profiles')
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_scheduled_for: deletionDate.toISOString(),
        deletion_reason: reason || null,
      })
      .eq('id', userId);

    return { error };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get user analytics from analytics schema
 */
export async function getUserAnalytics(userId: string): Promise<{
  messageCount: number;
  totalCost: number;
  totalTokens: number;
  downloadsCount: number;
  starsCount: number;
  reviewsCount: number;
  commandsCount: number;
  error: Error | null;
}> {
  try {
    // Get current month usage from analytics.user_monthly_usage
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Try to get monthly usage from analytics schema
    // Note: This may require RPC function if schema is not directly accessible
    const { data: monthlyUsage, error: monthlyError } = await supabase
      .from('analytics.user_monthly_usage')
      .select('message_count, cost_total, tokens_total')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .single();

    // If no monthly usage found, try to aggregate from chat_events
    let messageCount = 0;
    let totalCost = 0;
    let totalTokens = 0;

    if (monthlyUsage) {
      messageCount = monthlyUsage.message_count || 0;
      totalCost = Number(monthlyUsage.cost_total) || 0;
      totalTokens = Number(monthlyUsage.tokens_total) || 0;
    } else {
      // Fallback: count from chat_events in analytics schema
      const { count: chatEventsCount, error: chatEventsError } = await supabase
        .from('analytics.chat_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!chatEventsError && chatEventsCount) {
        messageCount = chatEventsCount;
      }

      // Get cost and tokens from chat_events
      const { data: chatEvents, error: chatEventsDataError } = await supabase
        .from('analytics.chat_events')
        .select('cost_total, tokens_total')
        .eq('user_id', userId);

      if (!chatEventsDataError && chatEvents) {
        totalCost = chatEvents.reduce((sum, event) => sum + (Number(event.cost_total) || 0), 0);
        totalTokens = chatEvents.reduce((sum, event) => sum + (Number(event.tokens_total) || 0), 0);
      }
    }

    // Count downloads
    const { count: downloadsCount, error: downloadsError } = await supabase
      .from('downloads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count stars (ratings)
    const { count: starsCount, error: starsError } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count reviews (comments)
    const { count: reviewsCount, error: reviewsError } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count commands (messages from v2_messages where role is 'user')
    const { count: commandsCount, error: commandsError } = await supabase
      .from('v2_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user');

    return {
      messageCount: messageCount || 0,
      totalCost: totalCost || 0,
      totalTokens: totalTokens || 0,
      downloadsCount: downloadsCount || 0,
      starsCount: starsCount || 0,
      reviewsCount: reviewsCount || 0,
      commandsCount: commandsCount || 0,
      error: monthlyError || downloadsError || starsError || reviewsError || commandsError || null,
    };
  } catch (error) {
    return {
      messageCount: 0,
      totalCost: 0,
      totalTokens: 0,
      downloadsCount: 0,
      starsCount: 0,
      reviewsCount: 0,
      commandsCount: 0,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get all cities for dropdown selection
 */
export async function getCities(): Promise<{ cities: City[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { cities: [], error };
    }

    return { cities: data || [], error: null };
  } catch (error) {
    return {
      cities: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

