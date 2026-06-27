-- Skip business-rule validation when records are soft-deleted.
-- Hibernate soft deletes via UPDATE deleted = true, which otherwise
-- re-runs insert/update triggers and can block user deletion.

CREATE OR REPLACE FUNCTION validate_appointment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted = TRUE THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'SCHEDULED' AND NEW.appointment_date <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Appointment date must be in the future for SCHEDULED appointments';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.patient_id AND user_type = 'PATIENT') THEN
        RAISE EXCEPTION 'Invalid patient ID or patient does not exist';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.doctor_id AND user_type = 'DOCTOR') THEN
        RAISE EXCEPTION 'Invalid doctor ID or doctor does not exist';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.patient_id AND active = TRUE) THEN
        RAISE EXCEPTION 'Patient is not active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.doctor_id AND active = TRUE) THEN
        RAISE EXCEPTION 'Doctor is not active or not available';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_medical_record()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted = TRUE THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.patient_id AND user_type = 'PATIENT') THEN
        RAISE EXCEPTION 'Invalid patient ID or patient does not exist';
    END IF;

    IF NEW.doctor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.doctor_id AND user_type = 'DOCTOR') THEN
        RAISE EXCEPTION 'Invalid doctor ID or doctor does not exist';
    END IF;

    IF NEW.record_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Record date cannot be in the future';
    END IF;

    IF NEW.follow_up_required AND (NEW.follow_up_date IS NULL OR NEW.follow_up_date <= CURRENT_DATE) THEN
        RAISE EXCEPTION 'Follow-up date must be in the future when follow-up is required';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
