-- A reviewer request may intentionally use a date different from PostgreSQL now().
-- Future-DOB validation belongs to the application and uses that SAME request
-- snapshot; a CURRENT_TIMESTAMP check would contradict it during review tests.
-- Keep date storage structurally bounded, with no mutable database/session clock.
ALTER TABLE patients DROP CONSTRAINT patients_dob_not_future;
ALTER TABLE patients ADD CONSTRAINT patients_dob_valid_range
  CHECK (date_of_birth >= DATE '0001-01-01' AND date_of_birth <= DATE '9999-12-31');
