var express = require('express');
var router = express.Router();
var request = require('request');

// Simple auth guard
function redirectLogin(req, res, next) {
  if (!req.session.username) {
    res.redirect('/login');
  } else {
    next();
  }
}

function getShapeCoords(shapeName) {
   if (shapeName === 'triangle') {
    // Simple triangle
    return [
      [0.0, 0.0],
      [1.0, 0.0],
      [0.5, 1.0],
      [0.0, 0.0]
    ];
  } else {
    // default: square
    return [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0]
    ];
  }
}

// Convert normalized shape to rough lat/lng points
function shapeToLatLng(shapeCoords, centerLat, centerLng, scaleKm) {
  var kmPerDegLat = 111;
  var scaleDeg = scaleKm / kmPerDegLat;

  var xs = shapeCoords.map(function (p) { return p[0]; });
  var ys = shapeCoords.map(function (p) { return p[1]; });

  var minX = Math.min.apply(null, xs);
  var maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys);
  var maxY = Math.max.apply(null, ys);

  var widthNorm = maxX - minX || 1;
  var heightNorm = maxY - minY || 1;
  var maxNorm = Math.max(widthNorm, heightNorm);
  var factor = scaleDeg / maxNorm;

  var centerX = (minX + maxX) / 2;
  var centerY = (minY + maxY) / 2;

  var result = [];

  for (var i = 0; i < shapeCoords.length; i++) {
    var x = shapeCoords[i][0];
    var y = shapeCoords[i][1];

    var dxNorm = x - centerX;
    var dyNorm = y - centerY;

    var dLat = dyNorm * factor;
    var dLng = dxNorm * factor / Math.cos(centerLat * Math.PI / 180);

    var lat = centerLat + dLat;
    var lng = centerLng + dLng;

    result.push({ lat: lat, lng: lng });
  }

  return result;
}

// distance in km between two lat/lng points
function distanceKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Call OpenRouteService to snap points to roads
function routeShapeOnRoads(points, callback) {
  var apiKey = process.env.ORS_API_KEY;

  // If no key configured, just skip snapping and use straight lines
  if (!apiKey) {
    console.log('No ORS_API_KEY set, using straight lines only.');
    return callback(null, null);
  }

  // ORS expects [lng, lat]
  var coords = points.map(function (p) {
    return [p.lng, p.lat];
  });

  var options = {
    url: 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coordinates: coords
    })
  };

  request(options, function (err, response, body) {
    if (err) {
      console.error('ORS error:', err);
      return callback(err);
    }

    try {
      var data = JSON.parse(body);

      if (!data.features || data.features.length === 0) {
        return callback(new Error('No route returned from ORS'));
      }

      var feature = data.features[0];

      // geometry.coordinates is [[lng, lat], [lng, lat], ...]
      var routedCoords = feature.geometry.coordinates;

      var routedPoints = routedCoords.map(function (c) {
        return { lat: c[1], lng: c[0] };
      });

      // distance is in metres
      var distanceMeters = feature.properties && feature.properties.summary
        ? feature.properties.summary.distance
        : null;

      var distanceKm = distanceMeters ? distanceMeters / 1000 : null;

      callback(null, {
        routedPoints: routedPoints,
        distanceKm: distanceKm
      });
    } catch (e) {
      console.error('Error parsing ORS response:', e);
      callback(e);
    }
  });
}

// GET /routes/generate - show form
router.get('/generate', redirectLogin, function (req, res) {
  res.render('routes_generate.ejs', {
    error: null,
    form: {
      shapeName: 'square',
      centerLat: '51.505',
      centerLng: '-0.09',
      scaleKm: '2'
    }
  });
});

// POST /routes/generate - process form
router.post('/generate', redirectLogin, function (req, res) {
  var shapeName = req.body.shapeName || 'square';
  var centerLat = parseFloat(req.body.centerLat);
  var centerLng = parseFloat(req.body.centerLng);
  var scaleKm = parseFloat(req.body.scaleKm);

  if (isNaN(centerLat) || isNaN(centerLng) || isNaN(scaleKm)) {
    return res.render('routes_generate.ejs', {
      error: 'Please enter valid numbers for centre and scale.',
      form: {
        shapeName: shapeName,
        centerLat: req.body.centerLat,
        centerLng: req.body.centerLng,
        scaleKm: req.body.scaleKm
      }
    });
  }
  var straightPoints = null;

  // Prefer custom drawn points if provided
  var pointsJson = req.body.pointsJson;
  if (pointsJson && pointsJson.trim() !== '') {
    try {
      var parsed = JSON.parse(pointsJson);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        straightPoints = parsed;
        shapeName = 'custom';
      }
    } catch (e) {
      console.log('Error parsing pointsJson:', e);
      // fall through to shape fallback
    }
  }
  if (!straightPoints) {
    var shapeCoords = getShapeCoords(shapeName);
    straightPoints = shapeToLatLng(shapeCoords, centerLat, centerLng, scaleKm);
  }

  // try to get a road-snapped route from ORS
  routeShapeOnRoads(straightPoints, function (err, routingResult) {
    // Points shown on the map
    var mapPoints = straightPoints;
    var totalDistanceKm;

    if (!err && routingResult && routingResult.routedPoints && routingResult.routedPoints.length > 0) {
      console.log('Using ORS routed path');
      mapPoints = routingResult.routedPoints;
      totalDistanceKm = routingResult.distanceKm;
    } else {
      console.log('Falling back to straight-line distance and points.');
      // Build straight-line distance as before
      totalDistanceKm = 0;
      for (var i = 1; i < straightPoints.length; i++) {
        var prev = straightPoints[i - 1];
        var curr = straightPoints[i];
        totalDistanceKm += distanceKm(prev.lat, prev.lng, curr.lat, curr.lng);
      }
    }

    // Keep simple steps based on the original straight-line shape
    var steps = [];
    for (var i = 1; i < straightPoints.length; i++) {
      var prev2 = straightPoints[i - 1];
      var curr2 = straightPoints[i];
      var dist2 = distanceKm(prev2.lat, prev2.lng, curr2.lat, curr2.lng);

      steps.push({
        fromLat: prev2.lat,
        fromLng: prev2.lng,
        toLat: curr2.lat,
        toLng: curr2.lng,
        distanceKm: dist2,
        instruction:
          'Run from point ' +
          i +
          ' to point ' +
          (i + 1) +
          ' (approx ' +
          dist2.toFixed(2) +
          ' km straight-line)'
      });
    }

    // Prepare [lat, lng] pairs for Leaflet
    var routePoints = mapPoints.map(function (p) {
      return [p.lat, p.lng];
    });

    res.render('routes_result.ejs', {
      shapeName: shapeName,
      centerLat: centerLat,
      centerLng: centerLng,
      scaleKm: scaleKm,
      totalDistanceKm: totalDistanceKm,
      steps: steps,
      points: mapPoints,
      routePoints: routePoints,
      waypoints: straightPoints 
    });
  });
});

// POST /routes/save
router.post('/save', redirectLogin, function (req, res) {
  var username = req.session.username;
  var routeName = req.sanitize(req.body.routeName);
  var shapeName = req.sanitize(req.body.shapeName);

  // get the user id
  global.db.query(
    'SELECT id FROM users WHERE username = ?',
    [username],
    function (err, users) {
      if (err) {
        console.error(err);
        return res.send('Database error');
      }

      if (users.length === 0) {
        return res.send('User not found');
      }

      var userId = users[0].id;

      // insert the route
      global.db.query(
        `INSERT INTO routes 
        (user_id, name, shape_name, center_lat, center_lng, scale_km, total_distance_km)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          routeName,
          shapeName,
          parseFloat(req.body.centerLat),
          parseFloat(req.body.centerLng),
          parseFloat(req.body.scaleKm),
          parseFloat(req.body.totalDistanceKm)
        ],
        function (err2) {
          if (err2) {
            console.error(err2);
            return res.send('Error saving route');
          }

          // Redirect to a confirmation page or back home
          res.send(`
            <h1>Route Saved!</h1>
            <p><a href="/">Home</a></p>
            <p><a href="/routes/generate">Generate Another Route</a></p>
          `);
        }
      );
    }
  );
});

// GET /routes/search - search routes for logged-in user
router.get('/search', redirectLogin, function (req, res) {
  var username = req.session.username;

  var shapeName = req.query.shapeName || 'all';
  var minDistance = req.query.minDistance;
  var maxDistance = req.query.maxDistance;

  // get the user id
  global.db.query(
    'SELECT id FROM users WHERE username = ?',
    [username],
    function (err, users) {
      if (err) {
        console.error(err);
        return res.send('Database error');
      }

      if (users.length === 0) {
        return res.send('User not found');
      }

      var userId = users[0].id;

      // Build SQL with optional filters
      var sql = 'SELECT * FROM routes WHERE user_id = ?';
      var params = [userId];

      if (shapeName && shapeName !== 'all') {
        sql += ' AND shape_name = ?';
        params.push(shapeName);
      }

      if (minDistance && !isNaN(parseFloat(minDistance))) {
        sql += ' AND total_distance_km >= ?';
        params.push(parseFloat(minDistance));
      }

      if (maxDistance && !isNaN(parseFloat(maxDistance))) {
        sql += ' AND total_distance_km <= ?';
        params.push(parseFloat(maxDistance));
      }

      sql += ' ORDER BY created_at DESC';

      global.db.query(sql, params, function (err2, routes) {
        if (err2) {
          console.error(err2);
          return res.send('Error retrieving routes');
        }

        res.render('routes_search.ejs', {
          routes: routes,
          form: {
            shapeName: shapeName,
            minDistance: minDistance || '',
            maxDistance: maxDistance || ''
          }
        });
      });
    }
  );
});


module.exports = router;
