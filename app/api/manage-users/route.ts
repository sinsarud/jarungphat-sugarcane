import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🌟 ฟีเจอร์ใหม่: กู้รหัสผ่านด่วนผ่านรหัสยืนยันของเเถ้าแก่ (Bypass Email)
    if (action === 'master_reset') {
      const { username, new_password, master_pin } = body;

      // ตรวจสอบรหัสลับเถ้าแก่ (ตั้งค่าเริ่มต้นเป็น 2569 หรือดึงจาก .env)
      const envPin = process.env.MASTER_RESET_PIN || '2569';
      if (master_pin !== envPin) {
        return NextResponse.json({ error: 'รหัสยืนยันของเถ้าแก่ไม่ถูกต้อง ไม่สามารถเปลี่ยนรหัสผ่านได้' }, { status: 401 });
      }

      // ค้นหาอีเมลจริงจากชื่อผู้ใช้งานในตารางจับคู่
      const { data: mappingData } = await supabaseAdmin
        .from('user_mappings')
        .select('email')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle();

      if (!mappingData) {
        return NextResponse.json({ error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบไร่อ้อย' }, { status: 404 });
      }

      // ดึงรายชื่อผู้ใช้ทั้งหมดในระบบ Auth เพื่อเอา ID ไปเปลี่ยนรหัส
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = users.find(u => u.email === mappingData.email);

      if (!authUser) {
        return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบฐานข้อมูลหลัก' }, { status: 404 });
      }

      // ใช้สิทธิ์แอดมินสั่ง Override เปลี่ยนรหัสผ่านใหม่ให้ทันทีโดยไม่ต้องส่งเมล
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: new_password
      });

      if (resetError) throw resetError;
      return NextResponse.json({ success: true });
    }

    // 🟢 1. ดึงรายชื่อพนักงานทั้งหมด (ระบบเดิมใน turn ก่อนหน้า)
    if (action === 'fetch') {
      const { data: mappings } = await supabaseAdmin.from('user_mappings').select('*').order('username');
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();

      const combined = (mappings || []).map(m => {
        const authUser = users.find(u => u.email === m.email);
        return {
          username: m.username,
          email: m.email,
          auth_id: authUser?.id || null,
          is_banned: authUser?.banned_until != null,
        };
      });
      return NextResponse.json({ users: combined });
    }

    // 🟢 2. สร้างพนักงานใหม่
    if (action === 'create') {
      const { username, password, email } = body;
      const cleanUsername = username.trim().toLowerCase();
      const finalEmail = email ? email.trim() : `${cleanUsername}@jarungphat.com`;

      const { error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: finalEmail, password: password, email_confirm: true,
      });
      if (authError) throw authError;

      const { error: mapError } = await supabaseAdmin.from('user_mappings').insert([{ username: cleanUsername, email: finalEmail }]);
      if (mapError) throw mapError;

      return NextResponse.json({ success: true });
    }

    // 🟢 3. แก้ไขข้อมูลผ่านหน้าแดชบอร์ดแอดมิน
    if (action === 'update') {
      const { auth_id, username, password, email } = body;
      const updates: any = {};
      if (email) updates.email = email;
      if (password) updates.password = password; 

      if (auth_id && Object.keys(updates).length > 0) {
         const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_id, updates);
         if (error) throw error;
      }
      if (email) {
         const { error } = await supabaseAdmin.from('user_mappings').update({ email }).eq('username', username);
         if (error) throw error;
      }
      return NextResponse.json({ success: true });
    }

    // 🟢 4. ระงับการใช้งาน / เปิดใช้งาน (Disable / Enable)
    if (action === 'toggle_status') {
      const { auth_id, is_banned } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_id, { ban_duration: is_banned ? 'none' : '876000h' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 🟢 5. ลบพนักงานถาวร
    if (action === 'delete') {
      const { auth_id, username } = body;
      if (auth_id) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_id);
        if (error) throw error;
      }
      const { error: mapErr } = await supabaseAdmin.from('user_mappings').delete().eq('username', username);
      if (mapErr) throw mapErr;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ไม่พบคำสั่งที่ต้องการ' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}