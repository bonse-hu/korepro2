import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type Video = {
  id: string;
  title: string;
  url: string;
  videoId: string;
};

type Clip = {
  id: string;
  videoId: string;
  start: number;
  end: number;
  meaning: string;
};

type Data = {
  version: 1;
  videos: Video[];
  segments: Clip[];
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const KEY = 'korepro2-data-v1';
const MASTERED_KEY = 'korepro2-mastered-v1';

const seed: Data = {
  version: 1,
  videos: [
    {
      id: 'v1',
      title: '韓国語学習用動画',
      url: 'https://www.youtube.com/watch?v=CR3HCCw5t60',
      videoId: 'CR3HCCw5t60',
    },
  ],
  segments: [
    { id: 's1', videoId: 'CR3HCCw5t60', start: 0, end: 6, meaning: '大丈夫' },
    { id: 's2', videoId: 'CR3HCCw5t60', start: 6, end: 12, meaning: '可愛い' },
  ],
};

const loadMastered = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(MASTERED_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const load = (): Data => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (
      value?.version === 1 &&
      Array.isArray(value.videos) &&
      Array.isArray(value.segments)
    ) {
      return value;
    }
  } catch {
    // 保存データが読み込めない場合は初期データを使う
  }
  return seed;
};

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const ytId = (value: string) => {
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
    if (url.hostname.includes('youtube.com')) {
      return (
        url.searchParams.get('v') ||
        (() => {
          const parts = url.pathname.split('/').filter(Boolean);
          return parts[parts.length - 1] || '';
        })()
      );
    }
  } catch {
    // 無効なURL
  }
  return '';
};

const secs = (value: string) => {
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':');
  return parts.length === 2
    ? Number(parts[0]) * 60 + Number(parts[1])
    : Number.NaN;
};

const stamp = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${(value % 60)
    .toFixed(1)
    .padStart(4, '0')}`;

export default function App() {
  const [data, setData] = useState<Data>(load);
  const [mastered, setMastered] = useState<string[]>(loadMastered);
  const [tab, setTab] = useState<'learn' | 'manage'>('learn');
  const [current, setCurrent] = useState<Clip | null>(null);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('再生ボタンを押してください');

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [video, setVideo] = useState('CR3HCCw5t60');
  const [selectedVideo, setSelectedVideo] = useState(
    () => load().videos[0]?.videoId || '',
  );
  const [start, setStart] = useState('00:00');
  const [end, setEnd] = useState('00:06');
  const [meaning, setMeaning] = useState('');
  const [edit, setEdit] = useState('');

  const player = useRef<any>(null);
  const mount = useRef<HTMLDivElement>(null);
  const previewPlayer = useRef<any>(null);
  const previewMount = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLFormElement | null>(null);
  const cur = useRef<Clip | null>(null);
  const active = useRef(false);
  const dataRef = useRef(data);
  const masteredRef = useRef(mastered);
  const poll = useRef<number | undefined>(undefined);

  const stopLearningPlayer = () => {
    active.current = false;
    if (poll.current) window.clearInterval(poll.current);
    poll.current = undefined;
    if (player.current) {
      try {
        player.current.stopVideo?.();
      } catch {
        // プレイヤーがすでに破棄されている場合は無視
      }
      try {
        player.current.destroy?.();
      } catch {
        // プレイヤーがすでに破棄されている場合は無視
      }
      player.current = null;
    }
    setPlaying(false);
  };

  const stopPreviewPlayer = () => {
    if (previewPlayer.current) {
      try {
        previewPlayer.current.stopVideo?.();
      } catch {
        // プレイヤーがすでに破棄されている場合は無視
      }
      try {
        previewPlayer.current.destroy?.();
      } catch {
        // プレイヤーがすでに破棄されている場合は無視
      }
      previewPlayer.current = null;
    }
  };

  useEffect(() => {
    dataRef.current = data;
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    masteredRef.current = mastered;
    localStorage.setItem(MASTERED_KEY, JSON.stringify(mastered));
  }, [mastered]);

  useEffect(() => {
    if (!data.videos.some((item) => item.videoId === selectedVideo)) {
      setSelectedVideo(data.videos[0]?.videoId || '');
    }
    if (!data.videos.some((item) => item.videoId === video)) {
      setVideo(data.videos[0]?.videoId || '');
    }
  }, [data.videos, selectedVideo, video]);

  useEffect(() => {
    if (tab === 'manage') {
      stopLearningPlayer();
    } else {
      stopPreviewPlayer();
    }
  }, [tab]);

  useEffect(
    () => () => {
      if (poll.current) window.clearInterval(poll.current);
      if (player.current) {
        try {
          player.current.stopVideo?.();
        } catch {
          // プレイヤーがすでに破棄されている場合は無視
        }
        try {
          player.current.destroy?.();
        } catch {
          // プレイヤーがすでに破棄されている場合は無視
        }
      }
      if (previewPlayer.current) {
        try {
          previewPlayer.current.stopVideo?.();
        } catch {
          // プレイヤーがすでに破棄されている場合は無視
        }
        try {
          previewPlayer.current.destroy?.();
        } catch {
          // プレイヤーがすでに破棄されている場合は無視
        }
      }
    },
    [],
  );

  const videoMap = useMemo(
    () => new Map(data.videos.map((item) => [item.videoId, item])),
    [data.videos],
  );
  const selectedClips = useMemo(
    () => data.segments.filter((clip) => clip.videoId === selectedVideo),
    [data.segments, selectedVideo],
  );
  const managedClips = useMemo(
    () => data.segments.filter((clip) => clip.videoId === video),
    [data.segments, video],
  );

  useEffect(() => {
    if (tab !== 'manage' || !previewMount.current) return;
    let cancelled = false;
    void loadApi().then(() => {
      if (cancelled || !previewMount.current || previewPlayer.current) return;
      previewPlayer.current = new window.YT.Player(previewMount.current, {
        videoId: video,
        playerVars: { playsinline: 1, rel: 0 },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab === 'manage' && previewPlayer.current && video) {
      previewPlayer.current.cueVideoById(video);
    }
  }, [video, tab]);

  const captureTime = (which: 'start' | 'end') => {
    const preview = previewPlayer.current;
    if (!preview || typeof preview.getCurrentTime !== 'function') {
      alert('動画プレーヤーを準備しています。少し待ってから押してください。');
      return null;
    }
    const time = stamp(preview.getCurrentTime());
    (which === 'start' ? setStart : setEnd)(time);
    return time;
  };

  const playPreview = () => {
    const preview = previewPlayer.current;
    if (!preview || typeof preview.playVideo !== 'function') {
      alert('動画プレーヤーを準備しています。少し待ってから押してください。');
      return;
    }
    preview.playVideo();
  };

  const nudgePreview = (delta: number) => {
    const preview = previewPlayer.current;
    if (
      !preview ||
      typeof preview.getCurrentTime !== 'function' ||
      typeof preview.seekTo !== 'function'
    ) {
      alert('動画プレーヤーを準備しています。少し待ってから押してください。');
      return;
    }
    preview.seekTo(Math.max(0, preview.getCurrentTime() + delta), true);
  };

  const loadApi = () =>
    new Promise<void>((resolve) => {
      if (window.YT?.Player) {
        resolve();
        return;
      }
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve();
      };
      if (!document.querySelector('[data-yt-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.dataset.ytApi = '1';
        document.head.appendChild(script);
      }
    });

  const nextRandom = (videoId: string) => {
    const eligible = dataRef.current.segments.filter(
      (clip) =>
        clip.videoId === videoId && !masteredRef.current.includes(clip.id),
    );
    const notCurrent = eligible.filter((clip) => clip.id !== cur.current?.id);
    return notCurrent.length
      ? notCurrent[Math.floor(Math.random() * notCurrent.length)]
      : eligible[0] || null;
  };

  const stop = () => {
    active.current = false;
    if (poll.current) window.clearInterval(poll.current);
    poll.current = undefined;
    player.current?.stopVideo();
    setPlaying(false);
    setMessage('停止しました');
  };

  const play = async (clip: Clip) => {
    const previous = cur.current;
    cur.current = clip;
    setCurrent(clip);
    setPlaying(true);
    setMessage('動画を読み込んでいます…');
    await loadApi();

    if (!player.current && mount.current) {
      player.current = new window.YT.Player(mount.current, {
        videoId: clip.videoId,
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: (event: any) => {
            const nextClip = cur.current;
            if (nextClip) {
              event.target.loadVideoById({
                videoId: nextClip.videoId,
                startSeconds: nextClip.start,
              });
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              setMessage('再生中');
              if (poll.current) window.clearInterval(poll.current);
              poll.current = window.setInterval(() => {
                const clipNow = cur.current;
                const currentPlayer = player.current;
                if (!active.current || !clipNow || !currentPlayer) return;
                if (currentPlayer.getCurrentTime() >= clipNow.end - 0.12) {
                  const nextClip = nextRandom(clipNow.videoId);
                  if (nextClip) void play(nextClip);
                  else stop();
                }
              }, 100);
            }
            if (event.data === 0 && active.current) {
              const clipNow = cur.current;
              const nextClip = clipNow ? nextRandom(clipNow.videoId) : null;
              if (nextClip) void play(nextClip);
              else stop();
            }
          },
          onError: () => {
            setMessage('動画を再生できません。埋め込み可能な動画か確認してください。');
            setPlaying(false);
          },
        },
      });
    } else if (previous?.videoId === clip.videoId) {
      player.current.seekTo(clip.start, true);
      player.current.playVideo();
    } else if (player.current) {
      player.current.loadVideoById({
        videoId: clip.videoId,
        startSeconds: clip.start,
      });
    }
  };

  const selectLearningVideo = (videoId: string) => {
    active.current = false;
    if (poll.current) window.clearInterval(poll.current);
    poll.current = undefined;
    player.current?.stopVideo();
    cur.current = null;
    setCurrent(null);
    setPlaying(false);
    setSelectedVideo(videoId);
    setMessage('選択した動画のタイムスタンプを再生します');
  };

  const startPlay = () => {
    const eligible = selectedClips.filter(
      (clip) => !masteredRef.current.includes(clip.id),
    );
    if (!eligible.length) {
      setMessage(
        selectedClips.length
          ? 'この動画の未習得セットがありません。「リセット」で再出題できます。'
          : 'この動画にはタイムスタンプがありません。「動画・セット管理」から登録してください。',
      );
      return;
    }
    active.current = true;
    void play(eligible[Math.floor(Math.random() * eligible.length)]);
  };

  const markMastered = () => {
    if (!current) return;
    const updated = [...new Set([...masteredRef.current, current.id])];
    masteredRef.current = updated;
    setMastered(updated);
    const next = dataRef.current.segments.filter(
      (clip) => clip.videoId === current.videoId && !updated.includes(clip.id),
    );
    if (next.length) {
      const clip = next[Math.floor(Math.random() * next.length)];
      if (active.current) void play(clip);
      else {
        cur.current = clip;
        setCurrent(clip);
        setMessage('「覚えた」に登録しました');
      }
    } else {
      stop();
      cur.current = null;
      setCurrent(null);
      setMessage('この動画のセットをすべて覚えました！「リセット」で再出題できます。');
    }
  };

  const resetMastered = () => {
    const selectedIds = new Set(selectedClips.map((clip) => clip.id));
    if (!masteredRef.current.some((masteredId) => selectedIds.has(masteredId))) return;
    if (confirm('選択中の動画の「覚えた」記録をリセットしますか？')) {
      const updated = masteredRef.current.filter(
        (masteredId) => !selectedIds.has(masteredId),
      );
      masteredRef.current = updated;
      setMastered(updated);
      setMessage('選択中の動画の「覚えた」記録をリセットしました');
    }
  };

  const addVideo = (event: FormEvent) => {
    event.preventDefault();
    const videoId = ytId(url);
    if (!videoId) {
      alert('YouTube URLを確認してください');
      return;
    }
    setData((currentData) => ({
      ...currentData,
      videos: [
        ...currentData.videos.filter((item) => item.videoId !== videoId),
        { id: id(), title: title || 'YouTube動画', url, videoId },
      ],
    }));
    setVideo(videoId);
    setTitle('');
    setUrl('');
  };

  const save = (event?: FormEvent, capturedEnd?: string) => {
    event?.preventDefault();
    const startSeconds = secs(start);
    const endSeconds = secs(capturedEnd ?? end);
    if (
      !video ||
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      startSeconds < 0 ||
      endSeconds <= startSeconds
    ) {
      alert('動画と時刻を確認してください');
      return;
    }
    const clip: Clip = {
      id: edit || id(),
      videoId: video,
      start: startSeconds,
      end: endSeconds,
      meaning,
    };
    setData((currentData) => ({
      ...currentData,
      segments: edit
        ? currentData.segments.map((item) => (item.id === edit ? clip : item))
        : [...currentData.segments, clip],
    }));
    setEdit('');
    setMeaning('');
    setStart('00:00');
    setEnd('00:06');
  };

  const exportJson = () => {
    const anchor = document.createElement('a');
    const objectUrl = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );

    anchor.href = objectUrl;
    anchor.download = 'korepro2-backup.json';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (
        imported.version !== 1 ||
        !Array.isArray(imported.videos) ||
        !Array.isArray(imported.segments)
      ) {
        throw new Error('Invalid backup file');
      }
      if (confirm('現在のデータを読み込む内容で置き換えますか？')) {
        setData(imported);
      }
    } catch {
      alert('JSONを読み込めませんでした');
    }
    event.target.value = '';
  };

  const beginEdit = (clip: Clip) => {
    setEdit(clip.id);
    setVideo(clip.videoId);
    setStart(String(clip.start));
    setEnd(String(clip.end));
    setMeaning(clip.meaning);

    window.requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const learnedCount = selectedClips.filter((clip) =>
    mastered.includes(clip.id),
  ).length;

  return (
    <div className="app">
      <header>
        <div>
          <small>KOREAN LISTENING PRACTICE</small>
          <h1>Korepro<span>2</span></h1>
        </div>
        <b>한국어 <i>→</i> 日本語</b>
      </header>

      <nav>
        <button className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}>
          学習する
        </button>
        <button className={tab === 'manage' ? 'on' : ''} onClick={() => setTab('manage')}>
          動画・セット管理
        </button>
      </nav>

      {tab === 'learn' ? (
        <main className="learning">
          <section className="panel">
            <small>VIDEO-SPECIFIC LISTENING</small>
            <h2>耳で覚える、韓国語。</h2>
            <p>動画を選ぶと、その動画専用のタイムスタンプリストだけを再生します。</p>
            <label>
              学習する動画
              <select
                value={selectedVideo}
                onChange={(event) => selectLearningVideo(event.target.value)}
                disabled={!data.videos.length}
              >
                {data.videos.map((item) => (
                  <option value={item.videoId} key={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
            <p className="muted">
              {videoMap.get(selectedVideo)?.title || '動画が登録されていません'} · タイムスタンプ {selectedClips.length}件
            </p>
            <div className="player"><div ref={mount} /></div>
            <div className="buttons">
              <button className="primary" disabled={playing || !selectedVideo} onClick={startPlay}>
                ▶ この動画のリストをランダム再生
              </button>
              <button onClick={stop} disabled={!playing}>■ 停止</button>
              <button onClick={markMastered} disabled={!current}>覚えた</button>
            </div>
            <p className="status">{message}</p>
          </section>

          <aside className="panel">
            <small>SELECTED VIDEO LIST</small>
            <h2>{videoMap.get(selectedVideo)?.title || '動画を選択してください'}</h2>
            {selectedClips.length ? (
              selectedClips.map((clip, index) => (
                <div className="row" key={clip.id}>
                  <div>
                    <b>{index + 1}. {clip.meaning || '意味未登録'}</b>
                    <small>{stamp(clip.start)}〜{stamp(clip.end)}</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">この動画にはタイムスタンプがありません。</p>
            )}
            <hr />
            <strong className="total">{selectedClips.length}</strong>
            <p className="muted">この動画の登録済みセット</p>
            <p className="muted">覚えた：{learnedCount} / {selectedClips.length}</p>
            <button
              onClick={resetMastered}
              disabled={!selectedClips.some((clip) => mastered.includes(clip.id))}
            >
              ↻ この動画の「覚えた」記録をリセット
            </button>
          </aside>
        </main>
      ) : (
        <main className="manage">
          <section className="panel">
            <small>1 · VIDEO</small>
            <h2>YouTube動画を登録</h2>
            <form onSubmit={addVideo}>
              <label>
                動画タイトル
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例：日常会話" />
              </label>
              <label>
                YouTube URL
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." required />
              </label>
              <button className="primary">動画を追加</button>
            </form>
            {data.videos.map((item) => (
              <p className="row" key={item.id}>
                {item.title}{' '}<a href={item.url} target="_blank" rel="noreferrer">YouTubeで開く ↗</a>
              </p>
            ))}
          </section>

          <section className="panel">
            <small>2 · LISTENING SET</small>
            <h2>{edit ? 'セットを編集' : '再生セットを登録'}</h2>
            <p className="muted">タイムスタンプは選択したYouTube動画だけに紐づきます。</p>
            <form ref={editFormRef} onSubmit={save}>
              <label>
                対象動画
                <select value={video} onChange={(event) => setVideo(event.target.value)} disabled={!data.videos.length}>
                  {data.videos.map((item) => (
                    <option value={item.videoId} key={item.id}>{item.title}</option>
                  ))}
                </select>
              </label>
              <div className="player"><div ref={previewMount} /></div>
              <div className="fine-controls">
                <span>動画の再生操作</span>
                <button type="button" onClick={playPreview}>▶ 再生</button>
                <button type="button" onClick={() => nudgePreview(-3)}>↶ 3秒戻る</button>
                <button type="button" onClick={() => nudgePreview(-0.5)}>−0.5秒</button>
                <button type="button" onClick={() => nudgePreview(0.5)}>＋0.5秒</button>
                <button type="button" onClick={() => nudgePreview(1)}>＋1秒</button>
              </div>
              <div className="two">
                <label>
                  開始時刻
                  <input value={start} onChange={(event) => setStart(event.target.value)} />
                  <button type="button" onClick={() => captureTime('start')}>▶ 現在位置を開始時刻にする</button>
                </label>
                <label>
                  終了時刻
                  <input value={end} onChange={(event) => setEnd(event.target.value)} />
                  <button type="button" onClick={() => {
                    const capturedEnd = captureTime('end');
                    if (capturedEnd !== null) save(undefined, capturedEnd);
                  }}>■ 現在位置を終了時刻にする</button>
                </label>
              </div>
              <label>
                日本語の意味
                <input value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="例：大丈夫" />
              </label>
              <button className="primary" disabled={!video}>{edit ? '変更を保存' : 'セットを追加'}</button>
            </form>
          </section>

          <section className="panel">
            <small>3 · REGISTERED SETS</small>
            <label>
              表示する動画のリスト
              <select value={video} onChange={(event) => setVideo(event.target.value)}>
                {data.videos.map((item) => (
                  <option value={item.videoId} key={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
            <h2>登録済みセット（{managedClips.length}）</h2>
            {managedClips.map((clip, index) => (
              <div className="row" key={clip.id}>
                <div>
                  <b>{index + 1}. {clip.meaning || '意味未登録'}</b>
                  <small>{videoMap.get(clip.videoId)?.title} · {stamp(clip.start)}〜{stamp(clip.end)}</small>
                </div>
                <button onClick={() => beginEdit(clip)}>編集</button>
                <button onClick={() => confirm('削除しますか？') && setData((currentData) => ({
                  ...currentData,
                  segments: currentData.segments.filter((item) => item.id !== clip.id),
                }))}>削除</button>
              </div>
            ))}
            {!managedClips.length && <p className="muted">この動画にはセットがありません。</p>}
          </section>

          <section className="panel">
            <small>4 · BACKUP</small>
            <h2>データの引っ越し</h2>
            <p className="muted">データは端末内に保存され、自動同期は行いません。PCでJSONを書き出し、iPhone側で読み込むことで手動で同じ登録内容を使えます。</p>
            <div className="buttons">
              <button onClick={exportJson}>↓ JSONを書き出す</button>
              <label className="file">
                ↑ JSONを読み込む
                <input type="file" accept=".json,application/json" onChange={importJson} />
              </label>
            </div>
          </section>
        </main>
      )}
      <footer>個人用リスニングツール · データは端末内に保存</footer>
    </div>
  );
}
