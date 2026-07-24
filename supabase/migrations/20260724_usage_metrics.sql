-- Migration for Server Usage Metrics in SuperAdmin
CREATE OR REPLACE FUNCTION get_system_storage_usage()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    total_db_bytes bigint;
    tables_usage json;
    storage_bytes bigint;
    total_orders bigint;
    total_clients bigint;
    total_products bigint;
    total_tenants bigint;
BEGIN
    -- 1. Total DB Size in Bytes
    SELECT pg_database_size(current_database()) INTO total_db_bytes;

    -- 2. Top tables by size in bytes
    SELECT json_agg(t) INTO tables_usage
    FROM (
        SELECT 
            table_name,
            pg_total_relation_size('"' || table_schema || '"."' || table_name || '"') AS size_bytes,
            pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS size_pretty
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY pg_total_relation_size('"' || table_schema || '"."' || table_name || '"') DESC
        LIMIT 10
    ) t;

    -- 3. Storage objects total size
    BEGIN
        SELECT COALESCE(SUM((metadata->>'size')::bigint), 0) INTO storage_bytes
        FROM storage.objects;
    EXCEPTION WHEN OTHERS THEN
        storage_bytes := 0;
    END;

    -- 4. Key record counts
    BEGIN SELECT COUNT(*) INTO total_orders FROM pedidos; EXCEPTION WHEN OTHERS THEN total_orders := 0; END;
    BEGIN SELECT COUNT(*) INTO total_clients FROM clientes; EXCEPTION WHEN OTHERS THEN total_clients := 0; END;
    BEGIN SELECT COUNT(*) INTO total_products FROM productos; EXCEPTION WHEN OTHERS THEN total_products := 0; END;
    BEGIN SELECT COUNT(*) INTO total_tenants FROM sucursales; EXCEPTION WHEN OTHERS THEN total_tenants := 0; END;

    -- Construct JSON
    result := json_build_object(
        'total_db_bytes', total_db_bytes,
        'total_db_mb', ROUND((total_db_bytes::numeric / (1024 * 1024)), 2),
        'tables', COALESCE(tables_usage, '[]'::json),
        'storage_bytes', storage_bytes,
        'storage_mb', ROUND((storage_bytes::numeric / (1024 * 1024)), 2),
        'counts', json_build_object(
            'orders', total_orders,
            'clients', total_clients,
            'products', total_products,
            'tenants', total_tenants
        )
    );

    RETURN result;
END;
$$;
