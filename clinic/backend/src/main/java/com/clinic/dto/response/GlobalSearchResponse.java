package com.clinic.dto.response;

import java.util.List;

/**
 * Grouped search results. Every list is present (possibly empty) so the UI can
 * render stable sections instead of conditionally checking field presence.
 */
public record GlobalSearchResponse(
        String query,
        int totalResults,
        List<Hit> users,
        List<Hit> patients,
        List<Hit> doctors,
        List<Hit> appointments,
        List<Hit> invoices,
        List<Hit> departments
) {
    public record Hit(
            String id,
            String type,
            String title,
            String subtitle,
            /** Frontend route that opens the record. */
            String link
    ) {
    }
}