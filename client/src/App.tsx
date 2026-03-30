import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { bootstrapAuth, logout } from "./app/authSlice";
import UploadPage from "./pages/UploadPage";
import ReportPage from "./pages/ReportPage";
import AuthPage from "./pages/AuthPage";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import PricingPage from "./pages/PricingPage";

export default function App(): JSX.Element {
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const navItems = [
    { to: "/", label: "Home" },
    { to: "/pricing", label: "Pricing" },
    { to: "/reports", label: "Reports" },
    ...(user ? [{ to: "/profile", label: "Profile" }] : [])
  ];

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? "U";
  const planLabel = user?.subscription.plan === "free" ? "Free" : user?.subscription.plan === "team" ? "Team" : "Individual";
  const avatarTone = useMemo(() => {
    const tones = [
      "bg-sky-100 text-sky-700",
      "bg-emerald-100 text-emerald-700",
      "bg-amber-100 text-amber-700",
      "bg-indigo-100 text-indigo-700"
    ];
    return tones[initial.charCodeAt(0) % tones.length];
  }, [initial]);

  useEffect(() => {
    void dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent): void {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setMobileNavOpen(false);
      }
    }

    function onEscClose(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileNavOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscClose);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscClose);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onScroll(): void {
      setIsScrolled(window.scrollY > 8);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <header ref={headerRef} className="sticky top-0 z-40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-100/60 via-sky-100/35 to-emerald-100/40" />
        <div className={`relative border-b border-slate-200/80 bg-white/90 backdrop-blur-xl transition-shadow ${isScrolled ? "shadow-md shadow-slate-200/70" : ""}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-center justify-between py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen((current) => !current)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
                  aria-label="Toggle navigation"
                >
                  <span className="block text-sm leading-none">{mobileNavOpen ? "✕" : "☰"}</span>
                </button>

                <Link
                  to="/"
                  className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                    PL
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">Perf Lens</p>
                    <p className="hidden truncate text-[10px] uppercase tracking-[0.12em] text-slate-500 lg:block">
                      Frontend Performance Ops
                    </p>
                  </div>
                </Link>

                <nav className="hidden items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 md:flex" aria-label="Primary navigation">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                          isActive
                            ? "bg-white text-brand-700 shadow-sm"
                            : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {user ? (
                  <>
                    <Link
                      to="/"
                      className="hidden rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 lg:inline-flex"
                    >
                      Start Analysis
                    </Link>
                    <div className="relative" ref={menuRef}>
                      <button
                        type="button"
                        onClick={() => setMenuOpen((current) => !current)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-2 ring-white ${avatarTone}`}
                        >
                          {initial}
                        </span>
                        <span className="hidden max-w-[130px] truncate text-sm font-semibold text-slate-800 sm:block">
                          {user.name}
                        </span>
                        <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:inline-flex">
                          {planLabel}
                        </span>
                        <span className={`text-xs text-slate-500 transition ${menuOpen ? "rotate-180" : ""}`}>▼</span>
                      </button>

                      {menuOpen ? (
                        <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                          <div className="bg-gradient-to-r from-brand-50 to-sky-50 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-600">{user.email}</p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">{planLabel} Plan</p>
                          </div>
                          <div className="p-2">
                            <Link
                              to="/"
                              onClick={() => setMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                            >
                              Start Analysis
                            </Link>
                            <Link
                              to="/pricing"
                              onClick={() => setMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                            >
                              Pricing and Billing
                            </Link>
                            <Link
                              to="/reports"
                              onClick={() => setMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                            >
                              My Reports
                            </Link>
                            <Link
                              to="/profile"
                              onClick={() => setMenuOpen(false)}
                              className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                            >
                              Profile and Compliance
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                dispatch(logout());
                                setMenuOpen(false);
                                setMobileNavOpen(false);
                              }}
                              className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                            >
                              Logout
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <Link
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                    to="/auth"
                  >
                    Sign In / Create Account
                  </Link>
                )}
              </div>
            </div>
          </div>

          {mobileNavOpen ? (
            <div className="border-t border-slate-200 bg-white/95 px-4 py-3 md:hidden">
              <div className="mx-auto flex max-w-6xl flex-col gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-brand-100 text-brand-700" : "text-slate-700 hover:bg-slate-100"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                {!user ? (
                  <p className="px-3 pt-1 text-xs text-slate-500">Sign in to start analysis and manage report history.</p>
                ) : (
                  <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <p className="px-2 text-xs font-semibold text-slate-600">{user.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(logout());
                        setMobileNavOpen(false);
                      }}
                      className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="mx-auto hidden max-w-6xl items-center justify-between gap-4 px-6 pb-3 pt-1 text-xs text-slate-500 md:flex">
            <p>Static analysis workspace for modern frontend repositories with asynchronous processing and user-scoped report history.</p>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Temporary source processing</span>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">User-scoped reports</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reports" element={user ? <ReportsPage /> : loading ? <p className="text-sm text-slate-600">Loading session...</p> : <Navigate to="/auth" replace />} />
          <Route path="/profile" element={user ? <ProfilePage /> : loading ? <p className="text-sm text-slate-600">Loading session...</p> : <Navigate to="/auth" replace />} />
          <Route
            path="/report/:reportId"
            element={user ? <ReportPage /> : loading ? <p className="text-sm text-slate-600">Loading session...</p> : <Navigate to="/auth" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}
