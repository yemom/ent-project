package com.clinic.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Dated, role-scoped appointment counts and a transparent deterministic baseline. */
public record AiHistoricalForecastResponse(
        String metric,
        String scope,
        LocalDate from,
        LocalDate to,
        LocalDateTime computedAt,
        String method,
        int observationCount,
        boolean sufficientHistory,
        String limitation,
        List<Point> actual,
        List<Point> predicted,
        List<String> sources,
        List<Insight> insights
) {
    public record Point(LocalDate date, long value) { }
    public record Insight(String kind, String title, String explanation, String period, String source) { }
}
