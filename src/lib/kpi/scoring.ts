import { KpiEvaluation, SectionScoreSummary, KpiGrade } from '@/types/kpi';

export function calculateKpiScoreSummaries(evaluation: KpiEvaluation): {
  sections: SectionScoreSummary[];
  selfTotal: number;
  supervisorTotal: number;
  finalGrade: KpiGrade;
} {
  const template = evaluation.template;
  if (!template || !template.sections) {
    return {
      sections: [],
      selfTotal: evaluation.self_total_score || 0,
      supervisorTotal: evaluation.supervisor_total_score || 0,
      finalGrade: evaluation.final_grade || 'B',
    };
  }

  let calculatedSelfTotal = 0;
  let calculatedSupervisorTotal = 0;

  const summaries: SectionScoreSummary[] = template.sections.map((sec) => {
    const itemCount = sec.items.length || 1;
    let selfSum = 0;
    let supervisorSum = 0;

    sec.items.forEach((item) => {
      const selfVal = evaluation.self_scores?.[item.id] || 0;
      const supVal = evaluation.supervisor_scores?.[item.id] || 0;
      selfSum += selfVal;
      supervisorSum += supVal;
    });

    const selfAvg = selfSum / itemCount;
    const supervisorAvg = supervisorSum / itemCount;

    // Weight contribution: (avg / 5) * weight
    const selfScoreWeighted = Number(((selfAvg / 5) * sec.weight).toFixed(2));
    const supervisorScoreWeighted = Number(((supervisorAvg / 5) * sec.weight).toFixed(2));

    calculatedSelfTotal += selfScoreWeighted;
    calculatedSupervisorTotal += supervisorScoreWeighted;

    return {
      sectionId: sec.id,
      sectionTitle: sec.title,
      weight: sec.weight,
      selfAvg: Number(selfAvg.toFixed(2)),
      selfScoreWeighted,
      supervisorAvg: Number(supervisorAvg.toFixed(2)),
      supervisorScoreWeighted,
      gap: Number((supervisorAvg - selfAvg).toFixed(2)),
    };
  });

  const finalSupervisor = Number(calculatedSupervisorTotal.toFixed(2));
  let grade: KpiGrade = 'D';
  if (finalSupervisor >= 90) grade = 'A';
  else if (finalSupervisor >= 80) grade = 'B+';
  else if (finalSupervisor >= 70) grade = 'B';
  else if (finalSupervisor >= 60) grade = 'C';

  return {
    sections: summaries,
    selfTotal: Number(calculatedSelfTotal.toFixed(2)),
    supervisorTotal: finalSupervisor,
    finalGrade: grade,
  };
}

export function generateAnonymousKpiEmailHtml(evaluation: KpiEvaluation): string {
  const personnelName = evaluation.personnel?.name_th || 'บุคลากรโรงเรียนสมคิดวิทยา';
  const position = evaluation.personnel?.position_th || 'ครูผู้สอน';
  const cycleTitle = evaluation.cycle?.title || 'การประเมินผลการปฏิบัติงาน';
  const { sections, selfTotal, supervisorTotal, finalGrade } = calculateKpiScoreSummaries(evaluation);

  const gradeBadgeBg =
    finalGrade === 'A'
      ? '#059669' // Emerald
      : finalGrade === 'B+'
      ? '#2563EB' // Blue
      : finalGrade === 'B'
      ? '#4F46E5' // Indigo
      : finalGrade === 'C'
      ? '#D97706' // Amber
      : '#DC2626'; // Red

  const gradeNameTh =
    finalGrade === 'A'
      ? 'ระดับดีเด่น (Outstanding)'
      : finalGrade === 'B+'
      ? 'ระดับดีมาก (Very Good)'
      : finalGrade === 'B'
      ? 'ระดับดี (Good)'
      : finalGrade === 'C'
      ? 'ระดับพอใช้ (Fair)'
      : 'ต้องปรับปรุง (Needs Improvement)';

  const tableRows = sections
    .map(
      (s) => `
    <tr style="border-bottom: 1px solid #E2E8F0;">
      <td style="padding: 12px 14px; font-size: 13px; color: #1E293B; font-weight: 500;">
        ${s.sectionTitle}
        <span style="display: block; font-size: 11px; color: #64748B;">น้ำหนัก ${s.weight}%</span>
      </td>
      <td style="padding: 12px 14px; font-size: 13px; text-align: center; color: #475569;">
        ${s.selfAvg.toFixed(1)} / 5.0
      </td>
      <td style="padding: 12px 14px; font-size: 14px; text-align: center; font-weight: 700; color: #7B1C3E;">
        ${s.supervisorAvg.toFixed(1)} / 5.0
      </td>
      <td style="padding: 12px 14px; font-size: 13px; text-align: right; font-weight: 600; color: #0F172A;">
        ${s.supervisorScoreWeighted.toFixed(1)} / ${s.weight}
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>แจ้งผลการประเมินการปฏิบัติงาน - โรงเรียนสมคิดวิทยา</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Sukhumvit Set', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5F4F2; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #7B1C3E; padding: 32px 28px; text-align: center; border-bottom: 4px solid #1B3A6B;">
              <div style="color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px;">
                โรงเรียนสมคิดวิทยา
              </div>
              <div style="color: rgba(255,255,255,0.85); font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
                SOMKIDVITTAYA SCHOOL • HR PERFORMANCE EVALUATION
              </div>
              <div style="margin-top: 14px; display: inline-block; background-color: rgba(0,0,0,0.25); color: #FEE2E2; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 600;">
                🔒 รายงานผลการประเมินส่วนบุคคล (คะแนนถัวเฉลี่ยจากคณะกรรมการผู้ประเมิน โดยไม่เปิดเผยตัวตน)
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              
              <!-- Greeting & Meta -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 18px; font-weight: 700; color: #0F172A; margin-bottom: 4px;">
                      เรียน คุณครู ${personnelName}
                    </div>
                    <div style="font-size: 13px; color: #64748B;">
                      ตำแหน่ง: <span style="font-weight: 600; color: #334155;">${position}</span>
                    </div>
                    <div style="font-size: 13px; color: #64748B; margin-top: 2px;">
                      รอบการประเมิน: <span style="font-weight: 600; color: #7B1C3E;">${cycleTitle}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Grade & Final Score Summary Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #FAF7F5 0%, #F1ECE8 100%); border-radius: 20px; border: 1px solid #E5DCD4; margin-bottom: 28px; padding: 22px;">
                <tr>
                  <td align="center">
                    <div style="font-size: 12px; font-weight: 700; color: #7B1C3E; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                      ผลการประเมินรวมประจำรอบ
                    </div>
                    <div style="display: inline-block; background-color: ${gradeBadgeBg}; color: #FFFFFF; font-size: 26px; font-weight: 900; padding: 6px 24px; border-radius: 14px; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
                      เกรด ${finalGrade}
                    </div>
                    <div style="font-size: 15px; font-weight: 700; color: #1E293B; margin-bottom: 4px;">
                      ${gradeNameTh}
                    </div>
                    <div style="font-size: 13px; color: #475569;">
                      คะแนนประเมินสรุป: <strong style="color: #7B1C3E; font-size: 15px;">${supervisorTotal.toFixed(2)}%</strong> 
                      <span style="color: #94A3B8; margin: 0 6px;">•</span>
                      คะแนนประเมินตนเอง: <strong>${selfTotal.toFixed(2)}%</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Competency Breakdown Table -->
              <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 10px; display: flex; align-items: center;">
                📊 รายละเอียดผลคะแนนแยกตามหมวดสมรรถนะ
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; margin-bottom: 28px;">
                <thead>
                  <tr style="background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0;">
                    <th style="padding: 10px 14px; font-size: 12px; text-align: left; color: #475569; font-weight: 700;">หมวดการประเมิน</th>
                    <th style="padding: 10px 14px; font-size: 12px; text-align: center; color: #475569; font-weight: 700;">ตนเอง</th>
                    <th style="padding: 10px 14px; font-size: 12px; text-align: center; color: #7B1C3E; font-weight: 700;">กรรมการ</th>
                    <th style="padding: 10px 14px; font-size: 12px; text-align: right; color: #475569; font-weight: 700;">คะแนน</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>

              <!-- Constructive Feedback Section (Strictly Anonymous) -->
              ${
                evaluation.supervisor_strengths
                  ? `
              <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 16px; padding: 18px; margin-bottom: 16px;">
                <div style="font-size: 13px; font-weight: 700; color: #065F46; margin-bottom: 6px;">
                  🌟 จุดเด่นและข้อชื่นชมจากคณะกรรมการประเมิน:
                </div>
                <div style="font-size: 13px; color: #047857; line-height: 1.6; white-space: pre-wrap;">
${evaluation.supervisor_strengths}
                </div>
              </div>`
                  : ''
              }

              ${
                evaluation.supervisor_improvements
                  ? `
              <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 16px; padding: 18px; margin-bottom: 16px;">
                <div style="font-size: 13px; font-weight: 700; color: #1E40AF; margin-bottom: 6px;">
                  💡 ข้อเสนอแนะเพื่อการพัฒนาและต่อยอด (Continuous Growth):
                </div>
                <div style="font-size: 13px; color: #1D4ED8; line-height: 1.6; white-space: pre-wrap;">
${evaluation.supervisor_improvements}
                </div>
              </div>`
                  : ''
              }

              ${
                evaluation.supervisor_overall_comment
                  ? `
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px;">
                  📝 สรุปความเห็นภาพรวม:
                </div>
                <div style="font-size: 13px; color: #475569; line-height: 1.6; white-space: pre-wrap;">
${evaluation.supervisor_overall_comment}
                </div>
              </div>`
                  : ''
              }

              <!-- Portal Link Button -->
              <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
                <a href="https://sv-portal.somkidvittaya.ac.th/admin/kpi" target="_blank" style="display: inline-block; background-color: #7B1C3E; color: #FFFFFF; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 14px; text-decoration: none; box-shadow: 0 4px 12px rgba(123,28,62,0.25);">
                  เข้าสู่ระบบเพื่อดูบทวิเคราะห์ฉบับเต็ม &rarr;
                </a>
              </div>
              <div style="text-align: center; font-size: 11px; color: #94A3B8;">
                ท่านสามารถเข้าดูเรดาร์ชาร์ตเปรียบเทียบและบันทึกประวัติย้อนหลังได้ใน SVPortal
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 22px 28px; text-align: center;">
              <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">
                โรงเรียนสมคิดวิทยา อ.เมือง จ.ระยอง
              </div>
              <div style="font-size: 11px; color: #94A3B8; line-height: 1.5;">
                ระบบการประเมินผลการปฏิบัติงานบุคลากรอิเล็กทรอนิกส์ (SV-KPI Portal)<br>
                อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติ ข้อมูลผู้ประเมินถูกจัดเก็บเป็นความลับสูงสุดตามมาตรฐานจริยธรรมของโรงเรียน
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
