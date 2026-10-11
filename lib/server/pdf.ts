import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PDF_FONT_BASE64 } from './pdf-font';
import { redactContactText } from './privacy';

type Profile = Record<string, unknown>;
type Contacts = { email?: string; phone?: string } | null;
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
const text = (value: unknown, fallback = ''): string => value == null ? fallback : String(value);

/** Caller must authorize access and decide per-employer contact permission first. */
export async function renderProfilePdf(profile: Profile, contacts: Contacts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontData = Uint8Array.from(atob(PDF_FONT_BASE64), c => c.charCodeAt(0));
  const font = await doc.embedFont(fontData, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const clean = (s: string) => Array.from(contacts ? s : redactContactText(s)).filter(c => c === '\n' || supported.has(c.codePointAt(0)!)).join('');
  const blue = rgb(.251, .184, 1), dark = rgb(.106, .11, .129), muted = rgb(.39, .42, .48);
  const pageWidth = 595.28, pageHeight = 841.89, margin = 48, contentWidth = pageWidth - margin * 2;
  let page: PDFPage, y: number;
  const addPage = () => {
    page = doc.addPage([pageWidth, pageHeight]); y = pageHeight - 56;
    page.drawText('ФСП Карьера', { x: margin, y, size: 12, font, color: blue });
    page.drawText('Профиль квалификации', { x: 335, y, size: 10, font, color: muted });
    y -= 36;
  };
  addPage();
  const lines = (value: string, size: number, maxWidth: number, f: PDFFont): string[] => {
    const result: string[] = [];
    for (const paragraph of clean(value).split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue; }
        if (current) result.push(current);
        current = '';
        for (const char of word) {
          if (f.widthOfTextAtSize(current + char, size) > maxWidth && current) { result.push(current); current = ''; }
          current += char;
        }
      }
      result.push(current);
    }
    return result;
  };
  const paragraph = (value: string, size = 10, color = dark, spacing = 6) => {
    for (const line of lines(value, size, contentWidth, font)) {
      if (y < 65) addPage();
      page.drawText(line, { x: margin, y, size, font, color }); y -= size * 1.6;
    }
    y -= spacing;
  };
  const section = (title: string) => {
    if (y < 112) addPage();
    y -= 8; paragraph(title, 12, blue, 6);
  };
  paragraph(text(profile.name, 'Кандидат'), 23, dark, 4);
  paragraph(text(profile.title, 'ИТ-специалист'), 12, muted);
  const spec = profile.specialization === 'backend' ? 'Backend' : profile.specialization === 'frontend' ? 'Frontend' : text(profile.specialization, 'Не выбрана');
  const grade = profile.verifiedGrade ? text(profile.verifiedGrade).toUpperCase() : 'Грейд не подтверждён';
  paragraph(`${spec} / ${grade}${profile.city ? ` / ${text(profile.city)}` : ''}`, 10, muted);
  paragraph(`Опыт работы в годах: ${text(profile.experienceYears, '0')}. Отрасль: ${text(profile.industry, 'Не указана')}.`);
  section('Контакты');
  if (contacts) {
    paragraph(`Email: ${contacts.email || 'Не указан'}`);
    paragraph(`Телефон: ${contacts.phone || 'Не указан'}`);
  } else paragraph('Контакты скрыты. Доступ появляется только после принятия приглашения этой компании или самостоятельного отклика.', 10, muted);
  if (profile.bio) { section('О кандидате'); paragraph(text(profile.bio)); }
  section('Роли и софт-скиллы');
  paragraph(`Роли: ${list(profile.roles).join(', ') || 'Не указаны'}.`);
  paragraph(`Софт-скиллы: ${list(profile.softSkills).join(', ') || 'Не указаны'}.`);
  paragraph('Указаны кандидатом в резюме; первичный технический тест не подтверждает эти сведения.', 9, muted);
  section('Навыки');
  paragraph(`Указаны кандидатом: ${list(profile.skills).join(', ') || 'Не указаны'}.`);
  const demonstrated = list(profile.demonstratedSkills);
  paragraph(`Показаны в тесте: ${demonstrated.join(', ') || 'Пока нет подтверждённых результатов'}.`, 10, muted);
  const history = Array.isArray(profile.history) ? profile.history as Profile[] : [];
  if (history.length) {
    section('История тестирования');
    for (const item of history.slice(0, 12)) {
      const dateValue = text(item.submittedAt || item.completedAt || item.createdAt);
      const date = dateValue && !Number.isNaN(Date.parse(dateValue)) ? new Date(dateValue).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
      paragraph(`${date}  ${text(item.specialization)} / ${text(item.grade)}: ${text(item.score)}%, ${item.passed ? 'пройден' : 'не пройден'}.`, 10);
    }
  }
  section('Достижения ФСП');
  const achievements = Array.isArray(profile.achievements) ? profile.achievements as Profile[] : [];
  if (!achievements.length) paragraph('История ФСП отсутствует. Участие в ФСП не является условием доступа к платформе.', 10, muted);
  for (const achievement of achievements) {
    paragraph(`${text(achievement.event || achievement.title)}. ${text(achievement.discipline)}. ${text(achievement.date)}. ${text(achievement.result)}.`, 10);
    paragraph('Источник: демонстрационный реестр ФСП. Синтетическое достижение, не подтверждение реального спортивного результата.', 9, muted);
  }
  section('Основание категории');
  paragraph('Категорию подтверждает первичный тест по специализации и грейду. Самооценка, стаж и спортивные достижения не заменяют его. Результат теста является оценкой демонстрационного инструмента, а не гарантией успешного найма.', 9, muted);
  const generated = new Date().toISOString();
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawText(`Профиль v1 • ${new Date(generated).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })} • ${i + 1}/${pages.length}`, { x: margin, y: 30, size: 8, font, color: muted });
  }
  doc.setTitle(`Профиль квалификации ${clean(text(profile.name))}`);
  doc.setAuthor('ФСП Карьера');
  doc.setSubject('Стандартизированный профиль с политикой раскрытия контактов');
  return doc.save();
}
