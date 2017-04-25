// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var municipalitySchema = new mongoose.Schema({
	municipality: String,
	municipality_desc: String,
    boundaries: { coordinates: Number },
    sms_key_fibair: { type: String, default: "" },
    mandatory_email: { type: String, default: "false" },
    mandatory_sms: { type: String, default: "false" },
    active_sms_service: { type: String, default: "false" }
});


// Return model
module.exports = restful.model('municipality', municipalitySchema);
