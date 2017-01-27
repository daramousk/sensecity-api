// Dependencies

var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');



//mongoose.connect('mongodb://localhost/sensecity');

// Models

var Issue = require('../models/issue');

// Routes
/*Lighting_model.methods(['get', 'put', 'post', 'delete']);
Lighting_model.register(router,'/lights');
*/



router.get('/:id', function(req, res){		
		/*Lighting_model.find({},function(err, issue){
					res.send(issue);
				  }).limit(2);	
				  
				  */
    console.log("image return");
    console.log(req.params.id);

	var id = req.params.id;
	
	Issue.findOne({"_id":req.params.id},function(err, issue){
		res.send(issue.image_name);
	});
}); 





// Return router
module.exports = router;
  
