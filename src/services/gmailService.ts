import { SELF_FEEDBACK_OPTIONS } from '../data/competencyForms';
import { requestGmailAccessToken, setCachedGmailAccessToken } from '../lib/firebase';
import { FeedbackOptionKey, PositionType } from '../types/competency';

export const HEAD_NURSE_NOTIFICATION_EMAIL = 'awanvilai@gmail.com';

export interface SelfAssessmentEmailPayload {
  staffName: string;
  positionType: PositionType;
  ward: string;
  wardYears: number;
  formTitle: string;
  formCode: string;
  assessmentPeriod: string;
  selfTotalScore: number;
  selfMaxScore: number;
  selfPercentage: number;
  selfAnsweredCount: number;
  totalItems: number;
  selfFeedback: FeedbackOptionKey[];
  selfOtherNote: string;
  senderEmail?: string | null;
}

function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function toBase64Url(input: string): string {
  return utf8ToBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildSelfAssessmentEmailSubject(payload: SelfAssessmentEmailPayload): string {
  return `[แจ้งผลประเมินตนเอง] ${payload.staffName} (${payload.formCode}) - ${payload.assessmentPeriod}`;
}

function buildSelfAssessmentEmailHtml(payload: SelfAssessmentEmailPayload, appUrl: string): string {
  const feedbackLabels = payload.selfFeedback
    .map((key) => SELF_FEEDBACK_OPTIONS.find((opt) => opt.key === key)?.label)
    .filter((label): label is string => Boolean(label));

  const feedbackHtml =
    feedbackLabels.length > 0 || payload.selfOtherNote.trim()
      ? `
        <div style="margin-top: 16px; padding: 12px 16px; background-color: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 10px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #4338CA;">ความคิดเห็นของผู้รับการประเมิน</p>
          ${
            feedbackLabels.length > 0
              ? `<ul style="margin: 0 0 6px 18px; padding: 0; font-size: 13px; color: #334155;">${feedbackLabels
                  .map((label) => `<li>${escapeHtml(label)}</li>`)
                  .join('')}</ul>`
              : ''
          }
          ${
            payload.selfOtherNote.trim()
              ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #334155;">หมายเหตุเพิ่มเติม: ${escapeHtml(
                  payload.selfOtherNote.trim()
                )}</p>`
              : ''
          }
        </div>
      `
      : '';

  return `
    <div style="font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0F172A; line-height: 1.6;">
      <div style="background-color: #0F172A; color: #FFFFFF; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <p style="margin: 0; font-size: 12px; color: #2DD4BF; font-weight: 600;">ระบบประเมินสมรรถนะเฉพาะหน่วยงาน · หอผู้ป่วยพิเศษบุญสม 7</p>
        <h2 style="margin: 6px 0 0 0; font-size: 18px; font-weight: 600;">แจ้งส่งผลการประเมินตนเอง (รอการประเมินจากผู้บังคับบัญชา)</h2>
      </div>
      <div style="border: 1px solid #E2E8F0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; background-color: #FFFFFF;">
        <p style="margin: 0 0 14px 0; font-size: 14px;">เรียน หัวหน้าหอผู้ป่วย / ผู้บังคับบัญชา,</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
          บุคลากรได้ส่งแบบประเมินสมรรถนะด้วยตนเองเรียบร้อยแล้ว กรุณาเข้าสู่ระบบเพื่อดำเนินการประเมินผลในส่วนของผู้บังคับบัญชา
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #64748B; width: 40%;">ชื่อ–นามสกุล ผู้รับการประเมิน</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-weight: 600;">${escapeHtml(payload.staffName)} (${escapeHtml(payload.positionType)})</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;">หอผู้ป่วย / อายุงานในหอผู้ป่วย</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9;">${escapeHtml(payload.ward)} · ${payload.wardYears} ปี</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;">แบบประเมินสมรรถนะ</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-weight: 600;">${escapeHtml(payload.formCode)} — ${escapeHtml(payload.formTitle)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;">รอบการประเมิน</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9;">${escapeHtml(payload.assessmentPeriod)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #64748B;">คะแนนประเมินตนเอง</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-weight: 700; color: #4F46E5;">
              ${payload.selfTotalScore} / ${payload.selfMaxScore} คะแนน (${payload.selfPercentage}%) · ประเมิน ${payload.selfAnsweredCount}/${payload.totalItems} ข้อ
            </td>
          </tr>
        </table>

        ${feedbackHtml}

        <div style="margin-top: 22px; text-align: center;">
          <a href="${escapeHtml(appUrl)}" style="display: inline-block; background-color: #0891B2; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 11px 22px; border-radius: 10px;">
            เข้าสู่ระบบเพื่อประเมินผลด้านผู้บังคับบัญชา
          </a>
        </div>
        <p style="margin: 14px 0 0 0; font-size: 11px; color: #94A3B8; text-align: center;">
          ลิงก์เข้าใช้งาน: ${escapeHtml(appUrl)}
        </p>
      </div>
    </div>
  `;
}

function createMimeMessage(to: string, subject: string, htmlBody: string): string {
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
  const encodedBody = utf8ToBase64(htmlBody);
  const lines = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ];
  return toBase64Url(lines.join('\r\n'));
}

async function postGmailSend(accessToken: string, rawMessage: string): Promise<Response> {
  return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawMessage }),
  });
}

export async function sendSelfAssessmentEmailNotification(
  payload: SelfAssessmentEmailPayload
): Promise<void> {
  const appUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-zwr22b4uwv2oaj2meze6uu-596846209780.asia-southeast1.run.app';
  const subject = buildSelfAssessmentEmailSubject(payload);
  const htmlBody = buildSelfAssessmentEmailHtml(payload, appUrl);
  const rawMessage = createMimeMessage(HEAD_NURSE_NOTIFICATION_EMAIL, subject, htmlBody);

  let token = await requestGmailAccessToken(false);
  let res = await postGmailSend(token, rawMessage);

  if (res.status === 401) {
    setCachedGmailAccessToken(null);
    token = await requestGmailAccessToken(true);
    res = await postGmailSend(token, rawMessage);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `ส่งอีเมลแจ้งเตือนไม่สำเร็จ (${res.status})${errText ? `: ${errText.slice(0, 160)}` : ''}`
    );
  }
}
