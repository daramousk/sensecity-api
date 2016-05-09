// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var static_dataSchema = new mongoose.Schema({
	municipality:String,
  type:String,
  subtype:String,
  dimos_item_id:String,
  loc:{
		type: String,
		coordinates:[Number], //[<longitude>,<lattitude>]
	},
	notes: [Array],
	create_at: Date
});

static_dataSchema.index({loc: "2dsphere"});

// Return model
module.exports = restful.model('Static_data', static_dataSchema);

