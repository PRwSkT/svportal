import { NextRequest, NextResponse } from 'next/server';
import { translateThaiToEnZh } from '@/lib/translate';
import { FormField, FormFieldOption } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, fields, thank_you_title, thank_you_message } = body;

    // 1. Translate title
    const translatedTitle: { th: string; en: string; zh: string } = {
      th: title?.th || (typeof title === 'string' ? title : ''),
      en: title?.en || '',
      zh: title?.zh || '',
    };
    if (translatedTitle.th && (!translatedTitle.en || !translatedTitle.zh)) {
      const res = await translateThaiToEnZh(translatedTitle.th);
      translatedTitle.en = res.en;
      translatedTitle.zh = res.zh;
    }

    // 2. Translate description
    const translatedDesc: { th: string; en: string; zh: string } = {
      th: description?.th || (typeof description === 'string' ? description : ''),
      en: description?.en || '',
      zh: description?.zh || '',
    };
    if (translatedDesc.th && (!translatedDesc.en || !translatedDesc.zh)) {
      const res = await translateThaiToEnZh(translatedDesc.th);
      translatedDesc.en = res.en;
      translatedDesc.zh = res.zh;
    }

    // 3. Translate thank you screen
    const translatedThankTitle: { th: string; en: string; zh: string } = {
      th: thank_you_title?.th || (typeof thank_you_title === 'string' ? thank_you_title : 'ขอบคุณสำหรับการส่งข้อมูล'),
      en: thank_you_title?.en || '',
      zh: thank_you_title?.zh || '',
    };
    if (translatedThankTitle.th && (!translatedThankTitle.en || !translatedThankTitle.zh)) {
      const res = await translateThaiToEnZh(translatedThankTitle.th);
      translatedThankTitle.en = res.en;
      translatedThankTitle.zh = res.zh;
    }

    const translatedThankMsg: { th: string; en: string; zh: string } = {
      th: thank_you_message?.th || (typeof thank_you_message === 'string' ? thank_you_message : 'เราได้รับข้อมูลของคุณเรียบร้อยแล้ว'),
      en: thank_you_message?.en || '',
      zh: thank_you_message?.zh || '',
    };
    if (translatedThankMsg.th && (!translatedThankMsg.en || !translatedThankMsg.zh)) {
      const res = await translateThaiToEnZh(translatedThankMsg.th);
      translatedThankMsg.en = res.en;
      translatedThankMsg.zh = res.zh;
    }

    // 4. Translate fields in parallel batches
    const translatedFields: FormField[] = [];
    if (Array.isArray(fields)) {
      for (const field of fields) {
        const f = { ...field };

        // Translate field label
        const labelTh = f.label?.th || '';
        let labelEn = f.label?.en || '';
        let labelZh = f.label?.zh || '';
        if (labelTh && (!labelEn || !labelZh)) {
          const res = await translateThaiToEnZh(labelTh);
          labelEn = res.en;
          labelZh = res.zh;
        }
        f.label = { th: labelTh, en: labelEn, zh: labelZh };

        // Translate help_text if any
        if (f.help_text?.th) {
          const htTh = f.help_text.th;
          let htEn = f.help_text.en || '';
          let htZh = f.help_text.zh || '';
          if (htTh && (!htEn || !htZh)) {
            const res = await translateThaiToEnZh(htTh);
            htEn = res.en;
            htZh = res.zh;
          }
          f.help_text = { th: htTh, en: htEn, zh: htZh };
        }

        // Translate options if any
        if (Array.isArray(f.options) && f.options.length > 0) {
          const newOptions: FormFieldOption[] = [];
          for (const opt of f.options) {
            const optTh = opt.label?.th || '';
            let optEn = opt.label?.en || '';
            let optZh = opt.label?.zh || '';
            if (optTh && (!optEn || !optZh)) {
              const res = await translateThaiToEnZh(optTh);
              optEn = res.en;
              optZh = res.zh;
            }
            newOptions.push({
              value: opt.value,
              label: { th: optTh, en: optEn, zh: optZh },
            });
          }
          f.options = newOptions;
        }

        translatedFields.push(f);
      }
    }

    return NextResponse.json({
      success: true,
      title: translatedTitle,
      description: translatedDesc,
      thank_you_title: translatedThankTitle,
      thank_you_message: translatedThankMsg,
      fields: translatedFields,
    });
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to translate form' },
      { status: 500 }
    );
  }
}
