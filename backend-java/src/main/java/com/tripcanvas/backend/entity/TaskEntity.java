package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("tasks")
public class TaskEntity {
    @Id(keyType = KeyType.None)
    private String id;
    @Column("user_id")
    private String userId;
    private String prompt;
    @Column("prompt_mode")
    private String promptMode;
    @Column("template_id")
    private String templateId;
    @Column("template_resolution_id")
    private String templateResolutionId;
    @Column("template_resolution_name")
    private String templateResolutionName;
    @Column("template_quality_id")
    private String templateQualityId;
    @Column("template_quality_name")
    private String templateQualityName;
    @Column("template_title_snapshot")
    private String templateTitleSnapshot;
    @Column("template_version")
    private Integer templateVersion;
    @Column("credit_cost")
    private Integer creditCost;
    @Column("template_inputs_json")
    private String templateInputsJson;
    @Column("user_prompt")
    private String userPrompt;
    @Column("assembled_prompt")
    private String assembledPrompt;
    @Column("params_json")
    private String paramsJson;
    @Column("actual_params_json")
    private String actualParamsJson;
    @Column("actual_params_by_image_json")
    private String actualParamsByImageJson;
    @Column("revised_prompt_by_image_json")
    private String revisedPromptByImageJson;
    @Column("input_image_ids_json")
    private String inputImageIdsJson;
    @Column("mask_target_image_id")
    private String maskTargetImageId;
    @Column("mask_image_id")
    private String maskImageId;
    @Column("output_image_ids_json")
    private String outputImageIdsJson;
    private String status;
    private String error;
    @Column("is_favorite")
    private Integer isFavorite;
    @Column("created_at")
    private Long createdAt;
    @Column("finished_at")
    private Long finishedAt;
    private Long elapsed;
    @Column("api_mode")
    private String apiMode;
    @Column("codex_cli")
    private Integer codexCli;
}
