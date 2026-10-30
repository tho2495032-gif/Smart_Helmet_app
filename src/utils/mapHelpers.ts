function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

export function createLeafletMapHtml(
  latitude: number,
  longitude: number,
  helmetName: string,
  helmetId: string,
) {
  const safeName = escapeHtml(helmetName);
  const safeId = escapeHtml(helmetId);

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #eeeeee; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${latitude}, ${longitude}], 16);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      minZoom: 2
    }).addTo(map);

    var marker = L.marker([${latitude}, ${longitude}]).addTo(map);
    marker.bindPopup("<b>${safeName}</b><br>ID: ${safeId}").openPopup();

    window.updateLocation = function(lat, lng) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    };
  </script>
</body>
</html>`;
}
