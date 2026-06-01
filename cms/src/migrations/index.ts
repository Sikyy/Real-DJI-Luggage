import * as migration_20260601_000001_add_site_logo_and_quick_contact_fields from './20260601_000001_add_site_logo_and_quick_contact_fields'

export const migrations = [
  {
    up: migration_20260601_000001_add_site_logo_and_quick_contact_fields.up,
    down: migration_20260601_000001_add_site_logo_and_quick_contact_fields.down,
    name: '20260601_000001_add_site_logo_and_quick_contact_fields',
  },
]
