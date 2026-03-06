SELECT c.nombre FROM categorias c JOIN productos p ON c.id = p.categoria_id JOIN pedido_items pi ON p.id = pi.producto_id LIMIT 1; 
