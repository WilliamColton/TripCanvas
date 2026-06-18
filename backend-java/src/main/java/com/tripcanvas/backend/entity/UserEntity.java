package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("users")
public class UserEntity {
    @Id(keyType = KeyType.None)
    private String id;
    private String label;
    private String role;
    private String status;
    @Column("created_at")
    private Long createdAt;
    @Column("last_login_at")
    private Long lastLoginAt;
    private Integer quota;
    @Column("unlimited_quota")
    private Integer unlimitedQuota;
    @Column("used_count")
    private Integer usedCount;
    @Column("password_hash")
    private String passwordHash;
    private String username;
    @Column("invite_code")
    private String inviteCode;
    @Column("invite_code_set_at")
    private Long inviteCodeSetAt;
    @Column("invited_by")
    private String invitedBy;
}
