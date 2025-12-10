var express = require('express');
var router = express.Router();

// Helper to get user id
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

// GET /api/routes
router.get('/routes', function (req, res) {
  global.db.query(
    'SELECT routes.id, routes.name, routes.shape_name, routes.total_distance_km, users.username AS owner ' +
      'FROM routes INNER JOIN users ON routes.user_id = users.id ' +
      'WHERE routes.is_public = 1 ' +
      'ORDER BY routes.created_at DESC',
    function (err, rows) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(rows);
    }
  );
});

// GET /api/routes/mine
router.get('/routes/mine', function (req, res) {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  var username = req.session.username;

  getUserId(username, function (err, userId) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error finding user' });
    }

    global.db.query(
      'SELECT id, name, shape_name, total_distance_km, created_at FROM routes WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      function (err2, rows) {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json(rows);
      }
    );
  });
});

module.exports = router;