function InitMap (mapInfos) {
  $(function () {
    var map = L.map('map', {
      minZoom: mapInfos.minZoom,
      maxZoom: mapInfos.maxZoom,
      crs: mapInfos.CRS,
    });

    L.tileLayer(mapInfos.tilePattern, {
      attribution: mapInfos.attribution,
      tileSize: mapInfos.tileSize,
    }).addTo(map);

    map.setView(mapInfos.center, mapInfos.defaultZoom);

    L.latlngGraticule().addTo(map);

    L.control.scale({
      maxWidth: 200,
      imperial: false
    }).addTo(map);

    // add control in top right with recent sessions
    const recentSessionsControl = L.control({
      position: 'topright',
    })
    recentSessionsControl.onAdd = (map) => {
      var recentSessions = localStorage.getItem('recentSessions') || '[]';
      // If session search param set, store in cache
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const session = urlParams.get('session');
      if (session) {
        recentSessions = JSON.parse(recentSessions);
        if (!recentSessions.includes(session)) {
          // if not already listed, insert at beginning of array
          recentSessions.unshift(session);
          localStorage.setItem('recentSessions', JSON.stringify(recentSessions));
        } else {
          // move to top if already in array
          recentSessions = recentSessions.filter((s) => s !== session);
          recentSessions.unshift(session);
          localStorage.setItem('recentSessions', JSON.stringify(recentSessions));

        }
      }

      // Use recent missions to populate info window
      var recentSessionsHtml = '<div id="recentSessions" style="background-color: white; padding: 10px;"><h3>Recent Sessions</h3><ul>';
      for (let session of recentSessions || []) {
        if (session === recentSessions[0]) {
          // if first, add a "current" label
          recentSessionsHtml += '<li>Current: <a href="/draw?session=' + session + '">' + session + '</a></li>';
        } else {
          // otherwise, add normally
          recentSessionsHtml += '<li><a href="/draw?session=' + session + '">' + session + '</a></li>';
        }
        // skip any past 7
        if (session === recentSessions[6]) {
          break;
        }
      }
      recentSessionsHtml += '</ul></div>';

      var div = L.DomUtil.create('div', 'recentSessions');
      div.innerHTML = recentSessionsHtml;
      return div;
    }

    recentSessionsControl.addTo(map);


    L.control.gridMousePosition().addTo(map);

    if (window.location.hash == '#cities') {
      $.each(mapInfos.cities, function (index, city) {
        L.marker([city.y, city.x]).addTo(map).bindPopup(city.name);
      });
    }

    // Function to update draw colors based on the selected color
    window.DRAW_COLOR = '#3388ff';
    function updateDrawColors (color) {
      DRAW_COLOR = color;
    }

    // Update the 'pm:create' event listener
    map.on('pm:create', function (event) {
      console.log(event.shape);
      var layer = event.layer;
      var imageUrl = null;

      if (event.shape === 'Marker') {
        var imageUrl = prompt('Enter the URL of the marker image, or leave blank to use the default.');
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
        var popup = L.popup({
          maxWidth: 200,
          className: 'drawingPopup',
        });
        popup.setContent(description + '<br>Image: ' + imageUrl);
        layer.bindPopup(popup);

        // create tooltip
        layer.bindTooltip(description, {
          permanent: true,
          direction: 'bottom',
          className: 'drawingTooltip',
        });
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
    function saveDrawingToServer (layer, description, color, imageUrl) {
      // get session search param from current url
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const session = urlParams.get('session');
      $.ajax({
        url: '/drawings/' + session,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          data: layer.toGeoJSON(),
          description: description,
          color: color,
          imageUrl: imageUrl, // Include the imageUrl in the request
        }),
        success: function (response) {
          // Get the ID of the saved drawing from the server response
          const drawingId = response.id;

          // Set the ID as a property of the layer
          layer.drawingId = drawingId;

          console.log('Drawing saved successfully.');
        },
        error: function (xhr, status, error) {
          console.error('Error saving drawing:', error);
        },
      });
    }


    // Event listener for drawing deletion
    map.on('pm:remove', function (event) {
      console.log('Drawing deleted. ');
      var layer = event.layer;
      deleteDrawingOnServer(layer);
    });

    // Function to delete a drawing from the server
    function deleteDrawingOnServer (layer) {
      console.log('Deleting drawing...');
      console.log(layer.drawingId);
      const drawingId = layer.drawingId;
      if (drawingId) {
        $.ajax({
          url: `/drawings/${drawingId}`,
          type: 'DELETE',
          success: function () {
            console.log('Drawing deleted successfully.');
          },
          error: function (xhr, status, error) {
            console.error('Error deleting drawing:', error);
          },
        });
      }
    }

    // Load drawings from the server
    loadDrawingsFromServer();

    function loadDrawingsFromServer () {
      // get session search param from current url
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const session = urlParams.get('session');

      $.ajax({
        url: `/drawings/${session}`,
        type: 'GET',
        dataType: 'json',
        success: function (drawings) {
          drawings.forEach(function (drawing) {
            var layer;
            if (drawing.data.geometry.type === 'Point') {
              var icon = L.icon({
                iconUrl: drawing.imageUrl,
                iconSize: [25, 41], // Adjust the size of the icon if needed
              });
              layer = L.geoJSON(drawing.data, {
                pointToLayer: function (geoJsonPoint, latlng) {
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

            layer.eachLayer(function (l) {
              var popup = L.popup({
                maxWidth: 200,
                className: 'drawingPopup',
              });
              popup.setContent(drawing.description);
              l.bindPopup(popup);

              // create tooltip
              l.bindTooltip(drawing.description, {
                permanent: true,
                direction: 'bottom',
                className: 'drawingTooltip',
              });

              l.drawingId = drawing.id; // Set the drawing ID as a property of the layer
            });

            layer.addTo(map);
          });

          console.log('Drawings loaded successfully.');
        },
        error: function (xhr, status, error) {
          console.error('Error loading drawings:', error);
        },
      });
      checkIt();
    }

    function checkIt () {
      $.ajax({
        url: '/loginStatus',
        type: 'GET',
        dataType: 'json',
        success: function (response) {
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
              change: function (color) {
                var selectedColor = color.toHexString();
                updateDrawColors(selectedColor);
              },
            });
          }
        },
        error: function (xhr, status, error) {
          console.error('Error checking login status:', error);
        },
      });
    }
  });
}