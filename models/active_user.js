// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;
	
// Schema
var active_userSchema = new mongoose.Schema({
	uuid :  String,
	name : String,	
	email : String,
	mobile_num : {type:String, default : ""},	
	create_at : {type: Date, default: Date.now},
	permission :  { send_issues: {type:String, default : "false"}, communicate_with: {email : {type:String, default : "false"}, sms : {type:String, default : "false"}}},
	activate : {type:String, default : ""}
});

// Return model
module.exports = restful.model('Active_user', active_userSchema);
