// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var activate_mobileSchema = new mongoose.Schema({
    mobile_num: String,
    activate: { type: String, default: "" }
});

// Return model
module.exports = restful.model('Activate_mobile', activate_mobileSchema);