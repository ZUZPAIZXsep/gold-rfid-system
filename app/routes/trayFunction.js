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