var express = require('express');
var router = express.Router();

// Reuse auth guard
function redirectLogin(req, res, next) {
  if (!req.session.username) {
    res.redirect('/login');
  } else {
    next();
  }
}

// Helper: get user id from session username
function getUserId(username, callback) {
  global.db.query(
    'SELECT id FROM users WHERE username = ?',
    [username],
    function (err, rows) {
      if (err) return callback(err);
      if (rows.length === 0) return callback(new Error('User not found'));
      callback(null, rows[0].id);
    }
  );
}

// GET /runs/add - show form to log a run
router.get('/add', redirectLogin, function (req, res) {
  var username = req.session.username;

  getUserId(username, function (err, userId) {
    if (err) {
      console.error(err);
      return res.send('Error finding user');
    }

    // Get this user's routes to choose from
    global.db.query(
      'SELECT id, name FROM routes WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      function (err2, routes) {
        if (err2) {
          console.error(err2);
          return res.send('Error loading routes');
        }

        res.render('runs_add.ejs', {
          routes: routes,
          error: null
        });
      }
    );
  });
});

// POST /runs/add - save run to database
router.post('/add', redirectLogin, function (req, res) {
  var username = req.session.username;
  var routeId = req.body.routeId;
  var runDate = req.body.runDate;
  var durationMinutes = req.body.durationMinutes;
  var notes = req.body.notes;
  var rating = req.body.rating;

  if (!routeId || !runDate) {
    // Minimal validation
    return res.send('Please select a route and a date.');
  }

  getUserId(username, function (err, userId) {
    if (err) {
      console.error(err);
      return res.send('Error finding user');
    }

    global.db.query(
      `INSERT INTO runs (user_id, route_id, run_date, duration_minutes, notes, rating)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        routeId,
        runDate,
        durationMinutes ? parseFloat(durationMinutes) : null,
        notes || null,
        rating ? parseInt(rating) : null
      ],
      function (err2) {
        if (err2) {
          console.error(err2);
          return res.send('Error saving run');
        }

        res.send(`
          <h1>Run Logged!</h1>
          <p><a href="/runs/add">Log another run</a></p>
          <p><a href="/runs/search">View my run history</a></p>
          <p><a href="/">Home</a></p>
        `);
      }
    );
  });
});

// GET /runs/search - view runs history
router.get('/search', redirectLogin, function (req, res) {
  var username = req.session.username;

  // Optional filters
  var minRating = req.query.minRating;
  var fromDate = req.query.fromDate;
  var toDate = req.query.toDate;

  getUserId(username, function (err, userId) {
    if (err) {
      console.error(err);
      return res.send('Error finding user');
    }

    var sql =
      'SELECT runs.*, routes.name AS route_name ' +
      'FROM runs INNER JOIN routes ON runs.route_id = routes.id ' +
      'WHERE runs.user_id = ?';
    var params = [userId];

    if (minRating && !isNaN(parseInt(minRating))) {
      sql += ' AND runs.rating >= ?';
      params.push(parseInt(minRating));
    }

    if (fromDate) {
      sql += ' AND runs.run_date >= ?';
      params.push(fromDate);
    }

    if (toDate) {
      sql += ' AND runs.run_date <= ?';
      params.push(toDate);
    }

    sql += ' ORDER BY runs.run_date DESC';

    global.db.query(sql, params, function (err2, runs) {
      if (err2) {
        console.error(err2);
        return res.send('Error loading runs');
      }

      res.render('runs_search.ejs', {
        runs: runs,
        form: {
          minRating: minRating || '',
          fromDate: fromDate || '',
          toDate: toDate || ''
        }
      });
    });
  });
});

module.exports = router;
