// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var roleSchema = new mongoose.Schema({
	username : String,
	password: String,
	role: String,
	email: String,
	department: String,
        city: String,
        uuid: String,
        timestamp: Number
});

// Return model
module.exports = restful.model('Roles', roleSchema);