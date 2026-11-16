import { test, describe } from 'node:test';
import assert from 'node:assert';
import { escapeHtml, renderSafeKaTeX, sanitizeSvg } from '../../src/lib/academic/security-sanitizer.ts';
import { rebuildAnswerKeyFromMapping, generateExamSets, scoreExamAnswers } from '../../src/lib/academic/exam-engine.ts';
import type { AcademicExamQuestion, AcademicExamSet, ChoiceOption } from '../../src/types/academic.ts';

describe('Security Sanitizer & KaTeX Hardening', () => {
  describe('escapeHtml', () => {
    test('should escape all critical HTML injection characters (&, <, >, ", \')', () => {
      const malicious = '<script>alert("XSS & attack")</script>\' OR 1=1;';
      const escaped = escapeHtml(malicious);
      assert.strictEqual(escaped.includes('<script>'), false);
      assert.strictEqual(escaped.includes('&amp;'), true);
      assert.strictEqual(escaped.includes('&lt;script&gt;'), true);
      assert.strictEqual(escaped.includes('&quot;'), true);
      assert.strictEqual(escaped.includes('&#39;'), true);
    });

    test('should return empty string for null, undefined, or empty text', () => {
      assert.strictEqual(escapeHtml(''), '');
      assert.strictEqual(escapeHtml(null as unknown as string), '');
      assert.strictEqual(escapeHtml(undefined as unknown as string), '');
    });
  });

  describe('renderSafeKaTeX', () => {
    test('should escape XSS payloads in normal text alongside inline KaTeX ($...$)', () => {
      const input = 'จงหาค่าของ <script>alert("XSS")</script> $x^2 + y^2 = z^2$ ในรูปสามเหลี่ยม <img src=x onerror=alert(1)>';
      const output = renderSafeKaTeX(input);

      // Verify no executable HTML tags in normal text
      assert.strictEqual(output.includes('<script>'), false);
      assert.strictEqual(output.includes('<img'), false);
      assert.strictEqual(output.includes('&lt;script&gt;'), true);
      assert.strictEqual(output.includes('&lt;img src=x onerror=alert(1)&gt;'), true);

      // Verify KaTeX math container was rendered
      assert.strictEqual(output.includes('class="katex"'), true);
    });

    test('should escape XSS payloads alongside display KaTeX ($$...$$)', () => {
      const input = '<b>สำคัญ:</b> $$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$ <a href="javascript:alert(1)">คลิกที่นี่</a>';
      const output = renderSafeKaTeX(input);

      assert.strictEqual(output.includes('<b>'), false);
      assert.strictEqual(output.includes('&lt;b&gt;สำคัญ:&lt;/b&gt;'), true);
      assert.strictEqual(output.includes('<a href'), false);
      assert.strictEqual(output.includes('&lt;a href=&quot;javascript:alert(1)&quot;&gt;'), true);
      assert.strictEqual(output.includes('class="katex-display"'), true);
    });

    test('should safely escape pure text without math', () => {
      const plain = 'คำถามทั่วไป: มีส้ม 5 ผล <script>alert("plain")</script>';
      const output = renderSafeKaTeX(plain);
      assert.strictEqual(output, 'คำถามทั่วไป: มีส้ม 5 ผล &lt;script&gt;alert(&quot;plain&quot;)&lt;/script&gt;');
    });

    test('should safely render raw LaTeX command starting with backslash', () => {
      const rawLatex = '\\frac{3}{4} + \\frac{1}{2} = \\frac{5}{4}';
      const output = renderSafeKaTeX(rawLatex);
      assert.strictEqual(output.includes('class="katex"'), true);
    });

    test('should prevent XSS when malicious payload is passed inside KaTeX text command', () => {
      const tricky = '$\\text{<script>alert(1)</script>}$';
      const output = renderSafeKaTeX(tricky);
      assert.strictEqual(output.includes('<script>'), false);
    });

    test('should prevent XSS and render math in exam question strings', () => {
      const examQuestionInput = 'ข้อที่ 1. <script>evil()</script> $A = \\pi r^2$';
      const rendered = renderSafeKaTeX(examQuestionInput);
      assert.strictEqual(rendered.includes('<script>'), false);
      assert.strictEqual(rendered.includes('&lt;script&gt;evil()&lt;/script&gt;'), true);
      assert.strictEqual(rendered.includes('class="katex"'), true);
    });
  });

  describe('sanitizeSvg', () => {
    test('should strip <script> tags and contents completely', () => {
      const rawSvg = '<svg viewBox="0 0 100 100"><script>alert("hacked")</script><circle cx="50" cy="50" r="40"/></svg>';
      const sanitized = sanitizeSvg(rawSvg);
      assert.strictEqual(sanitized.includes('<script>'), false);
      assert.strictEqual(sanitized.includes('alert('), false);
      assert.strictEqual(sanitized.includes('<circle cx="50" cy="50" r="40"/>'), true);
    });

    test('should strip nested or obfuscated script tags', () => {
      const rawSvg = '<svg><scr<script>ipt>alert(1)</script></svg>';
      const sanitized = sanitizeSvg(rawSvg);
      assert.strictEqual(sanitized.includes('<script>'), false);
      assert.strictEqual(sanitized.includes('alert('), false);
    });

    test('should strip <foreignObject> container and malicious children', () => {
      const rawSvg = `<svg>
        <foreignObject width="100" height="100">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <script>alert(1)</script>
            <iframe src="https://evil.com"></iframe>
          </div>
        </foreignObject>
        <rect width="100" height="100" fill="red"/>
      </svg>`;
      const sanitized = sanitizeSvg(rawSvg);
      assert.strictEqual(sanitized.includes('foreignObject'), false);
      assert.strictEqual(sanitized.includes('<script>'), false);
      assert.strictEqual(sanitized.includes('<iframe'), false);
      assert.strictEqual(sanitized.includes('<rect width="100" height="100" fill="red"/>'), true);
    });

    test('should strip all inline event handlers (onload, onerror, onclick, onbegin, etc.)', () => {
      const rawSvg = '<svg onload="alert(1)" ONLOAD=\'alert(2)\' onclick=alert(3)><circle onmouseover="evil()" cx="10" cy="10" r="5"/></svg>';
      const sanitized = sanitizeSvg(rawSvg);
      assert.strictEqual(/onload/i.test(sanitized), false);
      assert.strictEqual(/onclick/i.test(sanitized), false);
      assert.strictEqual(/onmouseover/i.test(sanitized), false);
      assert.strictEqual(sanitized.includes('circle'), true);
      assert.strictEqual(sanitized.includes('cx="10"'), true);
    });

    test('should strip dangerous URI schemes (javascript:, vbscript:, data:text/html)', () => {
      const rawSvg = `<svg>
        <a href="javascript:alert(1)"><text>Link 1</text></a>
        <a xlink:href="javascript:alert(2)"><text>Link 2</text></a>
        <image href="data:text/html,<script>alert(1)</script>"/>
        <path d="M 0 0 L 10 10"/>
      </svg>`;
      const sanitized = sanitizeSvg(rawSvg);
      assert.strictEqual(sanitized.includes('javascript:'), false);
      assert.strictEqual(sanitized.includes('data:text/html'), false);
      assert.strictEqual(sanitized.includes('<path d="M 0 0 L 10 10"/>'), true);
    });

    test('should preserve valid educational SVG diagrams', () => {
      const educationalSvg = `
        <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" width="100%" height="260">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0284c7" />
            </marker>
          </defs>
          <style>
            .axis { stroke: #64748b; stroke-width: 1.5; }
            .label { font-size: 12px; fill: #1e293b; font-family: Sarabun; }
          </style>
          <line x1="40" y1="260" x2="360" y2="260" class="axis" marker-end="url(#arrow)" />
          <line x1="40" y1="260" x2="40" y2="20" class="axis" marker-end="url(#arrow)" />
          <rect x="60" y="100" width="40" height="160" fill="#38bdf8" stroke="#0284c7" stroke-width="1" />
          <circle cx="200" cy="120" r="30" fill="#fde047" stroke="#eab308" stroke-width="2" />
          <polyline points="50,200 120,150 190,180 260,90 330,120" fill="none" stroke="#ef4444" stroke-width="2.5" />
          <polygon points="150,50 180,90 120,90" fill="#86efac" stroke="#16a34a" />
          <text x="200" y="290" text-anchor="middle" class="label">เวลา (วินาที)</text>
        </svg>
      `;

      const sanitized = sanitizeSvg(educationalSvg);
      assert.strictEqual(sanitized.includes('<marker id="arrow"'), true);
      assert.strictEqual(sanitized.includes('<style>'), true);
      assert.strictEqual(sanitized.includes('<line x1="40"'), true);
      assert.strictEqual(sanitized.includes('<rect x="60"'), true);
      assert.strictEqual(sanitized.includes('<circle cx="200"'), true);
      assert.strictEqual(sanitized.includes('<polyline points='), true);
      assert.strictEqual(sanitized.includes('<polygon points='), true);
      assert.strictEqual(sanitized.includes('<text x="200"'), true);
      assert.strictEqual(sanitized.includes('เวลา (วินาที)'), true);
    });
  });
});

describe('Exam Engine & Safe Edit Lock Integrity', () => {
  const masterQuestions: AcademicExamQuestion[] = [
    {
      id: 'q1',
      exam_id: 'exam-101',
      question_number: 1,
      question_text: '1 + 1 เท่ากับเท่าใด',
      choice_a: '1',
      choice_b: '2',
      choice_c: '3',
      choice_d: '4',
      correct_choice: 'B', // 2
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      indicator_code: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q2',
      exam_id: 'exam-101',
      question_number: 2,
      question_text: 'เมืองหลวงของประเทศไทยคืออะไร',
      choice_a: 'เชียงใหม่',
      choice_b: 'ภูเก็ต',
      choice_c: 'กรุงเทพมหานคร',
      choice_d: 'ขอนแก่น',
      correct_choice: 'C', // กรุงเทพมหานคร
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      indicator_code: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q3',
      exam_id: 'exam-101',
      question_number: 3,
      question_text: 'แม่น้ำเจ้าพระยาไหลลงสู่อ่าวไทย',
      choice_a: 'ถูก',
      choice_b: 'ผิด',
      choice_c: 'ไม่ทราบ',
      choice_d: 'ถูกทุกข้อ',
      correct_choice: 'A', // ถูก
      points: 1,
      pin_choice_position: true,
      pinned_choice_index: 'D',
      question_image_url: null,
      indicator_code: null,
      created_at: new Date().toISOString()
    }
  ];

  test('generateExamSets produces valid question mappings and answer keys', () => {
    const sets = generateExamSets(masterQuestions, { setNames: ['A', 'B', 'C'] });
    assert.strictEqual(sets.length, 3);

    // Set A retains master question order (1..3)
    const setA = sets[0];
    assert.strictEqual(setA.set_name, 'A');
    assert.strictEqual(setA.answer_key['1'], 'B');
    assert.strictEqual(setA.answer_key['2'], 'C');
    assert.strictEqual(setA.answer_key['3'], 'A');
  });

  test('rebuildAnswerKeyFromMapping deterministically computes new keys when master answer changes', () => {
    // Simulate Set B with specific permutation:
    // New Question 1 is Original Question 2
    // New Question 2 is Original Question 1
    // New Question 3 is Original Question 3
    const mockSetB: Pick<AcademicExamSet, 'question_order_mapping'> = {
      question_order_mapping: [
        {
          original_question_number: 2,
          new_question_number: 1,
          choice_map: { A: 'B', B: 'C', C: 'D', D: 'A' } as Record<ChoiceOption, ChoiceOption>
        },
        {
          original_question_number: 1,
          new_question_number: 2,
          choice_map: { A: 'C', B: 'A', C: 'B', D: 'D' } as Record<ChoiceOption, ChoiceOption>
        },
        {
          original_question_number: 3,
          new_question_number: 3,
          choice_map: { A: 'A', B: 'B', C: 'C', D: 'D' } as Record<ChoiceOption, ChoiceOption>
        }
      ]
    };

    // Before change: Q1 master answer is B, Q2 master answer is C, Q3 is A
    // In Set B:
    // For Set B Q1 (Original 2): original correct choice is C. Choice slot 'B' maps to C! -> Key is 'B'
    // For Set B Q2 (Original 1): original correct choice is B. Choice slot 'C' maps to B! -> Key is 'C'
    // For Set B Q3 (Original 3): original correct choice is A. Choice slot 'A' maps to A! -> Key is 'A'
    const initialKey = rebuildAnswerKeyFromMapping(mockSetB, masterQuestions);
    assert.deepStrictEqual(initialKey, {
      '1': 'B',
      '2': 'C',
      '3': 'A'
    });

    // Now Teacher fixes a wrong key on master exam:
    // Teacher realizes Q2 (Capital of Thailand) master key should be A (e.g. choice changed),
    // and Q1 (1+1) master key was changed to C
    const updatedMasterQuestions = masterQuestions.map(q => {
      if (q.question_number === 1) return { ...q, correct_choice: 'C' as ChoiceOption };
      if (q.question_number === 2) return { ...q, correct_choice: 'A' as ChoiceOption };
      return q;
    });

    // Calling rebuildAnswerKeyFromMapping must recalculate without changing the printed set's shuffle
    const rebuiltKey = rebuildAnswerKeyFromMapping(mockSetB, updatedMasterQuestions);

    // Check Set B Q1 (Original 2): original correct is now A. Slot 'D' maps to A -> Key must be 'D'
    // Check Set B Q2 (Original 1): original correct is now C. Slot 'A' maps to C -> Key must be 'A'
    // Check Set B Q3 (Original 3): unchanged -> Key is 'A'
    assert.deepStrictEqual(rebuiltKey, {
      '1': 'D',
      '2': 'A',
      '3': 'A'
    });
  });

  test('rebuildAnswerKeyFromMapping supports 5-choice questions (A..E)', () => {
    const mock5ChoiceSet: Pick<AcademicExamSet, 'question_order_mapping'> = {
      question_order_mapping: [
        {
          original_question_number: 1,
          new_question_number: 1,
          choice_map: { A: 'E', B: 'D', C: 'C', D: 'B', E: 'A' } as Record<ChoiceOption, ChoiceOption>
        }
      ]
    };

    const q5: Array<Pick<AcademicExamQuestion, 'question_number' | 'correct_choice'>> = [
      { question_number: 1, correct_choice: 'E' }
    ];

    const key = rebuildAnswerKeyFromMapping(mock5ChoiceSet, q5);
    // Original correct choice is 'E'. In choice_map, slot 'A' maps to 'E'
    assert.strictEqual(key['1'], 'A');
  });

  test('Safe Edit Lock simulation preserves printed paper integrity and corrects student scores', () => {
    // 1. Initial exam sets generated and printed
    const sets = generateExamSets(masterQuestions, { setNames: ['A', 'B'] });
    const setB = sets.find(s => s.set_name === 'B')!;

    // 2. Student took Set B and submitted answers
    const studentAnswers = { ...setB.answer_key }; // Student scored 100% originally
    const initialScoring = scoreExamAnswers(studentAnswers, setB.answer_key);
    assert.strictEqual(initialScoring.rawScore, 3);
    assert.strictEqual(initialScoring.correctCount, 3);

    // 3. Teacher fixes question 1 on master exam: correct_choice changes from B to C
    const updatedQuestions = masterQuestions.map(q => 
      q.question_number === 1 ? { ...q, correct_choice: 'C' as ChoiceOption } : q
    );

    // 4. Safe edit lock: sets are NOT re-randomized; answer_key is rebuilt deterministically
    const updatedAnswerKey = rebuildAnswerKeyFromMapping(setB, updatedQuestions);
    const updatedSetB = { ...setB, answer_key: updatedAnswerKey };

    // 5. Re-score student with rebuilt key: since Q1 answer changed, student score reflects the correction
    const reScored = scoreExamAnswers(studentAnswers, updatedSetB.answer_key);
    assert.strictEqual(reScored.rawScore, 2);
    assert.strictEqual(reScored.correctCount, 2);
  });
});
