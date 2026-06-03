-- Migration to add HR fields to the usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sueldo NUMERIC(12,2) DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS horario TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS informacion_general TEXT;
