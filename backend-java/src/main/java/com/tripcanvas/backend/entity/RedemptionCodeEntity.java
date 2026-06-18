package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("redemption_codes")
public class RedemptionCodeEntity {
    @Id(keyType = KeyType.None)
    private String id;
    private String code;
    private Integer quota;
    @Column("used_by")
    private String usedBy;
    @Column("used_at")
    private Long usedAt;
    @Column("created_at")
    private Long createdAt;
}
