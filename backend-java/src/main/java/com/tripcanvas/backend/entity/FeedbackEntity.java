package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("feedbacks")
public class FeedbackEntity {
    @Id(keyType = KeyType.None)
    private String id;
    @Column("user_id")
    private String userId;
    @Column("user_label")
    private String userLabel;
    private String category;
    private String content;
    private String contact;
    private String status;
    @Column("created_at")
    private Long createdAt;
    @Column("updated_at")
    private Long updatedAt;
}
