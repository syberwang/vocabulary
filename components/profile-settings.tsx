"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { useSpeech } from "@/hooks/use-speech";

export function ProfileSettings() {
  const { state, setSpeechSettings } = useApp();
  const { speakSample, localSpeak, hasFrenchVoice, supported, speechState, speechError } = useSpeech();
  const speaking = speechState === "loading" || speechState === "playing";

  return (
    <section className="page-section">
      <h1 className="page-title">我的</h1>
      <p className="page-subtitle">调整法语发音和学习偏好。学习进度保存在你服务器上的 PostgreSQL 数据库中。</p>
      <div className="settings-list">
        <div className="setting-row"><strong>当前模式</strong><p>自有服务器同步 · 单用户账号</p></div>
        <div className="setting-row">
          <strong>标准法语音色</strong>
          <p>Azure Speech · 法国法语（fr-FR）</p>
          <button className="ghost-button" style={{ marginTop: 10 }} onClick={() => speakSample()} disabled={speaking}>试听标准发音</button>
          {speechError && <p className="example-zh" role="status" style={{ marginTop: 10 }}>{speechError}</p>}
          {supported && hasFrenchVoice && <button className="ghost-button" style={{ marginTop: 10 }} onClick={() => localSpeak("Bonjour, bienvenue dans votre cours de français.")}>使用设备本地发音（备用）</button>}
          {supported && !hasFrenchVoice && <p className="example-zh" style={{ marginTop: 10 }}>设备未安装法语本地音色；标准发音不依赖设备音色。</p>}
        </div>
        <div className="setting-row"><label htmlFor="rate">语速：{state.speechRate === 0.75 ? "慢速" : "正常"}</label><input id="rate" type="range" min="0.75" max="0.9" step="0.15" value={state.speechRate} onChange={(event) => setSpeechSettings(Number(event.target.value))} /></div>
        <div className="setting-row"><strong>学习时区</strong><p>{state.timezone}。每天当地零点开启新的课程日期。</p></div>
        <div className="setting-row"><strong>内容后台</strong><p>添加阶段、课程和单词，或审核已有词条。</p><Link className="ghost-button" href="/admin">打开内容后台</Link></div>
        <div className="setting-row"><strong>退出账号</strong><p>退出只会清除当前浏览器的登录会话，不会删除 PostgreSQL 中的学习记录。</p><form action="/auth/signout" method="post"><button className="danger-button" type="submit">退出登录</button></form></div>
      </div>
    </section>
  );
}
