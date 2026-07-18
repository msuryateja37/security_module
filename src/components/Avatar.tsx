import React from 'react';

interface AvatarProps {
  /** Object URL / data URL of the profile photo. Falls back to the initial when absent. */
  src?: string | null;
  /** Display name — its first letter is the fallback when there is no photo. */
  name: string;
  /** Alt text override (defaults to the name). */
  alt?: string;
}

/**
 * Renders the content of a circular avatar container: the profile photo when one
 * is available, otherwise the user's initial. Meant to be dropped inside an
 * existing `.profile-avatar` / `.pv-avatar-circle` style circle.
 */
export const Avatar: React.FC<AvatarProps> = ({ src, name, alt }) => {
  if (src) {
    return <img src={src} alt={alt || name} className="avatar-fill-img" />;
  }
  return <>{(name || '?').charAt(0).toUpperCase()}</>;
};
