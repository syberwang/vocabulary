"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookPlus, Layers3, Plus, Save, Search } from "lucide-react";

type ContentStatus = "draft" | "approved" | "needs_review" | "quarantined";
type AdminEntry = {
  id: string;
  word: string;
  part_of_speech: string;
  translation_zh: string;
  example_fr: string;
  example_zh: string;
  usage_note: string;
  accepted_answers: string[];
  content_status: ContentStatus;
  raw_values: { word?: string; pos?: string; zh?: string };
  source_page: number;
};
type AdminLevel = { code: string; title: string; sort_order: number; course_count: number };
type AdminCourse = { id: string; level: string; code: string; title: string; unit_no: number; lesson_no: number; word_count: number };

const emptyWord = {
  course_id: "",
  word: "",
  part_of_speech: "",
  translation_zh: "",
  accepted_answers: "",
  example_fr: "",
  example_zh: "",
  usage_note: "",
  content_status: "needs_review" as ContentStatus,
};

function errorMessage(response: Response, fallback: string) {
  return response.json().then((body: { error?: string }) => body.error ?? fallback).catch(() => fallback);
}

export function AdminContent() {
  const [tab, setTab] = useState<"review" | "create">("create");
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [selected, setSelected] = useState<AdminEntry | null>(null);
  const [levels, setLevels] = useState<AdminLevel[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("needs_review");
  const [message, setMessage] = useState("");
  const [levelForm, setLevelForm] = useState({ code: "B1", title: "B1 中级", sortOrder: "" });
  const [courseForm, setCourseForm] = useState({ levelCode: "", unitNo: "1", lessonNo: "1", code: "", title: "", sortOrder: "", sourceStartPage: "0", sourceEndPage: "0" });
  const [wordForm, setWordForm] = useState(emptyWord);

  async function loadEntries() {
    const response = await fetch(`/api/admin/entries?status=${status}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (!response.ok) return setMessage(await errorMessage(response, "内容载入失败。"));
    const rows = await response.json() as AdminEntry[];
    setEntries(rows);
    setSelected((current) => rows.find((row) => row.id === current?.id) ?? rows[0] ?? null);
    setMessage("");
  }

  async function loadCatalog() {
    const [levelResponse, courseResponse] = await Promise.all([
      fetch("/api/admin/levels", { cache: "no-store" }),
      fetch("/api/admin/courses", { cache: "no-store" }),
    ]);
    if (!levelResponse.ok || !courseResponse.ok) {
      setMessage("阶段和课程目录载入失败，请确认数据库迁移已执行。");
      return;
    }
    const nextLevels = await levelResponse.json() as AdminLevel[];
    const nextCourses = await courseResponse.json() as AdminCourse[];
    setLevels(nextLevels);
    setCourses(nextCourses);
    setCourseForm((current) => ({ ...current, levelCode: current.levelCode || nextLevels[0]?.code || "" }));
    setWordForm((current) => ({ ...current, course_id: current.course_id || nextCourses[0]?.id || "" }));
  }

  useEffect(() => { void loadEntries(); }, [status]);
  useEffect(() => { void loadCatalog(); }, []);

  async function saveEntry() {
    if (!selected) return;
    const response = await fetch("/api/admin/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selected, note: "管理员后台校订" }),
    });
    setMessage(response.ok ? "已保存修改，并写入修订历史。" : await errorMessage(response, "保存失败，请检查必填字段。"));
    if (response.ok) setSelected(await response.json() as AdminEntry);
  }

  async function createLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/levels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: levelForm.code, title: levelForm.title, sortOrder: levelForm.sortOrder ? Number(levelForm.sortOrder) : undefined }) });
    if (!response.ok) return setMessage(await errorMessage(response, "阶段添加失败。"));
    const created = await response.json() as AdminLevel;
    setMessage(`阶段 ${created.code} 已添加。现在可以为它创建课程。`);
    setLevelForm({ code: "", title: "", sortOrder: "" });
    setCourseForm((current) => ({ ...current, levelCode: created.code }));
    await loadCatalog();
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceStartPage = Number(courseForm.sourceStartPage || 0);
    const sourceEndPage = Math.max(sourceStartPage, Number(courseForm.sourceEndPage || sourceStartPage));
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        levelCode: courseForm.levelCode,
        unitNo: Number(courseForm.unitNo),
        lessonNo: Number(courseForm.lessonNo),
        code: courseForm.code,
        title: courseForm.title,
        sortOrder: courseForm.sortOrder ? Number(courseForm.sortOrder) : undefined,
        sourceStartPage,
        sourceEndPage,
      }),
    });
    if (!response.ok) return setMessage(await errorMessage(response, "课程添加失败。"));
    const created = await response.json() as AdminCourse;
    setMessage(`课程 ${created.code} 已添加，现在可以添加单词。`);
    setCourseForm((current) => ({ ...current, code: "", title: "", sortOrder: "" }));
    setWordForm((current) => ({ ...current, course_id: created.id }));
    await loadCatalog();
  }

  async function createWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...wordForm,
        accepted_answers: wordForm.accepted_answers.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      }),
    });
    if (!response.ok) return setMessage(await errorMessage(response, "单词添加失败。"));
    const created = await response.json() as AdminEntry;
    setMessage(`单词“${created.word}”已添加，并已记录修订历史。`);
    setWordForm((current) => ({ ...emptyWord, course_id: current.course_id }));
    await loadCatalog();
    if (tab === "review") await loadEntries();
  }

  function updateEntry(field: keyof AdminEntry, value: unknown) {
    setSelected((current) => current ? { ...current, [field]: value } : current);
  }

  return (
    <section className="page-section admin-page">
      <h1 className="page-title">内容后台</h1>
      <p className="page-subtitle">管理阶段、课程和词条。新增内容默认待审核，批准后才会进入学习流。</p>

      <div className="admin-tabs" role="tablist" aria-label="内容后台功能">
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><BookPlus size={17} /> 添加单词</button>
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}><Save size={17} /> 审核已有词条</button>
      </div>

      {tab === "create" ? (
        <div className="admin-create-stack">
          <div className="admin-form-grid">
            <form className="panel settings-list" onSubmit={createLevel}>
              <div className="admin-section-title"><Layers3 size={18} /><div><h2>添加阶段</h2><p>例如 B1、B2 或自定义阶段。</p></div></div>
              <label>阶段代码<input className="answer-input" value={levelForm.code} onChange={(event) => setLevelForm({ ...levelForm, code: event.target.value })} placeholder="B1" required /></label>
              <label>显示名称<input className="answer-input" value={levelForm.title} onChange={(event) => setLevelForm({ ...levelForm, title: event.target.value })} placeholder="B1 中级" required /></label>
              <label>排序（可选）<input className="answer-input" type="number" min="0" value={levelForm.sortOrder} onChange={(event) => setLevelForm({ ...levelForm, sortOrder: event.target.value })} placeholder="自动排序" /></label>
              <button className="primary-button" type="submit"><Plus size={17} /> 添加阶段</button>
            </form>

            <form className="panel settings-list" onSubmit={createCourse}>
              <div className="admin-section-title"><Layers3 size={18} /><div><h2>添加课程</h2><p>先选阶段，再填写课程编号和名称。</p></div></div>
              <label>所属阶段<select className="answer-input" value={courseForm.levelCode} onChange={(event) => setCourseForm({ ...courseForm, levelCode: event.target.value })} required><option value="">请选择阶段</option>{levels.map((level) => <option key={level.code} value={level.code}>{level.code} · {level.title}</option>)}</select></label>
              <div className="admin-inline-fields"><label>单元<input className="answer-input" type="number" min="1" value={courseForm.unitNo} onChange={(event) => setCourseForm({ ...courseForm, unitNo: event.target.value })} required /></label><label>课程序号<input className="answer-input" type="number" min="1" value={courseForm.lessonNo} onChange={(event) => setCourseForm({ ...courseForm, lessonNo: event.target.value })} required /></label></div>
              <label>课程编号<input className="answer-input" value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} placeholder="B1-U1L1" required /></label>
              <label>课程名称<input className="answer-input" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="日常交流" required /></label>
              <div className="admin-inline-fields"><label>起始页<input className="answer-input" type="number" min="0" value={courseForm.sourceStartPage} onChange={(event) => setCourseForm({ ...courseForm, sourceStartPage: event.target.value })} /></label><label>结束页<input className="answer-input" type="number" min="0" value={courseForm.sourceEndPage} onChange={(event) => setCourseForm({ ...courseForm, sourceEndPage: event.target.value })} /></label></div>
              <button className="primary-button" type="submit" disabled={!levels.length}><Plus size={17} /> 添加课程</button>
            </form>
          </div>

          <form className="panel settings-list" onSubmit={createWord}>
            <div className="admin-section-title"><BookPlus size={18} /><div><h2>添加单词</h2><p>填写法语单词、中文释义和学习卡片内容；每行一个可接受答案。</p></div></div>
            <label>所属课程<select className="answer-input" value={wordForm.course_id} onChange={(event) => setWordForm({ ...wordForm, course_id: event.target.value })} required><option value="">请选择课程</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.level} · {course.code} · {course.title}（{course.word_count} 词）</option>)}</select></label>
            <div className="admin-inline-fields"><label>法语单词<input className="answer-input" value={wordForm.word} onChange={(event) => setWordForm({ ...wordForm, word: event.target.value })} placeholder="bonjour" required /></label><label>词性<input className="answer-input" value={wordForm.part_of_speech} onChange={(event) => setWordForm({ ...wordForm, part_of_speech: event.target.value })} placeholder="n.m. / v. / adj." /></label></div>
            <label>中文释义<textarea className="answer-input admin-textarea" value={wordForm.translation_zh} onChange={(event) => setWordForm({ ...wordForm, translation_zh: event.target.value })} placeholder="你好；问候" required /></label>
            <label>可接受答案<textarea className="answer-input admin-textarea" value={wordForm.accepted_answers} onChange={(event) => setWordForm({ ...wordForm, accepted_answers: event.target.value })} placeholder="留空则使用法语单词本身；每行一个答案" /></label>
            <div className="admin-inline-fields"><label>法语例句<textarea className="answer-input admin-textarea" value={wordForm.example_fr} onChange={(event) => setWordForm({ ...wordForm, example_fr: event.target.value })} placeholder="Bonjour, Marie !" /></label><label>例句中文<textarea className="answer-input admin-textarea" value={wordForm.example_zh} onChange={(event) => setWordForm({ ...wordForm, example_zh: event.target.value })} placeholder="你好，玛丽！" /></label></div>
            <label>用法提示<textarea className="answer-input admin-textarea" value={wordForm.usage_note} onChange={(event) => setWordForm({ ...wordForm, usage_note: event.target.value })} placeholder="可选：性数、搭配或语法说明" /></label>
            <label>发布状态<select className="answer-input" value={wordForm.content_status} onChange={(event) => setWordForm({ ...wordForm, content_status: event.target.value as ContentStatus })}><option value="needs_review">待审核（推荐）</option><option value="draft">草稿</option><option value="approved">已批准并发布</option><option value="quarantined">隔离</option></select></label>
            <button className="primary-button" type="submit" disabled={!courses.length}><BookPlus size={17} /> 保存单词</button>
          </form>
        </div>
      ) : (
        <>
          <div className="panel admin-search-row"><input className="answer-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索法语或中文" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="needs_review">待审核</option><option value="draft">草稿</option><option value="approved">已批准</option><option value="quarantined">已隔离</option><option value="all">全部</option></select><button className="icon-button" onClick={() => void loadEntries()} aria-label="搜索"><Search size={18} /></button></div>
          <div className="admin-review-grid">
            <div className="panel admin-entry-list">{entries.map((entry) => <button key={entry.id} onClick={() => setSelected(entry)} className={selected?.id === entry.id ? "selected" : ""}><b lang="fr">{entry.word}</b><span>{entry.translation_zh}</span></button>)}{!entries.length && <p className="empty-copy">没有符合条件的词条。</p>}</div>
            {selected && <div className="panel settings-list">
              <p className="admin-source">原文：{selected.raw_values?.word ?? "空"} / {selected.raw_values?.pos ?? "空"} / {selected.raw_values?.zh ?? "空"} · PDF 第 {selected.source_page} 页</p>
              {([['word', '法语'], ['part_of_speech', '词性'], ['translation_zh', '中文释义'], ['example_fr', '法语例句'], ['example_zh', '例句翻译'], ['usage_note', '用法提示']] as const).map(([field, label]) => <label key={field}>{label}<textarea className="answer-input admin-textarea" value={String(selected[field])} onChange={(event) => updateEntry(field, event.target.value)} /></label>)}
              <label>可接受答案<textarea className="answer-input admin-textarea" value={selected.accepted_answers.join("\n")} onChange={(event) => updateEntry("accepted_answers", event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))} /></label>
              <label>内容状态<select className="answer-input" value={selected.content_status} onChange={(event) => updateEntry("content_status", event.target.value)}><option value="needs_review">待审核</option><option value="draft">草稿</option><option value="approved">已批准</option><option value="quarantined">已隔离</option></select></label>
              <button className="primary-button" onClick={() => void saveEntry()}><Save size={17} /> 保存修改</button>
            </div>}
          </div>
        </>
      )}
      {message && <p className="feedback good" role="status">{message}</p>}
    </section>
  );
}
