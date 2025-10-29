/*
  # Fix Double-Nested Auth Calls in RLS Policies

  ## Overview
  This migration fixes policies that have double-nested SELECT statements
  and ensures all policies use the clean (select auth.uid()) pattern.

  ## Problem
  Previous migration created patterns like:
  - ( SELECT ( SELECT auth.uid() AS uid) AS uid)
  - ( SELECT auth.uid() AS uid)
  
  Both need to be simplified to:
  - (select auth.uid())

  ## Solution
  Use string replacement to normalize all variations to the optimal pattern.
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
  LOOP
    updated := false;
    
    -- Process USING clause
    IF policy_record.qual IS NOT NULL THEN
      new_qual := policy_record.qual;
      
      -- Fix triple nesting first
      WHILE position('( SELECT ( SELECT ( SELECT auth.uid()' in new_qual) > 0 LOOP
        new_qual := replace(new_qual, '( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)', '(select auth.uid())');
        updated := true;
      END LOOP;
      
      -- Fix double nesting
      WHILE position('( SELECT ( SELECT auth.uid()' in new_qual) > 0 LOOP
        new_qual := replace(new_qual, '( SELECT ( SELECT auth.uid() AS uid) AS uid)', '(select auth.uid())');
        updated := true;
      END LOOP;
      
      -- Fix single nesting with AS uid
      WHILE position('( SELECT auth.uid() AS uid)' in new_qual) > 0 LOOP
        new_qual := replace(new_qual, '( SELECT auth.uid() AS uid)', '(select auth.uid())');
        updated := true;
      END LOOP;
      
      -- Fix bare auth.uid() calls (but not already wrapped ones)
      IF position('auth.uid()' in new_qual) > 0 AND position('select auth.uid()' in new_qual) = 0 THEN
        new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
        updated := true;
      END IF;
    ELSE
      new_qual := NULL;
    END IF;

    -- Process WITH CHECK clause
    IF policy_record.with_check IS NOT NULL THEN
      new_with_check := policy_record.with_check;
      
      -- Fix triple nesting first
      WHILE position('( SELECT ( SELECT ( SELECT auth.uid()' in new_with_check) > 0 LOOP
        new_with_check := replace(new_with_check, '( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)', '(select auth.uid())');
        updated := true;
      END LOOP;
      
      -- Fix double nesting
      WHILE position('( SELECT ( SELECT auth.uid()' in new_with_check) > 0 LOOP
        new_with_check := replace(new_with_check, '( SELECT ( SELECT auth.uid() AS uid) AS uid)', '(select auth.uid())');
        updated := true;
      END LOOP;
      
      -- Fix single nesting with AS uid
      WHILE position('( SELECT auth.uid() AS uid)' in new_with_check) > 0 LOOP
        new_with_check := replace(new_with_check, '( SELECT auth.uid() AS uid)', '(select auth.uid())');
        updated := true;
      END LOOP;
      
      -- Fix bare auth.uid() calls
      IF position('auth.uid()' in new_with_check) > 0 AND position('select auth.uid()' in new_with_check) = 0 THEN
        new_with_check := replace(new_with_check, 'auth.uid()', '(select auth.uid())');
        updated := true;
      END IF;
    ELSE
      new_with_check := NULL;
    END IF;

    -- Only recreate policy if changes were made
    IF updated THEN
      -- Drop the old policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );

      -- Recreate with corrected syntax
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

      RAISE NOTICE 'Fixed auth nesting in policy % on %', policy_record.policyname, policy_record.tablename;
    END IF;
  END LOOP;
END $$;
