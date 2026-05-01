-- Migration 028: Improvements to Caja (Shifts)
ALTER TABLE cajas ADD COLUMN IF NOT EXISTS cajero_nombre TEXT;
