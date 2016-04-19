// Dependencies

var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');



//mongoose.connect('mongodb://localhost/sensecity');

// Models

var Lighting_model = require('../models/issue');

// Routes
/*Lighting_model.methods(['get', 'put', 'post', 'delete']);
Lighting_model.register(router,'/lights');
*/



router.get('/:id', function(req, res){		
		/*Lighting_model.find({},function(err, issue){
					res.send(issue);
				  }).limit(2);	
				  
				  */
	console.log("sdfds");
}); 





// Return router
module.exports = router;
  
