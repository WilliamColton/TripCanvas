package com.tripcanvas.backend.entity;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.KeyType;
import com.mybatisflex.annotation.Table;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Table("billing_records")
public class BillingRecordEntity {
    @Id(keyType = KeyType.None)
    private String id;
    @Column("task_id")
    private String taskId;
    @Column("user_id")
    private String userId;
    @Column("user_label_snapshot")
    private String userLabelSnapshot;
    @Column("endpoint_base_url_snapshot")
    private String endpointBaseUrlSnapshot;
    @Column("image_size")
    private String imageSize;
    @Column("output_image_id")
    private String outputImageId;
    @Column("success_image_count")
    private Integer successImageCount;
    @Column("unit_cost_x10000")
    private Long unitCostX10000;
    @Column("unit_sale_x10000")
    private Long unitSaleX10000;
    @Column("cost_x10000")
    private Long costX10000;
    @Column("revenue_x10000")
    private Long revenueX10000;
    @Column("profit_x10000")
    private Long profitX10000;
    @Column("created_at")
    private Long createdAt;
}
