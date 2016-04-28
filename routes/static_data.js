
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');

//mongoose.connect('mongodb://localhost/sensecity');

// Models

var Static_data = require('../models/static_data');

// Routes
/*
Static_data.methods(['get', 'put', 'post', 'delete']);
Static_data.register(static_router,'/static_data');
*/
static_router.get('/garbage', function(req, res){		
	Static_data.find({}, function(err, issue){
		res.send(issue);
  });
}); 

static_router.post('/insert', function(req, res){		
		console.log(req.body.municipality);
}); 

// Return router
module.exports = static_router;