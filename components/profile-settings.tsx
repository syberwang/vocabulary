"use client";

import { useApp } from "@/components/app-provider";
import { useSpeech } from "@/hooks/use-speech";

export function ProfileSettings() {
  const { state, setSpeechSettings, resetDemo } = useApp();
  const { voices, speak, supported } = useSpeech();
  return (
    <section className="page-section">
      <h1 className="page-title">我的</h1>
      <p className="page-subtitle">调整发音和学习偏好。配置 Supabase 后，邀请账号会在此显示同步状态。</p>
      <div className="settings-list">
        <div className="setting-row"><strong>当前模式</strong><p>{process.env.NEXT_PUBLIC_SUPABASE_URL ? "云端同步" : "本地演示（进度保存在当前浏览器）"}</p></div>
        <div className="setting-row">
          <label htmlFor="voice">法语音色</label>
          <select id="voice" value={state.voiceUri ?? ""} onChange={(event) => setSpeechSettings(event.target.value || undefined, state.speechRate)} disabled={!supported || !voices.length}>
            {!voices.length && <option value="">未找到法语音色</option>}
            {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
          </select>
          <button className="ghost-button" style={{ marginTop: 10 }} onClick={() => speak("Bonjour, bienvenue dans votre cours de français.")} disabled={!voices.length}>试听音色</button>
        </div>
        <div className="setting-row"><label htmlFor="rate">语速：{state.speechRate === 0.75 ? "慢速" : "正常"}</label><input id="rate" type="range" min="0.75" max="0.9" step="0.15" value={state.speechRate} onChange={(event) => setSpeechSettings(state.voiceUri, Number(event.target.value))} /></div>
        <div className="setting-row"><strong>学习时区</strong><p>{state.timezone}。每天当地零点开启新的课程日期。</p></div>
        <div className="setting-row"><strong>重置演示进度</strong><p>只清除本浏览器的学习记录，不会修改词表或讲义。</p><button className="danger-button" onClick={() => window.confirm("确定清除本地学习进度吗？") && resetDemo()}>清除本地进度</button></div>
      </div>
    </section>
  );
}
