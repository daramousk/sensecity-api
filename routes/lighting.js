// Dependencies

var express = require('express');
var router1 = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');



//mongoose.connect('mongodb://localhost/sensecity');

// Models

var Lighting_model = require('../models/lighting');

// Routes
Lighting_model.methods(['get', 'put', 'post', 'delete']);
Lighting_model.register(router1,'/lights');




router1.get('/lighting', function(req, res){
		console.log('sdfsdf');
		Lighting_model.find({},function(err, issue){
					res.send(issue);
				  }).limit(2);	
}); 





// Return router
module.exports = router1;
  
