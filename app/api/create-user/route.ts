import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password, email } = await request.json();

    // ใช้ Service Role Key เพื่อให้มีสิทธิ์แอดมินสูงสุด (สร้าง User ได้โดยไม่กระทบคนล็อกอินอยู่)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cleanUsername = username.trim().toLowerCase();
    // ถ้าเขาไม่ใส่อีเมลมา ให้ระบบสร้างอีเมลจำลองให้เองจากชื่อ
    const finalEmail = email ? email.trim() : `${cleanUsername}@jarungphat.com`;

    // 1. สร้างไอดีในระบบยืนยันตัวตน (Authentication)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: password,
      email_confirm: true, // ยืนยันอีเมลให้เลย จะได้เข้าใช้งานได้ทันที
    });

    if (authError) throw authError;

    // 2. บันทึกข้อมูลจับคู่ "ชื่อเล่น -> อีเมล" ลงตาราง user_mappings
    const { error: mappingError } = await supabaseAdmin
      .from('user_mappings')
      .insert([{ username: cleanUsername, email: finalEmail }]);

    if (mappingError) throw mappingError;

    return NextResponse.json({ success: true, message: 'สร้างบัญชีผู้ใช้งานสำเร็จ' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}