-- Add education, experience, academic year, and card validity dates to personnel
ALTER TABLE personnel 
  ADD COLUMN IF NOT EXISTS education_history text,
  ADD COLUMN IF NOT EXISTS experience_history text,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS card_issue_date text,
  ADD COLUMN IF NOT EXISTS card_expire_date text;
