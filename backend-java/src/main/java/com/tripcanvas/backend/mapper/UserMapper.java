package com.tripcanvas.backend.mapper;

import com.mybatisflex.core.BaseMapper;
import com.tripcanvas.backend.entity.UserEntity;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface UserMapper extends BaseMapper<UserEntity> {

    /** 原子自增 used_count，避免并发完成时读-改-写丢失更新。 */
    @Update("UPDATE users SET used_count = used_count + #{count} WHERE id = #{id}")
    int incrementUsedCount(@Param("id") String id, @Param("count") int count);

    /** 原子更新 quota，避免整行 update 覆盖并发的 used_count。 */
    @Update("UPDATE users SET quota = #{quota} WHERE id = #{id}")
    int updateQuota(@Param("id") String id, @Param("quota") int quota);

    /** 原子更新 quota 并重置 used_count。 */
    @Update("UPDATE users SET quota = #{quota}, used_count = 0 WHERE id = #{id}")
    int updateQuotaAndResetUsedCount(@Param("id") String id, @Param("quota") int quota);

    /** 一次聚合查询各邀请码对应的被邀请人数，消除 listInvites 的 N+1。 */
    @Select("SELECT invited_by AS invitedBy, COUNT(*) AS cnt FROM users WHERE invited_by IS NOT NULL GROUP BY invited_by")
    List<Map<String, Object>> selectInvitedCounts();
}