import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    if (!supabaseServiceKey) throw new Error('ไม่พบ SUPABASE_SERVICE_ROLE_KEY');

    // 🌟 1. ดึงข้อมูลจาก "ทุกระบบ" ตามเมนูหน้า Dashboard 🌟
    const { data: plots } = await supabaseAdmin.from('plots').select('*');
    const { data: attendance } = await supabaseAdmin.from('daily_attendance').select('*');
    const { data: advances } = await supabaseAdmin.from('advance_payments').select('*');
    const { data: employees } = await supabaseAdmin.from('employees').select('*');
    const { data: inventory } = await supabaseAdmin.from('inventory').select('*');
    const { data: payroll } = await supabaseAdmin.from('payroll').select('*');
    const { data: users } = await supabaseAdmin.from('users').select('*');
    const { data: history } = await supabaseAdmin.from('history').select('*');
    const { data: deliveries } = await supabaseAdmin.from('sugarcane_deliveries').select('*');
    const { data: configs } = await supabaseAdmin.from('truck_quota_configs').select('*');

    // 🌟 2. แพ็ครวมเป็นก้อนเดียว (Full ERP Backup) 🌟
    const backupData = {
      version: '3.0_Full_ERP_System',
      backup_date: new Date().toISOString(),
      plots: plots || [],
      daily_attendance: attendance || [],
      advance_payments: advances || [],
      employees: employees || [],
      inventory: inventory || [],
      payroll: payroll || [],
      users: users || [],
      history: history || [],
      sugarcane_deliveries: deliveries || [],
      truck_quota_configs: configs || []
    };

    const fileContent = JSON.stringify(backupData, null, 2);
    const fileName = `backup-full-${new Date().toISOString().split('T')[0]}.json`; 

    // 3. โยนขึ้น Cloud (Supabase Storage)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('backups')
      .upload(fileName, fileContent, {
        contentType: 'application/json',
        upsert: true 
      });

    if (uploadError) throw uploadError;

    // 4. ลบไฟล์ที่เก่าเกิน 15 วัน
    const { data: files } = await supabaseAdmin.storage.from('backups').list();
    if (files && files.length > 0) {
      const now = new Date();
      const filesToDelete = files.filter(file => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        const diffDays = Math.ceil(Math.abs(now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 15;
      }).map(file => file.name);

      if (filesToDelete.length > 0) {
        await supabaseAdmin.storage.from('backups').remove(filesToDelete);
      }
    }

    return NextResponse.json({ message: 'Full ERP Backup Successful' }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}