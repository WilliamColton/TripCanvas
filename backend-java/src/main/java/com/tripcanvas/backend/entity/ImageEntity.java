package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("images")
public class ImageEntity {
    @Id(keyType = KeyType.None)
    private String id;
    @Column("user_id")
    private String userId;
    @Column("file_path")
    private String filePath;
    private String mime;
    private Long size;
    private String sha256;
    private String source;
    @Column("created_at")
    private Long createdAt;
    /** 存储类型：local | cos，NULL 视为 local。 */
    @Column("storage_type")
    private String storageType;
    /** 对象存储 key 或本地相对路径。 */
    @Column("storage_key")
    private String storageKey;
    /** 对外访问 URL（预签名或公开直链），可空，按需生成。 */
    @Column("public_url")
    private String publicUrl;
}