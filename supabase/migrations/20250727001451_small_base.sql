/*
  # Add Gamification Features to Contacts Table

  1. Schema Changes
    - Add `is_team_member` column (BOOLEAN) to identify team members
    - Add `role` column (TEXT) to store team member roles
    - Add `gamification_stats` column (JSONB) to store gamification data
  
  2. Data Structure
    - `is_team_member`: Boolean flag indicating if contact is a team member
    - `role`: Team member role (sales-rep, manager, executive, admin)
    - `gamification_stats`: JSON object containing:
      - totalDeals: number of deals closed
      - totalRevenue: total revenue generated
      - totalLost: number of deals lost
      - winRate: percentage of deals won
      - currentStreak: current winning streak
      - longestStreak: longest winning streak achieved
      - level: current gamification level
      - points: total gamification points
      - achievements: array of achievement IDs
      - lastAchievementDate: timestamp of last achievement
      - monthlyGoal: monthly revenue/deal target
      - monthlyProgress: current month progress

  3. Security
    - No changes to existing RLS policies
    - Gamification data inherits existing contact security

  4. Notes
    - Uses IF NOT EXISTS to prevent errors on re-run
    - Provides sensible defaults for new columns
    - Preserves existing contact data
*/

-- Add is_team_member column to identify team members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'is_team_member'
  ) THEN
    ALTER TABLE contacts ADD COLUMN is_team_member BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add role column for team member roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'role'
  ) THEN
    ALTER TABLE contacts ADD COLUMN role TEXT;
  END IF;
END $$;

-- Add gamification_stats column for storing gamification data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'gamification_stats'
  ) THEN
    ALTER TABLE contacts ADD COLUMN gamification_stats JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add constraint to ensure valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contacts_role_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_role_check 
    CHECK (role IS NULL OR role IN ('sales-rep', 'manager', 'executive', 'admin'));
  END IF;
END $$;

-- Create index on is_team_member for efficient queries
CREATE INDEX IF NOT EXISTS idx_contacts_is_team_member ON contacts(is_team_member);

-- Create index on role for team member queries
CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(role) WHERE is_team_member = true;

-- Create index on gamification_stats for performance queries
CREATE INDEX IF NOT EXISTS idx_contacts_gamification_points ON contacts USING GIN ((gamification_stats->'points')) WHERE is_team_member = true;

-- Update existing contacts that might be team members (optional - based on your existing data)
-- This is commented out as it should be run manually if needed
/*
UPDATE contacts 
SET is_team_member = true, 
    role = 'sales-rep',
    gamification_stats = jsonb_build_object(
      'totalDeals', 0,
      'totalRevenue', 0,
      'totalLost', 0,
      'winRate', 0,
      'currentStreak', 0,
      'longestStreak', 0,
      'level', 1,
      'points', 0,
      'achievements', '[]'::jsonb,
      'monthlyGoal', 50000,
      'monthlyProgress', 0
    )
WHERE id IN (
  -- Add specific contact IDs that should be team members
  -- Example: 'contact-1', 'contact-2', 'contact-7'
);
*/