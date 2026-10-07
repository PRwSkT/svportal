import { NextRequest, NextResponse } from 'next/server';
import { translateThaiToEnZh } from '@/lib/translate';
import { FormField } from '@/types';
import { getServerUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, fields, thank_you_title, thank_you_message } = body;

    // 1. Translate Title in parallel
    const titleTh = (title?.th || (typeof title === 'string' ? title : '')).trim();
    let titleEn = title?.en || '';
    let titleZh = title?.zh || '';
    const titlePromise = titleTh
      ? translateThaiToEnZh(titleTh).then(res => {
          titleEn = res.en || titleEn;
          titleZh = res.zh || titleZh;
        })
      : Promise.resolve();

    // 2. Translate Description
    const descTh = (description?.th || (typeof description === 'string' ? description : '')).trim();
    let descEn = description?.en || '';
    let descZh = description?.zh || '';
    const descPromise = descTh
      ? translateThaiToEnZh(descTh).then(res => {
          descEn = res.en || descEn;
          descZh = res.zh || descZh;
        })
      : Promise.resolve();

    // 3. Translate Thank You screen
    const thankTitleTh = (thank_you_title?.th || (typeof thank_you_title === 'string' ? thank_you_title : 'ขอบคุณสำหรับการส่งข้อมูล')).trim();
    let thankTitleEn = thank_you_title?.en || '';
    let thankTitleZh = thank_you_title?.zh || '';
    const thankTitlePromise = thankTitleTh
      ? translateThaiToEnZh(thankTitleTh).then(res => {
          thankTitleEn = res.en || thankTitleEn;
          thankTitleZh = res.zh || thankTitleZh;
        })
      : Promise.resolve();

    const thankMsgTh = (thank_you_message?.th || (typeof thank_you_message === 'string' ? thank_you_message : 'เราได้รับข้อมูลของคุณเรียบร้อยแล้ว')).trim();
    let thankMsgEn = thank_you_message?.en || '';
    let thankMsgZh = thank_you_message?.zh || '';
    const thankMsgPromise = thankMsgTh
      ? translateThaiToEnZh(thankMsgTh).then(res => {
          thankMsgEn = res.en || thankMsgEn;
          thankMsgZh = res.zh || thankMsgZh;
        })
      : Promise.resolve();

    // 4. Translate Fields in parallel
    const fieldsPromises = (fields || []).map(async (field: FormField) => {
      const f = { ...field };

      // Translate field label
      const labelTh = (f.label?.th || '').trim();
      const labelPromise = labelTh
        ? translateThaiToEnZh(labelTh).then(res => {
            f.label = {
              th: labelTh,
              en: res.en || f.label?.en || labelTh,
              zh: res.zh || f.label?.zh || labelTh,
            };
          })
        : Promise.resolve();

      // Translate help_text
      const helpTh = (f.help_text?.th || '').trim();
      const helpPromise = helpTh
        ? translateThaiToEnZh(helpTh).then(res => {
            f.help_text = {
              th: helpTh,
              en: res.en || f.help_text?.en || helpTh,
              zh: res.zh || f.help_text?.zh || helpTh,
            };
          })
        : Promise.resolve();

      // Translate options
      let optionsPromise = Promise.resolve();
      if (Array.isArray(f.options) && f.options.length > 0) {
        optionsPromise = Promise.all(
          f.options.map(async (opt) => {
            const optTh = (opt.label?.th || '').trim();
            if (optTh) {
              const res = await translateThaiToEnZh(optTh);
              return {
                value: opt.value,
                label: {
                  th: optTh,
                  en: res.en || opt.label?.en || optTh,
                  zh: res.zh || opt.label?.zh || optTh,
                },
              };
            }
            return opt;
          })
        ).then(updatedOptions => {
          f.options = updatedOptions;
        });
      }

      await Promise.all([labelPromise, helpPromise, optionsPromise]);
      return f;
    });

    // Wait for all translations
    const [_, __, ___, ____, translatedFields] = await Promise.all([
      titlePromise,
      descPromise,
      thankTitlePromise,
      thankMsgPromise,
      Promise.all(fieldsPromises),
    ]);

    return NextResponse.json({
      success: true,
      title: { th: titleTh, en: titleEn, zh: titleZh },
      description: { th: descTh, en: descEn, zh: descZh },
      thank_you_title: { th: thankTitleTh, en: thankTitleEn, zh: thankTitleZh },
      thank_you_message: { th: thankMsgTh, en: thankMsgEn, zh: thankMsgZh },
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
