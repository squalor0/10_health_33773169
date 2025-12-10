var express = require('express');
var router = express.Router();

// GET / - Home page
router.get('/', function (req, res) {
  // If not logged in, just render the home page with no stats
  if (!req.session.username) {
    return res.render('home.ejs', {
      stats: null
    });
  }

  var username = req.session.username;

  // Look up user id
  global.db.query(
    'SELECT id FROM users WHERE username = ?',
    [username],
    function (err, users) {
      if (err) {
        console.error(err);
        // Fallback: render without stats
        return res.render('home.ejs', { stats: null });
      }

      if (users.length === 0) {
        return res.render('home.ejs', { stats: null });
      }

      var userId = users[0].id;

      // Query stats for this user
      var sql =
        'SELECT ' +
        ' (SELECT COUNT(*) FROM routes WHERE user_id = ?) AS routeCount,' +
        ' (SELECT COUNT(*) FROM runs WHERE user_id = ?) AS runCount,' +
        ' (SELECT SUM(total_distance_km) FROM routes WHERE user_id = ?) AS totalDistanceKm';

      global.db.query(sql, [userId, userId, userId], function (err2, rows) {
        if (err2) {
          console.error(err2);
          return res.render('home.ejs', { stats: null });
        }

        var stats = rows[0];

        // Handle null SUM
        if (!stats.totalDistanceKm) {
          stats.totalDistanceKm = 0;
        }

        res.render('home.ejs', {
          stats: stats
        });
      });
    }
  );
});

router.get('/about', function (req, res) {
  res.render('about.ejs');
});

router.get('/logout', function (req, res) {
  req.session.destroy(function () {
    res.redirect('/');
  });
});

module.exports = router;