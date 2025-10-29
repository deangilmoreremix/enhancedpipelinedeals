/*
  # Finalize RLS Policy Optimization

  ## Overview
  This migration completes the RLS optimization by handling edge cases and ensuring
  all auth.uid() calls are properly wrapped in subqueries without double-nesting.

  ## Changes
  - Fix double-nested SELECT statements created by previous migration
  - Optimize remaining policies that use SELECT auth.uid() AS uid format
  - Ensure consistent (select auth.uid()) pattern across all policies

  ## Performance Impact
  Completes the optimization started in previous migration, ensuring all 
  policies benefit from single-evaluation auth function calls.
*/

DO $$
DECLARE
  policy_record RECORD;
  new_qual TEXT;
  new_with_check TEXT;
BEGIN
  -- Loop through all remaining policies with auth.uid() variations
  FOR policy_record IN 
    SELECT 
      schemaname,
      tablename,
      policyname,
      cmd,
      qual,
      with_check
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND (
        qual LIKE '%auth.uid()%' 
        OR with_check LIKE '%auth.uid()%'
      )
  LOOP
    -- Process USING clause
    IF policy_record.qual IS NOT NULL THEN
      new_qual := policy_record.qual;
      
      -- Replace double-nested selects with single select
      new_qual := regexp_replace(new_qual, '\( SELECT \( SELECT auth\.uid\(\) AS uid\) AS uid\)', '(select auth.uid())', 'g');
      
      -- Replace ( SELECT auth.uid() AS uid) with (select auth.uid())
      new_qual := regexp_replace(new_qual, '\( SELECT auth\.uid\(\) AS uid\)', '(select auth.uid())', 'g');
      
      -- Replace any remaining bare auth.uid() with (select auth.uid())
      new_qual := regexp_replace(new_qual, '([^(]|^)auth\.uid\(\)', '\1(select auth.uid())', 'g');
    ELSE
      new_qual := NULL;
    END IF;

    -- Process WITH CHECK clause
    IF policy_record.with_check IS NOT NULL THEN
      new_with_check := policy_record.with_check;
      
      -- Replace double-nested selects with single select
      new_with_check := regexp_replace(new_with_check, '\( SELECT \( SELECT auth\.uid\(\) AS uid\) AS uid\)', '(select auth.uid())', 'g');
      
      -- Replace ( SELECT auth.uid() AS uid) with (select auth.uid())
      new_with_check := regexp_replace(new_with_check, '\( SELECT auth\.uid\(\) AS uid\)', '(select auth.uid())', 'g');
      
      -- Replace any remaining bare auth.uid() with (select auth.uid())
      new_with_check := regexp_replace(new_with_check, '([^(]|^)auth\.uid\(\)', '\1(select auth.uid())', 'g');
    ELSE
      new_with_check := NULL;
    END IF;

    -- Only update if there were changes
    IF (new_qual IS DISTINCT FROM policy_record.qual) OR 
       (new_with_check IS DISTINCT FROM policy_record.with_check) THEN
      
      -- Drop the old policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );

      -- Recreate the policy with optimized auth function calls
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO authenticated',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename,
        policy_record.cmd
      ) ||
      CASE 
        WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual)
        ELSE ''
      END ||
      CASE 
        WHEN new_with_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_with_check)
        ELSE ''
      END;

      RAISE NOTICE 'Finalized optimization for policy % on table %', policy_record.policyname, policy_record.tablename;
    END IF;
  END LOOP;
END $$;
