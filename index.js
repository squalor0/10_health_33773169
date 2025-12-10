require('dotenv').config();

var express = require('express');
var mysql = require('mysql2');
var path = require('path');
var session = require('express-session');

var app = express();

// View engine
app.set('view engine', 'ejs');

// Static files (CSS, client JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing for POST forms
app.use(express.urlencoded({ extended: true }));

// Sessions (for login)
app.use(session({
  secret: process.env.SESSION_SECRET || 'someSecretString',
  resave: false,
  saveUninitialized: false
}));

// MySQL connection pool
var db = mysql.createPool({
  host: process.env.HEALTH_HOST || 'localhost',
  user: process.env.HEALTH_USER || 'health_app',
  password: process.env.HEALTH_PASSWORD || 'qwertyuiop',
  database: process.env.HEALTH_DATABASE || 'health'
});

// Make db available everywhere
global.db = db;

// Make logged-in user available to all views
app.use(function (req, res, next) {
  res.locals.loggedInUser = req.session.username || null;
  next();
});

// Routes
var mainRoutes = require('./routes/main');
var authRoutes = require('./routes/auth');
var fitnessRoutes = require('./routes/routes');
var runsRoutes = require('./routes/runs');

app.use('/', mainRoutes);
app.use('/', authRoutes);
app.use('/routes', fitnessRoutes);
app.use('/runs', runsRoutes); 

// Basic error handler
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(500).send('Server error');
});

var port = process.env.PORT || 8000;
app.listen(port, function () {
  console.log('App listening on port ' + port);
});
