import { NextResponse } from 'next/server';

// จำลองฐานข้อมูลชั่วคราวในหน่วยความจำ (ถ้าบอสมี Database เช่น MySQL/PostgreSQL/MongoDB สามารถเอาโค้ดต่อ DB มาเสียบตรงนี้ได้ทันทีครับ)
let poiDatabase: any[] = [
  { id: 1, name: 'โกดังใหญ่ชลบุรี', lat: 13.28446, lon: 101.39728, radius: 0.5, address: 'ต.วัดสุวรรณ อ.บ่อทอง จ.ชลบุรี' }
];

// ดึงข้อมูลจุดจอดทั้งหมด (GET)
export async function GET() {
  return NextResponse.json({ success: true, data: poiDatabase });
}

// บันทึกจุดจอดใหม่ (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // ตรวจสอบความถูกต้องของข้อมูล
    if (!body.lat || !body.lon || !body.name) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    const newPoi = {
      id: Date.now(),
      name: body.name,
      lat: parseFloat(body.lat),
      lon: parseFloat(body.lon),
      radius: parseFloat(body.radius || 0.5),
      address: body.address || 'ไม่ระบุที่อยู่',
      createdAt: new Date().toISOString(),
    };

    poiDatabase.push(newPoi);
    console.log('📍 บันทึกจุดจอดใหม่สำเร็จ:', newPoi);

    return NextResponse.json({ success: true, message: 'บันทึกจุดจอดเรียบร้อยแล้ว', data: newPoi });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }, { status: 500 });
  }
}