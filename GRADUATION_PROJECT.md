# CliniCel: AI-Integrated Hospital Management System

## Project definition

CliniCel is a role-secured hospital management platform enhanced with a
privacy-aware clinical documentation assistant. It combines appointments,
medical records, prescriptions, pharmacy, laboratory operations, billing,
notifications, audit logging, and an AI workflow designed for human review.

The graduation contribution is not an unrestricted chatbot. It is an
evidence-grounded assistant that:

- reads only data the signed-in role is already authorised to access;
- uses server-computed facts and bounded clinical records;
- supports local Ollama deployment so patient data can remain on-premises;
- labels clinical outputs as drafts requiring qualified clinician verification;
- never writes diagnoses, prescriptions, or appointment changes without an
  explicit human confirmation flow;
- records AI access metadata without placing prompts or clinical text in the
  compliance audit table.

## Demonstration scenario

1. Sign in as a doctor.
2. Open **AI Assistant** from the protected application.
3. Select **Clinical documentation** and choose an authorised patient.
4. Ask for a visit summary or handover draft.
5. Compare the draft with the source medical records.
6. Demonstrate that a patient or cashier cannot access the same capability.
7. Show that the response is labelled for human review and that the audit trail
   records the access without storing the prompt.

## Architecture

```text
Next.js / React UI
        |
        v
Spring Security + JWT + RBAC
        |
        v
AI controller -> capability service -> authorised repositories
        |                         |
        v                         v
provider adapter              PostgreSQL / Flyway
        |
        v
local Ollama (/api/chat)
```

## Research and evaluation questions

1. Does role-scoped retrieval prevent unauthorised clinical disclosure?
2. Does grounding the prompt in stored records reduce unsupported claims?
3. Does human-review labelling prevent the assistant from being treated as an
   autonomous clinical decision-maker?
4. What are the latency and usability differences between local model sizes?

## Measurable acceptance criteria

- All backend tests pass, including AI authorization and provider tests.
- Frontend type-check and production build pass.
- Patients and non-clinical roles cannot invoke `clinical_documentation`.
- A doctor can generate a bounded draft only for an authorised patient.
- Provider failures return an explicit unavailable/error state; no fabricated
  answer is shown.
- No API key, prompt, or completion is returned to the browser or written to
  the AI access audit row.
- The local demo runs with Ollama and does not require a hosted AI key.

## Local graduation setup

```powershell
ollama pull llama3.2
Copy-Item backend\.env.example backend\.env.local
# Set database and local account values in backend\.env.local.
docker compose up -d clinic-postgres clinic-redis
cd backend
mvn spring-boot:run
```

Run the frontend separately from `frontend` with `npm install` and `npm run dev`.
Use a real secret in local configuration, but never commit `.env`, `.env.local`,
or provider keys.

## Security note

Any credential that has ever been pasted into chat, an issue, a terminal log, or
source control must be revoked and replaced. This repository intentionally
contains only placeholders in `.env.example`.
