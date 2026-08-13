import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "vocabulary.json");
const outputDir = path.join(root, "data", "content-courses");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const args = process.argv.slice(2);
const courseArg = args.indexOf("--course");
const requestedCourse = courseArg >= 0 ? args[courseArg + 1] : null;
const runAll = args.includes("--all");
if (!runAll && !requestedCourse) {
  throw new Error("用法：node scripts/generate-course-content.mjs --course a1-u1l1，或使用 --all。");
}

const specificUsage = new Map(Object.entries({
  "à": "à 可表示地点、方向或间接宾语；与 le / les 连用时缩合为 au / aux。",
  "avoir": "avoir 表示“有”，也用于年龄和多种固定表达。",
  "avec": "avec 表示伴随、工具或具有某种特征。",
  "ce": "ce 可作指示代词，也出现在 c'est 和 ce sont 中。",
  "dans": "dans 表示在某个空间内部，也可表示“在……之后”的时间。",
  "de": "de 可表示所属、来源或内容；与 le / les 缩合为 du / des。",
  "elle": "elle 作阴性第三人称单数主语。",
  "en": "en 可表示地点、方式或材料，也可替代 de + 名词。",
  "et": "et 连接两个并列的词、短语或分句。",
  "être": "être 用于说明身份、性质或状态；现在时变位需要单独记忆。",
  "il": "il 作阳性第三人称单数主语，也用于无人称结构。",
  "je": "je 作第一人称单数主语；元音或哑音 h 前省音为 j'。",
  "ma": "ma 修饰单数阴性名词；元音或哑音 h 前通常改用 mon。",
  "mon": "mon 修饰单数阳性名词，也用于元音或哑音 h 开头的阴性名词前。",
  "non": "non 用于否定回答；句内否定通常使用 ne ... pas。",
  "ou": "ou 表示选择，意为“或者”；不要与 où（哪里）混淆。",
  "oui": "oui 用于肯定回答；反驳否定问句时常用 si。",
  "qui": "qui 可询问人，也可作关系代词并在从句中充当主语。",
  "s'il vous plaît": "礼貌请求时使用；熟人单数形式是 s'il te plaît。",
  "tu": "tu 用于熟人、朋友或儿童之间的单数非正式称呼。",
  "voici": "voici 用于介绍眼前的人或事物，后面可直接接名词或代词。",
  "vous": "vous 可表示复数“你们”，也可作为单数礼貌称呼“您”。",
}));

const commonExamples = new Map(Object.entries({
  "à": ["Je vais à Paris.", "我去巴黎。"],
  "avec": ["Je viens avec Marie.", "我和玛丽一起来。"],
  "ce": ["Qu'est-ce que c'est ?", "这是什么？"],
  "dans": ["Le livre est dans le sac.", "书在包里。"],
  "de": ["C'est le livre de Paul.", "这是保罗的书。"],
  "elle": ["Elle habite à Paris.", "她住在巴黎。"],
  "en": ["Elle habite en France.", "她住在法国。"],
  "et": ["Paul et Marie arrivent.", "保罗和玛丽到了。"],
  "il": ["Il est étudiant.", "他是大学生。"],
  "je": ["Je parle français.", "我说法语。"],
  "ma": ["Voici ma carte.", "这是我的卡片。"],
  "mon": ["Voici mon livre.", "这是我的书。"],
  "non": ["Non, je ne suis pas français.", "不，我不是法国人。"],
  "ou": ["Tu veux du thé ou du café ?", "你想喝茶还是咖啡？"],
  "oui": ["Oui, je comprends.", "是的，我明白。"],
  "qui": ["Qui est cette femme ?", "这位女士是谁？"],
  "s'il vous plaît": ["Un café, s'il vous plaît.", "请给我一杯咖啡。"],
  "tu": ["Tu habites à Montréal ?", "你住在蒙特利尔吗？"],
  "voici": ["Voici mon professeur.", "这是我的老师。"],
  "vous": ["Vous parlez français ?", "您说法语吗？"],
}));

// 首课作为内容风格基准，逐条写成可直接教学的自然例句。
const entryExamples = new Map([
  [15, ["Paul est Français.", "保罗是法国人。"]],
  [17, ["Ce restaurant est italien.", "这是一家意大利餐厅。"]],
  [18, ["Luca est Italien.", "卢卡是意大利人。"]],
  [21, ["Bonjour, madame.", "您好，女士。"]],
  [22, ["C'est mon mari.", "这是我的丈夫。"]],
  [24, ["Bonjour, monsieur.", "您好，先生。"]],
  [25, ["Quelle est votre nationalité ?", "您的国籍是什么？"]],
  [26, ["Mon nom est Martin.", "我姓马丁。"]],
  [29, ["Mon prénom est Léa.", "我叫蕾雅。"]],
]);

function firstGloss(value) {
  return String(value).split(/[；;,，。！？]/)[0].replace(/^\[[^\]]+\]/, "").trim();
}

function candidateForms(entry) {
  const values = [...(entry.acceptedAnswers ?? []), entry.word]
    .flatMap((value) => String(value).split(/\s+\/\s+/))
    .map((value) => value.replace(/[’]/g, "'").replace(/\[[^\]]+\]/g, "").trim())
    .filter((value) => value && !/[()]/.test(value));
  return [...new Set(values)].sort((a, b) => a.length - b.length);
}

function usageFor(entry) {
  const key = candidateForms(entry)[0]?.toLocaleLowerCase("fr-FR");
  if (specificUsage.has(key)) return specificUsage.get(key);
  const pos = entry.pos.toLocaleLowerCase("fr-FR");
  if (pos.includes("n.m.pl")) return "阳性复数名词；注意其单数形式和复数词尾。";
  if (pos.includes("n.f.pl")) return "阴性复数名词；注意其单数形式和复数词尾。";
  if (pos.includes("n.m") || pos === "m.") return "阳性名词；记忆时同时记住冠词 un / le。";
  if (pos.includes("n.f") || pos === "f.") return "阴性名词；记忆时同时记住冠词 une / la。";
  if (pos.startsWith("n.") || pos === "n") return "名词；注意阴阳性以及括号中给出的词形变化。";
  if (pos.includes("v.pr")) return "代词式动词；变位时自反代词要与主语配合。";
  if (pos.includes("v.t")) return "及物动词；通常需要直接宾语来补充动作对象。";
  if (pos.includes("v.i")) return "不及物动词；结合完整句子记忆其常用搭配。";
  if (pos.startsWith("v")) return "动词；结合主语和时态一起练习变位。";
  if (pos.includes("adj.poss")) return "主有形容词；形式取决于后接名词的性和数。";
  if (pos.startsWith("adj")) return "形容词；通常要与所修饰名词保持性数一致。";
  if (pos.includes("adv")) return "副词；注意它在句中的位置以及所修饰的成分。";
  if (pos.includes("prép")) return "介词；与后面的名词或代词构成介词短语。";
  if (pos.includes("pron")) return "代词；结合它在句中的语法功能整体记忆。";
  if (pos.includes("conj")) return "连词；用于连接词、短语或分句。";
  if (pos.includes("interj")) return "感叹词；常单独使用，语气取决于具体情境。";
  return "常用词或固定表达；建议结合整句和具体语境记忆。";
}

function fallbackFor(entry) {
  const form = candidateForms(entry)[0] ?? entry.word;
  const key = form.toLocaleLowerCase("fr-FR");
  const curated = entryExamples.get(entry.sourceRow) ?? commonExamples.get(key);
  if (curated) return { content: curated, risk: "medium" };
  const gloss = firstGloss(entry.zh);
  const pos = entry.pos.toLocaleLowerCase("fr-FR");
  if (pos.includes("n.pr")) return { content: [`Je connais ${form}.`, `我知道${gloss}。`], risk: "high" };
  if (pos.includes("n.f.pl") || pos.includes("n.m.pl")) return { content: [`Voici des ${form}.`, `这里有一些${gloss}。`], risk: "high" };
  if (pos.includes("n.f") || pos === "f.") return { content: [`Voici une ${form}.`, `这里有一个${gloss}。`], risk: "high" };
  if (pos.includes("n.m") || pos === "m.") return { content: [`Voici un ${form}.`, `这里有一个${gloss}。`], risk: "high" };
  if (pos.startsWith("n")) return { content: [`C'est ${form}.`, `这是${gloss}。`], risk: "high" };
  if (pos.startsWith("v")) return { content: [`On peut ${form} ici.`, `在这里可以${gloss}。`], risk: "high" };
  if (pos.startsWith("adj")) return { content: [`C'est ${form}.`, `这是${gloss}的。`], risk: "high" };
  if (pos.includes("adv")) return { content: [`Il répond ${form}.`, `他${gloss}回答。`], risk: "high" };
  if (pos.includes("interj")) return { content: [`« ${form} ! » dit Léa.`, `蕾雅说：“${gloss}！”`], risk: "high" };
  return { content: [`Léa dit : « ${form}. »`, `蕾雅说：“${gloss}。”`], risk: "high" };
}

function generateEntry(entry) {
  if (entry.contentStatus === "approved") {
    return {
      entryId: entry.id,
      exampleFr: entry.exampleFr,
      exampleZh: entry.exampleZh,
      usageNote: entry.usageNote,
      risk: "low",
      status: "approved",
      source: { kind: "manual", label: "讲义校订" },
    };
  }
  const { content: [exampleFr, exampleZh], risk } = fallbackFor(entry);
  return {
    entryId: entry.id,
    exampleFr,
    exampleZh,
    usageNote: usageFor(entry),
    risk,
    status: "needs_review",
    source: { kind: "codex", label: "Codex 课程草稿" },
  };
}

fs.mkdirSync(outputDir, { recursive: true });
const courses = runAll ? data.courses : data.courses.filter((course) => course.id === requestedCourse);
if (!courses.length) throw new Error(`未找到课程：${requestedCourse}`);

for (const course of courses) {
  const entries = data.entries.filter((entry) => entry.courseId === course.id && entry.contentStatus !== "quarantined");
  const outputPath = path.join(outputDir, `${course.id}.json`);
  const generated = entries.map(generateEntry);
  const payload = {
    courseId: course.id,
    generatedAt: new Date().toISOString(),
    generator: "codex-course-v1-local",
    entries: generated,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const approved = generated.filter((entry) => entry.status === "approved").length;
  const drafts = generated.length - approved;
  console.log(`完成 ${course.id}：${generated.length} 词（已校订 ${approved}，Codex 草稿 ${drafts}）`);
}
