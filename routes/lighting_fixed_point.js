// Dependencies

var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');



//mongoose.connect('mongodb://localhost/sensecity');
 
// Models

var LightingFixedPoint = require('../models/lighting_fixed_point');

// Routes

LightingFixedPoint.methods(['get', 'put', 'post', 'delete']);
LightingFixedPoint.register(router,'/lighting_fixed_point');




router.get('/lighting_fixed_point', function(req, res){

	console.log("test1");
	
}); 





// Return router
module.exports = router;
  
