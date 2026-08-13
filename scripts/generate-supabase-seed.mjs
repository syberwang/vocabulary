import fs from "node:fs";
import path from "node:path";

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "vocabulary.json"), "utf8"));
const q = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;

const statements = ["begin;"];
for (const course of data.courses) {
  statements.push(`insert into public.courses (id, level, unit_no, lesson_no, code, title, sort_order, word_count, source_start_page, source_end_page) values (${q(course.id)}, ${q(course.level)}, ${course.unit}, ${course.lesson}, ${q(course.code)}, ${q(course.title)}, ${course.sortOrder}, ${course.wordCount}, ${course.sourceStartPage}, ${course.sourceEndPage}) on conflict (id) do update set title=excluded.title, word_count=excluded.word_count, source_start_page=excluded.source_start_page, source_end_page=excluded.source_end_page;`);
}
for (const entry of data.entries) {
  statements.push(`insert into public.vocabulary_entries (id, source_row, course_id, word, part_of_speech, translation_zh, accepted_answers, example_fr, example_zh, usage_note, source_page, source_method, raw_values, content_status, content_version, example_source, content_risk) values (${q(entry.id)}, ${entry.sourceRow}, ${q(entry.courseId)}, ${q(entry.word)}, ${q(entry.pos)}, ${q(entry.zh)}, ${json(entry.acceptedAnswers)}, ${q(entry.exampleFr)}, ${q(entry.exampleZh)}, ${q(entry.usageNote)}, ${entry.sourcePage}, ${q(entry.sourceMethod)}, ${json(entry.raw)}, ${q(entry.contentStatus)}, ${entry.contentVersion}, ${json(entry.exampleSource ?? null)}, ${q(entry.contentRisk ?? null)}) on conflict (id) do update set word=excluded.word, part_of_speech=excluded.part_of_speech, translation_zh=excluded.translation_zh, accepted_answers=excluded.accepted_answers, example_fr=excluded.example_fr, example_zh=excluded.example_zh, usage_note=excluded.usage_note, content_status=excluded.content_status, content_version=excluded.content_version, example_source=excluded.example_source, content_risk=excluded.content_risk, updated_at=now();`);
}
statements.push("commit;");
fs.writeFileSync(path.join(process.cwd(), "supabase", "seed.sql"), statements.join("\n"), "utf8");
console.log(`Generated ${data.courses.length} courses and ${data.entries.length} entries.`);
