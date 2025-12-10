var express = require('express');
var router = express.Router();

// Simple auth guard
function redirectLogin(req, res, next) {
  if (!req.session.username) {
    res.redirect('/login');
  } else {
    next();
  }
}

// Helper: some simple shapes in [0,1] space
function getShapeCoords(shapeName) {
  if (shapeName === 'square') {
    return [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0]
    ];
  } else if (shapeName === 'triangle') {
    return [
      [0.0, 0.0],
      [1.0, 0.0],
      [0.5, 1.0],
      [0.0, 0.0]
    ];
  } else {
    return [
      [0.5, 0.0],
      [0.9, 0.4],
      [0.5, 1.0],
      [0.1, 0.4],
      [0.5, 0.0]
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

// Rough distance in km between two lat/lng points
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

// GET /routes/generate - show form
router.get('/generate', redirectLogin, function (req, res) {
  res.render('routes_generate.ejs', {
    error: null,
    form: {
      shapeName: 'heart',
      centerLat: '51.505',
      centerLng: '-0.09',
      scaleKm: '2'
    }
  });
});

// POST /routes/generate - process form
router.post('/generate', redirectLogin, function (req, res) {
  var shapeName = req.body.shapeName || 'heart';
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

  var shapeCoords = getShapeCoords(shapeName);
  var points = shapeToLatLng(shapeCoords, centerLat, centerLng, scaleKm);

  // Build directions
  var steps = [];
  var totalDistanceKm = 0;

  for (var i = 1; i < points.length; i++) {
    var prev = points[i - 1];
    var curr = points[i];

    var dist = distanceKm(prev.lat, prev.lng, curr.lat, curr.lng);
    totalDistanceKm += dist;

    steps.push({
      fromLat: prev.lat,
      fromLng: prev.lng,
      toLat: curr.lat,
      toLng: curr.lng,
      distanceKm: dist,
      instruction:
        'Run from point ' +
        i +
        ' to point ' +
        (i + 1) +
        ' (~' +
        dist.toFixed(2) +
        ' km)'
    });
  }

  res.render('routes_result.ejs', {
    shapeName: shapeName,
    centerLat: centerLat,
    centerLng: centerLng,
    scaleKm: scaleKm,
    totalDistanceKm: totalDistanceKm,
    steps: steps
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
