const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
dayjs.extend(localizedFormat);
const { ObjectId } = require('mongoose').Types;
const connectDB = require('../Config/db');
const rfidModule = require('../rfid_module/rfidReader');


// เชื่อมต่อกับ MongoDB
mongoose.connect('mongodb+srv://admin:1234@goldcluster.nf1xhez.mongodb.net/GoldRfid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// สร้างโครงสร้างข้อมูล
const goldSchema = new mongoose.Schema({

  // gold_id: ObjectId,
  // goldtype: String,
  // size: String,
  // weight: String,
  
  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String
  // ,gold_timestamp: { type: Date, default: Date.now }
},{ 
  collection: 'gold_data_tag' 
  // collection: 'Goldcount'
});

const Gold = mongoose.model('Gold', goldSchema);

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    let condition = {};
    if (req.query.search) {
      condition = { topic: { $regex: new RegExp(req.query.search, 'i') } };
    }

    const golds = await Gold.find(condition);
    res.render('index', { golds: golds, dayjs: dayjs });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// router.get('/gold_list',async (req, res) => {
//   try {
//     let condition = {};
//     if (req.query.search) {
//       condition = { topic: { $regex: new RegExp(req.query.search, 'i') } };
//     }
//     const goldslist = await Gold.find(condition);
//     res.render('gold_list', { goldslist: goldslist , golds_data: {} , dayjs: dayjs });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });

router.get('/gold_list', async (req, res, next) => {
  try {
      let condition = {};

      // ถ้ามีการเลือกประเภททองคำ
      if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
          condition.goldtype = req.query.select_goldType;
      }

      // ถ้ามีการเลือกขนาดทองคำ
      if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
          condition.size = req.query.select_goldSize;
      }

      const goldslist = await Gold.find(condition);
      res.render('gold_list', { 
        goldslist: goldslist, 
        dayjs: dayjs, 
        select_goldType: 
        req.query.select_goldType, 
        select_goldSize: req.query.select_goldSize });
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});

// //mockup id for test
// router.get('/add_golddata', async (req,res) => {
//   try{
//     let addgoldsdata = [];
//     // สร้างข้อมูลเลข tag 001 - 010
//     for (let i = 1; i <= 10; i++) {
//         let paddedNumber = i.toString().padStart(3, '0');
//         addgoldsdata.push({ gold_id: paddedNumber });
//     }
//       res.render('add_golddata', {
//         addgoldsdata: addgoldsdata,
//         dayjs: dayjs
//     });
//   } catch (error) {
//       console.error(error);
//       res.status(500).send('Internal Server Error');
//   }
// });

router.get('/add_golddata', async (req, res) => {
  try {
    let addgoldsdata = [];
    let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidReader.js
    for (let i = 0; i < rfidTags.length; i++) {
      addgoldsdata.push({ gold_id: rfidTags[i] });
    }
    res.render('add_golddata', {
      addgoldsdata: addgoldsdata,
      dayjs: dayjs
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/add_dataform', async (req, res) => {
  try {
      // ดึงค่า Gold_Tag_id จาก query string
      const goldId = req.query.gold_id;

      res.render('add_dataform', { goldId: goldId });
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});

router.post('/add_dataform', async (req, res) => {
  try {
      // ดึงค่า Gold_Tag_id จาก body ของการส่งข้อมูลแบบ POST
      const goldId = req.body.gold_id;
      // ดำเนินการบันทึกข้อมูลทองคำโดยใช้ goldId ที่ได้มา
      const { gold_id, gold_type, gold_size, gold_weight } = req.body;

        // // สร้าง timestamp ปัจจุบัน
        // const timestamp = Date.now();

        // // แปลง timestamp เป็นวันที่และเวลาในรูปแบบที่ต้องการ (วัน เดือน ปี เวลา ไทย)
        // const gold_timestamp = dayjs(timestamp).locale('th').format('DD MMMM YYYY HH:mm:ss');

        // สร้างข้อมูลที่จะบันทึกลงในฐานข้อมูล
        const newGoldData = new Gold({
            gold_id,
            gold_type,
            gold_size,
            gold_weight
            // ,gold_timestamp // เพิ่ม timestamp ไปยังข้อมูล
        });
        
        // บันทึกข้อมูลลงในฐานข้อมูล
        await newGoldData.save();

      res.redirect('./add_golddata');
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});

router.get('/clear_rfid_tags', (req, res) => {
  try {
      rfidModule.resetRfidTags(); // เรียกใช้งานฟังก์ชัน resetRfidTags() เพื่อล้างค่า rfidTags
      res.json({ message: 'RFID Tags cleared successfully' }); // ส่งข้อความกลับไปยัง client เพื่อแสดงว่าล้างค่าสำเร็จ
      console.log('RFID Tags cleared successfully');
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/gold_edit', async (req,res) => {
  try{
      let condition = {};

      // ถ้ามีการเลือกประเภททองคำ
      if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
          condition.goldtype = req.query.select_goldType;
      }

      // ถ้ามีการเลือกขนาดทองคำ
      if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
          condition.size = req.query.select_goldSize;
      }

      const goldsedit = await Gold.find(condition);
      res.render('gold_edit', {
        goldsedit: goldsedit,
        dayjs: dayjs, 
        select_goldType: 
        req.query.select_goldType, 
        select_goldSize: req.query.select_goldSize});
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});



// // สร้างเส้นทางเพื่อแก้ไขข้อมูล
// router.get('/edit/:id', async (req, res) => {
//   try {
//       const gold_edit = await Gold.findById(req.params.id);
//       res.render('edit_modal', { gold_edit: gold_edit });
//   } catch (error) {
//       console.error(error);
//       res.status(500).send('Internal Server Error');
//   }
// });

// // สร้างเส้นทางเพื่ออัปเดตข้อมูล
// router.post('/update/:id', async (req, res) => {
//   try {
//       const { goldtype, size, weight } = req.body;
//       await Gold.findByIdAndUpdate(req.params.id, { goldtype, size, weight });
//       res.redirect('/add_edit');
//   } catch (error) {
//       console.error(error);
//       res.status(500).send('Internal Server Error');
//   }
// });



module.exports = router;
