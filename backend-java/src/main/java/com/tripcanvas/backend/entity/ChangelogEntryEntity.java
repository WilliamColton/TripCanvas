package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("changelog_entries")
public class ChangelogEntryEntity {
    @Id(keyType = KeyType.None)
    private String id;
    private String version;
    private String title;
    private String content;
    private Integer published;
    @Column("created_at")
    private Long createdAt;
    @Column("updated_at")
    private Long updatedAt;
    @Column("published_at")
    private Long publishedAt;
}
