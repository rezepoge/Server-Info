const express = require('express');
const router = express.Router();
const settings = require('../classes/settings').get();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Serverinfo',
    monitoredValues: settings.monitoredValues
  });
});

module.exports = router;