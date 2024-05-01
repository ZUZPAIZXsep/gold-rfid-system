const mongoose = require('mongoose');



const connectDB = async()=>{
    try{
        await mongoose.connect('mongodb+srv://admin:1234@goldcluster.nf1xhez.mongodb.net/gold');
        console.log('Connected DB GoldRfid')
    }catch(err){
        console.log(err)
    }
}

module.exports = connectDB