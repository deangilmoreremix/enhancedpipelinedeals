/*
  # Complete Auth Function Optimization in RLS Policies

  ## Overview
  Final migration to ensure all auth.uid() calls are optimized for performance.
  Handles all PostgreSQL formatting variations.

  ## Changes
  - Replaces all variations of auth.uid() calls with (select auth.uid())
  - Handles uppercase SELECT from PostgreSQL's internal representation
  - Ensures consistent, optimized pattern across all 113+ tables

  ## Performance Impact
  Once complete, all queries will benefit from single-evaluation of auth functions,
  dramatically improving performance at scale.
*/

DO $$
DECLARE
  policy_record RECORD;
  new_qual TEXT;
  new_with_check TEXT;
  updated BOOLEAN;
BEGIN
  FOR policy_record IN 
    SELECT 
      schemaname,
      tablename,
      policyname,
      cmd,
      qual,
      with_check,
      roles
    FROM pg_policies 
    WHERE schemaname = 'public'
      AND (qual IS NOT NULL OR with_check IS NOT NULL)
  LOOP
    updated := false;
    new_qual := policy_record.qual;
    new_with_check := policy_record.with_check;
    
    -- Process USING clause
    IF new_qual IS NOT NULL THEN
      -- Replace all variations with lowercase (select auth.uid())
      -- This handles: ( SELECT auth.uid() AS uid), (SELECT auth.uid()), etc.
      new_qual := regexp_replace(new_qual, '\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+\w+)?\s*\)', '(select auth.uid())', 'gi');
      
      -- Handle any remaining bare auth.uid() that isn't already in a select
      IF new_qual ~ 'auth\.uid\(\)' AND new_qual !~ '\(select auth\.uid\(\)\)' THEN
        -- Only replace if not already wrapped
        new_qual := regexp_replace(new_qual, '(?<!\(select )auth\.uid\(\)', '(select auth.uid())', 'g');
      END IF;
      
      IF new_qual != policy_record.qual THEN
        updated := true;
      END IF;
    END IF;

    -- Process WITH CHECK clause  
    IF new_with_check IS NOT NULL THEN
      -- Replace all variations with lowercase (select auth.uid())
      new_with_check := regexp_replace(new_with_check, '\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+\w+)?\s*\)', '(select auth.uid())', 'gi');
      
      -- Handle any remaining bare auth.uid()
      IF new_with_check ~ 'auth\.uid\(\)' AND new_with_check !~ '\(select auth\.uid\(\)\)' THEN
        new_with_check := regexp_replace(new_with_check, '(?<!\(select )auth\.uid\(\)', '(select auth.uid())', 'g');
      END IF;
      
      IF new_with_check != policy_record.with_check THEN
        updated := true;
      END IF;
    END IF;

    -- Recreate policy if it was updated
    IF updated THEN
      BEGIN
        -- Drop the old policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
          policy_record.policyname,
          policy_record.schemaname,
          policy_record.tablename
        );

        -- Recreate with optimized auth calls
        EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO %s',
          policy_record.policyname,
          policy_record.schemaname,
          policy_record.tablename,
          policy_record.cmd,
          array_to_string(policy_record.roles, ', ')
        ) ||
        CASE 
          WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual)
          ELSE ''
        END ||
        CASE 
          WHEN new_with_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_with_check)
          ELSE ''
        END;

        RAISE NOTICE 'Optimized % on %.%', policy_record.policyname, policy_record.schemaname, policy_record.tablename;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to optimize policy % on %.%: %', 
          policy_record.policyname, policy_record.schemaname, policy_record.tablename, SQLERRM;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS optimization complete!';
END $$;
