

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


COMMENT ON SCHEMA "analytics" IS 'Dedicated schema for AI chat analytics, token tracking, and usage metrics. Separate from core application tables for better organization and performance.';



CREATE SCHEMA IF NOT EXISTS "api";


ALTER SCHEMA "api" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."profession" AS ENUM (
    'Urbaniste',
    'Aménageur foncier',
    'Géomètre-expert',
    'Agent des services d’urbanisme',
    'Architecte',
    'Maître d’ouvrage',
    'Bureau d’études techniques',
    'Entrepreneur du BTP',
    'Promoteur immobilier',
    'Agent immobilier',
    'Gestionnaire de patrimoine immobilier',
    'Juriste',
    'Notaire',
    'Avocat',
    'Maire et élus locaux',
    'Technicien des services urbanisme',
    'Paysagiste',
    'Expert en environnement',
    'Agriculteur',
    'Artisan',
    'Autre'
);


ALTER TYPE "public"."profession" OWNER TO "postgres";


COMMENT ON TYPE "public"."profession" IS 'Les Plans Locaux d’Urbanisme (PLU) sont des documents essentiels pour de nombreuses professions.';



CREATE OR REPLACE FUNCTION "analytics"."refresh_all_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  refresh materialized view concurrently analytics.mv_user_monthly_summary;
  refresh materialized view concurrently analytics.mv_document_popularity;
end;
$$;


ALTER FUNCTION "analytics"."refresh_all_views"() OWNER TO "postgres";


COMMENT ON FUNCTION "analytics"."refresh_all_views"() IS 'Refresh all materialized views. Schedule via pg_cron or external job.';



CREATE OR REPLACE FUNCTION "analytics"."update_daily_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_date date;
begin
  v_date := date(new.created_at at time zone 'UTC');
  insert into analytics.user_daily_usage (
    user_id, date,
    message_count, tokens_total, cost_total,
    tokens_cached, cache_hit_count, error_count
  )
  values (
    new.user_id, v_date,
    1, new.tokens_total, new.cost_total,
    coalesce(new.tokens_cached, 0),
    case when new.cache_hit then 1 else 0 end,
    case when new.error_occurred then 1 else 0 end
  )
  on conflict (user_id, date)
  do update set
    message_count = analytics.user_daily_usage.message_count + 1,
    tokens_total = analytics.user_daily_usage.tokens_total + excluded.tokens_total,
    cost_total = analytics.user_daily_usage.cost_total + excluded.cost_total,
    tokens_cached = analytics.user_daily_usage.tokens_cached + excluded.tokens_cached,
    cache_hit_count = analytics.user_daily_usage.cache_hit_count + excluded.cache_hit_count,
    error_count = analytics.user_daily_usage.error_count + excluded.error_count,
    updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "analytics"."update_daily_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "analytics"."update_document_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_date DATE;
BEGIN
  -- Only process if document_id exists
  IF NEW.document_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_date := DATE(NEW.created_at);
  
  -- Upsert document usage for this date
  INSERT INTO analytics.document_usage (
    document_id,
    date,
    query_count,
    unique_users,
    conversation_count,
    tokens_total,
    cost_total,
    error_count,
    feedback_count
  )
  VALUES (
    NEW.document_id,
    v_date,
    1, -- query_count
    1, -- unique_users (will be fixed by refresh)
    CASE WHEN NEW.conversation_id IS NOT NULL THEN 1 ELSE 0 END,
    NEW.tokens_total,
    NEW.cost_total,
    CASE WHEN NEW.error_occurred THEN 1 ELSE 0 END,
    CASE WHEN NEW.user_feedback_rating IS NOT NULL THEN 1 ELSE 0 END
  )
  ON CONFLICT (document_id, date)
  DO UPDATE SET
    query_count = document_usage.query_count + 1,
    tokens_total = document_usage.tokens_total + EXCLUDED.tokens_total,
    cost_total = document_usage.cost_total + EXCLUDED.cost_total,
    error_count = document_usage.error_count + EXCLUDED.error_count,
    feedback_count = CASE 
      WHEN NEW.user_feedback_rating IS NOT NULL 
      THEN document_usage.feedback_count + 1 
      ELSE document_usage.feedback_count 
    END,
    avg_tokens_per_query = (document_usage.tokens_total + EXCLUDED.tokens_total) / 
                           (document_usage.query_count + 1),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "analytics"."update_document_usage"() OWNER TO "postgres";


COMMENT ON FUNCTION "analytics"."update_document_usage"() IS 'Updates document_usage table in real-time when chat events are logged. Tracks daily document analytics.';



CREATE OR REPLACE FUNCTION "analytics"."update_monthly_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_year integer;
  v_month integer;
begin
  v_year := extract(year from (new.created_at at time zone 'UTC'))::integer;
  v_month := extract(month from (new.created_at at time zone 'UTC'))::integer;
  insert into analytics.user_monthly_usage (
    user_id, year, month,
    message_count, tokens_total, cost_total, tokens_cached, error_count
  )
  values (
    new.user_id, v_year, v_month,
    1, new.tokens_total, new.cost_total, coalesce(new.tokens_cached, 0),
    case when new.error_occurred then 1 else 0 end
  )
  on conflict (user_id, year, month)
  do update set
    message_count = analytics.user_monthly_usage.message_count + 1,
    tokens_total = analytics.user_monthly_usage.tokens_total + excluded.tokens_total,
    cost_total = analytics.user_monthly_usage.cost_total + excluded.cost_total,
    tokens_cached = analytics.user_monthly_usage.tokens_cached + excluded.tokens_cached,
    error_count = analytics.user_monthly_usage.error_count + excluded.error_count,
    cache_hit_rate = round(
      nullif(analytics.user_monthly_usage.tokens_cached + excluded.tokens_cached,0)::numeric /
      nullif(analytics.user_monthly_usage.tokens_total + excluded.tokens_total,0) * 100,
      2
    ),
    updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "analytics"."update_monthly_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_account_deletion"("user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    -- Clear deletion information
    UPDATE profiles 
    SET 
        deletion_requested_at = NULL,
        deletion_scheduled_for = NULL,
        deletion_reason = NULL
    WHERE id = user_id;
    
    result := json_build_object(
        'deletion_cancelled', true,
        'cancelled_at', NOW()
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."cancel_account_deletion"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_account_deletion"("user_id" "uuid") IS 'Cancels a scheduled account deletion';



CREATE OR REPLACE FUNCTION "public"."chat_assistant_set_turn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_turn int;
  v_user_created_at timestamptz;
begin
  if new.role = 'assistant' then
    if new.reply_to_message_id is null then
      return new;
    end if;
    select conversation_turn, created_at into v_user_turn, v_user_created_at
    from public.chat_messages
    where id = new.reply_to_message_id;

    if v_user_turn is not null then
      new.conversation_turn := v_user_turn;
    else
      -- fallback: count user messages up to the user message's created_at
      select count(*) into v_user_turn
      from public.chat_messages m
      where m.conversation_id = new.conversation_id
        and m.role = 'user'
        and m.created_at <= v_user_created_at;
      new.conversation_turn := v_user_turn;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."chat_assistant_set_turn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_finalize_turn"("p_conversation_id" "uuid", "p_user_id" "uuid", "p_document_id" "uuid", "p_user_message_id" "uuid", "p_ai_text" "text", "p_model_name" "text", "p_model_provider" "text", "p_model_version" "text", "p_tokens_prompt" integer, "p_tokens_completion" integer, "p_tokens_cached" integer, "p_cost_prompt" numeric, "p_cost_completion" numeric, "p_cost_cached" numeric, "p_response_time_ms" integer, "p_execution_id" "text", "p_extra_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("assistant_message_id" "uuid", "conversation_turn" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_turn int;
  v_assistant_id uuid;
BEGIN
  v_turn := public.compute_conversation_turn(p_conversation_id, p_user_message_id);

  INSERT INTO public.chat_messages(
    conversation_id, user_id, document_id,
    role, message, metadata, conversation_turn, reply_to_message_id
  )
  VALUES (
    p_conversation_id, p_user_id, p_document_id,
    'assistant', p_ai_text,
    COALESCE(p_extra_metadata, '{}'::jsonb) || jsonb_build_object(
      'model_name', p_model_name,
      'model_provider', p_model_provider,
      'model_version', p_model_version,
      'response_time_ms', p_response_time_ms,
      'reply_to_message_id', p_user_message_id
    ),
    v_turn,
    p_user_message_id
  )
  RETURNING id INTO v_assistant_id;

  UPDATE public.chat_conversations
    SET last_message_at = NOW()
    WHERE id = p_conversation_id;

  INSERT INTO analytics.chat_events(
    conversation_id, message_id, document_id, user_id,
    model_name, model_version, model_provider,
    tokens_prompt, tokens_completion, tokens_cached,
    cost_prompt, cost_completion, cost_cached,
    response_time_ms, cache_hit,
    user_query_length, ai_response_length,
    metadata
  )
  VALUES (
    p_conversation_id, v_assistant_id, p_document_id, p_user_id,
    COALESCE(p_model_name, 'gemini-2.0-flash-exp'), p_model_version, p_model_provider,
    COALESCE(p_tokens_prompt, 0), COALESCE(p_tokens_completion, 0), COALESCE(p_tokens_cached, 0),
    COALESCE(p_cost_prompt, 0), COALESCE(p_cost_completion, 0), COALESCE(p_cost_cached, 0),
    p_response_time_ms, COALESCE(p_tokens_cached, 0) > 0,
    NULL, char_length(COALESCE(p_ai_text, '')),
    jsonb_build_object(
      'n8n_execution_id', p_execution_id,
      'user_message_id', p_user_message_id,
      'conversation_turn', v_turn
    )
  );

  RETURN QUERY SELECT v_assistant_id, v_turn;
END$$;


ALTER FUNCTION "public"."chat_finalize_turn"("p_conversation_id" "uuid", "p_user_id" "uuid", "p_document_id" "uuid", "p_user_message_id" "uuid", "p_ai_text" "text", "p_model_name" "text", "p_model_provider" "text", "p_model_version" "text", "p_tokens_prompt" integer, "p_tokens_completion" integer, "p_tokens_cached" integer, "p_cost_prompt" numeric, "p_cost_completion" numeric, "p_cost_cached" numeric, "p_response_time_ms" integer, "p_execution_id" "text", "p_extra_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_user_set_turn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.role = 'user' then
    select coalesce((
      select count(*)
      from public.chat_messages m
      where m.conversation_id = new.conversation_id
        and m.role = 'user'
        and m.created_at < new.created_at
    ), 0) + 1 into new.conversation_turn;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."chat_user_set_turn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_accounts"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    expired_users UUID[];
    deleted_count INTEGER := 0;
    result JSON;
BEGIN
    -- Find users whose deletion time has passed
    SELECT ARRAY_AGG(id) INTO expired_users
    FROM profiles 
    WHERE deletion_scheduled_for IS NOT NULL 
    AND deletion_scheduled_for <= NOW();
    
    IF expired_users IS NOT NULL THEN
        -- Delete expired users from auth.users (this will cascade to profiles)
        DELETE FROM auth.users 
        WHERE id = ANY(expired_users);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
    END IF;
    
    result := json_build_object(
        'deleted_accounts', deleted_count,
        'deleted_user_ids', expired_users,
        'cleanup_time', NOW()
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_comments"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER := 0;
    result JSON;
BEGIN
    -- Delete expired comments
    DELETE FROM deleted_comments 
    WHERE permanent_deletion_scheduled_for <= NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    result := json_build_object(
        'deleted_comments', deleted_count,
        'cleanup_time', NOW()
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_deletions"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_accounts INTEGER := 0;
    deleted_comments INTEGER := 0;
    account_record RECORD;
    result JSON;
BEGIN
    -- Delete expired accounts
    FOR account_record IN 
        SELECT id 
        FROM profiles 
        WHERE deletion_scheduled_for IS NOT NULL 
        AND deletion_scheduled_for <= NOW()
    LOOP
        -- Delete user account (this will cascade to related data)
        DELETE FROM auth.users WHERE id = account_record.id;
        deleted_accounts := deleted_accounts + 1;
    END LOOP;
    
    -- Delete expired comments
    DELETE FROM deleted_comments 
    WHERE permanent_deletion_scheduled_for <= NOW();
    
    GET DIAGNOSTICS deleted_comments = ROW_COUNT;
    
    result := json_build_object(
        'success', true,
        'deleted_accounts', deleted_accounts,
        'deleted_comments', deleted_comments,
        'cleanup_date', NOW()
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_deletions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_deletions"() IS 'Permanently deletes expired accounts and comments';



CREATE OR REPLACE FUNCTION "public"."compute_conversation_turn"("p_conversation_id" "uuid", "p_user_message_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_turn integer;
BEGIN
  SELECT COUNT(*) INTO v_turn
  FROM public.chat_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.role = 'user'
    AND m.created_at <= (SELECT created_at FROM public.chat_messages WHERE id = p_user_message_id);

  IF v_turn IS NULL OR v_turn < 1 THEN
    RAISE EXCEPTION 'Could not compute turn (missing user message or conversation mismatch)';
  END IF;

  RETURN v_turn;
END$$;


ALTER FUNCTION "public"."compute_conversation_turn"("p_conversation_id" "uuid", "p_user_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile_for_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_full text;
  v_first text;
  v_last text;
  v_phone text;
  v_avatar text;
begin
  v_full := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  -- last name = last token, first name = full name without last token (or null if not present)
  if v_full is not null then
    v_last := regexp_replace(v_full, '.*\s+', '');
    v_first := nullif(regexp_replace(v_full, '\s+[^\s]+$', ''), '');
  end if;
  v_phone := coalesce(new.raw_user_meta_data->>'phone', new.phone);
  v_avatar := new.raw_user_meta_data->>'avatar_url';

  insert into public.profiles (id, email, phone, first_name, last_name, avatar_url, created_at, updated_at)
  values (
    new.id,
    new.email,
    v_phone,
    v_first,
    v_last,
    v_avatar,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$_$;


ALTER FUNCTION "public"."create_profile_for_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_comment_dual_table"("comment_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_user_id UUID;
    comment_exists BOOLEAN;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User must be authenticated');
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM comments 
        WHERE id = comment_id AND user_id = current_user_id
    ) INTO comment_exists;
    
    IF NOT comment_exists THEN
        RETURN json_build_object('success', false, 'error', 'Comment not found or access denied');
    END IF;
    
    -- Update the comments_deleted table to mark as deleted
    UPDATE comments_deleted 
    SET deleted_status = TRUE, deleted_at = NOW(), updated_at = NOW()
    WHERE id = comment_id;
    
    -- Delete from main comments table
    DELETE FROM comments WHERE id = comment_id;
    
    RETURN json_build_object('success', true, 'message', 'Comment deleted successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."delete_comment_dual_table"("comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Function logic here
END;
$$;


ALTER FUNCTION "public"."delete_user_account"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_account"() IS 'Deletes an account. Make sure that only the user himself has access to this functionnality to detele his own account.';



CREATE OR REPLACE FUNCTION "public"."delete_user_account"("user_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
    -- Function logic to delete user account
    DELETE FROM auth.users WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"("user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_download_limit_dynamic"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  used_count integer;
  allowed integer;
begin
  -- Admin bypass
  if exists (select 1 from public.profiles where id = new.user_id and is_admin = true) then
    return new;
  end if;

  select count(*) into used_count from public.downloads where user_id = new.user_id;
  select public.get_allowed_downloads(new.user_id) into allowed;
  if used_count >= allowed then
    raise exception 'DOWNLOAD_LIMIT_REACHED';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_download_limit_dynamic"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_free_download_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  download_count integer;
begin
  select count(*) into download_count
  from public.downloads
  where user_id = new.user_id;

  if download_count >= 5 then
    raise exception 'FREE_DOWNLOAD_LIMIT_REACHED';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_free_download_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_deletion_status"("user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    profile_record RECORD;
    result JSON;
BEGIN
    -- Get profile information
    SELECT deletion_requested_at, deletion_scheduled_for, deletion_reason
    INTO profile_record
    FROM profiles 
    WHERE id = user_id;
    
    IF profile_record.deletion_scheduled_for IS NOT NULL THEN
        result := json_build_object(
            'deletion_scheduled', true,
            'deletion_requested_at', profile_record.deletion_requested_at,
            'deletion_scheduled_for', profile_record.deletion_scheduled_for,
            'deletion_reason', profile_record.deletion_reason,
            'time_remaining_seconds', EXTRACT(EPOCH FROM (profile_record.deletion_scheduled_for - NOW()))
        );
    ELSE
        result := json_build_object(
            'deletion_scheduled', false
        );
    END IF;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_account_deletion_status"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_account_deletion_status"("user_id" "uuid") IS 'Gets the deletion status of an account';



CREATE OR REPLACE FUNCTION "public"."get_allowed_downloads"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  select case
    when exists (
      select 1 from public.profiles where id = p_user_id and is_admin = true
    ) then 2147483647
    else coalesce((select free_quota + paid_credits from public.user_download_limits where user_id = p_user_id), 5)
  end;
$$;


ALTER FUNCTION "public"."get_allowed_downloads"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_profile_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_roles"("p_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_has boolean := false;
begin
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and (u.raw_user_meta_data->>'role') = any (p_roles)
  ) into v_has;
  return coalesce(v_has, false);
end;
$$;


ALTER FUNCTION "public"."has_any_roles"("p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_comment_to_deleted_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO comments_deleted (
        id, document_id, user_id, content, created_at, updated_at, deleted_status, deleted_at
    ) VALUES (
        NEW.id, NEW.document_id, NEW.user_id, NEW.content, NEW.created_at, NEW.updated_at, FALSE, NULL
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."insert_comment_to_deleted_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_user_v1_to_v2"("p_user_id" "uuid") RETURNS TABLE("migrated_count" integer, "failed_count" integer, "skipped_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_conv RECORD;
  v_migrated INTEGER := 0;
  v_failed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_result RECORD;
BEGIN
  -- Loop through all active v1 conversations for this user
  FOR v_conv IN 
    SELECT id FROM chat_conversations
    WHERE user_id = p_user_id
    AND is_active = true
    ORDER BY created_at
  LOOP
    BEGIN
      -- Check if already migrated
      IF EXISTS (
        SELECT 1 FROM migration_tracking 
        WHERE v1_conversation_id = v_conv.id
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Attempt migration
      SELECT * INTO v_result 
      FROM migrate_v1_conversation_to_v2(v_conv.id);
      
      v_migrated := v_migrated + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      -- Error already logged in migration_tracking by the function
      CONTINUE;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_failed, v_skipped;
END;
$$;


ALTER FUNCTION "public"."migrate_user_v1_to_v2"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_user_v1_to_v2"("p_user_id" "uuid") IS 'Batch migrates all active v1 conversations for a user. Returns counts of migrated, failed, and skipped conversations.';



CREATE OR REPLACE FUNCTION "public"."migrate_v1_conversation_to_v2"("p_v1_conversation_id" "uuid") RETURNS TABLE("project_id" "uuid", "conversation_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_project_id UUID;
  v_conversation_id UUID;
  v1_conv RECORD;
  v_user_id UUID;
BEGIN
  -- Fetch v1 conversation
  SELECT * INTO v1_conv 
  FROM chat_conversations 
  WHERE id = p_v1_conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'V1 conversation % not found', p_v1_conversation_id;
  END IF;
  
  v_user_id := v1_conv.user_id;
  
  -- Check if already migrated
  IF EXISTS (
    SELECT 1 FROM migration_tracking 
    WHERE v1_conversation_id = p_v1_conversation_id
  ) THEN
    RAISE EXCEPTION 'V1 conversation % has already been migrated', p_v1_conversation_id;
  END IF;
  
  BEGIN
    -- Create v2_project (draft, unnamed)
    INSERT INTO v2_projects (
      user_id, 
      status, 
      name,
      metadata
    )
    VALUES (
      v_user_id, 
      'draft',
      NULL, -- unnamed
      jsonb_build_object('migrated_from_v1', true, 'v1_conversation_id', p_v1_conversation_id)
    )
    RETURNING id INTO v_project_id;
    
    -- Create v2_conversation linked to project
    INSERT INTO v2_conversations (
      user_id,
      project_id,
      conversation_type,
      is_active,
      last_message_at,
      created_at,
      updated_at,
      context_metadata
    )
    VALUES (
      v_user_id,
      v_project_id,
      'address_analysis',
      v1_conv.is_active,
      v1_conv.last_message_at,
      v1_conv.created_at,
      COALESCE(v1_conv.last_message_at, v1_conv.created_at),
      jsonb_build_object('migrated_from_v1', true)
    )
    RETURNING id INTO v_conversation_id;
    
    -- Link document if exists
    IF v1_conv.document_id IS NOT NULL THEN
      INSERT INTO v2_conversation_documents (
        conversation_id,
        document_id,
        added_by,
        relevance_score,
        added_at
      )
      VALUES (
        v_conversation_id,
        v1_conv.document_id,
        'migration',
        1.0,
        v1_conv.created_at
      )
      ON CONFLICT (conversation_id, document_id) DO NOTHING;
    END IF;
    
    -- Migrate messages
    INSERT INTO v2_messages (
      conversation_id,
      user_id,
      role,
      message,
      referenced_documents,
      conversation_turn,
      reply_to_message_id,
      metadata,
      created_at
    )
    SELECT
      v_conversation_id,
      cm.user_id,
      cm.role::text, -- v1 and v2 both use TEXT with CHECK constraint
      cm.message,
      CASE 
        WHEN cm.document_id IS NOT NULL 
        THEN ARRAY[cm.document_id]::UUID[]
        ELSE ARRAY[]::UUID[]
      END,
      cm.conversation_turn,
      cm.reply_to_message_id,
      jsonb_build_object('migrated_from_v1', true) || COALESCE(cm.metadata, '{}'::jsonb),
      cm.created_at
    FROM chat_messages cm
    WHERE cm.conversation_id = p_v1_conversation_id
    ORDER BY cm.created_at;
    
    -- Update conversation message count
    UPDATE v2_conversations
    SET message_count = (
      SELECT COUNT(*) FROM v2_messages 
      WHERE conversation_id = v_conversation_id
    )
    WHERE id = v_conversation_id;
    
    -- Track migration
    INSERT INTO migration_tracking (
      v1_conversation_id,
      v2_conversation_id,
      v2_project_id,
      migration_status
    )
    VALUES (
      p_v1_conversation_id,
      v_conversation_id,
      v_project_id,
      'completed'
    );
    
    RETURN QUERY SELECT v_project_id, v_conversation_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log failed migration
    INSERT INTO migration_tracking (
      v1_conversation_id,
      v2_project_id,
      v2_conversation_id,
      migration_status,
      error_message
    )
    VALUES (
      p_v1_conversation_id,
      v_project_id,
      v_conversation_id,
      'failed',
      SQLERRM
    )
    ON CONFLICT (v1_conversation_id) 
    DO UPDATE SET 
      migration_status = 'failed',
      error_message = SQLERRM;
    
    RAISE;
  END;
END;
$$;


ALTER FUNCTION "public"."migrate_v1_conversation_to_v2"("p_v1_conversation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_v1_conversation_to_v2"("p_v1_conversation_id" "uuid") IS 'Migrates a single v1 conversation to v2: creates project, conversation, migrates messages and links documents. Returns project_id and conversation_id.';



CREATE OR REPLACE FUNCTION "public"."restore_comment_from_deleted"("comment_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_user_id UUID;
    deleted_comment RECORD;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User must be authenticated');
    END IF;
    
    SELECT * FROM comments_deleted 
    WHERE id = comment_id AND user_id = current_user_id AND deleted_status = TRUE
    INTO deleted_comment;
    
    IF deleted_comment IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Deleted comment not found or access denied');
    END IF;
    
    -- Restore to main comments table
    INSERT INTO comments (id, document_id, user_id, content, created_at, updated_at)
    VALUES (deleted_comment.id, deleted_comment.document_id, deleted_comment.user_id, 
            deleted_comment.content, deleted_comment.created_at, NOW());
    
    -- Update deleted table to mark as not deleted
    UPDATE comments_deleted 
    SET deleted_status = FALSE, deleted_at = NULL, updated_at = NOW()
    WHERE id = comment_id;
    
    RETURN json_build_object('success', true, 'message', 'Comment restored successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."restore_comment_from_deleted"("comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_account_deletion"("user_id" "uuid", "reason" "text" DEFAULT 'User requested account deletion'::"text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deletion_date TIMESTAMPTZ;
    result JSON;
BEGIN
    -- Calculate deletion date (30 seconds for testing, change to 30 days for production)
    deletion_date := NOW() + INTERVAL '30 seconds';
    
    -- Update the profile with deletion information
    UPDATE profiles 
    SET 
        deletion_requested_at = NOW(),
        deletion_scheduled_for = deletion_date,
        deletion_reason = reason
    WHERE id = user_id;
    
    -- Check if update was successful
    IF NOT FOUND THEN
        -- Create profile if it doesn't exist
        INSERT INTO profiles (id, deletion_requested_at, deletion_scheduled_for, deletion_reason)
        VALUES (user_id, NOW(), deletion_date, reason);
    END IF;
    
    result := json_build_object(
        'deletion_scheduled', true,
        'deletion_requested_at', NOW(),
        'deletion_scheduled_for', deletion_date,
        'deletion_reason', reason
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."schedule_account_deletion"("user_id" "uuid", "reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."schedule_account_deletion"("user_id" "uuid", "reason" "text") IS 'Schedules an account for deletion in 30 days';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_comment"("comment_id" "uuid", "user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    comment_record RECORD;
    result JSON;
BEGIN
    -- Get the comment to be deleted
    SELECT id, document_id, user_id as comment_user_id, content, created_at
    INTO comment_record
    FROM comments 
    WHERE id = comment_id AND user_id = soft_delete_comment.user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
    END IF;
    
    -- Move comment to deleted_comments table
    INSERT INTO deleted_comments (
        original_comment_id,
        document_id,
        user_id,
        content,
        original_created_at,
        permanent_deletion_scheduled_for
    ) VALUES (
        comment_record.id,
        comment_record.document_id,
        comment_record.comment_user_id,
        comment_record.content,
        comment_record.created_at,
        NOW() + INTERVAL '30 days'
    );
    
    -- Delete the original comment
    DELETE FROM comments WHERE id = comment_id;
    
    result := json_build_object(
        'success', true,
        'deleted_at', NOW(),
        'permanent_deletion_scheduled_for', NOW() + INTERVAL '30 days'
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."soft_delete_comment"("comment_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_comment"("comment_id" "uuid", "user_id" "uuid") IS 'Soft deletes a comment with 30-day recovery period';



CREATE OR REPLACE FUNCTION "public"."sync_profile_from_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_full text;
  v_first text;
  v_last text;
  v_phone text;
  v_avatar text;
begin
  v_full := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  if v_full is not null then
    v_last := regexp_replace(v_full, '.*\s+', '');
    v_first := nullif(regexp_replace(v_full, '\s+[^\s]+$', ''), '');
  else
    v_first := null;
    v_last := null;
  end if;
  v_phone := coalesce(new.raw_user_meta_data->>'phone', new.phone);
  v_avatar := new.raw_user_meta_data->>'avatar_url';

  update public.profiles p
     set email = new.email,
         phone = v_phone,
         first_name = v_first,
         last_name = v_last,
         avatar_url = v_avatar,
         updated_at = now()
   where p.id = new.id;

  return new;
end;
$_$;


ALTER FUNCTION "public"."sync_profile_from_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "analytics"."chat_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "document_id" "uuid",
    "user_id" "uuid",
    "model_name" "text" DEFAULT 'gemini-2.0-flash-exp'::"text" NOT NULL,
    "model_version" "text",
    "model_provider" "text" DEFAULT 'google'::"text",
    "tokens_prompt" integer DEFAULT 0 NOT NULL,
    "tokens_completion" integer DEFAULT 0 NOT NULL,
    "tokens_cached" integer DEFAULT 0,
    "tokens_total" integer GENERATED ALWAYS AS (("tokens_prompt" + "tokens_completion")) STORED,
    "cost_prompt" numeric(10,6) DEFAULT 0 NOT NULL,
    "cost_completion" numeric(10,6) DEFAULT 0 NOT NULL,
    "cost_cached" numeric(10,6) DEFAULT 0,
    "cost_total" numeric(10,6) GENERATED ALWAYS AS ((("cost_prompt" + "cost_completion") + COALESCE("cost_cached", (0)::numeric))) STORED,
    "response_time_ms" integer,
    "cache_hit" boolean DEFAULT false,
    "user_query_length" integer,
    "ai_response_length" integer,
    "user_feedback_rating" integer,
    "user_feedback_text" "text",
    "user_feedback_at" timestamp with time zone,
    "error_occurred" boolean DEFAULT false,
    "error_message" "text",
    "error_code" "text",
    "query_intent" "text",
    "sections_referenced" "text"[],
    "intermediate_steps" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_events_cost_cached_check" CHECK (("cost_cached" >= (0)::numeric)),
    CONSTRAINT "chat_events_cost_completion_check" CHECK (("cost_completion" >= (0)::numeric)),
    CONSTRAINT "chat_events_cost_prompt_check" CHECK (("cost_prompt" >= (0)::numeric)),
    CONSTRAINT "chat_events_response_time_ms_check" CHECK (("response_time_ms" >= 0)),
    CONSTRAINT "chat_events_tokens_cached_check" CHECK (("tokens_cached" >= 0)),
    CONSTRAINT "chat_events_tokens_completion_check" CHECK (("tokens_completion" >= 0)),
    CONSTRAINT "chat_events_tokens_prompt_check" CHECK (("tokens_prompt" >= 0)),
    CONSTRAINT "chat_events_user_feedback_rating_check" CHECK ((("user_feedback_rating" >= 1) AND ("user_feedback_rating" <= 5)))
);


ALTER TABLE "analytics"."chat_events" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."chat_events" IS 'Raw event log for every AI chat interaction. Source of truth for all analytics aggregations.';



CREATE TABLE IF NOT EXISTS "analytics"."document_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "query_count" integer DEFAULT 0,
    "unique_users" integer DEFAULT 0,
    "conversation_count" integer DEFAULT 0,
    "tokens_total" bigint DEFAULT 0,
    "avg_tokens_per_query" integer,
    "cost_total" numeric(10,4) DEFAULT 0,
    "avg_response_time_ms" integer,
    "cache_hit_rate" numeric(5,2),
    "avg_feedback_rating" numeric(3,2),
    "feedback_count" integer DEFAULT 0,
    "error_count" integer DEFAULT 0,
    "top_sections" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."document_usage" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."document_usage" IS 'Daily aggregated analytics per document. Shows which documents are most used and costly.';



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "zoning_id" "uuid",
    "zone_id" "uuid",
    "typology_id" "uuid",
    "content_json" "jsonb",
    "html_content" "text",
    "pdf_storage_path" "text",
    "source_plu_date" character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "source_plu_url" "text"
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."documents" IS 'Shared table: PLU documents available in the system';



CREATE MATERIALIZED VIEW "analytics"."mv_document_popularity" AS
 SELECT "ce"."document_id",
    (("d"."content_json" -> 'metadata'::"text") ->> 'name_city'::"text") AS "city",
    (("d"."content_json" -> 'metadata'::"text") ->> 'name_zoning'::"text") AS "zoning",
    (("d"."content_json" -> 'metadata'::"text") ->> 'name_zone'::"text") AS "zone",
    "count"(*) FILTER (WHERE ("ce"."created_at" >= ("now"() - '7 days'::interval))) AS "queries_7d",
    "count"(DISTINCT "ce"."user_id") FILTER (WHERE ("ce"."created_at" >= ("now"() - '7 days'::interval))) AS "users_7d",
    "sum"("ce"."cost_total") FILTER (WHERE ("ce"."created_at" >= ("now"() - '7 days'::interval))) AS "cost_7d",
    "count"(*) FILTER (WHERE ("ce"."created_at" >= ("now"() - '30 days'::interval))) AS "queries_30d",
    "count"(DISTINCT "ce"."user_id") FILTER (WHERE ("ce"."created_at" >= ("now"() - '30 days'::interval))) AS "users_30d",
    "sum"("ce"."cost_total") FILTER (WHERE ("ce"."created_at" >= ("now"() - '30 days'::interval))) AS "cost_30d",
    "count"(*) AS "queries_total",
    "count"(DISTINCT "ce"."user_id") AS "users_total",
    "sum"("ce"."cost_total") AS "cost_total",
    "avg"("ce"."user_feedback_rating") AS "avg_rating",
    ("avg"("ce"."response_time_ms"))::integer AS "avg_response_time_ms",
    "max"("ce"."created_at") AS "last_accessed_at"
   FROM ("analytics"."chat_events" "ce"
     JOIN "public"."documents" "d" ON (("d"."id" = "ce"."document_id")))
  GROUP BY "ce"."document_id", (("d"."content_json" -> 'metadata'::"text") ->> 'name_city'::"text"), (("d"."content_json" -> 'metadata'::"text") ->> 'name_zoning'::"text"), (("d"."content_json" -> 'metadata'::"text") ->> 'name_zone'::"text")
  WITH NO DATA;


ALTER TABLE "analytics"."mv_document_popularity" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "analytics"."mv_document_popularity" IS 'Document usage statistics across different time windows. Refresh hourly.';



CREATE MATERIALIZED VIEW "analytics"."mv_user_monthly_summary" AS
 SELECT "chat_events"."user_id",
    ("date_trunc"('month'::"text", ("chat_events"."created_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "month_start",
    (EXTRACT(year FROM ("chat_events"."created_at" AT TIME ZONE 'UTC'::"text")))::integer AS "year",
    (EXTRACT(month FROM ("chat_events"."created_at" AT TIME ZONE 'UTC'::"text")))::integer AS "month",
    "count"(*) AS "message_count",
    "count"(DISTINCT "chat_events"."conversation_id") AS "conversation_count",
    "count"(DISTINCT "chat_events"."document_id") AS "document_count",
    "count"(DISTINCT "date"(("chat_events"."created_at" AT TIME ZONE 'UTC'::"text"))) AS "active_days",
    "sum"("chat_events"."tokens_total") AS "tokens_total",
    "sum"("chat_events"."tokens_cached") AS "tokens_cached",
    "round"(((("sum"(
        CASE
            WHEN "chat_events"."cache_hit" THEN 1
            ELSE 0
        END))::numeric / (GREATEST("count"(*), (1)::bigint))::numeric) * (100)::numeric), 2) AS "cache_hit_rate",
    "sum"("chat_events"."cost_total") AS "cost_total",
    "sum"(
        CASE
            WHEN "chat_events"."cache_hit" THEN (("chat_events"."cost_prompt" + "chat_events"."cost_completion") - "chat_events"."cost_cached")
            ELSE (0)::numeric
        END) AS "cost_saved_by_cache",
    ("avg"("chat_events"."response_time_ms"))::integer AS "avg_response_time_ms",
    ("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("chat_events"."response_time_ms")::double precision)))::integer AS "median_response_time_ms",
    ("percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY (("chat_events"."response_time_ms")::double precision)))::integer AS "p95_response_time_ms",
    "sum"(
        CASE
            WHEN "chat_events"."error_occurred" THEN 1
            ELSE 0
        END) AS "error_count",
    "round"(((("sum"(
        CASE
            WHEN "chat_events"."error_occurred" THEN 1
            ELSE 0
        END))::numeric / (GREATEST("count"(*), (1)::bigint))::numeric) * (100)::numeric), 2) AS "error_rate",
    "avg"("chat_events"."user_feedback_rating") AS "avg_feedback_rating",
    "count"("chat_events"."user_feedback_rating") AS "feedback_count",
    "max"("chat_events"."created_at") AS "last_activity_at"
   FROM "analytics"."chat_events"
  GROUP BY "chat_events"."user_id", (("date_trunc"('month'::"text", ("chat_events"."created_at" AT TIME ZONE 'UTC'::"text")))::"date"), ((EXTRACT(year FROM ("chat_events"."created_at" AT TIME ZONE 'UTC'::"text")))::integer), ((EXTRACT(month FROM ("chat_events"."created_at" AT TIME ZONE 'UTC'::"text")))::integer)
  WITH NO DATA;


ALTER TABLE "analytics"."mv_user_monthly_summary" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "analytics"."mv_user_monthly_summary" IS 'Materialized view of monthly user statistics. Refresh nightly or on-demand.';



CREATE TABLE IF NOT EXISTS "analytics"."system_daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "active_users" integer DEFAULT 0,
    "new_users" integer DEFAULT 0,
    "total_messages" integer DEFAULT 0,
    "total_conversations" integer DEFAULT 0,
    "total_documents_accessed" integer DEFAULT 0,
    "tokens_total" bigint DEFAULT 0,
    "tokens_cached" bigint DEFAULT 0,
    "cache_hit_rate" numeric(5,2),
    "cost_total" numeric(10,2) DEFAULT 0,
    "cost_per_message" numeric(10,6),
    "cost_saved_by_cache" numeric(10,2) DEFAULT 0,
    "avg_response_time_ms" integer,
    "p95_response_time_ms" integer,
    "error_count" integer DEFAULT 0,
    "error_rate" numeric(5,2),
    "avg_feedback_rating" numeric(3,2),
    "model_distribution" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."system_daily_metrics" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."system_daily_metrics" IS 'Platform-wide daily metrics. Admin-only view of overall system health and costs.';



CREATE TABLE IF NOT EXISTS "analytics"."user_daily_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "message_count" integer DEFAULT 0,
    "conversation_count" integer DEFAULT 0,
    "document_count" integer DEFAULT 0,
    "tokens_total" bigint DEFAULT 0,
    "tokens_cached" bigint DEFAULT 0,
    "cache_hit_count" integer DEFAULT 0,
    "cost_total" numeric(10,4) DEFAULT 0,
    "cost_saved_by_cache" numeric(10,4) DEFAULT 0,
    "avg_response_time_ms" integer,
    "median_response_time_ms" integer,
    "p95_response_time_ms" integer,
    "error_count" integer DEFAULT 0,
    "avg_feedback_rating" numeric(3,2),
    "feedback_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."user_daily_usage" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."user_daily_usage" IS 'Daily aggregated usage per user. Refreshed via materialized view or trigger.';



CREATE TABLE IF NOT EXISTS "analytics"."user_monthly_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "year_month" "text" GENERATED ALWAYS AS ((("year" || '-'::"text") || "lpad"(("month")::"text", 2, '0'::"text"))) STORED,
    "message_count" integer DEFAULT 0,
    "conversation_count" integer DEFAULT 0,
    "document_count" integer DEFAULT 0,
    "active_days" integer DEFAULT 0,
    "tokens_total" bigint DEFAULT 0,
    "tokens_cached" bigint DEFAULT 0,
    "cache_hit_rate" numeric(5,2),
    "cost_total" numeric(10,2) DEFAULT 0,
    "cost_saved_by_cache" numeric(10,2) DEFAULT 0,
    "avg_response_time_ms" integer,
    "error_count" integer DEFAULT 0,
    "error_rate" numeric(5,2),
    "avg_feedback_rating" numeric(3,2),
    "feedback_count" integer DEFAULT 0,
    "monthly_message_limit" integer,
    "monthly_token_limit" bigint,
    "monthly_cost_limit" numeric(10,2),
    "limit_reached" boolean DEFAULT false,
    "limit_reached_at" timestamp with time zone,
    "notified_80_percent" boolean DEFAULT false,
    "notified_100_percent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_monthly_usage_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "analytics"."user_monthly_usage" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."user_monthly_usage" IS 'Monthly aggregated usage per user. Used for billing and limit enforcement.';



CREATE OR REPLACE VIEW "analytics"."v_user_current_month" AS
 SELECT "umu"."id",
    "umu"."user_id",
    "umu"."year",
    "umu"."month",
    "umu"."year_month",
    "umu"."message_count",
    "umu"."conversation_count",
    "umu"."document_count",
    "umu"."active_days",
    "umu"."tokens_total",
    "umu"."tokens_cached",
    "umu"."cache_hit_rate",
    "umu"."cost_total",
    "umu"."cost_saved_by_cache",
    "umu"."avg_response_time_ms",
    "umu"."error_count",
    "umu"."error_rate",
    "umu"."avg_feedback_rating",
    "umu"."feedback_count",
    "umu"."monthly_message_limit",
    "umu"."monthly_token_limit",
    "umu"."monthly_cost_limit",
    "umu"."limit_reached",
    "umu"."limit_reached_at",
    "umu"."notified_80_percent",
    "umu"."notified_100_percent",
    "umu"."created_at",
    "umu"."updated_at",
    "round"(((("umu"."message_count")::numeric / (NULLIF("umu"."monthly_message_limit", 0))::numeric) * (100)::numeric), 1) AS "usage_percent",
    ("umu"."monthly_message_limit" - "umu"."message_count") AS "messages_remaining",
        CASE
            WHEN "umu"."limit_reached" THEN 'limit_reached'::"text"
            WHEN (("umu"."monthly_message_limit" IS NOT NULL) AND (("umu"."message_count")::numeric >= (("umu"."monthly_message_limit")::numeric * 0.9))) THEN 'warning'::"text"
            WHEN (("umu"."monthly_message_limit" IS NOT NULL) AND (("umu"."message_count")::numeric >= (("umu"."monthly_message_limit")::numeric * 0.8))) THEN 'approaching'::"text"
            ELSE 'normal'::"text"
        END AS "status"
   FROM "analytics"."user_monthly_usage" "umu"
  WHERE ((("umu"."year")::numeric = EXTRACT(year FROM "now"())) AND (("umu"."month")::numeric = EXTRACT(month FROM "now"())));


ALTER TABLE "analytics"."v_user_current_month" OWNER TO "postgres";


COMMENT ON VIEW "analytics"."v_user_current_month" IS 'Current month usage with calculated status. Used in user dashboard.';



CREATE OR REPLACE VIEW "analytics"."v_user_recent_activity" AS
 SELECT "ce"."user_id",
    "ce"."created_at",
    "ce"."conversation_id",
    "ce"."document_id",
    "ce"."tokens_total",
    "ce"."cost_total",
    "ce"."response_time_ms",
    "ce"."cache_hit",
    "ce"."error_occurred",
    (("d"."content_json" -> 'metadata'::"text") ->> 'name_city'::"text") AS "city",
    (("d"."content_json" -> 'metadata'::"text") ->> 'name_zone'::"text") AS "zone"
   FROM ("analytics"."chat_events" "ce"
     LEFT JOIN "public"."documents" "d" ON (("d"."id" = "ce"."document_id")))
  WHERE ("ce"."created_at" >= ("now"() - '7 days'::interval))
  ORDER BY "ce"."created_at" DESC;


ALTER TABLE "analytics"."v_user_recent_activity" OWNER TO "postgres";


COMMENT ON VIEW "analytics"."v_user_recent_activity" IS 'Last 7 days of activity per user. Used in user dashboard.';



CREATE TABLE IF NOT EXISTS "public"."blog_analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid",
    "event_type" character varying(50) NOT NULL,
    "event_data" "jsonb",
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "referrer" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_article_tags" (
    "article_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."blog_article_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "excerpt" "text",
    "content" "text" NOT NULL,
    "markdown_content" "text",
    "cover_image_url" "text",
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "meta_title" character varying(255),
    "meta_description" "text",
    "canonical_url" "text",
    "og_title" character varying(255),
    "og_description" "text",
    "og_image_url" "text",
    "twitter_title" character varying(255),
    "twitter_description" "text",
    "twitter_image_url" "text",
    "category_id" "uuid",
    "author_id" "uuid",
    "company_context_id" "uuid",
    "ai_generated" boolean DEFAULT false,
    "ai_prompts_used" "text"[],
    "human_edit_ratio" numeric(3,2) DEFAULT 1.0,
    "view_count" integer DEFAULT 0,
    "scroll_depth_avg" numeric(5,2) DEFAULT 0,
    "cta_clicks" integer DEFAULT 0,
    "outlink_clicks" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "blog_articles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'ready'::character varying, 'scheduled'::character varying, 'published'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."blog_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "color" character varying(7) DEFAULT '#000000'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_content_planner" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "topic" "text" NOT NULL,
    "target_keywords" "text"[],
    "content_brief" "text",
    "target_publish_date" "date",
    "priority" integer DEFAULT 1,
    "status" character varying(20) DEFAULT 'planned'::character varying,
    "article_id" "uuid",
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "blog_content_planner_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['planned'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."blog_content_planner" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_seo_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid",
    "audit_type" character varying(50) NOT NULL,
    "lighthouse_score" integer,
    "seo_score" integer,
    "issues" "jsonb",
    "recommendations" "jsonb",
    "audited_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_seo_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "slug" character varying(50) NOT NULL,
    "description" "text",
    "usage_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conversation_turn" integer,
    "reply_to_message_id" "uuid",
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "insee_code" character varying
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


COMMENT ON TABLE "public"."cities" IS 'Shared reference table: Cities are publicly readable, authenticated users can create cities when needed';



COMMENT ON COLUMN "public"."cities"."insee_code" IS 'INSEE code (e.g., "38185") - unique identifier for French communes, nullable for existing cities without INSEE codes';



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments_deleted" (
    "id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_status" boolean DEFAULT false,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."comments_deleted" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_context" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "mission" "text",
    "values" "text"[],
    "tone" character varying(100),
    "messaging" "text",
    "brand_voice_guidelines" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."company_context" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."downloads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'pdf'::"text"
);


ALTER TABLE "public"."downloads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."migration_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "v1_conversation_id" "uuid",
    "v2_conversation_id" "uuid",
    "v2_project_id" "uuid",
    "migrated_at" timestamp without time zone DEFAULT "now"(),
    "migration_status" "text" DEFAULT 'completed'::"text",
    "error_message" "text",
    CONSTRAINT "migration_tracking_migration_status_check" CHECK (("migration_status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."migration_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."migration_tracking" IS 'Tracks migration of v1 conversations to v2 projects. Prevents duplicate migrations.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "last_name" "text",
    "first_name" "text",
    "phone" "text",
    "full_name" "text" GENERATED ALWAYS AS ((("first_name" || ' '::"text") || "last_name")) STORED,
    "avatar_url" "text",
    "is_admin" boolean DEFAULT false,
    "deletion_requested_at" timestamp with time zone,
    "deletion_scheduled_for" timestamp with time zone,
    "deletion_reason" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "pseudo" "text",
    CONSTRAINT "nom_length" CHECK (("char_length"("last_name") >= 1)),
    CONSTRAINT "prenom_length" CHECK (("char_length"("first_name") >= 1)),
    CONSTRAINT "profiles_is_admin_check" CHECK (("is_admin" = ANY (ARRAY[true, false])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Shared table: User profiles linked to auth.users';



COMMENT ON COLUMN "public"."profiles"."is_admin" IS 'Admins have can delete comments';



CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid",
    "user_id" "uuid",
    "rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."research_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "city_id" "text",
    "address_input" "text",
    "geo_lon" double precision,
    "geo_lat" double precision,
    "zone_label" "text",
    "success" boolean DEFAULT false NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."research_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."typologies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."typologies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_download_limits" (
    "user_id" "uuid" NOT NULL,
    "free_quota" integer DEFAULT 5 NOT NULL,
    "paid_credits" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_download_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."v2_conversation_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "added_at" timestamp without time zone DEFAULT "now"(),
    "added_by" "text" DEFAULT 'user'::"text",
    "relevance_score" numeric(3,2),
    "usage_count" integer DEFAULT 0,
    "last_referenced_at" timestamp without time zone,
    "trigger_context" "jsonb",
    CONSTRAINT "v2_conversation_documents_added_by_check" CHECK (("added_by" = ANY (ARRAY['user'::"text", 'ai_auto'::"text", 'ai_suggested'::"text", 'address_search'::"text", 'migration'::"text"])))
);


ALTER TABLE "public"."v2_conversation_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."v2_conversation_documents" IS 'V2 Conversation-Documents junction - many-to-many linking. Non-destructive alongside v1 tables.';



COMMENT ON COLUMN "public"."v2_conversation_documents"."document_id" IS 'Reference to documents table (shared with v1)';



COMMENT ON COLUMN "public"."v2_conversation_documents"."added_by" IS 'How this document was added to the conversation for tracking';



COMMENT ON COLUMN "public"."v2_conversation_documents"."relevance_score" IS 'AI-calculated relevance score (0.00 to 1.00) for this document in this conversation';



COMMENT ON COLUMN "public"."v2_conversation_documents"."trigger_context" IS 'JSONB storing context of how document was triggered: trigger_type, address, query, message_id';



CREATE TABLE IF NOT EXISTS "public"."v2_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "conversation_type" "text" DEFAULT 'address_analysis'::"text",
    "title" "text",
    "context_metadata" "jsonb",
    "is_active" boolean DEFAULT true,
    "archived_at" timestamp without time zone,
    "last_message_at" timestamp without time zone DEFAULT "now"(),
    "message_count" integer DEFAULT 0,
    "document_count" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "v2_conversations_conversation_type_check" CHECK (("conversation_type" = ANY (ARRAY['address_analysis'::"text", 'multi_zone'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."v2_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."v2_conversations" IS 'V2 Conversations table - always linked to a project. Non-destructive alongside v1 tables.';



COMMENT ON COLUMN "public"."v2_conversations"."project_id" IS 'Required reference to v2_projects - conversations cannot exist without a project';



COMMENT ON COLUMN "public"."v2_conversations"."context_metadata" IS 'JSONB storing context like initial_address, geocoded coordinates, city, zone, etc.';



COMMENT ON COLUMN "public"."v2_conversations"."message_count" IS 'Denormalized count of messages for performance';



COMMENT ON COLUMN "public"."v2_conversations"."document_count" IS 'Denormalized count of linked documents for performance';



CREATE TABLE IF NOT EXISTS "public"."v2_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "message" "text" NOT NULL,
    "message_type" "text",
    "referenced_documents" "uuid"[],
    "referenced_zones" "uuid"[],
    "referenced_cities" "uuid"[],
    "search_context" "jsonb",
    "intent_detected" "text",
    "confidence_score" numeric(3,2),
    "ai_model_used" "text",
    "conversation_turn" integer,
    "reply_to_message_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "v2_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'address_search'::"text", 'document_summary'::"text", 'comparison'::"text", 'clarification'::"text"]))),
    CONSTRAINT "v2_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."v2_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."v2_messages" IS 'V2 Messages table - enhanced messages with AI metadata and array references. Non-destructive alongside v1 tables.';



COMMENT ON COLUMN "public"."v2_messages"."referenced_documents" IS 'Array of document UUIDs cited in this message - enables multi-document conversations';



COMMENT ON COLUMN "public"."v2_messages"."search_context" IS 'JSONB storing address search context: address_input, geocoded_address, coordinates, city, zone, documents_found';



COMMENT ON COLUMN "public"."v2_messages"."intent_detected" IS 'AI-detected intent classification for analytics';



COMMENT ON COLUMN "public"."v2_messages"."confidence_score" IS 'AI confidence score (0.00 to 1.00) for intent detection';



CREATE TABLE IF NOT EXISTS "public"."v2_project_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "pinned" boolean DEFAULT false,
    "added_at" timestamp without time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."v2_project_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."v2_project_documents" IS 'V2 Project-Documents junction - project-level document collection. Non-destructive alongside v1 tables.';



COMMENT ON COLUMN "public"."v2_project_documents"."document_id" IS 'Reference to documents table (shared with v1)';



COMMENT ON COLUMN "public"."v2_project_documents"."pinned" IS 'Flag to mark important/pinned documents for quick access';



COMMENT ON COLUMN "public"."v2_project_documents"."notes" IS 'User notes about this document specific to this project';



CREATE TABLE IF NOT EXISTS "public"."v2_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "description" "text",
    "project_type" "text",
    "main_address" "text",
    "main_city_id" "uuid",
    "main_zone_id" "uuid",
    "geo_lon" numeric(10,7),
    "geo_lat" numeric(10,7),
    "color" "text" DEFAULT '#6B7280'::"text",
    "icon" "text" DEFAULT '📁'::"text",
    "starred" boolean DEFAULT false,
    "position" integer,
    "status" "text" DEFAULT 'draft'::"text",
    "plu_alert_enabled" boolean DEFAULT false,
    "plu_last_check_at" timestamp without time zone,
    "plu_check_frequency" "text" DEFAULT 'monthly'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "first_edited_at" timestamp without time zone,
    "metadata" "jsonb",
    CONSTRAINT "v2_projects_plu_check_frequency_check" CHECK (("plu_check_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "v2_projects_project_type_check" CHECK (("project_type" = ANY (ARRAY['construction'::"text", 'extension'::"text", 'renovation'::"text", 'amenagement'::"text", 'lotissement'::"text", 'other'::"text"]))),
    CONSTRAINT "v2_projects_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."v2_projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."v2_projects" IS 'V2 Projects table - stores user project organization. Non-destructive alongside v1 tables.';



COMMENT ON COLUMN "public"."v2_projects"."main_city_id" IS 'Reference to cities table (shared with v1) - informational only';



COMMENT ON COLUMN "public"."v2_projects"."main_zone_id" IS 'Reference to zones table (shared with v1) - informational only';



COMMENT ON COLUMN "public"."v2_projects"."status" IS 'Project lifecycle: draft (auto-created), active (user edited), completed, archived';



COMMENT ON COLUMN "public"."v2_projects"."plu_alert_enabled" IS 'Enable automatic PLU change notifications for this project';



CREATE TABLE IF NOT EXISTS "public"."v2_research_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "message_id" "uuid",
    "project_id" "uuid",
    "address_input" "text" NOT NULL,
    "search_intent" "text",
    "geocoded_address" "text",
    "city_id" "uuid",
    "geo_lon" numeric(10,7),
    "geo_lat" numeric(10,7),
    "documents_found" "uuid"[],
    "success" boolean DEFAULT true,
    "error_reason" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "zone_id" "uuid"
);


ALTER TABLE "public"."v2_research_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."v2_research_history" IS 'V2 Research History table - enhanced with v2 conversation/project links. Non-destructive alongside v1 tables.';



COMMENT ON COLUMN "public"."v2_research_history"."conversation_id" IS 'Optional link to v2_conversations - SET NULL if conversation deleted';



COMMENT ON COLUMN "public"."v2_research_history"."project_id" IS 'Optional link to v2_projects - SET NULL if project deleted';



COMMENT ON COLUMN "public"."v2_research_history"."city_id" IS 'Reference to cities table (shared with v1)';



COMMENT ON COLUMN "public"."v2_research_history"."documents_found" IS 'Array of document UUIDs found during address search';



COMMENT ON COLUMN "public"."v2_research_history"."zone_id" IS 'Reference to zones table (shared with v1) - used for storing specific zone information';



CREATE TABLE IF NOT EXISTS "public"."view_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."view_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "zoning_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "zones_constructibles" boolean,
    "geometry" "jsonb"
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


COMMENT ON TABLE "public"."zones" IS 'Shared table: PLU zones within zonings - now includes geometry for map display';



COMMENT ON COLUMN "public"."zones"."geometry" IS 'GeoJSON multipolygon geometry from Carto API - used for map visualization with highlighted zones';



CREATE TABLE IF NOT EXISTS "public"."zonings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "city_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "code" character varying(10)
);


ALTER TABLE "public"."zonings" OWNER TO "postgres";


COMMENT ON TABLE "public"."zonings" IS 'Shared reference table: Zonings are publicly readable, authenticated users can create zonings when needed';



COMMENT ON COLUMN "public"."zonings"."code" IS 'Short code from Carto API typezone field (U, AU, N, A, etc.) - used for direct mapping from API response';



ALTER TABLE ONLY "analytics"."chat_events"
    ADD CONSTRAINT "chat_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."document_usage"
    ADD CONSTRAINT "document_usage_document_id_date_key" UNIQUE ("document_id", "date");



ALTER TABLE ONLY "analytics"."document_usage"
    ADD CONSTRAINT "document_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."system_daily_metrics"
    ADD CONSTRAINT "system_daily_metrics_date_key" UNIQUE ("date");



ALTER TABLE ONLY "analytics"."system_daily_metrics"
    ADD CONSTRAINT "system_daily_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."user_daily_usage"
    ADD CONSTRAINT "user_daily_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."user_daily_usage"
    ADD CONSTRAINT "user_daily_usage_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "analytics"."user_monthly_usage"
    ADD CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."user_monthly_usage"
    ADD CONSTRAINT "user_monthly_usage_user_id_year_month_key" UNIQUE ("user_id", "year", "month");



ALTER TABLE ONLY "public"."blog_analytics_events"
    ADD CONSTRAINT "blog_analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_article_tags"
    ADD CONSTRAINT "blog_article_tags_pkey" PRIMARY KEY ("article_id", "tag_id");



ALTER TABLE ONLY "public"."blog_articles"
    ADD CONSTRAINT "blog_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_articles"
    ADD CONSTRAINT "blog_articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."blog_content_planner"
    ADD CONSTRAINT "blog_content_planner_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_seo_audits"
    ADD CONSTRAINT "blog_seo_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments_deleted"
    ADD CONSTRAINT "comments_deleted_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_context"
    ADD CONSTRAINT "company_context_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."downloads"
    ADD CONSTRAINT "downloads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_tracking"
    ADD CONSTRAINT "migration_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_tracking"
    ADD CONSTRAINT "migration_tracking_v1_conversation_id_key" UNIQUE ("v1_conversation_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_document_id_user_id_key" UNIQUE ("document_id", "user_id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."research_history"
    ADD CONSTRAINT "research_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."typologies"
    ADD CONSTRAINT "typologies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_download_limits"
    ADD CONSTRAINT "user_download_limits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."v2_conversation_documents"
    ADD CONSTRAINT "v2_conversation_documents_conversation_id_document_id_key" UNIQUE ("conversation_id", "document_id");



ALTER TABLE ONLY "public"."v2_conversation_documents"
    ADD CONSTRAINT "v2_conversation_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."v2_conversations"
    ADD CONSTRAINT "v2_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."v2_messages"
    ADD CONSTRAINT "v2_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."v2_project_documents"
    ADD CONSTRAINT "v2_project_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."v2_project_documents"
    ADD CONSTRAINT "v2_project_documents_project_id_document_id_key" UNIQUE ("project_id", "document_id");



ALTER TABLE ONLY "public"."v2_projects"
    ADD CONSTRAINT "v2_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."view_history"
    ADD CONSTRAINT "view_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zonings"
    ADD CONSTRAINT "zonings_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chat_events_cache" ON "analytics"."chat_events" USING "btree" ("cache_hit", "created_at" DESC);



CREATE INDEX "idx_chat_events_conversation" ON "analytics"."chat_events" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_chat_events_cost" ON "analytics"."chat_events" USING "btree" ("cost_total" DESC) WHERE ("cost_total" > (0)::numeric);



CREATE INDEX "idx_chat_events_created" ON "analytics"."chat_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chat_events_document" ON "analytics"."chat_events" USING "btree" ("document_id", "created_at" DESC);



CREATE INDEX "idx_chat_events_errors" ON "analytics"."chat_events" USING "btree" ("created_at" DESC) WHERE ("error_occurred" = true);



CREATE INDEX "idx_chat_events_intent" ON "analytics"."chat_events" USING "btree" ("query_intent") WHERE ("query_intent" IS NOT NULL);



CREATE INDEX "idx_chat_events_metadata" ON "analytics"."chat_events" USING "gin" ("metadata");



CREATE INDEX "idx_chat_events_user" ON "analytics"."chat_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_chat_events_user_month" ON "analytics"."chat_events" USING "btree" ("user_id", "date_trunc"('month'::"text", ("created_at" AT TIME ZONE 'UTC'::"text")));



CREATE INDEX "idx_document_usage_cost" ON "analytics"."document_usage" USING "btree" ("cost_total" DESC);



CREATE INDEX "idx_document_usage_date" ON "analytics"."document_usage" USING "btree" ("date" DESC);



CREATE INDEX "idx_document_usage_doc" ON "analytics"."document_usage" USING "btree" ("document_id", "date" DESC);



CREATE INDEX "idx_mv_document_popularity_cost_30d" ON "analytics"."mv_document_popularity" USING "btree" ("cost_30d" DESC);



CREATE UNIQUE INDEX "idx_mv_document_popularity_doc" ON "analytics"."mv_document_popularity" USING "btree" ("document_id");



CREATE INDEX "idx_mv_document_popularity_queries_7d" ON "analytics"."mv_document_popularity" USING "btree" ("queries_7d" DESC);



CREATE INDEX "idx_mv_user_monthly_summary_month" ON "analytics"."mv_user_monthly_summary" USING "btree" ("month_start" DESC);



CREATE UNIQUE INDEX "idx_mv_user_monthly_summary_unique" ON "analytics"."mv_user_monthly_summary" USING "btree" ("user_id", "year", "month");



CREATE INDEX "idx_mv_user_monthly_summary_user" ON "analytics"."mv_user_monthly_summary" USING "btree" ("user_id", "year" DESC, "month" DESC);



CREATE INDEX "idx_system_daily_metrics_date" ON "analytics"."system_daily_metrics" USING "btree" ("date" DESC);



CREATE INDEX "idx_user_daily_usage_cost" ON "analytics"."user_daily_usage" USING "btree" ("cost_total" DESC);



CREATE INDEX "idx_user_daily_usage_date" ON "analytics"."user_daily_usage" USING "btree" ("date" DESC);



CREATE INDEX "idx_user_daily_usage_user" ON "analytics"."user_daily_usage" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_user_monthly_usage_limit" ON "analytics"."user_monthly_usage" USING "btree" ("user_id") WHERE ("limit_reached" = true);



CREATE INDEX "idx_user_monthly_usage_period" ON "analytics"."user_monthly_usage" USING "btree" ("year" DESC, "month" DESC);



CREATE INDEX "idx_user_monthly_usage_user" ON "analytics"."user_monthly_usage" USING "btree" ("user_id", "year" DESC, "month" DESC);



CREATE INDEX "chat_conversations_idx" ON "public"."chat_conversations" USING "btree" ("user_id", "document_id", "is_active", "created_at" DESC);



CREATE UNIQUE INDEX "chat_conversations_one_active_per_doc" ON "public"."chat_conversations" USING "btree" ("user_id", "document_id") WHERE "is_active";



CREATE INDEX "chat_messages_conv_created_idx" ON "public"."chat_messages" USING "btree" ("conversation_id", "created_at");



CREATE UNIQUE INDEX "chat_messages_one_assistant_per_turn" ON "public"."chat_messages" USING "btree" ("reply_to_message_id") WHERE (("role" = 'assistant'::"text") AND ("reply_to_message_id" IS NOT NULL));



CREATE INDEX "comments_deleted_document_id_idx" ON "public"."comments_deleted" USING "btree" ("document_id");



CREATE INDEX "comments_deleted_status_idx" ON "public"."comments_deleted" USING "btree" ("deleted_status");



CREATE INDEX "comments_deleted_user_id_idx" ON "public"."comments_deleted" USING "btree" ("user_id");



CREATE UNIQUE INDEX "company_context_one_active_row" ON "public"."company_context" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_chat_messages_conv_turn" ON "public"."chat_messages" USING "btree" ("conversation_id", "conversation_turn", "created_at");



CREATE UNIQUE INDEX "idx_cities_insee_code" ON "public"."cities" USING "btree" ("insee_code") WHERE ("insee_code" IS NOT NULL);



CREATE INDEX "idx_cities_insee_code_lookup" ON "public"."cities" USING "btree" ("insee_code");



CREATE INDEX "idx_cities_name" ON "public"."cities" USING "btree" ("name");



CREATE INDEX "idx_documents_typology" ON "public"."documents" USING "btree" ("typology_id");



CREATE INDEX "idx_documents_zone" ON "public"."documents" USING "btree" ("zone_id");



CREATE INDEX "idx_documents_zoning" ON "public"."documents" USING "btree" ("zoning_id");



CREATE INDEX "idx_migration_tracking_status" ON "public"."migration_tracking" USING "btree" ("migration_status");



CREATE INDEX "idx_migration_tracking_v1_conv" ON "public"."migration_tracking" USING "btree" ("v1_conversation_id");



CREATE INDEX "idx_migration_tracking_v2_conv" ON "public"."migration_tracking" USING "btree" ("v2_conversation_id");



CREATE INDEX "idx_migration_tracking_v2_project" ON "public"."migration_tracking" USING "btree" ("v2_project_id");



CREATE INDEX "idx_profiles_admin" ON "public"."profiles" USING "btree" ("is_admin") WHERE ("is_admin" = true);



CREATE INDEX "idx_profiles_deletion_scheduled" ON "public"."profiles" USING "btree" ("deletion_scheduled_for") WHERE ("deletion_scheduled_for" IS NOT NULL);



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_research_history_created_at" ON "public"."research_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_research_history_user_id" ON "public"."research_history" USING "btree" ("user_id");



CREATE INDEX "idx_typologies_name" ON "public"."typologies" USING "btree" ("name");



CREATE INDEX "idx_v2_conv_active" ON "public"."v2_conversations" USING "btree" ("user_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_v2_conv_docs_conversation" ON "public"."v2_conversation_documents" USING "btree" ("conversation_id");



CREATE INDEX "idx_v2_conv_docs_document" ON "public"."v2_conversation_documents" USING "btree" ("document_id");



CREATE INDEX "idx_v2_conv_docs_relevance" ON "public"."v2_conversation_documents" USING "btree" ("conversation_id", "relevance_score" DESC);



CREATE INDEX "idx_v2_conv_last_message" ON "public"."v2_conversations" USING "btree" ("user_id", "last_message_at" DESC);



CREATE INDEX "idx_v2_conv_project" ON "public"."v2_conversations" USING "btree" ("project_id");



CREATE INDEX "idx_v2_conv_user" ON "public"."v2_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_v2_msg_conversation" ON "public"."v2_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_v2_msg_documents" ON "public"."v2_messages" USING "gin" ("referenced_documents");



CREATE INDEX "idx_v2_msg_turn" ON "public"."v2_messages" USING "btree" ("conversation_id", "conversation_turn");



CREATE INDEX "idx_v2_msg_user" ON "public"."v2_messages" USING "btree" ("user_id");



CREATE INDEX "idx_v2_proj_docs_pinned" ON "public"."v2_project_documents" USING "btree" ("project_id", "pinned") WHERE ("pinned" = true);



CREATE INDEX "idx_v2_proj_docs_project" ON "public"."v2_project_documents" USING "btree" ("project_id");



CREATE INDEX "idx_v2_projects_active" ON "public"."v2_projects" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['draft'::"text", 'active'::"text"]));



CREATE INDEX "idx_v2_projects_starred" ON "public"."v2_projects" USING "btree" ("user_id", "starred") WHERE ("starred" = true);



CREATE INDEX "idx_v2_projects_status" ON "public"."v2_projects" USING "btree" ("user_id", "status");



CREATE INDEX "idx_v2_projects_user" ON "public"."v2_projects" USING "btree" ("user_id");



CREATE INDEX "idx_v2_research_conversation" ON "public"."v2_research_history" USING "btree" ("conversation_id");



CREATE INDEX "idx_v2_research_project" ON "public"."v2_research_history" USING "btree" ("project_id");



CREATE INDEX "idx_v2_research_user" ON "public"."v2_research_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_v2_research_zone" ON "public"."v2_research_history" USING "btree" ("zone_id");



CREATE INDEX "idx_zones_geometry" ON "public"."zones" USING "gin" ("geometry");



CREATE INDEX "idx_zones_zoning" ON "public"."zones" USING "btree" ("zoning_id");



CREATE INDEX "idx_zonings_city" ON "public"."zonings" USING "btree" ("city_id");



CREATE INDEX "idx_zonings_code" ON "public"."zonings" USING "btree" ("code");



CREATE OR REPLACE TRIGGER "trigger_update_daily_usage" AFTER INSERT ON "analytics"."chat_events" FOR EACH ROW EXECUTE FUNCTION "analytics"."update_daily_usage"();



CREATE OR REPLACE TRIGGER "trigger_update_document_usage" AFTER INSERT ON "analytics"."chat_events" FOR EACH ROW EXECUTE FUNCTION "analytics"."update_document_usage"();



CREATE OR REPLACE TRIGGER "trigger_update_monthly_usage" AFTER INSERT ON "analytics"."chat_events" FOR EACH ROW EXECUTE FUNCTION "analytics"."update_monthly_usage"();



CREATE OR REPLACE TRIGGER "comments_insert_trigger" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."insert_comment_to_deleted_table"();



CREATE OR REPLACE TRIGGER "downloads_enforce_limit" BEFORE INSERT ON "public"."downloads" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_download_limit_dynamic"();



CREATE OR REPLACE TRIGGER "on_profile_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_profile_update"();



CREATE OR REPLACE TRIGGER "on_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_user_download_limits" BEFORE UPDATE ON "public"."user_download_limits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_chat_assistant_set_turn" BEFORE INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."chat_assistant_set_turn"();



CREATE OR REPLACE TRIGGER "trg_chat_user_set_turn" BEFORE INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."chat_user_set_turn"();



CREATE OR REPLACE TRIGGER "update_blog_articles_updated_at" BEFORE UPDATE ON "public"."blog_articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_blog_content_planner_updated_at" BEFORE UPDATE ON "public"."blog_content_planner" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_context_updated_at" BEFORE UPDATE ON "public"."company_context" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ratings_updated_at" BEFORE UPDATE ON "public"."ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "analytics"."chat_events"
    ADD CONSTRAINT "chat_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."chat_events"
    ADD CONSTRAINT "chat_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "analytics"."chat_events"
    ADD CONSTRAINT "chat_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "analytics"."chat_events"
    ADD CONSTRAINT "chat_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "analytics"."document_usage"
    ADD CONSTRAINT "document_usage_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."user_daily_usage"
    ADD CONSTRAINT "user_daily_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."user_monthly_usage"
    ADD CONSTRAINT "user_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_analytics_events"
    ADD CONSTRAINT "blog_analytics_events_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id");



ALTER TABLE ONLY "public"."blog_analytics_events"
    ADD CONSTRAINT "blog_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."blog_article_tags"
    ADD CONSTRAINT "blog_article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_article_tags"
    ADD CONSTRAINT "blog_article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_articles"
    ADD CONSTRAINT "blog_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_articles"
    ADD CONSTRAINT "blog_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id");



ALTER TABLE ONLY "public"."blog_articles"
    ADD CONSTRAINT "blog_articles_company_context_id_fkey" FOREIGN KEY ("company_context_id") REFERENCES "public"."company_context"("id");



ALTER TABLE ONLY "public"."blog_articles"
    ADD CONSTRAINT "blog_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."blog_content_planner"
    ADD CONSTRAINT "blog_content_planner_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id");



ALTER TABLE ONLY "public"."blog_content_planner"
    ADD CONSTRAINT "blog_content_planner_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."blog_seo_audits"
    ADD CONSTRAINT "blog_seo_audits_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id");



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments_deleted"
    ADD CONSTRAINT "comments_deleted_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_context"
    ADD CONSTRAINT "company_context_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_typology_id_fkey" FOREIGN KEY ("typology_id") REFERENCES "public"."typologies"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_zoning_id_fkey" FOREIGN KEY ("zoning_id") REFERENCES "public"."zonings"("id");



ALTER TABLE ONLY "public"."downloads"
    ADD CONSTRAINT "downloads_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."downloads"
    ADD CONSTRAINT "downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."migration_tracking"
    ADD CONSTRAINT "migration_tracking_v1_conversation_id_fkey" FOREIGN KEY ("v1_conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."migration_tracking"
    ADD CONSTRAINT "migration_tracking_v2_conversation_id_fkey" FOREIGN KEY ("v2_conversation_id") REFERENCES "public"."v2_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."migration_tracking"
    ADD CONSTRAINT "migration_tracking_v2_project_id_fkey" FOREIGN KEY ("v2_project_id") REFERENCES "public"."v2_projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_history"
    ADD CONSTRAINT "research_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_download_limits"
    ADD CONSTRAINT "user_download_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_conversation_documents"
    ADD CONSTRAINT "v2_conversation_documents_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."v2_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_conversation_documents"
    ADD CONSTRAINT "v2_conversation_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_conversations"
    ADD CONSTRAINT "v2_conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."v2_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_conversations"
    ADD CONSTRAINT "v2_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_messages"
    ADD CONSTRAINT "v2_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."v2_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_messages"
    ADD CONSTRAINT "v2_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."v2_messages"("id");



ALTER TABLE ONLY "public"."v2_messages"
    ADD CONSTRAINT "v2_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."v2_project_documents"
    ADD CONSTRAINT "v2_project_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_project_documents"
    ADD CONSTRAINT "v2_project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."v2_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_projects"
    ADD CONSTRAINT "v2_projects_main_city_id_fkey" FOREIGN KEY ("main_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."v2_projects"
    ADD CONSTRAINT "v2_projects_main_zone_id_fkey" FOREIGN KEY ("main_zone_id") REFERENCES "public"."zones"("id");



ALTER TABLE ONLY "public"."v2_projects"
    ADD CONSTRAINT "v2_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."v2_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."v2_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."v2_projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."v2_research_history"
    ADD CONSTRAINT "v2_research_history_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."view_history"
    ADD CONSTRAINT "view_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_zoning_id_fkey" FOREIGN KEY ("zoning_id") REFERENCES "public"."zonings"("id");



ALTER TABLE ONLY "public"."zonings"
    ADD CONSTRAINT "zonings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



CREATE POLICY "Admins can manage document usage" ON "analytics"."document_usage" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all chat events" ON "analytics"."chat_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all daily usage" ON "analytics"."user_daily_usage" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all monthly usage" ON "analytics"."user_monthly_usage" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view system metrics" ON "analytics"."system_daily_metrics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Anyone can view document usage" ON "analytics"."document_usage" FOR SELECT USING (true);



CREATE POLICY "Service role can insert events" ON "analytics"."chat_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can update own feedback" ON "analytics"."chat_events" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own chat events" ON "analytics"."chat_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own daily usage" ON "analytics"."user_daily_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own monthly usage" ON "analytics"."user_monthly_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "analytics"."chat_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."document_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."system_daily_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."user_daily_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."user_monthly_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins and editors can manage blog articles" ON "public"."blog_articles" TO "authenticated" USING (("public"."has_any_roles"(ARRAY['admin'::"text", 'editor'::"text"]) OR ("author_id" = "auth"."uid"()))) WITH CHECK (("public"."has_any_roles"(ARRAY['admin'::"text", 'editor'::"text"]) OR ("author_id" = "auth"."uid"())));



CREATE POLICY "Admins and editors can manage company context" ON "public"."company_context" USING (((COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") -> 'roles'::"text"), '[]'::"jsonb") @> '["admin"]'::"jsonb") OR (COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") -> 'roles'::"text"), '[]'::"jsonb") @> '["editor"]'::"jsonb"))) WITH CHECK (((COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") -> 'roles'::"text"), '[]'::"jsonb") @> '["admin"]'::"jsonb") OR (COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") -> 'roles'::"text"), '[]'::"jsonb") @> '["editor"]'::"jsonb")));



CREATE POLICY "Admins and editors can select analytics events" ON "public"."blog_analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Admins and editors can select seo audits" ON "public"."blog_seo_audits" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Admins can delete any comment" ON "public"."comments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can delete documents" ON "public"."documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



COMMENT ON POLICY "Admins can delete documents" ON "public"."documents" IS 'Only admins can delete documents';



CREATE POLICY "Admins can update documents" ON "public"."documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



COMMENT ON POLICY "Admins can update documents" ON "public"."documents" IS 'Only admins can update existing documents';



CREATE POLICY "Admins can view all conversation documents" ON "public"."v2_conversation_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all conversations" ON "public"."v2_conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all downloads" ON "public"."downloads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all messages" ON "public"."v2_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all migration records" ON "public"."migration_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all project documents" ON "public"."v2_project_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all projects" ON "public"."v2_projects" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all research history" ON "public"."v2_research_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Allow anonymous contact submissions" ON "public"."contact_messages" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to view messages" ON "public"."contact_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anonymous insert research" ON "public"."research_history" FOR INSERT WITH CHECK (("user_id" IS NULL));



CREATE POLICY "Anyone can read blog articles" ON "public"."blog_articles" FOR SELECT USING (true);



CREATE POLICY "Anyone can view cities" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "Anyone can view zones" ON "public"."zones" FOR SELECT USING (true);



CREATE POLICY "Anyone can view zonings" ON "public"."zonings" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create cities" ON "public"."cities" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create zones" ON "public"."zones" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create zonings" ON "public"."zonings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert documents" ON "public"."documents" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "Authenticated users can insert documents" ON "public"."documents" IS 'Allows authenticated users to create placeholder documents during enrichment process';



CREATE POLICY "Authenticated users can update cities" ON "public"."cities" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view all documents" ON "public"."documents" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "Authenticated users can view all documents" ON "public"."documents" IS 'Allows all authenticated users to read documents (documents are shared/public resources)';



CREATE POLICY "Authenticated users can view documents" ON "public"."documents" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authors and editors can manage articles" ON "public"."blog_articles" USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'editor'::"text"])))))));



CREATE POLICY "Authors and editors can modify article tags" ON "public"."blog_article_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."blog_articles" "a"
  WHERE (("a"."id" = "blog_article_tags"."article_id") AND (("a"."author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "auth"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))))))));



CREATE POLICY "Comments are viewable by everyone" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Editors can manage content planner" ON "public"."blog_content_planner" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Enable read access for all users" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."zones" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."zonings" FOR SELECT USING (true);



CREATE POLICY "Only service role can insert into comments_deleted" ON "public"."comments_deleted" FOR INSERT WITH CHECK (false);



CREATE POLICY "Only service role can update comments_deleted" ON "public"."comments_deleted" FOR UPDATE USING (false);



CREATE POLICY "Public can view active categories" ON "public"."blog_categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view article tags" ON "public"."blog_article_tags" FOR SELECT USING (true);



CREATE POLICY "Public can view published articles" ON "public"."blog_articles" FOR SELECT USING ((("status")::"text" = 'published'::"text"));



CREATE POLICY "Public can view tags" ON "public"."blog_tags" FOR SELECT USING (true);



CREATE POLICY "Public cannot select content planner" ON "public"."blog_content_planner" FOR SELECT USING (false);



CREATE POLICY "Ratings are viewable by everyone" ON "public"."ratings" FOR SELECT USING (true);



CREATE POLICY "Service role can manage research_history" ON "public"."research_history" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."contact_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "User can view own research" ON "public"."research_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User insert own research" ON "public"."research_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own conversations" ON "public"."v2_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own messages" ON "public"."v2_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own migration records" ON "public"."migration_tracking" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."v2_projects"
  WHERE (("v2_projects"."id" = "migration_tracking"."v2_project_id") AND ("v2_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create own projects" ON "public"."v2_projects" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own research history" ON "public"."v2_research_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own view history" ON "public"."view_history" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own conversations" ON "public"."v2_conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own messages" ON "public"."v2_messages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own profile" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete own projects" ON "public"."v2_projects" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own ratings" ON "public"."ratings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own limits" ON "public"."user_download_limits" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own downloads" ON "public"."downloads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own ratings" ON "public"."ratings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can link documents to conversations" ON "public"."v2_conversation_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."v2_conversations"
  WHERE (("v2_conversations"."id" = "v2_conversation_documents"."conversation_id") AND ("v2_conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can link documents to projects" ON "public"."v2_project_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."v2_projects"
  WHERE (("v2_projects"."id" = "v2_project_documents"."project_id") AND ("v2_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read their own view history" ON "public"."view_history" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove documents from conversations" ON "public"."v2_conversation_documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."v2_conversations"
  WHERE (("v2_conversations"."id" = "v2_conversation_documents"."conversation_id") AND ("v2_conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can remove documents from projects" ON "public"."v2_project_documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."v2_projects"
  WHERE (("v2_projects"."id" = "v2_project_documents"."project_id") AND ("v2_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can select own limits" ON "public"."user_download_limits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own conversation documents" ON "public"."v2_conversation_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."v2_conversations"
  WHERE (("v2_conversations"."id" = "v2_conversation_documents"."conversation_id") AND ("v2_conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own conversations" ON "public"."v2_conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own limits" ON "public"."user_download_limits" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own messages" ON "public"."v2_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own project documents" ON "public"."v2_project_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."v2_projects"
  WHERE (("v2_projects"."id" = "v2_project_documents"."project_id") AND ("v2_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own projects" ON "public"."v2_projects" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own research history" ON "public"."v2_research_history" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



COMMENT ON POLICY "Users can update own research history" ON "public"."v2_research_history" IS 'Allows authenticated users to update their own research history records, enabling conversation_id and project_id to be linked after initial creation';



CREATE POLICY "Users can update their own comments" ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own ratings" ON "public"."ratings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view active company context" ON "public"."company_context" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Users can view own conversation documents" ON "public"."v2_conversation_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."v2_conversations"
  WHERE (("v2_conversations"."id" = "v2_conversation_documents"."conversation_id") AND ("v2_conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own conversations" ON "public"."v2_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own messages" ON "public"."v2_messages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own migration records" ON "public"."migration_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."v2_projects"
  WHERE (("v2_projects"."id" = "migration_tracking"."v2_project_id") AND ("v2_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own project documents" ON "public"."v2_project_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."v2_projects"
  WHERE (("v2_projects"."id" = "v2_project_documents"."project_id") AND ("v2_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own projects" ON "public"."v2_projects" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own research history" ON "public"."v2_research_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own comment history" ON "public"."comments_deleted" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own downloads" ON "public"."downloads" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."blog_analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_article_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_content_planner" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_seo_audits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments_deleted" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_context" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_insert" ON "public"."chat_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "conversations_select" ON "public"."chat_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "conversations_update" ON "public"."chat_conversations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."downloads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_conversations" "c"
  WHERE (("c"."id" = "chat_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "messages_select" ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_conversations" "c"
  WHERE (("c"."id" = "chat_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."migration_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."research_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."typologies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_download_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v2_conversation_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v2_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v2_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v2_project_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v2_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v2_research_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."view_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zonings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "analytics" TO "authenticated";
GRANT USAGE ON SCHEMA "analytics" TO "service_role";
GRANT USAGE ON SCHEMA "analytics" TO "anon";



GRANT USAGE ON SCHEMA "api" TO "anon";
GRANT USAGE ON SCHEMA "api" TO "authenticated";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";









































































































































































































GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_account_deletion"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_account_deletion"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_account_deletion"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."chat_assistant_set_turn"() TO "anon";
GRANT ALL ON FUNCTION "public"."chat_assistant_set_turn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_assistant_set_turn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."chat_finalize_turn"("p_conversation_id" "uuid", "p_user_id" "uuid", "p_document_id" "uuid", "p_user_message_id" "uuid", "p_ai_text" "text", "p_model_name" "text", "p_model_provider" "text", "p_model_version" "text", "p_tokens_prompt" integer, "p_tokens_completion" integer, "p_tokens_cached" integer, "p_cost_prompt" numeric, "p_cost_completion" numeric, "p_cost_cached" numeric, "p_response_time_ms" integer, "p_execution_id" "text", "p_extra_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."chat_finalize_turn"("p_conversation_id" "uuid", "p_user_id" "uuid", "p_document_id" "uuid", "p_user_message_id" "uuid", "p_ai_text" "text", "p_model_name" "text", "p_model_provider" "text", "p_model_version" "text", "p_tokens_prompt" integer, "p_tokens_completion" integer, "p_tokens_cached" integer, "p_cost_prompt" numeric, "p_cost_completion" numeric, "p_cost_cached" numeric, "p_response_time_ms" integer, "p_execution_id" "text", "p_extra_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_finalize_turn"("p_conversation_id" "uuid", "p_user_id" "uuid", "p_document_id" "uuid", "p_user_message_id" "uuid", "p_ai_text" "text", "p_model_name" "text", "p_model_provider" "text", "p_model_version" "text", "p_tokens_prompt" integer, "p_tokens_completion" integer, "p_tokens_cached" integer, "p_cost_prompt" numeric, "p_cost_completion" numeric, "p_cost_cached" numeric, "p_response_time_ms" integer, "p_execution_id" "text", "p_extra_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."chat_user_set_turn"() TO "anon";
GRANT ALL ON FUNCTION "public"."chat_user_set_turn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_user_set_turn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_comments"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_comments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_comments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_deletions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_deletions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_deletions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_conversation_turn"("p_conversation_id" "uuid", "p_user_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_conversation_turn"("p_conversation_id" "uuid", "p_user_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_conversation_turn"("p_conversation_id" "uuid", "p_user_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profile_for_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profile_for_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profile_for_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_comment_dual_table"("comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_comment_dual_table"("comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_comment_dual_table"("comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_download_limit_dynamic"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_download_limit_dynamic"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_download_limit_dynamic"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_free_download_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_free_download_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_free_download_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_deletion_status"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_deletion_status"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_deletion_status"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_allowed_downloads"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_allowed_downloads"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_allowed_downloads"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_profile_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_profile_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_profile_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_any_roles"("p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_any_roles"("p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_roles"("p_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "postgres";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "anon";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_comment_to_deleted_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_comment_to_deleted_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_comment_to_deleted_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_user_v1_to_v2"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_user_v1_to_v2"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_user_v1_to_v2"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_v1_conversation_to_v2"("p_v1_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_v1_conversation_to_v2"("p_v1_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_v1_conversation_to_v2"("p_v1_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_comment_from_deleted"("comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_comment_from_deleted"("comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_comment_from_deleted"("comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."schedule_account_deletion"("user_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_account_deletion"("user_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_account_deletion"("user_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_comment"("comment_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_comment"("comment_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_comment"("comment_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "service_role";



GRANT SELECT ON TABLE "analytics"."chat_events" TO "anon";
GRANT SELECT ON TABLE "analytics"."chat_events" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."document_usage" TO "anon";
GRANT SELECT ON TABLE "analytics"."document_usage" TO "authenticated";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT SELECT ON TABLE "analytics"."mv_document_popularity" TO "anon";
GRANT SELECT ON TABLE "analytics"."mv_document_popularity" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."mv_user_monthly_summary" TO "anon";
GRANT SELECT ON TABLE "analytics"."mv_user_monthly_summary" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."system_daily_metrics" TO "anon";
GRANT SELECT ON TABLE "analytics"."system_daily_metrics" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."user_daily_usage" TO "anon";
GRANT SELECT ON TABLE "analytics"."user_daily_usage" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."user_monthly_usage" TO "anon";
GRANT SELECT ON TABLE "analytics"."user_monthly_usage" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."v_user_current_month" TO "anon";
GRANT SELECT ON TABLE "analytics"."v_user_current_month" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."v_user_recent_activity" TO "anon";
GRANT SELECT ON TABLE "analytics"."v_user_recent_activity" TO "authenticated";
























GRANT ALL ON TABLE "public"."blog_analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."blog_analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."blog_article_tags" TO "anon";
GRANT ALL ON TABLE "public"."blog_article_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_article_tags" TO "service_role";



GRANT ALL ON TABLE "public"."blog_articles" TO "anon";
GRANT ALL ON TABLE "public"."blog_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_articles" TO "service_role";



GRANT ALL ON TABLE "public"."blog_categories" TO "anon";
GRANT ALL ON TABLE "public"."blog_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_categories" TO "service_role";



GRANT ALL ON TABLE "public"."blog_content_planner" TO "anon";
GRANT ALL ON TABLE "public"."blog_content_planner" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_content_planner" TO "service_role";



GRANT ALL ON TABLE "public"."blog_seo_audits" TO "anon";
GRANT ALL ON TABLE "public"."blog_seo_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_seo_audits" TO "service_role";



GRANT ALL ON TABLE "public"."blog_tags" TO "anon";
GRANT ALL ON TABLE "public"."blog_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_tags" TO "service_role";



GRANT ALL ON TABLE "public"."chat_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chat_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."comments_deleted" TO "anon";
GRANT ALL ON TABLE "public"."comments_deleted" TO "authenticated";
GRANT ALL ON TABLE "public"."comments_deleted" TO "service_role";



GRANT ALL ON TABLE "public"."company_context" TO "anon";
GRANT ALL ON TABLE "public"."company_context" TO "authenticated";
GRANT ALL ON TABLE "public"."company_context" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON TABLE "public"."downloads" TO "anon";
GRANT ALL ON TABLE "public"."downloads" TO "authenticated";
GRANT ALL ON TABLE "public"."downloads" TO "service_role";



GRANT ALL ON TABLE "public"."migration_tracking" TO "anon";
GRANT ALL ON TABLE "public"."migration_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."research_history" TO "anon";
GRANT ALL ON TABLE "public"."research_history" TO "authenticated";
GRANT ALL ON TABLE "public"."research_history" TO "service_role";



GRANT ALL ON TABLE "public"."typologies" TO "anon";
GRANT ALL ON TABLE "public"."typologies" TO "authenticated";
GRANT ALL ON TABLE "public"."typologies" TO "service_role";



GRANT ALL ON TABLE "public"."user_download_limits" TO "anon";
GRANT ALL ON TABLE "public"."user_download_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_download_limits" TO "service_role";



GRANT ALL ON TABLE "public"."v2_conversation_documents" TO "anon";
GRANT ALL ON TABLE "public"."v2_conversation_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."v2_conversation_documents" TO "service_role";



GRANT ALL ON TABLE "public"."v2_conversations" TO "anon";
GRANT ALL ON TABLE "public"."v2_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."v2_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."v2_messages" TO "anon";
GRANT ALL ON TABLE "public"."v2_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."v2_messages" TO "service_role";



GRANT ALL ON TABLE "public"."v2_project_documents" TO "anon";
GRANT ALL ON TABLE "public"."v2_project_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."v2_project_documents" TO "service_role";



GRANT ALL ON TABLE "public"."v2_projects" TO "anon";
GRANT ALL ON TABLE "public"."v2_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."v2_projects" TO "service_role";



GRANT ALL ON TABLE "public"."v2_research_history" TO "anon";
GRANT ALL ON TABLE "public"."v2_research_history" TO "authenticated";
GRANT ALL ON TABLE "public"."v2_research_history" TO "service_role";



GRANT ALL ON TABLE "public"."view_history" TO "anon";
GRANT ALL ON TABLE "public"."view_history" TO "authenticated";
GRANT ALL ON TABLE "public"."view_history" TO "service_role";



GRANT ALL ON TABLE "public"."zones" TO "anon";
GRANT ALL ON TABLE "public"."zones" TO "authenticated";
GRANT ALL ON TABLE "public"."zones" TO "service_role";



GRANT ALL ON TABLE "public"."zonings" TO "anon";
GRANT ALL ON TABLE "public"."zonings" TO "authenticated";
GRANT ALL ON TABLE "public"."zonings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT ON TABLES  TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























