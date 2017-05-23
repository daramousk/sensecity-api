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
    departments: { type: Array, "default": [] },
        city: String,
        uuid: String,
        timestamp: Number
});

// Return model
module.exports = restful.model('Roles', roleSchema);