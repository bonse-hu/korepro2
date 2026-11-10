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
    {
      id: 's1',
      videoId: 'CR3HCCw5t60',
      start: 0,
      end: 6,
      meaning: '大丈夫',
    },
    {
      id: 's2',
      videoId: 'CR3HCCw5t60',
      start: 6,
      end: 12,
      meaning: '可愛い',
    },
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

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.slice(1);
    }

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

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

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
  const [start, setStart] = useState('00:00');
  const [end, setEnd] = useState('00:06');
  const [meaning, setMeaning] = useState('');
  const [edit, setEdit] = useState('');

  const player = useRef<any>(null);
  const mount = useRef<HTMLDivElement>(null);
  const previewPlayer = useRef<any>(null);
  const previewMount = useRef<HTMLDivElement>(null);
  const cur = useRef<Clip | null>(null);
  const active = useRef(false);
  const dataRef = useRef(data);
  const masteredRef = useRef(mastered);
  const poll = useRef<number | undefined>(undefined);

  useEffect(() => {
    dataRef.current = data;
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    masteredRef.current = mastered;
    localStorage.setItem(MASTERED_KEY, JSON.stringify(mastered));
  }, [mastered]);

  useEffect(
    () => () => {
      if (poll.current) {
        window.clearInterval(poll.current);
      }
    },
    [],
  );

  const videoMap = useMemo(
    () => new Map(data.videos.map((item) => [item.videoId, item])),
    [data.videos],
  );

  useEffect(() => {
    if (tab !== 'manage' || !previewMount.current) {
      return;
    }

    let cancelled = false;

    void loadApi().then(() => {
      if (
        cancelled ||
        !previewMount.current ||
        previewPlayer.current
      ) {
        return;
      }

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
      return;
    }

    const time = preview.getCurrentTime();
    (which === 'start' ? setStart : setEnd)(stamp(time));
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

  const nextRandom = () => {
    const eligible = dataRef.current.segments.filter(
      (clip) => !masteredRef.current.includes(clip.id),
    );
    const notCurrent = eligible.filter((clip) => clip.id !== cur.current?.id);

    return notCurrent.length
      ? notCurrent[Math.floor(Math.random() * notCurrent.length)]
      : eligible[0] || null;
  };

  const stop = () => {
    active.current = false;

    if (poll.current) {
      window.clearInterval(poll.current);
    }

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

              if (poll.current) {
                window.clearInterval(poll.current);
              }

              poll.current = window.setInterval(() => {
                const clipNow = cur.current;
                const currentPlayer = player.current;

                if (!active.current || !clipNow || !currentPlayer) {
                  return;
                }

                if (currentPlayer.getCurrentTime() >= clipNow.end - 0.12) {
                  const nextClip = nextRandom();
                  if (nextClip) {
                    void play(nextClip);
                  } else {
                    stop();
                  }
                }
              }, 100);
            }

            if (event.data === 0 && active.current) {
              const nextClip = nextRandom();
              if (nextClip) {
                void play(nextClip);
              } else {
                stop();
              }
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
    } else {
      player.current.loadVideoById({
        videoId: clip.videoId,
        startSeconds: clip.start,
      });
    }
  };

  const startPlay = () => {
    const eligible = data.segments.filter(
      (clip) => !masteredRef.current.includes(clip.id),
    );

    if (!eligible.length) {
      setMessage('未習得のセットがありません。「リセット」で再出題できます。');
      return;
    }

    active.current = true;
    void play(eligible[Math.floor(Math.random() * eligible.length)]);
  };

  const markMastered = () => {
    if (!current) {
      return;
    }

    const updated = [...new Set([...masteredRef.current, current.id])];
    masteredRef.current = updated;
    setMastered(updated);

    const next = dataRef.current.segments.filter(
      (clip) => !updated.includes(clip.id),
    );

    if (next.length) {
      const clip = next[Math.floor(Math.random() * next.length)];

      if (active.current) {
        void play(clip);
      } else {
        setCurrent(clip);
        setMessage('「覚えた」に登録しました');
      }
    } else {
      stop();
      setCurrent(null);
      setMessage('すべて覚えました！「リセット」で再出題できます。');
    }
  };

  const resetMastered = () => {
    if (!masteredRef.current.length) {
      return;
    }

    if (
      confirm(
        '「覚えた」記録をすべてリセットして、全セットを再出題しますか？',
      )
    ) {
      masteredRef.current = [];
      setMastered([]);
      setMessage('「覚えた」記録をリセットしました');
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
        {
          id: id(),
          title: title || 'YouTube動画',
          url,
          videoId,
        },
      ],
    }));

    setVideo(videoId);
    setTitle('');
    setUrl('');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();

    const startSeconds = secs(start);
    const endSeconds = secs(end);

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
        ? currentData.segments.map((item) =>
            item.id === edit ? clip : item,
          )
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
      new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      }),
    );

    anchor.href = objectUrl;
    anchor.download = 'korepro2-backup.json';
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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

  return (
    <div className="app">
      <header>
        <div>
          <small>KOREAN LISTENING PRACTICE</small>
          <h1>
            Korepro<span>2</span>
          </h1>
        </div>
        <b>
          한국어 <i>→</i> 日本語
        </b>
      </header>

      <nav>
        <button
          className={tab === 'learn' ? 'on' : ''}
          onClick={() => setTab('learn')}
        >
          学習する
        </button>
        <button
          className={tab === 'manage' ? 'on' : ''}
          onClick={() => setTab('manage')}
        >
          動画・セット管理
        </button>
      </nav>

      {tab === 'learn' ? (
        <main className="learning">
          <section className="panel">
            <small>RANDOM LISTENING</small>
            <h2>耳で覚える、韓国語。</h2>
            <p>短い音声をランダムに繰り返して表現を身につけましょう。</p>

            <div className="player">
              <div ref={mount} />
            </div>

            <div className="buttons">
              <button
                className="primary"
                disabled={playing}
                onClick={startPlay}
              >
                ▶ ランダム再生スタート
              </button>
              <button onClick={stop} disabled={!playing}>
                ■ 停止
              </button>
            </div>

            <p className="status">{message}</p>
          </section>

          <aside className="panel">
            <small>NOW PLAYING</small>

            {current ? (
              <>
                <p className="muted">日本語の意味</p>
                <h2>{current.meaning || '（意味未登録）'}</h2>
                <p className="time">
                  {stamp(current.start)} — {stamp(current.end)}
                </p>
                <p>{videoMap.get(current.videoId)?.title}</p>
                <button className="primary" onClick={markMastered}>
                  ✓ 覚えた
                </button>
              </>
            ) : (
              <p className="muted">
                再生を開始すると、ここに意味が表示されます。
              </p>
            )}

            <hr />
            <strong className="total">{data.segments.length}</strong>
            <p className="muted">登録済みセット</p>
            <p className="muted">
              覚えた：
              {
                mastered.filter((masteredId) =>
                  data.segments.some((clip) => clip.id === masteredId),
                ).length
              }{' '}
              / {data.segments.length}
            </p>
            <button onClick={resetMastered} disabled={!mastered.length}>
              ↻ 覚えた記録をリセット
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
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例：日常会話"
                />
              </label>
              <label>
                YouTube URL
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </label>
              <button className="primary">動画を追加</button>
            </form>

            {data.videos.map((item) => (
              <p className="row" key={item.id}>
                {item.title}{' '}
                <a href={item.url} target="_blank">
                  YouTubeで開く ↗
                </a>
              </p>
            ))}
          </section>

          <section className="panel">
            <small>2 · LISTENING SET</small>
            <h2>{edit ? 'セットを編集' : '再生セットを登録'}</h2>
            <p className="muted">
              動画を再生し、開始・終了したい位置でボタンを押してください。時刻は自動入力されます（手入力での微調整も可能です）。
            </p>

            <form onSubmit={save}>
              <label>
                対象動画
                <select
                  value={video}
                  onChange={(event) => setVideo(event.target.value)}
                >
                  {data.videos.map((item) => (
                    <option value={item.videoId} key={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="player">
                <div ref={previewMount} />
              </div>

              <div className="fine-controls">
                <span>再生位置の微調整</span>
                <button type="button" onClick={() => nudgePreview(-1)}>
                  −1秒
                </button>
                <button type="button" onClick={() => nudgePreview(-0.5)}>
                  −0.5秒
                </button>
                <button type="button" onClick={() => nudgePreview(0.5)}>
                  ＋0.5秒
                </button>
                <button type="button" onClick={() => nudgePreview(1)}>
                  ＋1秒
                </button>
              </div>

              <div className="two">
                <label>
                  開始時刻
                  <input
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => captureTime('start')}
                  >
                    ▶ 現在位置を開始時刻にする
                  </button>
                </label>

                <label>
                  終了時刻
                  <input
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                  <button type="button" onClick={() => captureTime('end')}>
                    ■ 現在位置を終了時刻にする
                  </button>
                </label>
              </div>

              <label>
                日本語の意味
                <input
                  value={meaning}
                  onChange={(event) => setMeaning(event.target.value)}
                  placeholder="例：大丈夫"
                />
              </label>

              <button className="primary">
                {edit ? '変更を保存' : 'セットを追加'}
              </button>
            </form>
          </section>

          <section className="panel">
            <small>3 · REGISTERED SETS</small>
            <h2>登録済みセット（{data.segments.length}）</h2>

            {data.segments.map((clip, index) => (
              <div className="row" key={clip.id}>
                <div>
                  <b>
                    {index + 1}. {clip.meaning || '意味未登録'}
                  </b>
                  <small>
                    {videoMap.get(clip.videoId)?.title} · {stamp(clip.start)}〜
                    {stamp(clip.end)}
                  </small>
                </div>
                <button
                  onClick={() => {
                    setEdit(clip.id);
                    setVideo(clip.videoId);
                    setStart(String(clip.start));
                    setEnd(String(clip.end));
                    setMeaning(clip.meaning);
                  }}
                >
                  編集
                </button>
                <button
                  onClick={() =>
                    confirm('削除しますか？') &&
                    setData((currentData) => ({
                      ...currentData,
                      segments: currentData.segments.filter(
                        (item) => item.id !== clip.id,
                      ),
                    }))
                  }
                >
                  削除
                </button>
              </div>
            ))}
          </section>

          <section className="panel">
            <small>4 · BACKUP</small>
            <h2>データの引っ越し</h2>
            <p className="muted">
              PCでJSONを書き出し、iPhone側で読み込むと同じ登録内容を使えます。データは端末ごとに保存されます。
            </p>
            <div className="buttons">
              <button onClick={exportJson}>↓ JSONを書き出す</button>
              <label className="file">
                ↑ JSONを読み込む
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={importJson}
                />
              </label>
            </div>
          </section>
        </main>
      )}

      <footer>個人用リスニングツール · データは端末内に保存</footer>
    </div>
  );
}
