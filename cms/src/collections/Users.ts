import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [],
  labels: {
    plural: {
      en: 'Users',
      zh: '用户',
    },
    singular: {
      en: 'User',
      zh: '用户',
    },
  },
}
