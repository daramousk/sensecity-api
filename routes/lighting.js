// Dependencies

var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');



mongoose.connect('mongodb://localhost/sensecity');

// Models

var Lighting_model = require('../models/lighting');

// Routes
Lighting_model.methods(['get', 'put', 'post', 'delete']);
Lighting_model.register(router,'/issues');




router.get('/lighting', function(req, res){
		console.log('sdfsdf');
		Lighting_model.find();	
}); 





// Return router
module.exports = router;
  
