package com.clinic.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Server-computed operational forecast facts. This response is not model output.
 */
public record AiForecastResponse(
        Map<String, Object> facts,
        List<String> sources,
        LocalDateTime computedAt
) {
}
