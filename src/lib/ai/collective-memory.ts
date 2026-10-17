import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface CollectiveMemoryItem {
  id: string;
  category: string;
  topic: string;
  content: string;
  source_teacher: string | null;
  frequency_count: number;
  updated_at: string;
}

/**
 * ดึงความรู้และบริบทที่น้องฟ้าเรียนรู้จากการสนทนาของครูทั้งโรงเรียน
 */
export async function getCollectiveMemoryContext(category?: string, query?: string): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return '';

    let queryBuilder = supabase
      .from('nongfah_collective_memory')
      .select('category, topic, content, source_teacher, frequency_count')
      .order('frequency_count', { ascending: false })
      .limit(10);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data: memories, error } = await queryBuilder;
    if (error || !memories || memories.length === 0) {
      return '';
    }

    // Format as knowledge base entries for Nong Fah system prompt
    let contextStr = `\n[ความรู้และแนวปฏิบัติที่น้องฟ้าเรียนรู้จากคุณครูในโรงเรียน (Collective Teacher Memory)]:\n`;
    memories.forEach((m, idx) => {
      contextStr += `${idx + 1}. [${m.category}] ${m.topic}: "${m.content}" (แหล่งข้อมูล: ${m.source_teacher || 'คุณครู'})\n`;
    });

    return contextStr;
  } catch (err) {
    console.error('[Collective Memory Error]:', err);
    return '';
  }
}

/**
 * บันทึกบทสนทนาของคุณครูเพื่อให้น้องฟ้าเรียนรู้และสะสมความรู้ของโรงเรียน
 */
export async function recordTeacherConversation(entry: {
  userEmail?: string;
  userName?: string;
  userRole?: string;
  pathname?: string;
  userPrompt: string;
  aiResponse: string;
  actionType?: string;
  actionPayload?: any;
}) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    // 1. บันทึกประวัติการสนทนาลง nongfah_conversations
    await supabase.from('nongfah_conversations').insert({
      user_email: entry.userEmail || null,
      user_name: entry.userName || 'คุณครู',
      user_role: entry.userRole || 'teacher',
      pathname: entry.pathname || '/',
      user_prompt: entry.userPrompt,
      ai_response: entry.aiResponse,
      action_type: entry.actionType || 'chat',
      action_payload: entry.actionPayload || null,
    });

    // 2. วิเคราะห์ประโยคคำสั่งที่มีคุณค่าเพื่อเพิ่มเป็น collective memory อัตโนมัติ
    const prompt = entry.userPrompt.trim();
    if (
      prompt.length > 15 &&
      (prompt.includes('คือ') ||
        prompt.includes('ต้อง') ||
        prompt.includes('ระเบียบ') ||
        prompt.includes('แนวทาง') ||
        prompt.includes('กำหนดส่ง') ||
        prompt.includes('เปิดเทอม') ||
        prompt.includes('ปิดเทอม') ||
        prompt.includes('เกณฑ์'))
    ) {
      let category = 'general';
      if (prompt.includes('ปพ') || prompt.includes('เกรด') || prompt.includes('ตารางสอน') || prompt.includes('สอบ')) {
        category = 'academic';
      } else if (prompt.includes('สช') || prompt.includes('regis') || prompt.includes('orss') || prompt.includes('psis')) {
        category = 'opec';
      } else if (prompt.includes('ฟอร์ม') || prompt.includes('สำรวจ') || prompt.includes('คลีน')) {
        category = 'forms';
      } else if (prompt.includes('อาหาร') || prompt.includes('นม') || prompt.includes('พยาบาล')) {
        category = 'nutrition';
      }

      // Check if similar topic exists
      const { data: existing } = await supabase
        .from('nongfah_collective_memory')
        .select('id, frequency_count')
        .eq('category', category)
        .ilike('content', `%${prompt.slice(0, 20)}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('nongfah_collective_memory')
          .update({
            frequency_count: (existing[0].frequency_count || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
      }
    }
  } catch (err) {
    // Non-blocking background error
    console.error('[Record Conversation Error]:', err);
  }
}
