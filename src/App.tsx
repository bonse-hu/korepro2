  const captureTime = (which: 'start' | 'end', offsetSeconds = 0) => {
    const preview = previewPlayer.current;
    if (!preview || typeof preview.getCurrentTime !== 'function') {
      alert('動画プレーヤーを準備しています。少し待ってから押してください。');
      return null;
    }
    const raw = Math.max(0, preview.getCurrentTime() + offsetSeconds);
    const time = stamp(raw);
    (which === 'start' ? setStart : setEnd)(time);
    return time;
  };
