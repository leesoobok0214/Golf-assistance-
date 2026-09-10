"use client";

import React from "react";
import Link from "next/link";

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary", this.props.label, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page space-y-4">
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-6 text-center">
            <p className="text-lg font-extrabold text-red-800">화면을 표시하지 못했어요</p>
            <p className="mt-2 break-all text-sm font-medium text-red-700">
              {this.state.error.message || "client-side exception"}
            </p>
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              onClick={() => {
                try {
                  localStorage.removeItem("golf-assistant-sw-hard-reset-v4");
                  localStorage.removeItem("golf-assistant-sw-hard-reset-v5");
                } catch {}
                window.location.href = "/";
              }}
            >
              홈으로 새로고침
            </button>
            <Link href="/history" className="btn-secondary mt-2 block text-center">
              기록 다시 열기
            </Link>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
