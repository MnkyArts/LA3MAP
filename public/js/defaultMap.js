function InitMap(mapInfos) {
  $(function() {
      var map = L.map('map', {
          minZoom: mapInfos.minZoom,
          maxZoom: mapInfos.maxZoom,
          crs: mapInfos.CRS,
      });

      L.tileLayer('.' + mapInfos.tilePattern, {
          attribution: mapInfos.attribution,
          tileSize: mapInfos.tileSize,
      }).addTo(map);

      map.setView(mapInfos.center, mapInfos.defaultZoom);

      L.latlngGraticule().addTo(map);

      L.control.scale({
          maxWidth: 200,
          imperial: false
      }).addTo(map);

      L.control.gridMousePosition().addTo(map);

      if (window.location.hash == '#cities') {
          $.each(mapInfos.cities, function(index, city) {
              L.marker([city.y, city.x]).addTo(map).bindPopup(city.name);
          });
      }

      // Function to update draw colors based on the selected color
      function updateDrawColors(color) {
          map.eachLayer(function(layer) {
              if (layer.pm && (layer instanceof L.Polyline || layer instanceof L.Polygon)) {
                  layer.setStyle({
                      color: color
                  });
              }
          });
      }

      // Update the 'pm:create' event listener
      map.on('pm:create', function(event) {
          console.log(event.shape);
          var layer = event.layer;
          var imageUrl = null;

          if (event.shape === 'Marker') {
              var imageUrl = prompt('Enter the URL of the marker image:');
              if (!imageUrl) {
                  imageUrl = 'https://i.imgur.com/SY0C1lx.png';
              }
              var icon = L.icon({
                  iconUrl: imageUrl,
                  iconSize: [25, 41], // Adjust the size of the icon if needed
              });
              layer.setIcon(icon);
          }

          var description = prompt('Enter a description for the drawing:');

          // Get the selected color from the color picker
          var selectedColor = $('#colorPicker').spectrum('get').toHexString();

          if (description) {
              layer.description = description;
              layer.bindPopup(description).openPopup();
          }

          if (event.shape !== 'Marker') {
              layer.setStyle({
                  color: selectedColor
              }); // Set the color of the layer
          }

          // Send the drawing data to the server
          saveDrawingToServer(layer, description, selectedColor, imageUrl);
      });

      // Function to send the drawing data to the server
      function saveDrawingToServer(layer, description, color, imageUrl) {
          $.ajax({
              url: '/drawings',
              type: 'POST',
              contentType: 'application/json',
              data: JSON.stringify({
                  data: layer.toGeoJSON(),
                  description: description,
                  color: color,
                  imageUrl: imageUrl, // Include the imageUrl in the request
              }),
              success: function(response) {
                  // Get the ID of the saved drawing from the server response
                  const drawingId = response.id;

                  // Set the ID as a property of the layer
                  layer.drawingId = drawingId;

                  console.log('Drawing saved successfully.');
              },
              error: function(xhr, status, error) {
                  console.error('Error saving drawing:', error);
              },
          });
      }


      // Event listener for drawing deletion
      map.on('pm:remove', function(event) {
          console.log('Drawing deleted. ');
          var layer = event.layer;
          deleteDrawingOnServer(layer);
      });

      // Function to delete a drawing from the server
      function deleteDrawingOnServer(layer) {
          console.log('Deleting drawing...');
          console.log(layer.drawingId);
          const drawingId = layer.drawingId;
          if (drawingId) {
              $.ajax({
                  url: `/drawings/${drawingId}`,
                  type: 'DELETE',
                  success: function() {
                      console.log('Drawing deleted successfully.');
                  },
                  error: function(xhr, status, error) {
                      console.error('Error deleting drawing:', error);
                  },
              });
          }
      }

      // Load drawings from the server
      loadDrawingsFromServer();

      function loadDrawingsFromServer() {
          $.ajax({
              url: '/drawings',
              type: 'GET',
              dataType: 'json',
              success: function(drawings) {
                  drawings.forEach(function(drawing) {
                      var layer;
                      if (drawing.data.geometry.type === 'Point') {
                          var icon = L.icon({
                              iconUrl: drawing.imageUrl,
                              iconSize: [25, 41], // Adjust the size of the icon if needed
                          });
                          layer = L.geoJSON(drawing.data, {
                              pointToLayer: function(geoJsonPoint, latlng) {
                                  return L.marker(latlng, {
                                      icon: icon
                                  });
                              },
                          });
                      } else {
                          layer = L.geoJSON(drawing.data, {
                              style: {
                                  color: drawing.color,
                              },
                          });
                      }

                      layer.eachLayer(function(l) {
                          l.bindPopup(drawing.description);
                          l.drawingId = drawing.id; // Set the drawing ID as a property of the layer
                      });

                      layer.addTo(map);
                  });

                  console.log('Drawings loaded successfully.');
              },
              error: function(xhr, status, error) {
                  console.error('Error loading drawings:', error);
              },
          });
          checkIt();
      }

      function checkIt() {
          $.ajax({
              url: '/loginStatus',
              type: 'GET',
              dataType: 'json',
              success: function(response) {
                  if (response.isLoggedIn) {
                      map.pm.addControls({
                          position: 'topleft',
                          drawCircle: false,
                          drawRectangle: true,
                          drawCircleMarker: false,
                          tooltips: true,
                          drawPolyline: true,
                          drawPolygon: true,
                          drawText: false,
                      });
                      // Add color picker functionality
                      var colorPicker = $('<input type="text" id="colorPicker" />');
                      var logout = $('<div class="button-container" title="Logout"><a class="leaflet-buttons-control-button" role="button" tabindex="0" href="/logout"><div class="control-icon leaflet-pm-icon-logout"></div></a></div>');
                      $('.leaflet-pm-toolbar:last').append(logout);
                      $('.leaflet-pm-toolbar:first').prepend(colorPicker);
                      $('#colorPicker').spectrum({
                          color: '#3388ff', // Initial color
                          preferredFormat: 'hex',
                          showInput: true,
                          change: function(color) {
                              var selectedColor = color.toHexString();
                              updateDrawColors(selectedColor);
                          },
                      });
                  }
              },
              error: function(xhr, status, error) {
                  console.error('Error checking login status:', error);
              },
          });
      }
  });
}