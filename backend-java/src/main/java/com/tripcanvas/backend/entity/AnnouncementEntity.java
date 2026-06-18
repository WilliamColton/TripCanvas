package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("announcements")
public class AnnouncementEntity {
    @Id(keyType = KeyType.None)
    private String id;
    private String content;
    private Integer enabled;
    @Column("updated_at")
    private Long updatedAt;
}
