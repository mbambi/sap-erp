import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useLocation } from "react-router-dom";

interface OnlineUser {
  id: string;
  userId: string;
  userName: string;
  currentPage?: string;
  role?: string;
  lastSeen: string;
}

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

export default function CollaborationPanel() {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();

  const { data: presenceData, refetch: refetchPresence } = useQuery({
    queryKey: ["collaboration-online"],
    queryFn: () =>
      api.get<{ users: OnlineUser[]; count: number }>("/collaboration/online"),
    refetchInterval: 30_000,
  });

  const { data: activityData = [] } = useQuery({
    queryKey: ["collaboration-activity"],
    queryFn: () => api.get<ActivityItem[]>("/collaboration/activity"),
    refetchInterval: 30_000,
    enabled: expanded,
  });

  const heartbeat = useCallback(() => {
    if (!user) return;
    api.post("/collaboration/heartbeat", {
      currentPage: location.pathname,
      currentAction: undefined,
    }).catch(() => {});
  }, [user, location.pathname]);

  useEffect(() => {
    heartbeat();
    const id = setInterval(heartbeat, 60_000);
    return () => clearInterval(id);
  }, [heartbeat]);

  const onlineCount = presenceData?.count ?? presenceData?.users?.length ?? 0;
  const onlineUsers = presenceData?.users ?? [];
  const activities = (activityData as ActivityItem[]).slice(0, 10);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="flex flex-col items-end gap-2">
        {expanded && (
          <div className="card w-80 max-h-[400px] overflow-hidden shadow-lg flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Online ({onlineCount})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-2">
                {onlineUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No other users online
                  </p>
                ) : (
                  onlineUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                        {u.userName?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {u.userName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.currentPage ?? "—"} {u.role && `• ${u.role}`}
                        </p>
                      </div>
                      {u.role && (
                        <span className="badge badge-blue text-xs">{u.role}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="border-t p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Activity Feed
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {activities.length === 0 ? (
                    <p className="text-xs text-gray-400">No recent activity</p>
                  ) : (
                    activities.map((a) => (
                      <div key={a.id} className="text-xs">
                        <span className="font-medium text-gray-700">{a.userName}</span>
                        <span className="text-gray-500"> {a.action}</span>
                        {a.entityType && (
                          <span className="text-gray-400">
                            {" "}{a.entityType} {a.entityId}
                          </span>
                        )}
                        <p className="text-gray-400 truncate">
                          {new Date(a.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 transition-all"
          aria-label={expanded ? "Collapse panel" : "Expand collaboration panel"}
        >
          <div className="relative">
            <Users className="w-5 h-5 text-gray-600" />
            {onlineCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary-600 text-white text-xs font-medium rounded-full">
                {onlineCount > 99 ? "99+" : onlineCount}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>
    </div>
  );
}
