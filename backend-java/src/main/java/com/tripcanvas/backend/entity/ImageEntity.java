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
}
