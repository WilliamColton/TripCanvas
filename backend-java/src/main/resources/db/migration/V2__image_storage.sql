-- 接入腾讯云 COS：扩展 images 表以支持对象存储。
-- storage_type: local | cos （NULL 视为 local，兼容历史数据）
-- storage_key: 对象存储 key（COS 模式）或本地相对路径（与 file_path 一致）
-- public_url: 预签名或公开直链；为空时由后端按需生成
-- file_path 保持 NOT NULL（新数据填入 storage_key 同值），历史数据不变。
-- MySQL：ALTER TABLE ADD COLUMN 幂等由 continue-on-error 兜底；索引用 CREATE INDEX（无 IF NOT EXISTS）。

ALTER TABLE images ADD COLUMN storage_type VARCHAR(16);
ALTER TABLE images ADD COLUMN storage_key VARCHAR(512);
ALTER TABLE images ADD COLUMN public_url VARCHAR(2048);

CREATE INDEX idx_images_storage_key ON images(storage_key);