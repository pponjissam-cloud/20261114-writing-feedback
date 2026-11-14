import { NavLink, Navigate, Outlet, createBrowserRouter, RouterProvider, useLocation } from "react-router";
import { History, Moon, PenLine, Settings, Sun } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";
import { useTheme } from "@/hooks/useTheme";
import { MOCK_MODE } from "@/lib/llm/gemini";
import { QuotaBadge } from "@/components/QuotaBadge";
import { Button } from "@/components/ui/button";
import { WritePage } from "@/pages/Write";
import { ReportPage } from "@/pages/Report";
import { HistoryPage } from "@/pages/History";
import { SettingsPage } from "@/pages/Settings";
import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors", isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground");

function Layout() {
  const { keyHash } = useApiKey();
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-1.5 font-bold">
            <span className="grid size-7 place-items-center rounded-md bg-redpen text-white">
              <PenLine className="size-4" aria-hidden />
            </span>
            빨간펜 에세이 코치
          </NavLink>
          <nav className="flex gap-1" aria-label="주 메뉴">
            <NavLink to="/" end className={navClass}>
              <PenLine className="size-4" aria-hidden /> 글쓰기
            </NavLink>
            <NavLink to="/history" className={navClass}>
              <History className="size-4" aria-hidden /> 내 기록
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              <Settings className="size-4" aria-hidden /> 설정
            </NavLink>
          </nav>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={toggle} aria-label={theme === "dark" ? "밝은 화면" : "어두운 화면"}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
        <div className="border-t bg-muted/50">
          <QuotaBadge keyHash={keyHash} className="mx-auto max-w-5xl px-4 py-1.5" />
        </div>
        {MOCK_MODE && (
          <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
            모의(MOCK) 모드 — 실제 AI를 호출하지 않으며 사용량이 차감되지 않아요.
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

/** 첫 실행(키 없음) 시 설정 화면으로 보낸다 */
function RequireKey({ children }: { children: React.ReactNode }) {
  const { apiKey } = useApiKey();
  const location = useLocation();
  if (!MOCK_MODE && !apiKey) return <Navigate to="/settings" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: "/", element: <RequireKey><WritePage /></RequireKey> },
        { path: "/report/:id", element: <ReportPage /> },
        { path: "/history", element: <HistoryPage /> },
        { path: "/settings", element: <SettingsPage /> },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

export function App() {
  return <RouterProvider router={router} />;
}
