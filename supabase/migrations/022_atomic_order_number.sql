-- ============================================
-- FIX: ATOMIC ORDER NUMBER GENERATION
-- ============================================

-- Function to safely calculate the next order sequence for a sucursal and date
-- Handles mixing of formats (e.g. padding and non-padding) by parsing the suffix as numeric
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_sucursal_id UUID, p_date_part TEXT)
RETURNS INTEGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_seq INTEGER;
BEGIN
    -- Obtenemos el valor máximo numérico real del sufijo después del último guión
    -- Ejemplo: 'DELIVERY-20260402-9' -> 9
    -- Ejemplo: 'DELIVERY-20260402-0010' -> 10
    SELECT COALESCE(MAX(CAST(substring(numero_pedido from '-([0-9]+)$') AS INTEGER)), 0)
    INTO v_max_seq
    FROM public.pedidos
    WHERE sucursal_id = p_sucursal_id
    AND numero_pedido LIKE '%-' || p_date_part || '-%';
    
    RETURN v_max_seq + 1;
END;
$$ LANGUAGE plpgsql STABLE;
