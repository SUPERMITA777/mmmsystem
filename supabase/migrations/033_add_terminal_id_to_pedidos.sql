-- Migration to add terminal_id column to the pedidos table for print routing
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS terminal_id TEXT;
