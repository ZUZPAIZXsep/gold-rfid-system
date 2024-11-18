var HID = require('node-hid'); // นำเข้าชุดคำสั่ง 'node-hid' ที่ใช้ในการเชื่อมต่อกับอุปกรณ์ HID (Human Interface Device)
var devices = HID.devices(); // เก็บรายการอุปกรณ์ HID ทั้งหมดที่เชื่อมต่ออยู่ในตัวแปร 'devices'

// console.log('devices:', HID.devices());  //list USB-HID // แสดงรายการอุปกรณ์ USB-HID ที่เชื่อมต่ออยู่ในคอนโซล (ถูกปิดการทำงานไว้)

var deviceInfo = devices.find(function (d) { 
    var isTeensy = d.vendorId === 0x1a86 && d.productId === 0xe010;  // ตรวจสอบว่าอุปกรณ์มีรหัส VID=0x1A86 และ PID=0xE010 ซึ่งเป็นรหัสของเครื่องสแกน RFID
    var isKbd = d.path.includes('kbd'); // ตรวจสอบว่าอุปกรณ์เป็นคีย์บอร์ดหรือไม่ (ค้นหา 'kbd' ใน path ของอุปกรณ์)
    if (isTeensy && isKbd === false)  // ตรวจสอบว่าเป็นเครื่องสแกนที่ไม่ใช่คีย์บอร์ด
        return d.path; // คืนค่า path ของอุปกรณ์
    else return null; // ถ้าไม่ตรงตามเงื่อนไข ให้คืนค่าเป็น null
});

function sleep(delay) { 
    return new Promise((resolve) => setTimeout(resolve, delay)); // ฟังก์ชันพักการทำงานชั่วคราวตามเวลาที่กำหนดใน 'delay' (มิลลิวินาที)
}

var seenTags = {}; // ตัวแปรเก็บรหัสแท็กที่ถูกอ่านแล้ว (เก็บในรูปแบบออบเจ็กต์)
var rfidTags = []; // ตัวแปรเก็บรหัสแท็กที่ถูกอ่านแล้ว (เก็บในรูปแบบอาร์เรย์)

function ShowTagData(data) { 
    var tagID = data.slice(19, 31).toString('hex'); // ดึงข้อมูลรหัสแท็กจากตำแหน่งที่ 19 ถึง 31 ใน Buffer และแปลงเป็นรหัสฐาน 16
    if (!rfidTags.includes(tagID)) { // ตรวจสอบว่ารหัสแท็กนี้ยังไม่เคยถูกบันทึก
        rfidTags.push(tagID); // เพิ่มรหัสแท็กลงในอาร์เรย์ 'rfidTags'
        // console.log('tag:', tagID); // แสดงรหัสแท็กในรูปแบบฐาน 16 (ปิดการทำงานไว้)
    }
}

// // เพิ่มฟังก์ชันเพื่อรับข้อมูล RFID สำหรับเว็บแอปพลิเคชัน
// function getRfidData() {
//     return rfidData;
// }

function getRfidTags() { 
    return rfidTags; // คืนค่าอาร์เรย์ 'rfidTags' ที่เก็บรหัสแท็กทั้งหมดที่อ่านได้
}

function resetRfidTags() { 
    rfidTags = []; // ล้างค่าในอาร์เรย์ 'rfidTags'
}

async function run() { 
    if (deviceInfo) { // ตรวจสอบว่ามีอุปกรณ์ที่ตรงกับเงื่อนไขอยู่หรือไม่
        var device = new HID.HID(deviceInfo.path); // เปิดการเชื่อมต่อกับอุปกรณ์ที่เลือก
        try {
            console.log("Open Rfid Reader Success"); // แสดงข้อความในคอนโซลเมื่อเปิดเครื่องอ่าน RFID สำเร็จ
            device.sendFeatureReport([0x00, 0xFF, 0xC7, 0x83, 0xCC, 0x30, 0x00]);  // ส่งคำสั่งเพื่อเริ่มการทำงานของ USB-HID [0x00, 0xFF, 0xC7, 0x83, 0xCC, 0x30, 0x00] เป็นเลขสั่งการให้เครื่องอ่าน RFID เปิดทำงาน
        } catch (err) { 
            // ดักจับข้อผิดพลาดเมื่อเปิดการเชื่อมต่อไม่สำเร็จ (ไม่มีการดำเนินการใดๆ เมื่อมีข้อผิดพลาด)
        }

        await sleep(200); // พักการทำงาน 200 มิลลิวินาที
        // กำหนดการตั้งค่า
        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x24, 0x05, 0x07, 0x22]);    // ตั้งค่า RF Power ให้เป็น 7 dbm เป็นระดับพลังงานที่กำหนดให้สำหรับการส่งสัญญาณ RF ของอุปกรณ์ในการอ่านแท็ก RFID
        await sleep(200); // พักการทำงานอีก 200 มิลลิวินาที

        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x24, 0x02, 0x01, 0x2B]);    // ตั้งค่า Active Mode เพื่อให้อุปกรณ์ทำงานแบบ Active Mode
        await sleep(200);

        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x3F, 0x31, 0x80, 0x62]);   // ตั้งค่าความถี่เป็นย่าน US band
        await sleep(200);

        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x24, 0x0A, 0x01, 0x23]);   // ตั้งค่า Scan Area ให้อ่านเฉพาะ Tag id
        await sleep(200);

        device.on('data', function (data) { // ตั้งค่าการดักข้อมูลจากเครื่องอ่าน RFID
            if (data[0] !== 0 && data[1] === 0x43 && data[2] === 0x54 && data[6] === 0x45) { // ตรวจสอบข้อมูลที่อ่านได้ตามเงื่อนไขที่กำหนด
                ShowTagData(data); // เรียกใช้ฟังก์ชัน ShowTagData เพื่อจัดเก็บรหัสแท็กที่อ่านได้
            }
        });
    }
}

run(); // เรียกใช้ฟังก์ชัน run เพื่อเริ่มการทำงาน

module.exports = {
    //getRfidData // ส่งฟังก์ชัน getRfidData ออกไปให้ Express.js ใช้งาน (ยังไม่ได้เปิดการใช้งาน)
    getRfidTags, // ส่งฟังก์ชัน getRfidTags ออกไปให้ Express.js ใช้งาน
    resetRfidTags, // ส่งฟังก์ชัน resetRfidTags ออกไปให้ Express.js ใช้งาน
};
