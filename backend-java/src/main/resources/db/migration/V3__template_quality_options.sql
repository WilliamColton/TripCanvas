ALTER TABLE prompt_templates
  ADD COLUMN quality_options_json LONGTEXT;

ALTER TABLE tasks
  ADD COLUMN template_quality_id VARCHAR(64),
  ADD COLUMN template_quality_name VARCHAR(255);
