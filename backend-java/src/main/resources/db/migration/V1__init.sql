CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  quota INTEGER NOT NULL DEFAULT 0,
  unlimited_quota INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  username TEXT UNIQUE,
  invite_code TEXT UNIQUE,
  invite_code_set_at INTEGER,
  invited_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by);

CREATE TABLE IF NOT EXISTS redemption_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  quota INTEGER NOT NULL,
  used_by TEXT,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_user_sha256 ON images(user_id, sha256);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  prompt_mode TEXT,
  template_id TEXT,
  template_resolution_id TEXT,
  template_resolution_name TEXT,
  template_title_snapshot TEXT,
  template_version INTEGER NOT NULL DEFAULT 0,
  template_inputs_json TEXT,
  user_prompt TEXT,
  assembled_prompt TEXT,
  params_json TEXT NOT NULL,
  actual_params_json TEXT,
  actual_params_by_image_json TEXT,
  revised_prompt_by_image_json TEXT,
  input_image_ids_json TEXT NOT NULL,
  mask_target_image_id TEXT,
  mask_image_id TEXT,
  output_image_ids_json TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  elapsed INTEGER,
  api_mode TEXT,
  codex_cli INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_prompt_mode ON tasks(prompt_mode);
CREATE INDEX IF NOT EXISTS idx_tasks_template_id ON tasks(template_id);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  source TEXT NOT NULL,
  visibility TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  field_schema_json TEXT NOT NULL,
  resolution_options_json TEXT NOT NULL DEFAULT '[]',
  preview_image_id TEXT,
  prompt_body TEXT NOT NULL,
  negative_prompt TEXT NOT NULL DEFAULT '',
  assembly_mode TEXT NOT NULL DEFAULT 'sections',
  status TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_owner_user_id ON prompt_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_source ON prompt_templates(source);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_visibility ON prompt_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_status ON prompt_templates(status);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_sort_order ON prompt_templates(sort_order);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_created_at ON prompt_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_published_at ON prompt_templates(published_at);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_preview_image_id ON prompt_templates(preview_image_id);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bug',
  content TEXT NOT NULL,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks(category);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_version ON changelog_entries(version);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_published ON changelog_entries(published);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_created_at ON changelog_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_updated_at ON changelog_entries(updated_at);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_published_at ON changelog_entries(published_at);

CREATE TABLE IF NOT EXISTS billing_records (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_label_snapshot TEXT NOT NULL,
  endpoint_base_url_snapshot TEXT NOT NULL,
  image_size TEXT DEFAULT '',
  output_image_id TEXT NOT NULL,
  success_image_count INTEGER NOT NULL DEFAULT 1,
  unit_cost_x10000 INTEGER NOT NULL,
  unit_sale_x10000 INTEGER NOT NULL,
  cost_x10000 INTEGER NOT NULL,
  revenue_x10000 INTEGER NOT NULL,
  profit_x10000 INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_records_task_id ON billing_records(task_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_user_id ON billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_endpoint ON billing_records(endpoint_base_url_snapshot);
CREATE INDEX IF NOT EXISTS idx_billing_records_image_size ON billing_records(image_size);
CREATE INDEX IF NOT EXISTS idx_billing_records_output_image_id ON billing_records(output_image_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_created_at ON billing_records(created_at);
