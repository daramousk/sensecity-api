
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');

console.log("asdfghjkl");

//mongoose.connect('mongodb://localhost/sensecity');

// Models

var Static_data = require('../models/static_data');

// Routes
/*
Static_data.methods(['get', 'put', 'post', 'delete']);
Static_data.register(static_router,'/static_data');
*/
static_router.get('/static_data', function(req, res){		
		console.log("get");
}); 

static_router.post('/static_data', function(req, res){		
		console.log(req.body);
}); 

// Return router
module.exports = static_router;