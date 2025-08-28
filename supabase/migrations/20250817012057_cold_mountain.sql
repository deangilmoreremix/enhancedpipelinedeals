/*
  # Add AI Score column to contacts table

  1. New Columns
    - `ai_score` (integer, nullable)
      - Stores AI-generated contact score (0-100)
      - Nullable to allow existing contacts without scores

  2. Indexes
    - Add index on ai_score for performance

  3. Security
    - No changes to RLS policies needed (inherits from contacts table)
*/

-- Add ai_score column to contacts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'ai_score'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ai_score integer;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON contacts (ai_score);

-- Add check constraint to ensure score is between 0-100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contacts_ai_score_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_ai_score_check CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100));
  END IF;
END $$;