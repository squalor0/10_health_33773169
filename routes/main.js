var express = require('express');
var router = express.Router();

// Home page
router.get('/', function (req, res) {
  res.render('home.ejs');
});

// About page
router.get('/about', function (req, res) {
  res.render('about.ejs');
});

// Logout
router.get('/logout', function (req, res) {
  req.session.destroy(function () {
    res.redirect('/');
  });
});

module.exports = router;