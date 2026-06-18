package com.tripcanvas.backend.config;

import com.tripcanvas.backend.entity.AnnouncementEntity;
import com.tripcanvas.backend.entity.PromptTemplateEntity;
import com.tripcanvas.backend.entity.TaskEntity;
import com.tripcanvas.backend.entity.UserEntity;
import com.tripcanvas.backend.dto.response.PromptTemplateFieldResponse;
import com.tripcanvas.backend.mapper.AnnouncementMapper;
import com.tripcanvas.backend.mapper.PromptTemplateMapper;
import com.tripcanvas.backend.mapper.TaskMapper;
import com.tripcanvas.backend.mapper.UserMapper;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.JsonUtils;
import com.tripcanvas.backend.util.Times;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseBootstrap implements ApplicationRunner {
    private static final String ANNOUNCEMENT_ID = "default";

    private final UserMapper userMapper;
    private final TaskMapper taskMapper;
    private final AnnouncementMapper announcementMapper;
    private final PromptTemplateMapper promptTemplateMapper;
    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        ensureSchemaColumns();
        recoverStaleTasks();
        initAdmin();
        initAnnouncement();
        initDefaultPromptTemplates();
    }

    private void ensureSchemaColumns() {
        addColumnIfMissing("prompt_templates", "resolution_options_json", "resolution_options_json TEXT NOT NULL DEFAULT '[]'");
        addColumnIfMissing("tasks", "template_resolution_id", "template_resolution_id TEXT");
        addColumnIfMissing("tasks", "template_resolution_name", "template_resolution_name TEXT");
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        boolean exists = false;
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rows.next()) {
                if (column.equalsIgnoreCase(rows.getString("name"))) {
                    exists = true;
                    break;
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("读取数据库结构失败", e);
        }
        if (exists) {
            return;
        }
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + table + " ADD COLUMN " + definition);
        } catch (SQLException e) {
            throw new IllegalStateException("补齐数据库字段失败", e);
        }
        log.info("已补齐数据库字段 {}.{}", table, column);
    }

    private void recoverStaleTasks() {
        long now = Times.nowMillis();
        String message = "服务重启，任务中断";
        List<TaskEntity> tasks = taskMapper.selectListByQuery(FlexQuery.where("status IN ('queued','running')"));
        for (TaskEntity task : tasks) {
            task.setStatus("error")
                .setError(message)
                .setFinishedAt(now)
                .setElapsed(task.getCreatedAt() == null ? 0L : now - task.getCreatedAt());
            taskMapper.update(task);
        }
        if (!tasks.isEmpty()) {
            log.warn("已将 stale 任务标记为 error count={}", tasks.size());
        }
    }

    private void initAdmin() {
        long count = userMapper.selectCountByQuery(FlexQuery.eq("role", "admin"));
        if (count > 0) {
            return;
        }
        UserEntity admin = new UserEntity()
            .setId(Ids.generate())
            .setLabel("admin")
            .setRole("admin")
            .setStatus("active")
            .setQuota(0)
            .setUnlimitedQuota(0)
            .setUsedCount(0)
            .setCreatedAt(Times.nowMillis());
        userMapper.insert(admin);
    }

    private void initAnnouncement() {
        if (announcementMapper.selectOneById(ANNOUNCEMENT_ID) != null) {
            return;
        }
        announcementMapper.insert(new AnnouncementEntity()
            .setId(ANNOUNCEMENT_ID)
            .setContent("")
            .setEnabled(0)
            .setUpdatedAt(Times.nowMillis()));
    }

    private void initDefaultPromptTemplates() {
        long now = Times.nowMillis();
        for (DefaultTemplate template : defaultTemplates()) {
            long count = promptTemplateMapper.selectCountByQuery(
                FlexQuery.and(FlexQuery.eq("source", "admin"), "title = ?", template.title())
            );
            if (count > 0) {
                continue;
            }
            promptTemplateMapper.insert(new PromptTemplateEntity()
                .setId(Ids.generate())
                .setSource("admin")
                .setVisibility("public")
                .setTitle(template.title())
                .setCategory(template.category())
                .setDescription(template.description())
                .setFieldSchemaJson(JsonUtils.stringify(template.fields()))
                .setResolutionOptionsJson("[]")
                .setPromptBody(template.promptBody())
                .setNegativePrompt("")
                .setAssemblyMode("sections")
                .setStatus("published")
                .setSortOrder(template.sortOrder())
                .setVersion(1)
                .setCreatedAt(now)
                .setUpdatedAt(now)
                .setPublishedAt(now));
        }
    }

    private List<DefaultTemplate> defaultTemplates() {
        return List.of(
            new DefaultTemplate(
                "目的地旅行海报",
                "旅行海报",
                "适合生成城市或景区宣传海报，突出目的地氛围与旅行主题。",
                "生成一张高质量旅行目的地海报，目的地是 {目的地}，季节或时间是 {季节}，旅行主题是 {旅行主题}，画面风格是 {画面风格}。如果需要文字，只呈现以下海报文案：{海报文案}。画面应有明确旅行感、优秀构图、明亮干净的视觉层次。",
                List.of(
                    field("目的地", "目的地", true, "例如：京都、巴黎、洱海", 60),
                    field("季节", "季节/时间", true, "例如：秋季、清晨、黄金周", 40),
                    field("旅行主题", "旅行主题", true, "例如：亲子旅行、蜜月、独行", 60),
                    field("画面风格", "画面风格", true, "例如：明亮通透、日系胶片", 60),
                    field("海报文案", "海报文案", false, "可留空", 80)
                ),
                10
            ),
            new DefaultTemplate(
                "行程封面图",
                "行程封面",
                "为多日旅行计划生成封面图，适合攻略、行程单和分享页。",
                "生成一张旅行行程封面图，城市列表是 {城市列表}，行程天数是 {天数}，出行方式是 {出行方式}，旅行人群是 {旅行人群}，标题文字是 {标题}。整体要像精致旅行攻略封面，构图清晰，具有路线感和目的地辨识度。",
                List.of(
                    field("城市列表", "城市列表", true, "例如：大阪、京都、奈良", 100),
                    field("天数", "天数", true, "例如：5 天 4 晚", 30),
                    field("出行方式", "出行方式", false, "例如：自驾、铁路、徒步", 40),
                    field("旅行人群", "旅行人群", false, "例如：情侣、家庭、朋友", 40),
                    field("标题", "标题", true, "例如：关西初秋五日行", 80)
                ),
                20
            ),
            new DefaultTemplate(
                "旅行明信片",
                "旅行明信片",
                "生成带有目的地记忆感的明信片画面。",
                "生成一张旅行明信片风格图片，目的地是 {目的地}，祝福语或短句是 {祝福语}，整体色调是 {色调}，年代感是 {年代感}，构图偏好是 {构图}。画面要温暖、有纪念意义，避免杂乱文字。",
                List.of(
                    field("目的地", "目的地", true, null, 60),
                    field("祝福语", "祝福语", false, "例如：Wish you were here", 80),
                    field("色调", "色调", false, "例如：暖橙、蓝绿色", 40),
                    field("年代感", "年代感", false, "例如：复古 90 年代、现代简洁", 50),
                    field("构图", "构图", false, "例如：远景、街角、留白", 50)
                ),
                30
            )
        );
    }

    private PromptTemplateFieldResponse field(String key, String label, boolean required, String placeholder, int maxLength) {
        return new PromptTemplateFieldResponse(key, label, "short_text", required, placeholder, null, null, null, maxLength);
    }

    private record DefaultTemplate(
        String title,
        String category,
        String description,
        String promptBody,
        List<PromptTemplateFieldResponse> fields,
        int sortOrder
    ) {
    }
}
