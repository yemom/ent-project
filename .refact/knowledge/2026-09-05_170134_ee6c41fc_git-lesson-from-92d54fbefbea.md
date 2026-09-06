---
id: c5bd1d33-bdf4-4f05-9a0a-f1da95e5dde9
title: Git lesson from 92d54fbefbea
tags:
- git
- lesson
created: 2026-09-05
updated: 2026-09-06
filenames:
- clinic/backend/src/main/java/com/clinic/controller/AdminController.java
- clinic/backend/src/main/java/com/clinic/dto/request/UpdateUserRequest.java
- clinic/backend/src/main/java/com/clinic/dto/response/UserSummaryResponse.java
- clinic/backend/src/main/java/com/clinic/mapper/UserMapper.java
- clinic/backend/src/main/java/com/clinic/repository/UserRepository.java
- clinic/backend/src/main/java/com/clinic/service/AdminService.java
- clinic/backend/src/main/java/com/clinic/service/impl/AdminServiceImpl.java
- clinic/backend/src/main/resources/db/migration/V14__skip_validation_on_soft_delete.sql
- clinic/backend/src/test/java/com/clinic/support/TestFixtures.java
- clinic/frontend/src/features/admin/admin-pages.tsx
- clinic/frontend/src/services/api/admin.ts
- clinic/frontend/src/services/api/users.ts
links: []
kind: lesson
status: proposed
superseded_by: null
deprecated_at: null
review_after: 2026-09-06
source_chat_id: null
created_at: 2026-09-05T14:01:34.662694400+00:00
summary: null
description: null
entities: []
related_files: []
related_entities: []
content_hash: 9d148ec421717bbc14358ccbd45ef76c3af1cbfed794c3b12010f73b6d2c8a14
source_tool: buddy_memory_lifecycle:git
source_confidence: 0.8600000143051147
source_trajectory_id: null
source_message_range: null
source_commit: 92d54fbefbea3709be0685bd33a2bb45413daaeb
topic: null
last_used_at: null
use_count: 0
last_injected_at: null
dismissed_count: 0
source_content_hash: 9d148ec421717bbc14358ccbd45ef76c3af1cbfed794c3b12010f73b6d2c8a14
review_needed: true
occurrences: 0
---

Git lesson from 92d54fbefbea

Source commit: 92d54fbefbea
Paths: clinic/backend/src/main/java/com/clinic/controller/AdminController.java, clinic/backend/src/main/java/com/clinic/dto/request/UpdateUserRequest.java, clinic/backend/src/main/java/com/clinic/dto/response/UserSummaryResponse.java, clinic/backend/src/main/java/com/clinic/mapper/UserMapper.java, clinic/backend/src/main/java/com/clinic/repository/UserRepository.java, clinic/backend/src/main/java/com/clinic/service/AdminService.java, clinic/backend/src/main/java/com/clinic/service/impl/AdminServiceImpl.java, clinic/backend/src/main/resources/db/migration/V14__skip_validation_on_soft_delete.sql, clinic/backend/src/test/java/com/clinic/support/TestFixtures.java, clinic/frontend/src/features/admin/admin-pages.tsx, clinic/frontend/src/services/api/admin.ts, clinic/frontend/src/services/api/users.ts
Summary: Add admin user edit/delete and fix soft-delete failures in Docker