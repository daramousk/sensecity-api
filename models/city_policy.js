// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var cityPolicy = new mongoose.Schema({
	city :  String,
	category: String,	
	policy_desc: String,
	anonymous: {type:String, default : "false"}
});

// Return model
module.exports = restful.model('city_Policy', cityPolicy);
