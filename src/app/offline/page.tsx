export default function OfflinePage() {
  return (
    <main className="page flex flex-col items-center justify-center gap-3 pt-24 text-center">
      <p className="text-4xl" aria-hidden>
        ⛳
      </p>
      <h1 className="text-xl font-extrabold text-golf-900">오프라인입니다</h1>
      <p className="text-sm text-golf-500">
        네트워크에 연결되면 다시 시도해 주세요.
        <br />
        이미 저장된 라운드는 기기에서 볼 수 있어요.
      </p>
    </main>
  );
}
