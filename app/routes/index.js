const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
dayjs.extend(localizedFormat);
const { ObjectId } = require('mongoose').Types;
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

// สร้างโครงสร้างข้อมูล gold_data_tag
const goldTagSchema = new mongoose.Schema({
 
  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  has_data: Boolean
  // ,gold_timestamp: { type: Date, default: Date.now }
},{ 
  collection: 'gold_data_tag' 
});

const GoldTag = mongoose.model('GoldTag', goldTagSchema);

// สร้างโครงสร้างข้อมูล goldcount
const goldCountSchema = new mongoose.Schema({

  gold_id: ObjectId,
  goldtype: String,
  size: String,
  weight: String,
  
  // ,gold_timestamp: { type: Date, default: Date.now }
},{ 
  collection: 'Goldcount'
});

const Gold = mongoose.model('Gold', goldCountSchema);

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
      // ตรวจสอบว่า gold_id นี้มีข้อมูลในระบบหรือไม่
      const existingGold = await GoldTag.findOne({ gold_id: rfidTags[i] });
      let hasData = false;
      if (existingGold) {
        hasData = true; // หากมีข้อมูลในระบบแล้วก็กำหนดให้ hasData เป็น true
      }
      addgoldsdata.push({ gold_id: rfidTags[i], has_data: hasData });
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
        const newGoldData = new GoldTag({
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

router.get('/edit_goldTagData', async (req, res) => {
  try {
    let condition = {};

    // ถ้ามีการเลือกประเภททองคำ
    if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
      condition.gold_type = req.query.select_goldType;
    }

    // ถ้ามีการเลือกขนาดทองคำ
    if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
      condition.gold_size = req.query.select_goldSize;
    }

    const goldsedit = await GoldTag.find(condition);
    res.render('edit_goldTagData', {
      goldsedit: goldsedit,
      dayjs: dayjs,
      select_goldType: req.query.select_goldType,
      select_goldSize: req.query.select_goldSize
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



// GET route เพื่อดึงข้อมูลทองคำที่ต้องการแก้ไข
router.get('/edit_dataform', async (req, res) => {
    try {
        const goldId = req.query.gold_id; // รับ Gold_Tag_id ที่ต้องการแก้ไขจาก query parameter
        const goldData = await GoldTag.findOne({ gold_id: goldId }); // ค้นหาข้อมูลทองคำที่ต้องการแก้ไขในฐานข้อมูล

        if (!goldData) {
            return res.status(404).send('Gold data not found'); // หากไม่พบข้อมูลทองคำที่ต้องการแก้ไข
        }

        // ส่งข้อมูลทองคำไปยังหน้าแก้ไขข้อมูล
        res.render('edit_dataform', { goldId: goldData.gold_id, goldType: goldData.gold_type, goldSize: goldData.gold_size, goldWeight: goldData.gold_weight, select_goldType: goldData.gold_type, select_goldSize: goldData.gold_size });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// POST route เพื่ออัปเดตข้อมูลทองคำ
router.post('/update_data', async (req, res) => {
    try {
        const { gold_id, gold_type, gold_size, gold_weight } = req.body; // รับข้อมูลที่แก้ไขจากฟอร์ม

        // ค้นหาและอัปเดตข้อมูลทองคำในฐานข้อมูล
        await GoldTag.findOneAndUpdate({ gold_id: gold_id }, { gold_type: gold_type, gold_size: gold_size, gold_weight: gold_weight });

        res.redirect('/edit_goldTagData'); // ส่งกลับไปยังหน้าหลักหลังจากทำการอัปเดตข้อมูลเสร็จสิ้น
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

//GET route เพื่อลบข้อมูลทองคำ
router.get('/delete_goldTagData/:gold_id', async (req, res) => {
  try {
      const goldId = req.params.gold_id; // รับ Gold_Tag_id ที่ต้องการลบจาก parameter ของ URL
      await GoldTag.findOneAndDelete({ gold_id: goldId}); // ค้นหาและลบข้อมูลทองคำในฐานข้อมูล

      res.redirect('/edit_goldTagData'); // ส่งกลับไปยังหน้าหลักหลังจากทำการลบข้อมูลเสร็จสิ้น
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
