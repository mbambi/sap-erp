import {
  Menu, Bell, Search, LogOut, User, HelpCircle, Settings,
  X, Check, CheckCheck, Package, ShoppingCart, Users as UsersIcon,
  FileText, Truck, ChevronRight, Trash2,
} from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notifications";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface Props {
  onMenuClick: () => void;
}

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

const typeIcons: Record<string, React.ElementType> = {
  material: Package,
  customer: UsersIcon,
  vendor: Truck,
  sales_order: ShoppingCart,
  purchase_order: FileText,
  employee: User,
};

const typeLabels: Record<string, string> = {
  material: "Material",
  customer: "Customer",
  vendor: "Vendor",
  sales_order: "Sales Order",
  purchase_order: "Purchase Order",
  employee: "Employee",
};

export default function Header({ onMenuClick }: Props) {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllRead, deleteNotification } = useNotificationStore();
  const navigate = useNavigate();

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowProfile(false);
        setShowNotifications(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get("/search", { q: query });
      setSearchResults(res.results || []);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleSearchResultClick = (result: SearchResult) => {
    navigate(result.link);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    if (!notif.isRead) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
    setShowNotifications(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="lg:hidden btn-icon" aria-label="Toggle menu">
            <Menu className="w-5 h-5" />
          </button>

          <div ref={searchRef} className="relative">
            <button
              onClick={() => {
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-72 hover:bg-gray-150 transition-colors"
            >
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400 flex-1 text-left">Search anything...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 bg-white rounded border">
                Ctrl+K
              </kbd>
            </button>

            {showSearch && (
              <div className="absolute top-0 left-0 w-[480px] bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search materials, orders, customers, vendors..."
                    className="flex-1 text-sm outline-none placeholder:text-gray-400"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="p-0.5 hover:bg-gray-100 rounded">
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>

                {searchLoading && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Searching...
                  </div>
                )}

                {!searchLoading && searchResults.length > 0 && (
                  <div className="max-h-80 overflow-y-auto py-1">
                    {searchResults.map((result) => {
                      const Icon = typeIcons[result.type] || FileText;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                            <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase flex-shrink-0">
                            {typeLabels[result.type] || result.type}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    No results found for "{searchQuery}"
                  </div>
                )}

                {!searchLoading && searchQuery.length < 2 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="sm:hidden btn-icon" onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}>
            <Search className="w-5 h-5 text-gray-500" />
          </button>

          <button className="btn-icon relative" aria-label="Help" title="Help & Tutorials"
            onClick={() => navigate("/learning")}>
            <HelpCircle className="w-5 h-5 text-gray-500" />
          </button>

          <div className="relative" ref={notifRef}>
            <button
              className="btn-icon relative"
              aria-label="Notifications"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5 text-gray-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 bg-white border rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                          notif.isRead ? "bg-white hover:bg-gray-50" : "bg-blue-50/50 hover:bg-blue-50"
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          notif.isRead ? "bg-transparent" : "bg-primary-600"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${notif.isRead ? "text-gray-700" : "text-gray-900 font-medium"}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatTime(notif.createdAt)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.roles?.[0]}</p>
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-64 bg-white border rounded-xl shadow-2xl py-1 z-50">
                <div className="px-4 py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {user?.tenantName} &middot; {user?.roles?.join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => { navigate("/profile"); setShowProfile(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User className="w-4 h-4" /> My Profile
                </button>
                <button
                  onClick={() => { navigate("/profile/settings"); setShowProfile(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSearch && (
        <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setShowSearch(false)} />
      )}
    </>
  );
}
