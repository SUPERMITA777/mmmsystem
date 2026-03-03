-- Add panel_settings column to config_sucursal
ALTER TABLE config_sucursal 
ADD COLUMN IF NOT EXISTS panel_settings JSONB DEFAULT '{
  "columnas": ["pendiente", "preparando", "listo"],
  "ocultar_mapa_delivery": false,
  "ocultar_mapa_mesas": true,
  "sonido_notificacion": "campana_1",
  "notificacion_sonora": true,
  "whatsapp_templates": {
    "confirmado": "¡Hola! Tu pedido ya fue confirmado y se encuentra en preparación. Te avisaremos cuando esté en camino!",
    "listo": "TU PEDIDO YA ESTÁ LISTO Y EN CAMINO A TU DOMICILIO. QUE LO DISFRUTES!!!",
    "entregado": "¡Gracias por elegirnos! Esperamos que hayas disfrutado tu pedido."
  }
}'::jsonb;
