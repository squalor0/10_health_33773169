var express = require('express');
var bcrypt = require('bcrypt');
var router = express.Router();

// Show register form
router.get('/register', function (req, res) {
  res.render('register.ejs', { error: null });
});

// Process register form
router.post('/register', function (req, res, next) {
  var username = req.body.username;
  var password = req.body.password;

  if (!username || !password) {
    return res.render('register.ejs', { error: 'Please enter a username and password.' });
  }

  // password rule
  if (password.length < 8) {
    return res.render('register.ejs', { error: 'Password must be at least 8 characters.' });
  }

  bcrypt.hash(password, 10, function (err, hash) {
    if (err) {
      return next(err);
    }

    global.db.query(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash],
      function (err2) {
        if (err2) {
          console.error(err2);
          return res.render('register.ejs', { error: 'Username may already exist.' });
        }

        // Auto-login after registration
        req.session.username = username;
        res.redirect('/');
      }
    );
  });
});

// Show login form
router.get('/login', function (req, res) {
  res.render('login.ejs', { error: null });
});

// Process login form
router.post('/login', function (req, res, next) {
  var username = req.body.username;
  var password = req.body.password;

  if (!username || !password) {
    return res.render('login.ejs', { error: 'Please enter username and password.' });
  }

  global.db.query(
    'SELECT * FROM users WHERE username = ?',
    [username],
    function (err, results) {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        return res.render('login.ejs', { error: 'Invalid username or password.' });
      }

      var user = results[0];

      bcrypt.compare(password, user.password_hash, function (err2, match) {
        if (err2) {
          return next(err2);
        }

        if (!match) {
          return res.render('login.ejs', { error: 'Invalid username or password.' });
        }

        req.session.username = user.username;
        res.redirect('/');
      });
    }
  );
});

module.exports = router;
