self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "MMM Soporte — mensaje nuevo";
    const body = data.body || "";
    const ticketId = data.ticketId;
    
    // Si viene sucursalNombre, lo ponemos en el título o cuerpo
    const finalTitle = data.sucursalNombre ? `MMM Soporte — ${data.sucursalNombre}` : title;

    const options = {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: {
        url: '/admin/soporte?ticket=' + (ticketId || '')
      },
      actions: [
        { action: 'abrir', title: 'Ver mensaje' }
      ],
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(finalTitle, options)
    );
  } catch (err) {
    console.error('Error mostrando notificación push:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/admin/soporte';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Si ya hay una pestaña abierta en esa ruta, hacerle focus y navegar
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/admin/soporte') && 'focus' in client) {
          return client.focus().then(function(focusedClient) {
            return focusedClient.navigate(urlToOpen);
          });
        }
      }
      // Si no, abrir una ventana nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
