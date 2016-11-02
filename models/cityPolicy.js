// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var cityPolicy_Schema = new mongoose.Schema({
	municipality :  String,
	category: String,	
	description: String,
	anonymous: {type:String, default : "true"}
});

// Return model
module.exports = restful.model('cityPolicy', cityPolicy_Schema);
