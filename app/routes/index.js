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
  has_data: Boolean,
  gold_tray: String
},{ 
  collection: 'gold_data_tag' 
});

const GoldTag = mongoose.model('GoldTag', goldTagSchema);

// สร้างโครงสร้างข้อมูล goldcount_history
const goldCountHistorySchema = new mongoose.Schema({

  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  gold_tray: String,
  gold_timestamp: { type: Date, default: Date.now },
  gold_status: String,
  gold_outDateTime: Date,
  customer_name: String,
  customer_surname: String,
  customer_phone: String

},{ 
  collection: 'goldcount_history'
});

const Goldhistory = mongoose.model('Goldhistory', goldCountHistorySchema);

// สร้างโครงสร้างข้อมูล goldtags_count
const goldTagsCountSchema = new mongoose.Schema({

  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  gold_tray: String,
  gold_timestamp: { type: Date, default: Date.now },
  gold_status: String,
  gold_outDateTime: Date
  
},{ 
  collection: 'goldtags_count'
});

const Goldtagscount = mongoose.model('Goldtagscount', goldTagsCountSchema);

// ฟังก์ชันสำหรับจัดถาด
function assignTray(gold_type) {
  switch(gold_type) {
    case 'สร้อยคอ':
      return 'ถาดที่ 1';
    case 'แหวน':
      return 'ถาดที่ 2';
    case 'กำไลข้อมือ':
      return 'ถาดที่ 3';
    case 'สร้อยข้อมือ':
      return 'ถาดที่ 4';
    case 'ต่างหู':
      return 'ถาดที่ 5';
    default:
      return 'ถาดอื่นๆ';
  }
}

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    let condition = {};
    const golds = await Goldtagscount.find(condition);

    // เรียงข้อมูลตามลำดับถาด
      golds.sort((a, b) => {
      const trayOrder = {
        'ถาดที่ 1': 1,
        'ถาดที่ 2': 2,
        'ถาดที่ 3': 3,
        'ถาดที่ 4': 4,
        'ถาดที่ 5': 5,
        'ถาดอื่นๆ': 6
      };

      return trayOrder[a.gold_tray] - trayOrder[b.gold_tray];
    });

    res.render('index', { golds: golds, dayjs: dayjs, currentUrl: req.originalUrl });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/count_goldtags', async (req, res) => {
  try {
    let countgoldtags = [];
    let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidModule
    
    // ดึงข้อมูลจาก database ที่มี gold_id ตรงกับ rfidTags
    countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });

    // เพิ่มการจัดถาดให้กับทองคำแต่ละชนิด
    countgoldtags = countgoldtags.map(tag => {
      return {
        ...tag._doc,
        gold_tray: assignTray(tag.gold_type)
      };
    });

    // เรียงข้อมูลตามลำดับถาด
    countgoldtags.sort((a, b) => {
      const trayOrder = {
        'ถาดที่ 1': 1,
        'ถาดที่ 2': 2,
        'ถาดที่ 3': 3,
        'ถาดที่ 4': 4,
        'ถาดที่ 5': 5,
        'ถาดอื่นๆ': 6
      };

      return trayOrder[a.gold_tray] - trayOrder[b.gold_tray];
    });

    res.render('count_goldtags', {
      countgoldtags: countgoldtags,
      dayjs: dayjs, 
      currentUrl: req.originalUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/save_goldtags', async (req, res) => {
  try {
      // ดึงข้อมูลจาก database ที่มี gold_id ตรงกับ rfidTags
      let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidModule
      let countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });

      // สร้าง object ที่จะบันทึกลงใน collection `goldtags_count`
      let newGoldtagscount = countgoldtags.map(count_tag => ({
          gold_id: count_tag.gold_id,
          gold_type: count_tag.gold_type,
          gold_size: count_tag.gold_size,
          gold_weight: count_tag.gold_weight,
          gold_tray: assignTray(count_tag.gold_type),
          gold_timestamp: dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss'), // Timestamp ปัจจุบัน (รูปแบบวันที่และเวลาไทย)
          gold_status: 'in stock' // เพิ่มสถานะ
      }));

      // ลบข้อมูลเก่าออกก่อน
      await Goldtagscount.deleteMany({});
      // บันทึกข้อมูลใน collection `goldtags_count`
      await Goldtagscount.insertMany(newGoldtagscount);

      // เพิ่มฟังก์ชันในการบันทึกลงใน collection `goldhistory`
      let currentDate = dayjs().locale('th').startOf('day').toDate(); // เริ่มต้นวันปัจจุบัน
      let endOfCurrentDate = dayjs().locale('th').endOf('day').toDate(); // สิ้นสุดวันปัจจุบัน

      // ลบข้อมูลเก่าที่เป็นวันเดียวกันทั้งหมดก่อน
      await Goldhistory.deleteMany({
          gold_timestamp: {
              $gte: currentDate,
              $lte: endOfCurrentDate
          }
      });

      // เพิ่มข้อมูลใหม่
      await Goldhistory.insertMany(newGoldtagscount);

      res.json({ message: 'บันทึกรายการเรียบร้อยแล้ว' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

  router.get('/clear_goldtags_count', async (req, res) => {
    try {
        await Goldtagscount.deleteMany({}); // ลบข้อมูลทั้งหมดใน collection `goldtags_count`
        res.json({ message: 'ลบข้อมูลการนับทั้งหมดเรียบร้อยแล้ว' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/gold_list', async (req, res, next) => {
    try {
        let condition = { gold_status: 'in stock' }; // เพิ่มเงื่อนไขการกรองโดย gold_status
  
        // ถ้ามีการเลือกประเภททองคำ
        if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
            condition.gold_type = req.query.select_goldType;
        }
  
        // ถ้ามีการเลือกขนาดทองคำ
        if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
            condition.gold_size = req.query.select_goldSize;
        }
  
        // ถ้ามีการกรอกเลข Gold ID
        if (req.query.gold_id) {
          condition.gold_id = req.query.gold_id;
        }
        
        const goldslist = await Goldtagscount.find(condition);
  
        // เรียงข้อมูลตามลำดับถาด
        goldslist.sort((a, b) => {
        const trayOrder = {
          'ถาดที่ 1': 1,
          'ถาดที่ 2': 2,
          'ถาดที่ 3': 3,
          'ถาดที่ 4': 4,
          'ถาดที่ 5': 5,
          'ถาดอื่นๆ': 6
        };
  
        return trayOrder[a.gold_tray] - trayOrder[b.gold_tray];
      });
        
        res.render('gold_list', { 
          goldslist: goldslist, 
          dayjs: dayjs, 
          select_goldType: req.query.select_goldType, 
          select_goldSize: req.query.select_goldSize,
          gold_id: req.query.gold_id, 
          currentUrl: req.originalUrl });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });
  
  router.post('/update_goldstatus', async (req, res) => {
    try {
        const { gold_id, customer_name, customer_surname, customer_phone } = req.body;
        const currentTimestamp = dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss');

        // Update gold_status and gold_outDateTime in Goldtagscount collection
        const result = await Goldtagscount.updateOne(
            { gold_id: gold_id },
            {
                $set: {
                    gold_status: 'out of stock',
                    gold_outDateTime: currentTimestamp,
                },
            }
        );

        // หาเอกสารทองคำใน Goldhistory โดยใช้ gold_id และ timestamp ของวันนี้
        const existingGold = await Goldhistory.findOne({
            gold_id: gold_id,
            gold_timestamp: {
                $gte: dayjs().locale('th').startOf('day').toDate(),
                $lte: dayjs().locale('th').endOf('day').toDate(),
            },
        });

        if (existingGold) {
            // อัปเดตข้อมูลผู้ซื้อไปยังเอกสารที่มีอยู่แล้ว
            existingGold.customer_name = customer_name;
            existingGold.customer_surname = customer_surname;
            existingGold.customer_phone = customer_phone;
            existingGold.gold_status = 'out of stock';
            existingGold.gold_outDateTime = currentTimestamp;
            await existingGold.save();
        } else {
            // สร้างเอกสารใหม่ในกรณีที่ไม่มีเอกสารทองคำในวันนี้
            await Goldhistory.create({
                gold_id: gold_id,
                gold_status: 'out of stock',
                gold_outDateTime: currentTimestamp,
                customer_name: customer_name,
                customer_surname: customer_surname,
                customer_phone: customer_phone,
                gold_timestamp: currentTimestamp,
            });
        }

        res.redirect('/gold_list');
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
        dayjs: dayjs, 
        currentUrl: req.originalUrl
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

          res.redirect('/add_golddata?success=true');
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

      // ถ้ามีการกรอกเลข Gold ID
      if (req.query.gold_id) {
        condition.gold_id = req.query.gold_id;
      }

      const goldsedit = await GoldTag.find(condition);
      res.render('edit_goldTagData', {
        goldsedit: goldsedit,
        dayjs: dayjs,
        select_goldType: req.query.select_goldType,
        select_goldSize: req.query.select_goldSize, 
        gold_id: req.query.gold_id,
        currentUrl: req.originalUrl
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

          res.redirect('/edit_goldTagData?success=true'); // ส่งกลับไปยังหน้าหลักหลังจากทำการอัปเดตข้อมูลเสร็จสิ้น
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

        res.redirect('/edit_goldTagData?deleteSuccess=true'); // ส่งกลับไปยังหน้าหลักหลังจากทำการลบข้อมูลเสร็จสิ้น
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });

  const ITEMS_PER_PAGE = 15;

  router.get('/gold_salesHistory', async (req, res, next) => {
    try {
        let condition = { gold_status: 'out of stock' }; // Initial condition for out of stock items

        // Filter conditions based on query parameters
        if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
            condition.gold_type = req.query.select_goldType;
        }
        if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
            condition.gold_size = req.query.select_goldSize;
        }
        if (req.query.gold_id && req.query.gold_id.trim().length > 0) {
            condition.gold_id = req.query.gold_id.trim();
        }
        if (req.query.start_date && req.query.end_date) {
            const startDate = new Date(req.query.start_date);
            const endDate = new Date(req.query.end_date);
            condition.gold_outDateTime = {
                $gte: startDate,
                $lt: dayjs(endDate).endOf('day').toDate() // End of day for endDate
            };
        } else if (req.query.start_date) {
            const startDate = new Date(req.query.start_date);
            condition.gold_outDateTime = { $gte: startDate };
        } else if (req.query.end_date) {
            const endDate = new Date(req.query.end_date);
            condition.gold_outDateTime = { $lt: dayjs(endDate).endOf('day').toDate() };
        }


        // Pagination logic
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const allRecords = await Goldhistory.find(condition)
            .sort({ gold_outDateTime: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE);

        const totalItems = await Goldhistory.countDocuments(condition);

        res.render('gold_salesHistory', {
          goldshistory: allRecords,
          dayjs: dayjs,
          select_goldType: req.query.select_goldType,
          select_goldSize: req.query.select_goldSize,
          startDate: req.query.start_date,
          endDate: req.query.end_date,
          gold_id: req.query.gold_id,
          currentUrl: req.originalUrl,
          totalPages: Math.ceil(totalItems / ITEMS_PER_PAGE),
          currentPage: page
      });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


  router.get('/gold_history', async (req, res, next) => {
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

        // ถ้ามีการเลือกวันที่เริ่มต้นและสิ้นสุด
        if (req.query.start_date && req.query.end_date) {
            const startDate = new Date(req.query.start_date);
            const endDate = new Date(req.query.end_date);

            // ถ้าวันที่เริ่มต้นและสิ้นสุดเป็นวันเดียวกัน
            if (startDate.toDateString() === endDate.toDateString()) {
                condition.gold_timestamp = {
                    $gte: startDate,
                    $lt: dayjs(endDate).add(1, 'day').toDate() // เพิ่ม 1 วันเพื่อให้ครอบคลุมทั้งวัน
                };
            } else {
                // ถ้าวันที่เริ่มต้นและสิ้นสุดเป็นคนละวัน
                condition.gold_timestamp = {
                    $gte: startDate,
                    $lt: dayjs(endDate).add(1, 'day').toDate() // เพิ่ม 1 วันเพื่อให้ครอบคลุมทั้งวันสิ้นสุด
                };
            }
        } else if (req.query.start_date) {
            // ถ้ามีการเลือกแค่วันที่เริ่มต้น
            const startDate = new Date(req.query.start_date);
            condition.gold_timestamp = { $gte: startDate };
        } else if (req.query.end_date) {
            // ถ้ามีการเลือกแค่วันที่สิ้นสุด
            const endDate = new Date(req.query.end_date);
            condition.gold_timestamp = { $lt: dayjs(endDate).add(1, 'day').toDate() };
        }

        const page = parseInt(req.query.page) || 1; // หากไม่ได้ระบุหน้า ให้เริ่มจากหน้าที่ 1
        const perPage = 15; // จำนวนรายการต่อหน้า
        const skip = (page - 1) * perPage; // คำนวณหาจำนวนรายการที่ต้องข้าม

        // ดึงข้อมูลทองคำจากฐานข้อมูลโดยใช้เงื่อนไข condition และจัดกลุ่มตามวันและถาด
        const aggregateQuery = [
            { $match: condition },
            { $sort: { gold_timestamp: -1, gold_tray: 1 } }, // เรียงลำดับจากวันที่ล่าสุดไปยังเก่าสุดและตามถาด
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: "$gold_timestamp" },
                        month: { $month: "$gold_timestamp" },
                        year: { $year: "$gold_timestamp" },
                        gold_tray: "$gold_tray"
                    },
                    records: { $push: "$$ROOT" },
                    trayCount: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: {
                        day: "$_id.day",
                        month: "$_id.month",
                        year: "$_id.year"
                    },
                    trays: { $push: "$$ROOT" },
                    totalCount: { $sum: "$trayCount" }
                }
            },
            { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
        ];

        const allRecords = await Goldhistory.aggregate(aggregateQuery);

        // Flatten the grouped data into a single array
        let flatRecords = [];
        allRecords.forEach(group => {
            group.trays.forEach(tray => {
                tray.records.forEach(record => {
                    flatRecords.push({
                        ...record,
                        trayCount: tray.trayCount,
                        totalCount: group.totalCount,
                        groupDate: new Date(group._id.year, group._id.month - 1, group._id.day)
                    });
                });
            });
        });

        // Sorting flat records by date and tray within each day
        flatRecords.sort((a, b) => {
            if (a.groupDate > b.groupDate) return -1;
            if (a.groupDate < b.groupDate) return 1;
            if (a.gold_tray > b.gold_tray) return 1;
            if (a.gold_tray < b.gold_tray) return -1;
            return 0;
        });

        const totalRecords = flatRecords.length;
        const totalPages = Math.ceil(totalRecords / perPage);
        const paginatedRecords = flatRecords.slice(skip, skip + perPage);

        res.render('gold_history', { 
            goldshistory: paginatedRecords, 
            dayjs: dayjs, 
            select_goldType: req.query.select_goldType, 
            select_goldSize: req.query.select_goldSize,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            currentPage: page,
            totalPages: totalPages, 
            currentUrl: req.originalUrl
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



module.exports = router;
