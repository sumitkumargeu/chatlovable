import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatUserId, initialsFor, toMessageTimeLabel } from '@/hooks/useAdminChat';

interface UsersListProps {
  groupedUsers: Map<string, { count: number; lastTime: number }>;
  selectedUser: string;
  unread: Record<string, number>;
  onSelectUser: (uid: string) => void;
  isCollapsed?: boolean;
}

export const UsersList = ({
  groupedUsers,
  selectedUser,
  unread,
  onSelectUser,
  isCollapsed,
}: UsersListProps) => {
  // Sort users by lastTime descending
  const users = Array.from(groupedUsers.entries())
    .sort(([, a], [, b]) => b.lastTime - a.lastTime)
    .map(([uid]) => uid);

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
        No users yet
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col gap-2 p-3 overflow-y-auto scrollbar-thin h-full",
      isCollapsed && "flex-row overflow-x-auto overflow-y-hidden"
    )}>
      {users.map((uid) => {
        const userData = groupedUsers.get(uid);
        const isActive = uid === selectedUser;
        const unreadCount = unread[uid] || 0;

        return (
          <motion.div
            key={uid}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectUser(uid)}
            className={cn(
              "flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors border border-transparent",
              "hover:bg-panel-secondary/60",
              isActive && "bg-panel-secondary/70 border-line",
              isCollapsed && "flex-shrink-0"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-sm bg-primary/35 border border-line flex-shrink-0">
                {initialsFor(uid)}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="font-semibold truncate max-w-[180px]">
                    {formatUserId(uid)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
                    {userData?.count || 0} messages · {userData?.lastTime ? toMessageTimeLabel(new Date(userData.lastTime).toISOString()) : ''}
                  </div>
                </div>
              )}
            </div>
            {unreadCount > 0 && (
              <div className="min-w-6 h-6 px-2 rounded-full flex items-center justify-center bg-primary/70 text-primary-foreground text-xs font-medium">
                {unreadCount}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
