package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.generation.ImageFileInput;
import com.tripcanvas.backend.dto.generation.ImageGenerationResult;
import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import java.util.List;

public interface ImageGenerationClient {
    ImageGenerationResult generate(String prompt, TaskParamsResponse params, int n, boolean codexCli, Runnable onAcquired, List<ApiEndpointResponse> endpoints);

    ImageGenerationResult edit(String prompt, TaskParamsResponse params, List<ImageFileInput> imageFiles, ImageFileInput maskFile, int n, boolean codexCli, Runnable onAcquired, List<ApiEndpointResponse> endpoints);
}
