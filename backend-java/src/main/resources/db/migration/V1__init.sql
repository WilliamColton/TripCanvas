-- MySQL 版本初始化脚本。
-- 与 SQLite 版的差异：TEXT 主键/唯一键改 VARCHAR；时间戳与计数列改 BIGINT 避免 millis 溢出；
-- 布尔列改 TINYINT；带默认值的短文本改 VARCHAR 并保留默认值；JSON/长文本改 LONGTEXT（应用层插入时总会赋值，故去掉 TEXT 不支持的 DEFAULT）。
-- 索引使用 CREATE INDEX（MySQL 不支持 IF NOT EXISTS），重复创建由 spring.sql.init 的 continue-on-error 兜底。

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL,
  last_login_at BIGINT,
  quota BIGINT NOT NULL DEFAULT 0,
  unlimited_quota TINYINT NOT NULL DEFAULT 0,
  used_count BIGINT NOT NULL DEFAULT 0,
  password_hash VARCHAR(255),
  username VARCHAR(255),
  invite_code VARCHAR(64),
  invite_code_set_at BIGINT,
  invited_by VARCHAR(64),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_invite_code (invite_code)
);

CREATE INDEX idx_users_invited_by ON users(invited_by);

CREATE TABLE IF NOT EXISTS redemption_codes (
  id VARCHAR(64) NOT NULL,
  code VARCHAR(255) NOT NULL,
  quota BIGINT NOT NULL,
  used_by VARCHAR(64),
  used_at BIGINT,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_redemption_codes_code (code)
);

CREATE TABLE IF NOT EXISTS images (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  mime VARCHAR(64) NOT NULL,
  size BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  source VARCHAR(32) NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_user_sha256 ON images(user_id, sha256);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  prompt LONGTEXT NOT NULL,
  prompt_mode VARCHAR(32),
  template_id VARCHAR(64),
  template_resolution_id VARCHAR(64),
  template_resolution_name VARCHAR(255),
  template_title_snapshot VARCHAR(255),
  template_version BIGINT NOT NULL DEFAULT 0,
  template_inputs_json LONGTEXT,
  user_prompt LONGTEXT,
  assembled_prompt LONGTEXT,
  params_json LONGTEXT NOT NULL,
  actual_params_json LONGTEXT,
  actual_params_by_image_json LONGTEXT,
  revised_prompt_by_image_json LONGTEXT,
  input_image_ids_json LONGTEXT NOT NULL,
  mask_target_image_id VARCHAR(64),
  mask_image_id VARCHAR(64),
  output_image_ids_json LONGTEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  error LONGTEXT,
  is_favorite TINYINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  finished_at BIGINT,
  elapsed BIGINT,
  api_mode VARCHAR(32),
  codex_cli TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_prompt_mode ON tasks(prompt_mode);
CREATE INDEX idx_tasks_template_id ON tasks(template_id);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id VARCHAR(64) NOT NULL,
  owner_user_id VARCHAR(64),
  source VARCHAR(32) NOT NULL,
  visibility VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description LONGTEXT NOT NULL,
  field_schema_json LONGTEXT NOT NULL,
  resolution_options_json LONGTEXT NOT NULL,
  preview_image_id VARCHAR(64),
  prompt_body LONGTEXT NOT NULL,
  negative_prompt LONGTEXT NOT NULL,
  assembly_mode VARCHAR(32) NOT NULL DEFAULT 'sections',
  status VARCHAR(32) NOT NULL,
  sort_order BIGINT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  published_at BIGINT,
  PRIMARY KEY (id)
);

CREATE INDEX idx_prompt_templates_owner_user_id ON prompt_templates(owner_user_id);
CREATE INDEX idx_prompt_templates_source ON prompt_templates(source);
CREATE INDEX idx_prompt_templates_visibility ON prompt_templates(visibility);
CREATE INDEX idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX idx_prompt_templates_status ON prompt_templates(status);
CREATE INDEX idx_prompt_templates_sort_order ON prompt_templates(sort_order);
CREATE INDEX idx_prompt_templates_created_at ON prompt_templates(created_at);
CREATE INDEX idx_prompt_templates_published_at ON prompt_templates(published_at);
CREATE INDEX idx_prompt_templates_preview_image_id ON prompt_templates(preview_image_id);

CREATE TABLE IF NOT EXISTS announcements (
  id VARCHAR(64) NOT NULL,
  content LONGTEXT NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_label VARCHAR(255) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'bug',
  content LONGTEXT NOT NULL,
  contact VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_category ON feedbacks(category);
CREATE INDEX idx_feedbacks_status ON feedbacks(status);
CREATE INDEX idx_feedbacks_created_at ON feedbacks(created_at);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id VARCHAR(64) NOT NULL,
  version VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  published TINYINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  published_at BIGINT,
  PRIMARY KEY (id)
);

CREATE INDEX idx_changelog_entries_version ON changelog_entries(version);
CREATE INDEX idx_changelog_entries_published ON changelog_entries(published);
CREATE INDEX idx_changelog_entries_created_at ON changelog_entries(created_at);
CREATE INDEX idx_changelog_entries_updated_at ON changelog_entries(updated_at);
CREATE INDEX idx_changelog_entries_published_at ON changelog_entries(published_at);

CREATE TABLE IF NOT EXISTS billing_records (
  id VARCHAR(64) NOT NULL,
  task_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_label_snapshot VARCHAR(255) NOT NULL,
  endpoint_base_url_snapshot VARCHAR(512) NOT NULL,
  image_size VARCHAR(32) DEFAULT '',
  output_image_id VARCHAR(64) NOT NULL,
  success_image_count BIGINT NOT NULL DEFAULT 1,
  unit_cost_x10000 BIGINT NOT NULL,
  unit_sale_x10000 BIGINT NOT NULL,
  cost_x10000 BIGINT NOT NULL,
  revenue_x10000 BIGINT NOT NULL,
  profit_x10000 BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX idx_billing_records_task_id ON billing_records(task_id);
CREATE INDEX idx_billing_records_user_id ON billing_records(user_id);
CREATE INDEX idx_billing_records_endpoint ON billing_records(endpoint_base_url_snapshot);
CREATE INDEX idx_billing_records_image_size ON billing_records(image_size);
CREATE INDEX idx_billing_records_output_image_id ON billing_records(output_image_id);
CREATE INDEX idx_billing_records_created_at ON billing_records(created_at);