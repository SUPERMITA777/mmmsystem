-- Add impresora column to adicionales table to allow routing additionals to specific printers
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adicionales' AND column_name = 'impresora') THEN
        ALTER TABLE adicionales ADD COLUMN impresora TEXT;
    END IF;
END $$;

-- Refresh PGRST
NOTIFY pgrst, 'reload schema';
