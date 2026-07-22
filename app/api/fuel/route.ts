import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const plate = searchParams.get('plate') || '82-1926';
  const imei = searchParams.get('imei') || '';
  const fuelPrice = Number(searchParams.get('price')) || 32.50; // ราคาน้ำมันดีเซลปัจจุบัน (บาท/ลิตร)

  try {
    // 🌟 1. ดึงข้อมูลประวัติการวิ่งล่าสุดเพื่อเช็กสถานะการดรอปของน้ำมัน
    // ในระบบจริงจะไปเทียบค่าจากตาราง gps_history หรือ cURL ของ thaigpstracker
    const sampleFuelHistory = [
      { time: '21:35:24', status: 'จอดรถ - ดับเครื่อง', speed: 0, mileage: 14987389, fuelPercent: 45, fuelLiters: 135.0 },
      { time: '21:10:00', status: 'จอดรถ - ดับเครื่อง', speed: 0, mileage: 14987389, fuelPercent: 52, fuelLiters: 156.0 }, // 🚨 จุดสงสัย: จอดอยู่ดีๆ น้ำมันหายไป 7% (21 ลิตร)!
      { time: '18:39:12', status: 'กำลังวิ่ง', speed: 65, mileage: 14987360, fuelPercent: 55, fuelLiters: 165.0 },
      { time: '16:00:00', status: 'กำลังวิ่ง', speed: 58, mileage: 14987250, fuelPercent: 68, fuelLiters: 204.0 },
      { time: '12:00:00', status: 'เติมน้ำมันเต็มถัง', speed: 0, mileage: 14987100, fuelPercent: 100, fuelLiters: 300.0 }
    ];

    // 🌟 2. AI ตรวจจับการดูดน้ำมัน (Theft Detection Logic)
    let isTheftDetected = false;
    let theftDetails = null;

    for (let i = 0; i < sampleFuelHistory.length - 1; i++) {
      const current = sampleFuelHistory[i];
      const previous = sampleFuelHistory[i + 1];
      
      const fuelDrop = previous.fuelPercent - current.fuelPercent;
      const mileageDiff = current.mileage - previous.mileage;

      // เงื่อนไขจับผิด: น้ำมันหายเกิน 5% โดยที่รถวิ่งไปไม่ถึง 2 กิโลเมตร (หรือจอดนิ่ง)
      if (fuelDrop >= 5 && mileageDiff <= 2) {
        isTheftDetected = true;
        const litersLost = (previous.fuelLiters - current.fuelLiters).toFixed(1);
        const moneyLost = (Number(litersLost) * fuelPrice).toLocaleString();
        
        theftDetails = {
          timeDetected: current.time,
          fuelDropPercent: `${fuelDrop}%`,
          litersLost: `${litersLost} ลิตร`,
          estimatedLossBaht: `${moneyLost} บาท`,
          location: 'ต.วัดสุวรรณ อ.บ่อทอง จ.ชลบุรี (จุดจอดล่าสุด)',
          reason: 'ระดับน้ำมันลดลงผิดปกติขณะรถจอดนิ่งหรือไม่ได้เคลื่อนที่'
        };
        break;
      }
    }

    // 🌟 3. คำนวณความคุ้มค่าเชิงขนส่งอ้อย (Cost per Ton-Km Analytics)
    const totalKm = 289; // ระยะทางวิ่งสะสมของรอบบิลนี้
    const totalLitersUsed = 78.5; // ใช้น้ำมันไปทั้งหมด
    const totalFuelCost = totalLitersUsed * fuelPrice;
    const totalSugarcaneTons = 58.70; // น้ำหนักอ้อยรวมที่ส่งมอบสำเร็จจากระบบ Job

    const kmPerLiter = (totalKm / totalLitersUsed).toFixed(2); // กม./ลิตร (ยิ่งมากยิ่งดี)
    const costPerKm = (totalFuelCost / totalKm).toFixed(2); // บาท/กม.
    const costPerTon = (totalFuelCost / totalSugarcaneTons).toFixed(2); // บาท/ตันอ้อย (ตัวชี้วัดสำคัญของเจ้าของไร่!)

    return NextResponse.json({
      success: true,
      plate: plate,
      fuelPriceBaht: fuelPrice,
      theftAlert: {
        isDetected: isTheftDetected,
        details: theftDetails
      },
      analytics: {
        efficiencyKmPerLiter: `${kmPerLiter} กม./ลิตร`,
        costPerKmBaht: `${costPerKm} บาท/กม.`,
        costPerTonBaht: `${costPerTon} บาท/ตัน`,
        summaryText: Number(kmPerLiter) >= 3.5 ? '🟢 อัตราสิ้นเปลืองดีเยี่ยม (ประหยัดน้ำมัน)' : '🟠 อัตราสิ้นเปลืองค่อนข้างสูง (ควรตรวจเช็กสภาพเครื่องยนต์หรือลมยาง)',
        rawStats: {
          distanceKm: totalKm,
          litersUsed: totalLitersUsed,
          totalCostBaht: totalFuelCost.toLocaleString(),
          deliveredTons: totalSugarcaneTons
        }
      },
      history: sampleFuelHistory
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'คำนวณค่าน้ำมันไม่สำเร็จ', error: error.message }, { status: 500 });
  }
}