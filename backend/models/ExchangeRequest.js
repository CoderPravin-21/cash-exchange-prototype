import mongoose from 'mongoose';

const exchangeRequestSchema = new mongoose .Schema({


    requester: {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    helper :{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default:null

    },

    amount:{
        type : Number,
        required :true,
        min: 1

    },

    exchangeType:{
        type: String,
        enum: ["CASH_TO_ONLINE", "ONLINE_TO_CASH"],
        required: true
    },

    location:{
        type:{
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates:{
            type:[Number], // [longitude, latitude]
            required:true

        }
        
    },

    status:{
        type: String,
        enum : ["CREATED", "ACCEPTED", "COMPLETED", "CANCELLED", "EXPIRED"],
        default: "CREATED"

    },
    linkedRequest: {
    type: mongoose.Schema.Types.ObjectId,
  ref: "ExchangeRequest",
  default: null,
},


    expiresAt:{
        type: Date,
        required: true
    },

}, { 
    timestamps: true   
   } 
);

exchangeRequestSchema.index({ location: "2dsphere" });
exchangeRequestSchema.index({ status: 1 });
exchangeRequestSchema.index({ requester: 1 });
exchangeRequestSchema.index({ helper: 1 });
exchangeRequestSchema.index({ expiresAt: 1 });


const ExchangeRequest = mongoose.model(
  "ExchangeRequest",
  exchangeRequestSchema
);

export default ExchangeRequest;