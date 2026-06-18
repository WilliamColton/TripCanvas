package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("prompt_templates")
public class PromptTemplateEntity {
    @Id(keyType = KeyType.None)
    private String id;
    @Column("owner_user_id")
    private String ownerUserId;
    private String source;
    private String visibility;
    private String title;
    private String category;
    private String description;
    @Column("field_schema_json")
    private String fieldSchemaJson;
    @Column("resolution_options_json")
    private String resolutionOptionsJson;
    @Column("preview_image_id")
    private String previewImageId;
    @Column("prompt_body")
    private String promptBody;
    @Column("negative_prompt")
    private String negativePrompt;
    @Column("assembly_mode")
    private String assemblyMode;
    private String status;
    @Column("sort_order")
    private Integer sortOrder;
    private Integer version;
    @Column("created_at")
    private Long createdAt;
    @Column("updated_at")
    private Long updatedAt;
    @Column("published_at")
    private Long publishedAt;
}
