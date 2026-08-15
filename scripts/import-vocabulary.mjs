import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const root = process.cwd();
const dataPath = path.join(root, "data", "vocabulary.json");
const pdfAdditionsPath = path.join(root, "data", "pdf-vocabulary-additions.json");
const previousData = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, "utf8")) : null;
const previousEntries = new Map((previousData?.entries ?? []).map((entry) => [entry.id, entry]));
const pdfAdditions = JSON.parse(fs.readFileSync(pdfAdditionsPath, "utf8"));
const pdfCorrections = new Map(pdfAdditions.corrections.map((correction) => [correction.entryId, correction]));
const workbookPath = fs
  .readdirSync(root)
  .map((name) => path.join(root, name))
  .find((file) => file.toLowerCase().endsWith(".xlsx"));

if (!workbookPath) throw new Error("Vocabulary workbook was not found.");

const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }).slice(4);

const wordCorrections = new Map([
  ["àcôté(de)", "à côté (de)"],
  ["àdroite(de)", "à droite (de)"],
  ["àgauche(de)", "à gauche (de)"],
  ["ilya", "il y a"],
  ["mètrecarré", "mètre carré"],
  ["salledebains", "salle de bains"],
  ["airconditionné", "air conditionné"],
  ["hôteldeville", "hôtel de ville"],
  ["cartepostale", "carte postale"],
  ["fairedes/lescourses", "faire des / les courses"],
  ["eauminérale", "eau minérale"],
  ["pommedeterre", "pomme de terre"],
]);

const translationCorrections = new Map([
  ["œil[œj]", "眼睛"],
  ["grands-mères", "（外）祖母（复数）"],
  ["grands-pères", "（外）祖父（复数）"],
  ["chevaux", "马；马力（复数）"],
]);

const groupedFormsByRow = new Map([
  [664, { word: "œil / yeux", pos: "n.m.", zh: "眼睛" }],
  [783, { word: "grand-mère / grands-mères", pos: "n.f.", zh: "（外）祖母" }],
  [785, { word: "grand-père / grands-pères", pos: "n.m.", zh: "（外）祖父" }],
  [848, { word: "cheval / chevaux", pos: "n.m.", zh: "马；[机]马力" }],
  [1006, { word: "or", pos: "n.m.", zh: "金子、黄金；珍贵或完美的东西" }],
]);

// Directly verified against the indicated lecture PDF pages. Raw spreadsheet
// values remain in `raw` so every correction stays traceable.
const verifiedCorrectionsByRow = new Map([
  [86, { word: "toi", pos: "pron.pers.", zh: "你（用作主语或宾语的同位语，表示加强语气）", example: ["Et toi, tu habites où ?", "那你呢，你住在哪里？", "toi 是重读人称代词，可用于强调或介词后。"] }],
  [95, { word: "vous", pos: "pron.pers.", zh: "您；你们（用作主语或宾语的同位语，表示加强语气）", example: ["Et vous, vous habitez où ?", "那您呢，您住在哪里？", "vous 可作主语，也可作重读形式；用于复数或礼貌称呼。"] }],
  [271, { word: "jusque", pos: "prép.", zh: "直到，直至（与介词连用）", example: ["Continuez jusque dans le jardin.", "一直走到花园里面。", "jusque 常与 à、dans、chez 等介词连用；元音前写作 jusqu'。"] }],
  [190, { word: "manteau / manteaux", pos: "n.m.", zh: "大衣，外套", example: ["Il porte un manteau noir.", "他穿着一件黑色大衣。", "阳性名词；复数形式为 manteaux。"] }],
  [892, { word: "bulletin météo", pos: "n.m.", zh: "天气预报", example: ["J'écoute le bulletin météo.", "我收听天气预报。", "bulletin météo：天气预报；bulletin 是阳性名词。"] }],
  [834, { word: "à partir de", pos: "loc.prép.", zh: "从……起（表示时间或空间的起点）", example: ["Le magasin ouvre à partir de neuf heures.", "商店从九点开始营业。", "à partir de + 时间或地点：从……开始。"] }],
  [1085, { word: "climat", pos: "n.m.", zh: "气候", example: ["Le climat est agréable ici.", "这里的气候宜人。", "阳性名词；常见搭配有 climat océanique、continental、méditerranéen。"] }],
  [1126, { word: "arriver à (+ inf.)", pos: "loc.v.", zh: "终于做到，成功做成", example: ["J'arrive à finir ce travail.", "我终于完成了这项工作。", "arriver à + 动词不定式：成功做到某事。"] }],
  [1211, { word: "à la carte", pos: "loc.adv.", zh: "任选的，自由选择的", example: ["Vous mangez à la carte ?", "您要按菜单单点吗？", "manger à la carte：按菜单单点；与套餐 menu 相对。"] }],
  [1221, { word: "émission en direct", pos: "n.f.", zh: "直播节目", example: ["Nous regardons une émission en direct.", "我们正在看直播节目。", "en direct：现场直播、直播的。"] }],
  [1316, { word: "en ce moment", pos: "loc.adv.", zh: "此刻，现在", example: ["Je suis très occupé en ce moment.", "我现在很忙。", "en ce moment 表示“目前、现在”，常与现在时连用。"] }],
  [1322, { word: "beaux-arts", pos: "n.m.pl.", zh: "美术", example: ["Elle étudie les beaux-arts.", "她学习美术。", "复数阳性名词；学校名称中常写作 les Beaux-Arts。"] }],
  [1422, { word: "avoir l'impression de / que", pos: "loc.v.", zh: "感觉到，觉得", example: ["J'ai l'impression de connaître cette ville.", "我觉得自己认识这座城市。", "avoir l'impression de + 不定式；avoir l'impression que + 从句。"] }],
]);

// These source rows are retained for traceability, but their forms are taught
// together with the preceding singular card and therefore are not published.
const groupedContinuationRows = new Set([665, 784, 786, 849]);

const exampleCorrections = new Map([
  ["appeler(s’)", ["Je m'appelle Léa.", "我叫蕾雅。", "s'appeler + 姓名：名叫……"]],
  ["bienvenue", ["Bienvenue à Montréal !", "欢迎来到蒙特利尔！", "Bienvenue à + 地点"]],
  ["bonjour", ["Bonjour, madame !", "您好，女士！", "白天见面时的常用问候语"]],
  ["ce", ["Qu'est-ce que c'est ?", "这是什么？", "ce 是指示代词或限定词的一部分"]],
  ["elle", ["Elle est étudiante.", "她是大学生。", "elle 作阴性第三人称单数主语"]],
  ["et", ["Paul et Marie sont français.", "保罗和玛丽是法国人。", "et 连接两个并列成分"]],
  ["être", ["Je suis étudiant.", "我是大学生。", "être + 身份或形容词"]],
  ["étudiant(e)", ["Elle est étudiante à Paris.", "她在巴黎读大学。", "阴性形式为 étudiante"]],
  ["femme", ["Cette femme est française.", "这位女士是法国人。", "femme 是阴性名词"]],
  ["français(e)", ["Il parle français.", "他说法语。", "语言名词 français 通常不用冠词"]],
  ["or", ["Cette famille est en or.", "这个家庭非常珍贵、完美。", "en or 可表示“非常珍贵或完美的”"]],
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedWord(rawWord, level, course, zh) {
  if (!rawWord && level === "A2" && course === "U1L4" && zh.includes("珍贵")) return "or";
  const corrected = wordCorrections.get(rawWord) ?? rawWord;
  return clean(corrected).replace(/\[.*?\]/g, "").trim();
}

function inferPos(rawPos, word, zh) {
  if (rawPos) return clean(rawPos).replace(/^n\.f$/i, "n.f.").replace(/^n\.m$/i, "n.m.");
  const lower = zh.toLowerCase();
  if (/^interj/.test(lower)) return "interj.";
  if (/^adj/.test(lower)) return "adj.";
  if (/^adv/.test(lower)) return "adv.";
  if (/^[A-ZÀ-ÖØ-Þ]/.test(word)) return "n.pr.";
  if (/\s|…|\//.test(word)) return "loc.";
  return "mot/expr.";
}

function expandAnswers(word) {
  const base = word.replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  const answers = new Set([base]);
  if (base === "appeler(s')" || base === "appeler(s’)" || /appeler\(s['’]\)/.test(word)) {
    answers.add("appeler");
    answers.add("s'appeler");
  }
  const optional = base.match(/^(.*)\(([^)]+)\)$/);
  if (optional) {
    answers.add(optional[1]);
    answers.add(`${optional[1]}${optional[2]}`);
  }
  const withoutParentheticals = base.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (withoutParentheticals && withoutParentheticals !== base) answers.add(withoutParentheticals);
  if (base.includes(" / ")) base.split(" / ").forEach((part) => answers.add(part.trim()));
  return [...answers].filter(Boolean);
}

function fallbackExample(word, zh) {
  return [
    `Dans cette leçon, on apprend « ${word} ».` ,
    `这一课学习“${zh.split(/[；，]/)[0]}”这个词或表达。`,
    "示例为导入占位内容，需在内容后台结合讲义校对。",
  ];
}

function contentFields(entry, fallbackStatus, contentChanged = false) {
  const previous = previousEntries.get(entry.id);
  const unchanged = previous && !contentChanged && previous.word === entry.word && previous.pos === entry.pos && previous.zh === entry.zh;
  if (unchanged) {
    return {
      exampleFr: previous.exampleFr,
      exampleZh: previous.exampleZh,
      usageNote: previous.usageNote,
      contentStatus: previous.contentStatus,
      contentVersion: previous.contentVersion,
      exampleSource: previous.exampleSource,
      contentRisk: previous.contentRisk,
      contentReview: previous.contentReview,
    };
  }
  return {
    contentStatus: fallbackStatus,
    contentVersion: Math.max(1, Number(previous?.contentVersion ?? 0) + (previous ? 1 : 0)),
  };
}

const entries = [];
const courses = new Map();

rows.forEach((row, index) => {
  const sourceRow = index + 5;
  const level = clean(row[1]);
  const unit = Number(row[2]);
  const lesson = Number(row[3]);
  const courseCode = clean(row[4]);
  if (!level || !courseCode) return;

  const rawWord = clean(row[6]);
  const rawPos = clean(row[7]);
  const rawZh = clean(row[8]);
  const grouped = groupedFormsByRow.get(sourceRow);
  const verified = verifiedCorrectionsByRow.get(sourceRow);
  const id = `entry-${sourceRow}`;
  const correction = pdfCorrections.get(id);
  const word = correction?.word ?? verified?.word ?? grouped?.word ?? normalizedWord(rawWord, level, courseCode, rawZh);
  const zh = correction?.zh ?? verified?.zh ?? grouped?.zh ?? translationCorrections.get(rawWord) ?? rawZh;
  const pos = correction?.pos ?? verified?.pos ?? grouped?.pos ?? inferPos(rawPos || (word === "or" ? "n.m." : ""), word, zh);
  const courseId = `${level.toLowerCase()}-${courseCode.toLowerCase()}`;
  const courseTitle = clean(row[5]) || `${level} · 第 ${unit} 单元 · 第 ${lesson} 课`;
  const [fallbackExampleFr, fallbackExampleZh, fallbackUsageNote] = verified?.example ?? exampleCorrections.get(rawWord || word) ?? fallbackExample(word, zh);
  const fallbackStatus = groupedContinuationRows.has(sourceRow)
    ? "quarantined"
    : word && pos && zh
      ? (verified || exampleCorrections.has(rawWord || word) ? "approved" : "needs_review")
      : "quarantined";
  const previousEntry = previousEntries.get(id);
  const correctionChanged = Boolean(correction) && (!previousEntry || previousEntry.word !== word || previousEntry.pos !== pos || previousEntry.zh !== zh);
  const preserved = contentFields({ id, word, pos, zh }, correction ? "needs_review" : fallbackStatus, correctionChanged);

  if (!courses.has(courseId)) {
    courses.set(courseId, {
      id: courseId,
      level,
      unit,
      lesson,
      code: courseCode,
      title: courseTitle,
      sortOrder: (level === "A1" ? 0 : 100) + lesson,
      sourceStartPage: Number(row[9]),
      sourceEndPage: Number(row[9]),
      entryIds: [],
    });
  }

  const course = courses.get(courseId);
  course.entryIds.push(id);
  course.sourceStartPage = Math.min(course.sourceStartPage, Number(row[9]));
  course.sourceEndPage = Math.max(course.sourceEndPage, Number(row[9]));

  entries.push({
    id,
    sourceRow,
    courseId,
    level,
    unit,
    lesson,
    courseCode,
    word,
    pos,
    zh,
    acceptedAnswers: expandAnswers(word),
    exampleFr: preserved.exampleFr ?? fallbackExampleFr,
    exampleZh: preserved.exampleZh ?? fallbackExampleZh,
    usageNote: preserved.usageNote ?? fallbackUsageNote,
    sourcePage: Number(row[9]),
    sourceMethod: correction ? pdfAdditions.sourceMethod : clean(row[10]),
    raw: { word: rawWord || null, pos: rawPos || null, zh: rawZh || null },
    ...preserved,
  });
});

for (const [courseId, courseAdditions] of Object.entries(pdfAdditions.courses)) {
  const course = courses.get(courseId);
  if (!course) throw new Error(`PDF 补录课程不存在：${courseId}`);
  const seenPositions = new Set();
  for (const addition of courseAdditions.entries) {
    if (seenPositions.has(addition.position)) throw new Error(`PDF 补录表格位置重复：${courseId} #${addition.position}`);
    seenPositions.add(addition.position);
    const id = `pdf-${courseId}-${String(addition.position).padStart(3, "0")}`;
    const sourceRow = Number(pdfAdditions.sourceRowRanges[course.level]) + course.lesson * 100 + addition.position;
    if (entries.some((entry) => entry.id === id || entry.sourceRow === sourceRow)) throw new Error(`PDF 补录 ID/sourceRow 冲突：${id}`);
    const acceptedAnswers = expandAnswers(addition.word);
    const [fallbackExampleFr, fallbackExampleZh, fallbackUsageNote] = fallbackExample(addition.word, addition.zh);
    const preserved = contentFields({ id, word: addition.word, pos: addition.pos, zh: addition.zh }, "needs_review");
    entries.push({
      id,
      sourceRow,
      tablePosition: addition.position,
      courseId,
      level: course.level,
      unit: course.unit,
      lesson: course.lesson,
      courseCode: course.code,
      word: addition.word,
      pos: addition.pos,
      zh: addition.zh,
      acceptedAnswers,
      exampleFr: preserved.exampleFr ?? fallbackExampleFr,
      exampleZh: preserved.exampleZh ?? fallbackExampleZh,
      usageNote: preserved.usageNote ?? fallbackUsageNote,
      sourcePage: courseAdditions.sourcePage,
      sourceMethod: pdfAdditions.sourceMethod,
      raw: { word: addition.word, pos: addition.pos, zh: addition.zh, pdfTablePosition: addition.position },
      ...preserved,
    });
    course.entryIds.push(id);
  }
}

const courseList = [...courses.values()]
  .map((course) => ({ ...course, wordCount: entries.filter((entry) => entry.courseId === course.id && entry.contentStatus !== "quarantined").length }))
  .sort((a, b) => a.sortOrder - b.sortOrder);

const output = {
  metadata: {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: path.basename(workbookPath),
    sourcePdfs: fs.readdirSync(root).filter((name) => name.toLowerCase().endsWith(".pdf")),
    pdfAdditionManifestVersion: pdfAdditions.version,
    pdfAddedEntries: Object.values(pdfAdditions.courses).reduce((sum, course) => sum + course.entries.length, 0),
    pdfCorrectedEntries: pdfAdditions.corrections.length,
    courseCount: courseList.length,
    entryCount: entries.length,
    approvedExamples: entries.filter((entry) => entry.contentStatus === "approved").length,
    needsReview: entries.filter((entry) => entry.contentStatus === "needs_review").length,
    quarantined: entries.filter((entry) => entry.contentStatus === "quarantined").length,
  },
  courses: courseList,
  entries,
};

fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "vocabulary.json"), JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify(output.metadata, null, 2));
