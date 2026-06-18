package com.tripcanvas.backend.dto.generation;

import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import java.util.List;

public record ImageGenerationResult(
    List<GeneratedImage> images,
    TaskParamsResponse actualParams
) {
}
