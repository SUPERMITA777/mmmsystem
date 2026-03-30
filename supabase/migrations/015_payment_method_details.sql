-- migration file 015_payment_method_details.sql
ALTER TABLE metodos_pago ADD COLUMN IF NOT EXISTS detalles JSONB DEFAULT '{}'::jsonb;
