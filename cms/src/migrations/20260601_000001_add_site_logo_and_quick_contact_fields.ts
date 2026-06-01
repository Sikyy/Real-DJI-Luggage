import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDB = MigrateUpArgs['db']

type ColumnChange = {
  column: string
  definition: string
  table: string
}

const columns: ColumnChange[] = [
  {
    table: 'site_settings',
    column: 'dark_logo_image_id',
    definition: 'INTEGER',
  },
  {
    table: 'site_settings',
    column: 'external_dark_logo_image_url',
    definition: 'TEXT',
  },
  {
    table: 'site_settings_locales',
    column: 'menu_contact_quick_contact_label',
    definition: 'TEXT',
  },
]

function identifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

async function getColumnNames(db: MigrationDB, table: string) {
  const result = await db.run(sql.raw(`PRAGMA table_info(${identifier(table)})`))

  return new Set(result.rows.map((row) => String(row.name)))
}

async function addColumnIfMissing(db: MigrationDB, { column, definition, table }: ColumnChange) {
  const columnNames = await getColumnNames(db, table)

  if (!columnNames.has(column)) {
    await db.run(sql.raw(`ALTER TABLE ${identifier(table)} ADD COLUMN ${identifier(column)} ${definition}`))
  }
}

async function dropColumnIfPresent(db: MigrationDB, { column, table }: ColumnChange) {
  const columnNames = await getColumnNames(db, table)

  if (columnNames.has(column)) {
    await db.run(sql.raw(`ALTER TABLE ${identifier(table)} DROP COLUMN ${identifier(column)}`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const column of columns) {
    await addColumnIfMissing(db, column)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const column of [...columns].reverse()) {
    await dropColumnIfPresent(db, column)
  }
}
