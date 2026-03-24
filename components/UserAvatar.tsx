import React from "react";
import type { Profile } from "@/lib/types";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";

function getInitials(profile: Profile): string {
  const first = profile.name?.[0];
  const last = profile.surname?.[0];
  if (first || last) return `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (profile.username) return profile.username.slice(0, 2).toUpperCase();
  return "?";
}

interface UserAvatarProps {
  profile: Profile;
  avatarUrls: Map<string, string>;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const UserAvatar: React.FC<UserAvatarProps> = React.memo(
  ({ profile, avatarUrls, size = "sm" }) => {
    const uri = profile.avatar_url
      ? avatarUrls.get(profile.avatar_url)
      : undefined;
    return (
      <Avatar size={size}>
        {uri ? (
          <AvatarImage source={{ uri }} />
        ) : (
          <AvatarFallbackText>{getInitials(profile)}</AvatarFallbackText>
        )}
      </Avatar>
    );
  },
);
UserAvatar.displayName = "UserAvatar";

export default UserAvatar;
