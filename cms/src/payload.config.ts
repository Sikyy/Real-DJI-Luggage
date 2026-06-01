import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { id } from '@payloadcms/translations/languages/id'
import { zh } from '@payloadcms/translations/languages/zh'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { JobPosts } from './collections/JobPosts'
import { ContactSubmissions } from './collections/ContactSubmissions'
import { Media } from './collections/Media'
import { NewsPosts } from './collections/NewsPosts'
import { TeamMembers } from './collections/TeamMembers'
import { Testimonials } from './collections/Testimonials'
import { TrustedLogos } from './collections/TrustedLogos'
import { Users } from './collections/Users'
import { AboutPage } from './globals/AboutPage'
import { CareersPage } from './globals/CareersPage'
import { ContactPage } from './globals/ContactPage'
import { HomePage } from './globals/HomePage'
import { NewsroomPage } from './globals/NewsroomPage'
import { PlatformPage } from './globals/PlatformPage'
import { ServicesPage } from './globals/ServicesPage'
import { SiteSettings } from './globals/SiteSettings'
import { withLocalizedContent } from './utilities/localizedContent'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    withLocalizedContent(Media),
    withLocalizedContent(TeamMembers),
    withLocalizedContent(TrustedLogos),
    withLocalizedContent(Testimonials),
    withLocalizedContent(NewsPosts),
    withLocalizedContent(JobPosts),
    ContactSubmissions,
  ],
  cors: [
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    'http://localhost:8767',
    'http://127.0.0.1:8767',
  ],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || 'file:./cms.db',
    },
  }),
  editor: lexicalEditor(),
  globals: [
    withLocalizedContent(SiteSettings),
    withLocalizedContent(HomePage),
    withLocalizedContent(AboutPage),
    withLocalizedContent(ServicesPage),
    withLocalizedContent(PlatformPage),
    withLocalizedContent(NewsroomPage),
    withLocalizedContent(CareersPage),
    withLocalizedContent(ContactPage),
  ],
  i18n: {
    fallbackLanguage: 'zh',
    supportedLanguages: {
      zh,
      en,
      id,
    },
  },
  localization: {
    defaultLocale: 'en',
    fallback: true,
    locales: [
      {
        code: 'en',
        label: 'English',
      },
      {
        code: 'id',
        label: 'Bahasa Indonesia',
      },
      {
        code: 'zh',
        label: '简体中文',
      },
    ],
  },
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
