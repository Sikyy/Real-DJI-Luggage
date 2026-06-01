import type { CollectionConfig } from 'payload'

export const TeamMembers: CollectionConfig = {
  slug: 'team-members',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['name', 'role', 'sortOrder', 'isActive'],
    group: {
      en: 'About',
      zh: '关于',
    },
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Use this after image assets are migrated into Payload.',
      },
    },
    {
      name: 'externalImageUrl',
      type: 'text',
      admin: {
        description: 'Current Framer/CDN image URL used by the static site.',
      },
    },
    {
      name: 'imageAlt',
      type: 'text',
      required: true,
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  labels: {
    plural: {
      en: 'Team Members',
      zh: '团队成员',
    },
    singular: {
      en: 'Team Member',
      zh: '团队成员',
    },
  },
}
