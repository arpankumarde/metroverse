import { useAnnouncement } from './announcements'

/**
 * A caption of whatever the platform PA is saying (PLAN.md §17).
 *
 * The announcements are spoken, but a browser that will not speak — or a
 * player with the sound off — should still be told which train is coming and
 * how long it will be, so the words are always on screen as well.
 */
export function AnnouncementCaption() {
  const announcement = useAnnouncement()
  if (!announcement) return null

  return (
    <div className="announcement" key={announcement.id}>
      <span className="announcement-source">Platform {announcement.platformNumber}</span>
      <span className="announcement-text">{announcement.text}</span>
    </div>
  )
}
