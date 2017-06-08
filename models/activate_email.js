// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var activate_emailSchema = new mongoose.Schema({
    email: String,    
    activate: { type: String, default: "" }
});

// Return model
module.exports = restful.model('Activate_email', activate_emailSchema);