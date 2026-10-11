package com.clinic.service;

import com.clinic.dto.response.GlobalSearchResponse;
import org.springframework.data.domain.Pageable;

/**
 * Cross-entity search for the admin command bar.
 *
 * <p>Results are scoped to what the caller may see: a patient never sees other
 * patients, and a clinical role only sees entities its permissions cover.
 */
public interface GlobalSearchService {

    GlobalSearchResponse search(String query, int limit);
}