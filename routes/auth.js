var express = require('express');
var bcrypt = require('bcrypt');
var router = express.Router();
const { check, validationResult } = require('express-validator');

// Show register form
router.get('/register', function (req, res) {
  res.render('register.ejs', { error: null, username: '' });
});

// Process register form with validation
router.post(
  '/register',
  [
    check('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters.'),

    check('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.')
      .matches(/(?=.*[a-z])/)
      .withMessage('Password must contain at least one lowercase letter.')
      .matches(/(?=.*[A-Z])/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/(?=.*\d)/)
      .withMessage('Password must contain at least one number.')
      .matches(/(?=.*[^A-Za-z0-9])/)
      .withMessage('Password must contain at least one special character.')
  ],
  function (req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Show the first validation error
      return res.render('register.ejs', {
        error: errors.array()[0].msg,
        username: req.body.username
      });
    }

    // Sanitise inputs
    var username = req.sanitize(req.body.username);
    var password = req.body.password;

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
            return res.render('register.ejs', { error: 'Username may already exist.', username: req.body.username });
          }

          // Auto-login after registration
          req.session.username = username;
          res.redirect('/');
        }
      );
    });
  }
);

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
