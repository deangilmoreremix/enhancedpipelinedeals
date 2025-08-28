/*
  # Add AI Score Column to Contacts Table

  1. Schema Changes
    - Add `ai_score` column to `contacts` table
    - Type: integer (0-100 range)
    - Default: null (no score initially)
    - Add check constraint to ensure valid range

  2. Indexes
    - Add index on ai_score for filtering and sorting

  3. Notes
    - This column stores AI-generated scores for contact prioritization
    - Scores range from 0-100 indicating conversion likelihood
    - Null values indicate contacts that haven't been analyzed yet
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

-- Add check constraint to ensure ai_score is in valid range (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contacts_ai_score_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_ai_score_check 
    CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100));
  END IF;
END $$;

-- Add index on ai_score for performance
CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON contacts (ai_score);

-- Add comment explaining the column
COMMENT ON COLUMN contacts.ai_score IS 'AI-generated score (0-100) indicating contact conversion likelihood. NULL means not yet analyzed.';