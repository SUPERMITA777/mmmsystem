-- Add costo_fijo column to productos table
ALTER TABLE productos ADD COLUMN costo_fijo NUMERIC(12,2) DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN productos.costo_fijo IS 'Manual fixed cost for the product, used as fallback if no calculation from recipe is available';
